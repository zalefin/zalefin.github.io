"""
zach lefin, as a DAG.

Nothing to import: any CamelCase name is an operator, so
make up your own. Edit, then compile (ctrl/cmd + enter) to
redraw the graph behind the page.
"""

with DAG(dag_id="zach_lefin", schedule="@continuous"):
    # the core
    agentic = AgenticOperator(task_id="agentic_engineering")
    gitlab = GitLabCIOperator(
        task_id="gitlab_ci",
        runners="self_hosted",
        executors=["docker", "shell"],
    )
    airflow = OrchestratorOperator(task_id="airflow")
    aws = CloudOperator(task_id="aws")
    linux = LinuxOperator(task_id="linux", level="expert")

    # the tools
    mcp = MCPServerOperator(task_id="mcp_servers")
    guardrails = GuardrailSensor(
        task_id="guardrails",
        layers=["steering", "hard_gates"],
    )
    acp = ACPClientOperator(
        task_id="acp_client",
        human_gated=True,
    )
    rag = ChromaOperator(task_id="retrieval")
    tests = UnitTestSensor(
        task_id="unit_tests",
        required_to_merge=True,
    )
    image = DockerBuildOperator(
        task_id="airflow_image",
        push_to="registry",
    )
    provider = AirflowProviderOperator(
        task_id="custom_provider",
        ships=["operators", "sensors"],
    )
    spark = SparkOperator(task_id="spark", speedup="48x")
    homelab = HomelabOperator(task_id="homelab")

    # the work
    nifi = NiFiOperator(
        task_id="nifi_migration",
        processors=2_000,
    )
    review = AgentJudgeSensor(task_id="agent_review")
    migration = MigrationOperator(
        task_id="airflow_migration",
        jobs=50_000,
        dags=300,
        manual_effort="-95%",
    )
    lakehouse = IcebergOperator(
        task_id="lakehouse",
        tb=250,
    )
    sso = IdentityOperator(
        task_id="sso",
        protocols=["saml", "oidc"],
    )
    alteryx = MigrationOperator(
        task_id="alteryx_migration",
        status="in_progress",
    )
    dag_pipeline = PipelineOperator(
        task_id="dag_pipeline",
        dags=300,
    )
    dev_env = DockerComposeOperator(task_id="dev_env")
    contracts = DataContractSensor(
        task_id="data_contracts",
        sources=20,
    )

    # the result
    lead = TeamLeadOperator(task_id="team_lead")
    mentoring = MentorOperator(
        task_id="mentoring",
        trained=45,
    )
    tf_provider = TerraformOperator(
        task_id="tf_provider",
        written_by="agent",
    )
    production = ReliabilitySensor(task_id="production")
    end_to_end = OwnershipOperator(task_id="end_to_end")

    agentic >> [mcp, guardrails, acp, rag]
    airflow >> provider
    aws >> spark
    linux >> homelab
    [mcp, acp, rag] >> nifi
    guardrails >> review
    [provider, linux] >> migration
    [spark, aws] >> lakehouse
    homelab >> sso
    [nifi, review] >> alteryx
    gitlab >> [tests, image]
    [migration, tests] >> dag_pipeline
    [migration, image] >> dev_env
    lakehouse >> contracts
    [nifi, alteryx] >> lead
    [migration, dev_env] >> mentoring
    alteryx >> tf_provider
    [dag_pipeline, contracts, sso] >> production
    [lead, mentoring, tf_provider, production] >> end_to_end

    # and everything feeds everything else
    aws >> sso
    airflow >> dev_env
    gitlab >> tf_provider
    guardrails >> nifi
    mcp >> alteryx
    [agentic, homelab] >> tf_provider
