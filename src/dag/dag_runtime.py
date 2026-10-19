"""Just enough of a DAG runtime to draw one.

DAG files run with DAG, TaskGroup, task, dag, task_group, chain,
cross_downstream and Label already defined, so they need no imports. Any other
CamelCase name is an operator: `Anything(task_id="x")` adds a task, and `>>`
and `<<` wire tasks together, as in Airflow. Nothing here runs a task.

`compile_dag(source)` executes a DAG file and returns its graph as JSON.
"""

import builtins
import functools
import json
import traceback

DAG_FILE = "zachlef_in.py"


class DagException(Exception):
    pass


class DuplicateTaskIdFound(DagException):
    pass


class DagCycleException(DagException):
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
                raise DagException(
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


def _qualify(task_id, group):
    return f"{group.group_id}.{task_id}" if group and group.prefix else task_id


class BaseOperator(_DependencyMixin):
    _display_name = None

    def __init__(self, *args, task_id=None, dag=None, task_group=None, **kwargs):
        if args:
            raise DagException("Use keyword arguments when initializing operators")
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

    @classmethod
    def partial(cls, **kwargs):
        return _PartialOperator(cls, kwargs)

    def __repr__(self):
        return f"<Task({self.operator_name}): {self.task_id}>"


class _PartialOperator:
    def __init__(self, cls, kwargs):
        self._cls = cls
        self._kwargs = kwargs

    def expand(self, **kwargs):
        return self._cls(**self._kwargs)


_operators = {}


def _operator_class(name):
    """The operator class for a CamelCase name, made on first use."""
    if name not in _operators:
        _operators[name] = type(name, (BaseOperator,), {})
    return _operators[name]


class TaskGroup(_DependencyMixin):
    def __init__(
        self, group_id=None, *args, dag=None, parent_group=None, prefix_group_id=True
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

    def __call__(self, *args, **kwargs):
        dag = _current_dag()
        group = _current_group()
        base = self._kwargs.get("task_id") or self._fn.__name__
        task_id, n = base, 0
        # Calling the same @task twice gives it a suffix, as in Airflow.
        while dag is not None and _qualify(task_id, group) in dag.tasks:
            n += 1
            task_id = f"{base}__{n}"
        op = type("_DecoratedOperator", (BaseOperator,), {"_display_name": self._display})(
            task_id=task_id
        )
        for ref in _upstream_refs([args, kwargs]):
            _link(ref, op)
        return op

    def expand(self, **kwargs):
        return self(**kwargs)


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
        # @task.bash, @task.branch, ...
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
                raise DagException(
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


# Compiling --------------------------------------------------------------------

_PRELUDE = {
    "DAG": DAG,
    "TaskGroup": TaskGroup,
    "Label": Label,
    "task": task,
    "dag": dag,
    "task_group": task_group,
    "chain": chain,
    "cross_downstream": cross_downstream,
}


class _Namespace(dict):
    """A DAG file's globals: the prelude, plus any undefined CamelCase name
    as an operator class."""

    def __missing__(self, name):
        if hasattr(builtins, name) or not name[:1].isupper():
            raise KeyError(name)
        self[name] = _operator_class(name)
        return self[name]


def _check_cycles(the_dag):
    downstream = {task_id: [] for task_id in the_dag.tasks}
    for up, down in the_dag.edges:
        downstream[up].append(down)
    visiting, done = set(), set()

    def visit(task_id):
        if task_id in done:
            return
        if task_id in visiting:
            raise DagCycleException(
                f"Cycle detected in DAG: {the_dag.dag_id}. Faulty task: {task_id}"
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
        exec(code, _Namespace(_PRELUDE, __name__="zachlef_in", __file__=DAG_FILE))
        if not _state.dags:
            raise DagException(
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
