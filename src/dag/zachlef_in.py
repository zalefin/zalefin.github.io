"""
The DAG behind zachlef.in.

Edit it and press compile (ctrl/cmd + enter). Pyodide runs
this file in your browser against a stubbed-out airflow, and
the graph is redrawn from the DAG it defines.
"""

from datetime import datetime

from airflow.sdk import DAG, TaskGroup, task
from airflow.providers.amazon.aws.operators.athena import (
    AthenaOperator,
)
from airflow.providers.amazon.aws.operators.emr import (
    EmrAddStepsOperator,
)
from airflow.providers.amazon.aws.sensors.emr import (
    EmrStepSensor,
)
from airflow.providers.amazon.aws.sensors.s3 import (
    S3KeySensor,
)
from airflow.providers.common.sql.operators.sql import (
    SQLCheckOperator,
)
from airflow.providers.http.operators.http import (
    HttpOperator,
)
from airflow.providers.standard.operators.empty import (
    EmptyOperator,
)

with DAG(
    dag_id="zachlef_in",
    schedule="@daily",
    start_date=datetime(2022, 5, 1),
    catchup=False,
    tags=["data-platform", "agentic"],
):
    start = EmptyOperator(task_id="start")

    landed = S3KeySensor(
        task_id="s3_landed",
        bucket_key="s3://raw/events/{{ ds }}/_SUCCESS",
    )

    nifi = HttpOperator(
        task_id="nifi_ingest",
        endpoint="nifi-api/process-groups/ingest",
        method="PUT",
    )

    @task
    def extract():
        """Pull the day's records from upstream systems."""

    @task
    def validate(records):
        """Check every record against its data contract."""

    with TaskGroup("spark") as spark:
        submit = EmrAddStepsOperator(
            task_id="submit",
            job_flow_id="{{ var.value.emr_cluster }}",
        )
        wait = EmrStepSensor(
            task_id="wait",
            job_flow_id="{{ var.value.emr_cluster }}",
            step_id="{{ ti.xcom_pull('spark.submit')[0] }}",
        )
        submit >> wait

    @task
    def iceberg_merge():
        """MERGE INTO the Iceberg tables; schemas evolve."""

    with TaskGroup("checks") as checks:
        for check in ("row_counts", "freshness", "contracts"):
            SQLCheckOperator(task_id=check, sql=f"{check}.sql")

    athena = AthenaOperator(
        task_id="athena_refresh",
        query="MSCK REPAIR TABLE events",
        database="analytics",
    )

    @task
    def agent_review():
        """An agent flags anomalies; a human gates fixes."""

    @task
    def publish():
        """Ship it."""

    raw = extract()
    start >> [landed, nifi]
    landed >> raw
    checked = validate(raw)
    nifi >> checked
    checked >> spark >> iceberg_merge() >> checks
    checks >> [athena, agent_review()] >> publish()
