"""
zach lefin, as a DAG.

Nothing to import: any CamelCase name is an operator, so
make up your own. Edit, then compile (ctrl/cmd + enter) to
redraw the graph behind the page.
"""

with DAG(dag_id="zach_lefin", schedule="@continuous"):
    # the core
    agentic = AgenticOperator(task_id="agentic_engineering")
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
    ci_cd = PipelineOperator(task_id="ci_cd")
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
    [migration, homelab] >> ci_cd
    migration >> dev_env
    lakehouse >> contracts
    [nifi, alteryx] >> lead
    [migration, dev_env] >> mentoring
    alteryx >> tf_provider
    [ci_cd, contracts, sso] >> production
    [lead, mentoring, tf_provider, production] >> end_to_end

    # and everything feeds everything else
    aws >> sso
    airflow >> dev_env
    linux >> ci_cd
    guardrails >> nifi
    mcp >> alteryx
    [agentic, homelab] >> tf_provider
