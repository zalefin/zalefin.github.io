"""A stand-in for the `airflow` package, just enough to build a DAG's shape.

Every `airflow.*` import resolves to a stub module, so real import paths work
unchanged. Known names (DAG, task, TaskGroup, chain, ...) record tasks and
their dependencies; any other *Operator or *Sensor name becomes a generic
operator class, which covers the provider packages. Nothing here runs a task.

`compile_dag(source)` executes a DAG file against these stubs and returns its
graph as JSON.
"""

import functools
import importlib.abc
import importlib.machinery
import json
import sys
import traceback
import types

DAG_FILE = "zachlef_in.py"


class AirflowException(Exception):
    pass


class AirflowSkipException(AirflowException):
    pass


class DuplicateTaskIdFound(AirflowException):
    pass


class AirflowDagCycleException(AirflowException):
    pass


class _State:
    def __init__(self):
        self.dags = []
        self.dag_stack = []
        self.group_stack = []


_state = _State()


def _current_dag():
    return _state.dag_stack[-1] if _state.dag_stack else None


def _current_group():
    return _state.group_stack[-1] if _state.group_stack else None


# Dependencies -----------------------------------------------------------------


def _ends(obj, which):
    """The tasks at one end ("roots" or "leaves") of obj."""
    if isinstance(obj, (list, tuple, set)):
        return [t for item in obj for t in _ends(item, which)]
    if isinstance(obj, BaseOperator):
        return [obj]
    if isinstance(obj, TaskGroup):
        return obj._ends(which)
    raise TypeError(
        f"can't set a dependency on {type(obj).__name__!r}; "
        "expected a task, a TaskGroup or a list of them"
    )


def _link(upstream, downstream):
    for up in _ends(upstream, "leaves"):
        for down in _ends(downstream, "roots"):
            if up.dag is None or up.dag is not down.dag:
                raise AirflowException(
                    "Tried to set relationships between tasks in more than "
                    f"one DAG: {up.task_id!r} and {down.task_id!r}"
                )
            up.dag._add_edge(up, down)


class _DependencyMixin:
    def __rshift__(self, other):
        _link(self, other)
        return other

    def __lshift__(self, other):
        _link(other, self)
        return other

    def __rrshift__(self, other):
        # [a, b] >> self
        _link(other, self)
        return self

    def __rlshift__(self, other):
        # [a, b] << self
        _link(self, other)
        return self

    def set_downstream(self, other):
        _link(self, other)

    def set_upstream(self, other):
        _link(other, self)


# DAGs, tasks and groups -------------------------------------------------------


class DAG:
    def __init__(self, dag_id=None, *args, **kwargs):
        if dag_id is None:
            raise TypeError("DAG() missing required argument: 'dag_id'")
        self.dag_id = dag_id
        self.tasks = {}
        self.edges = []
        self._edge_set = set()
        _state.dags.append(self)

    def __enter__(self):
        _state.dag_stack.append(self)
        return self

    def __exit__(self, *exc):
        _state.dag_stack.pop()
        return False

    def _add_task(self, task):
        if task.task_id in self.tasks:
            raise DuplicateTaskIdFound(
                f"Task id {task.task_id!r} has already been added to the DAG"
            )
        self.tasks[task.task_id] = task

    def _add_edge(self, up, down):
        key = (up.task_id, down.task_id)
        if key not in self._edge_set:
            self._edge_set.add(key)
            self.edges.append(key)

    def test(self, *args, **kwargs):
        return None


def _qualify(task_id, group):
    return f"{group.group_id}.{task_id}" if group and group.prefix else task_id


class BaseOperator(_DependencyMixin):
    _display_name = None

    def __init__(self, *args, task_id=None, dag=None, task_group=None, **kwargs):
        if args:
            raise AirflowException(
                "Use keyword arguments when initializing operators"
            )
        if task_id is None:
            raise TypeError(
                f"{type(self).__name__}() missing required keyword "
                "argument: 'task_id'"
            )
        group = task_group or _current_group()
        self.task_id = _qualify(task_id, group)
        self.operator_name = self._display_name or type(self).__name__
        self.dag = dag or (group.dag if group else None) or _current_dag()
        if self.dag is not None:
            self.dag._add_task(self)
        if group is not None:
            group._children.append(self)

    @property
    def output(self):
        return self

    @classmethod
    def partial(cls, **kwargs):
        return _PartialOperator(cls, kwargs)

    def __repr__(self):
        return f"<Task({self.operator_name}): {self.task_id}>"


class BaseSensorOperator(BaseOperator):
    pass


class _PartialOperator:
    def __init__(self, cls, kwargs):
        self._cls = cls
        self._kwargs = kwargs

    def expand(self, **kwargs):
        return self._cls(**self._kwargs)

    expand_kwargs = expand


class TaskGroup(_DependencyMixin):
    def __init__(
        self,
        group_id=None,
        *args,
        dag=None,
        parent_group=None,
        prefix_group_id=True,
        **kwargs,
    ):
        if group_id is None:
            raise TypeError("TaskGroup() missing required argument: 'group_id'")
        parent = parent_group or _current_group()
        self.prefix = prefix_group_id
        self.group_id = _qualify(group_id, parent)
        self.dag = dag or (parent.dag if parent else None) or _current_dag()
        self._children = []
        if parent is not None:
            parent._children.append(self)

    def __enter__(self):
        _state.group_stack.append(self)
        return self

    def __exit__(self, *exc):
        _state.group_stack.pop()
        return False

    def _tasks(self):
        tasks = []
        for child in self._children:
            tasks.extend(child._tasks() if isinstance(child, TaskGroup) else [child])
        return tasks

    def _ends(self, which):
        tasks = self._tasks()
        ids = {t.task_id for t in tasks}
        edges = self.dag.edges if self.dag else []
        if which == "roots":
            inner = {down for up, down in edges if up in ids and down in ids}
        else:
            inner = {up for up, down in edges if up in ids and down in ids}
        return [t for t in tasks if t.task_id not in inner]


class Label:
    """An edge label: `a >> Label("why") >> b`."""

    def __init__(self, label):
        self.label = label
        self._upstream = []

    def __rrshift__(self, other):
        self._upstream.append(other)
        return self

    def __rshift__(self, other):
        for up in self._upstream:
            _link(up, other)
        return other


# Decorators -------------------------------------------------------------------


class _DecoratedOperator(BaseOperator):
    pass


def _upstream_refs(value):
    if isinstance(value, (BaseOperator, TaskGroup)):
        return [value]
    if isinstance(value, (list, tuple, set)):
        return [ref for item in value for ref in _upstream_refs(item)]
    if isinstance(value, dict):
        return [ref for item in value.values() for ref in _upstream_refs(item)]
    return []


class _DecoratedTask:
    def __init__(self, fn, display, kwargs):
        functools.update_wrapper(self, fn)
        self._fn = fn
        self._display = display
        self._kwargs = kwargs

    def override(self, **kwargs):
        return _DecoratedTask(self._fn, self._display, {**self._kwargs, **kwargs})

    def partial(self, **kwargs):
        return self

    def __call__(self, *args, **kwargs):
        dag = _current_dag()
        group = _current_group()
        base = self._kwargs.get("task_id") or self._fn.__name__
        task_id, n = base, 0
        # Calling the same @task twice gives it a suffix, as in Airflow.
        while dag is not None and _qualify(task_id, group) in dag.tasks:
            n += 1
            task_id = f"{base}__{n}"
        op = type(
            "_DecoratedOperator",
            (_DecoratedOperator,),
            {"_display_name": self._display},
        )(task_id=task_id)
        for ref in _upstream_refs([args, kwargs]):
            _link(ref, op)
        return op

    def expand(self, **kwargs):
        return self(**kwargs)

    expand_kwargs = expand


class _TaskDecorator:
    def __init__(self, display="@task", kwargs=None):
        self._display = display
        self._kwargs = kwargs or {}

    def __call__(self, python_callable=None, **kwargs):
        if python_callable is None:
            # @task(...) with arguments
            return _TaskDecorator(self._display, {**self._kwargs, **kwargs})
        return _DecoratedTask(python_callable, self._display, self._kwargs)

    def __getattr__(self, name):
        # @task.bash, @task.branch, @task.virtualenv, ...
        if name.startswith("__"):
            raise AttributeError(name)
        return _TaskDecorator(f"@task.{name}", self._kwargs)


task = _TaskDecorator()


def _decorator_factory(build):
    """Support both @decorator and @decorator(...)."""

    def decorator(fn=None, *args, **kwargs):
        if callable(fn):
            return build(fn, {})
        if fn is not None:
            kwargs = {"id": fn, **kwargs}
        return lambda f: build(f, kwargs)

    return decorator


def _build_dag(fn, kwargs):
    @functools.wraps(fn)
    def build(*args, **call_kwargs):
        dag_id = kwargs.get("dag_id") or kwargs.get("id") or fn.__name__
        with DAG(dag_id) as new_dag:
            fn(*args, **call_kwargs)
        return new_dag

    return build


def _build_task_group(fn, kwargs):
    @functools.wraps(fn)
    def build(*args, **call_kwargs):
        group_id = kwargs.get("group_id") or kwargs.get("id") or fn.__name__
        with TaskGroup(group_id) as group:
            fn(*args, **call_kwargs)
        return group

    return build


dag = _decorator_factory(_build_dag)
task_group = _decorator_factory(_build_task_group)


def chain(*tasks):
    for up, down in zip(tasks, tasks[1:]):
        if isinstance(up, (list, tuple)) and isinstance(down, (list, tuple)):
            if len(up) != len(down):
                raise AirflowException(
                    "Chain not supported for different length Iterable. "
                    f"Got {len(up)} and {len(down)}."
                )
            for u, d in zip(up, down):
                _link(u, d)
        else:
            _link(up, down)


def cross_downstream(from_tasks, to_tasks):
    for up in from_tasks:
        _link(up, to_tasks)


class Variable:
    @staticmethod
    def get(key, default_var=None, **kwargs):
        return default_var if default_var is not None else f"{{{{ var.value.{key} }}}}"


def days_ago(n, *args, **kwargs):
    import datetime

    return datetime.datetime.now() - datetime.timedelta(days=n)


def get_current_context():
    return {}


# Stub modules -----------------------------------------------------------------


class _OpaqueMeta(type):
    def __getattr__(cls, name):
        if name.startswith("__"):
            raise AttributeError(name)
        return f"{cls.__name__}.{name}"


class _Opaque(metaclass=_OpaqueMeta):
    """Any other airflow class (Param, Asset, TriggerRule, ...): accepts
    anything, does nothing."""

    def __init__(self, *args, **kwargs):
        pass

    def __getattr__(self, name):
        if name.startswith("__"):
            raise AttributeError(name)
        return _Opaque()

    def __call__(self, *args, **kwargs):
        return _Opaque()


_EXPORTS = {
    "DAG": DAG,
    "dag": dag,
    "task": task,
    "task_group": task_group,
    "TaskGroup": TaskGroup,
    "chain": chain,
    "cross_downstream": cross_downstream,
    "BaseOperator": BaseOperator,
    "BaseSensorOperator": BaseSensorOperator,
    "Label": Label,
    "Variable": Variable,
    "days_ago": days_ago,
    "get_current_context": get_current_context,
    "AirflowException": AirflowException,
    "AirflowSkipException": AirflowSkipException,
    "DuplicateTaskIdFound": DuplicateTaskIdFound,
    "AirflowDagCycleException": AirflowDagCycleException,
}

_generated = {}


def _stub_class(module, name):
    key = (module, name)
    if key not in _generated:
        if name.endswith(("Operator", "Sensor")):
            base = BaseOperator
        elif name.endswith(("Exception", "Error")):
            base = AirflowException
        else:
            base = _Opaque
        _generated[key] = type(name, (base,), {"__module__": module})
    return _generated[key]


class _StubModule(types.ModuleType):
    def __getattr__(self, name):
        if name.startswith("__"):
            raise AttributeError(name)
        if name in _EXPORTS:
            return _EXPORTS[name]
        if name[:1].isupper():
            return _stub_class(self.__name__, name)
        # Lowercase names fall through to the import system, which then
        # imports them as stub submodules.
        raise AttributeError(f"module {self.__name__!r} has no attribute {name!r}")


class _AirflowFinder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def find_spec(self, fullname, path, target=None):
        if fullname == "airflow" or fullname.startswith("airflow."):
            return importlib.machinery.ModuleSpec(fullname, self, is_package=True)
        return None

    def create_module(self, spec):
        return _StubModule(spec.name)

    def exec_module(self, module):
        pass


if not any(isinstance(f, _AirflowFinder) for f in sys.meta_path):
    sys.meta_path.insert(0, _AirflowFinder())


# Compiling --------------------------------------------------------------------


def _check_cycles(the_dag):
    downstream = {task_id: [] for task_id in the_dag.tasks}
    for up, down in the_dag.edges:
        downstream[up].append(down)
    visiting, done = set(), set()

    def visit(task_id):
        if task_id in done:
            return
        if task_id in visiting:
            raise AirflowDagCycleException(
                f"Cycle detected in DAG: {the_dag.dag_id}. "
                f"Faulty task: {task_id}"
            )
        visiting.add(task_id)
        for child in downstream[task_id]:
            visit(child)
        visiting.discard(task_id)
        done.add(task_id)

    for task_id in the_dag.tasks:
        visit(task_id)


def _describe(exc):
    if isinstance(exc, SyntaxError) and exc.filename == DAG_FILE:
        return {"error": f"SyntaxError: {exc.msg}", "line": exc.lineno}
    frames = [
        f for f in traceback.extract_tb(exc.__traceback__) if f.filename == DAG_FILE
    ]
    return {
        "error": f"{type(exc).__name__}: {exc}",
        "line": frames[-1].lineno if frames else None,
    }


def compile_dag(source):
    _state.__init__()
    try:
        code = compile(source, DAG_FILE, "exec")
        exec(code, {"__name__": "zachlef_in", "__file__": DAG_FILE})
        if not _state.dags:
            raise AirflowException(
                "no DAG found: create one with `with DAG(...):`, "
                "or call your @dag function"
            )
        the_dag = next((d for d in reversed(_state.dags) if d.tasks), _state.dags[-1])
        _check_cycles(the_dag)
        return json.dumps(
            {
                "ok": True,
                "dagId": the_dag.dag_id,
                "tasks": [
                    {"id": t.task_id, "operator": t.operator_name}
                    for t in the_dag.tasks.values()
                ],
                "edges": [list(edge) for edge in the_dag.edges],
            }
        )
    except Exception as exc:
        return json.dumps({"ok": False, **_describe(exc)})
