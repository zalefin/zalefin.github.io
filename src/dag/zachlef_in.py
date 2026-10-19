"""
zach lefin, as a DAG.

Nothing to import: any CamelCase name is an operator, so
make up your own. Edit, then compile (ctrl/cmd + enter) to
redraw the graph behind the page.
"""

with DAG(dag_id="zach_lefin", schedule="@continuous"):
    # foundations
    tinkering = CuriositySensor(task_id="tinkering")
    degree = DegreeOperator(
        task_id="cs_degree",
        school="CU Boulder",
    )
    linux = LinuxOperator(task_id="linux")
    systems = CourseworkOperator(
        task_id="c_systems",
        built=["shell", "malloc", "http_server"],
    )
    lead = TeamLeadOperator(task_id="team_lead", app="Poke")

    # the work
    integrations = WebhookOperator(task_id="integrations")
    homelab = HomelabOperator(
        task_id="homelab",
        sso="authentik",
    )
    migration = MigrationOperator(
        task_id="airflow_migration",
        jobs=50_000,
        dags=300,
    )
    ci_cd = PipelineOperator(task_id="ci_cd")
    platform = LakehouseOperator(
        task_id="data_platform",
        tb=250,
    )
    spark = SparkOperator(
        task_id="spark_tuning",
        speedup="48x",
    )
    mentoring = MentorOperator(task_id="mentoring")

    # now
    guardrails = GuardrailSensor(task_id="guardrails")
    mcp = MCPServerOperator(task_id="mcp_servers")
    agents = AgentOperator(
        task_id="agents",
        human_gated=True,
    )
    here = YouAreHereOperator(task_id="agentic_engineer")

    tinkering >> linux >> homelab >> [ci_cd, guardrails]
    degree >> [systems, lead]
    systems >> homelab
    lead >> integrations >> migration
    linux >> migration >> [ci_cd, platform, mentoring]
    platform >> spark
    [ci_cd, spark] >> mcp
    [mcp, guardrails] >> agents
    [agents, mentoring] >> here
