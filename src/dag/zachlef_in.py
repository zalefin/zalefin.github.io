"""
zach lefin, as a DAG.

Nothing to import: any CamelCase name is an operator, so
make up your own. Edit, then compile (ctrl/cmd + enter) to
redraw the graph behind the page.
"""

with DAG(dag_id="zach_lefin", schedule="@continuous"):
    # foundations
    tinkering = CuriositySensor(task_id="tinkering")
    dotfiles = DotfilesOperator(
        task_id="dotfiles",
        wm="dwm",
    )
    plugins = MinecraftPluginOperator(
        task_id="mc_plugins",
        lang="java",
    )
    linux = LinuxOperator(task_id="linux")
    degree = DegreeOperator(
        task_id="cs_degree",
        school="CU Boulder",
    )
    shell = ShellOperator(task_id="unix_shell", lang="c")
    malloc = AllocatorOperator(task_id="malloc", lang="c")
    http = HttpServerOperator(
        task_id="http_server",
        threads=True,
    )
    lead = TeamLeadOperator(task_id="team_lead", app="Poke")
    tutoring = TutorOperator(task_id="tutoring")

    # the work
    integrations = WebhookOperator(
        task_id="integrations",
        framework="django",
    )
    homelab = HomelabOperator(
        task_id="homelab",
        sso="authentik",
    )
    sso_cli = SamlOperator(task_id="sso_cli", cloud="aws")
    provider = AirflowProviderOperator(
        task_id="custom_provider",
        ships=["operators", "sensors"],
    )
    migration = MigrationOperator(
        task_id="airflow_migration",
        jobs=50_000,
        dags=300,
    )
    dev_env = DockerComposeOperator(task_id="dev_env")
    ci_cd = PipelineOperator(task_id="ci_cd")
    platform = LakehouseOperator(
        task_id="data_platform",
        tb=250,
    )
    spark = SparkOperator(
        task_id="spark_tuning",
        speedup="48x",
    )
    contracts = DataContractSensor(
        task_id="data_contracts",
        sources=20,
    )
    mentoring = MentorOperator(task_id="mentoring")

    # now
    nifi = NiFiOperator(
        task_id="nifi_migration",
        processors=2_000,
    )
    guardrails = GuardrailSensor(task_id="guardrails")
    review = AgentJudgeSensor(task_id="agent_review")
    mcp = MCPServerOperator(task_id="mcp_servers")
    rag = ChromaOperator(task_id="retrieval")
    agents = AgentOperator(
        task_id="agents",
        human_gated=True,
    )
    here = YouAreHereOperator(task_id="agentic_engineer")

    tinkering >> [dotfiles, plugins]
    degree >> [shell, malloc, http, lead]
    [dotfiles, shell] >> linux
    [plugins, degree] >> lead
    [lead, http] >> integrations
    linux >> [homelab, provider]
    homelab >> [sso_cli, ci_cd, guardrails]
    [integrations, provider] >> migration
    migration >> [dev_env, ci_cd, platform, mentoring]
    [lead, tutoring] >> mentoring
    [platform, malloc] >> spark
    platform >> contracts
    [dev_env, contracts] >> nifi
    sso_cli >> guardrails >> review
    nifi >> [mcp, rag]
    [ci_cd, spark] >> mcp
    [mcp, rag, review] >> agents
    [agents, mentoring] >> here
