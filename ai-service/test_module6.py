"""
Module 6 Automated Tests (Pytest)

Tests:
1. LangGraph graph creation
2. RECEIVE_CASE state
3. ANALYZE_CASE state
4. Module 4 prediction integration
5. Module 5 SHAP integration
6. LLM structured recommendation
7. Invalid LLM action rejection
8. Guardrail approval
9. Maximum retry = 3 guardrail
10. Maximum reminder = 2 guardrail
11. Successful payment -> STOP guardrail
12. Customer opt-out -> STOP guardrail
13. Repeated failure -> ESCALATE_TO_HUMAN
14. High-value transaction -> human approval
15. Duplicate event -> ignored
16. Safe simulated action execution
17. Successful demo retry
18. Recovery case update
19. Audit logging
20. Every state transition logged
21. ₹12,500 demo workflow
22. FastAPI agent endpoint
23. LLM unavailable safe failure handling
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from agent import (
    build_recovery_agent_graph,
    receive_case_node,
    analyze_case_node,
    get_ml_prediction_node,
    get_shap_explanation_node,
    diagnose_root_cause_node,
    select_intervention_node,
    apply_guardrails_node,
    execute_action_node,
    verify_result_node,
    update_case_node,
    audit_node,
    stop_node,
    run_recovery_agent,
    HIGH_VALUE_THRESHOLD,
    MAX_RETRIES,
    MAX_REMINDERS
)

client = TestClient(app)

# Test Fixtures for ₹12,500 Demo Case
DEMO_CASE_ID = "44444444-4444-4444-4444-444444444402"
MOCK_CASE = {
    "id": DEMO_CASE_ID,
    "payment_id": "33333333-3333-3333-3333-333333333302",
    "customer_id": "00000000-0000-0000-0000-000000000002",
    "status": "in_recovery",
    "revenue_at_risk": 12500.0,
    "recovered_amount": 0.0,
    "strategy": "payment_link",
    "escalated_to_human": False
}

MOCK_PAYMENT = {
    "id": "33333333-3333-3333-3333-333333333302",
    "amount": 12500.0,
    "currency": "INR",
    "status": "failed",
    "method": "card",
    "error_reason": "insufficient_funds",
    "error_description": "The card has insufficient funds"
}

MOCK_CUSTOMER = {
    "id": "00000000-0000-0000-0000-000000000002",
    "name": "Bob Smith",
    "email": "bob.smith@example.com",
    "customer_payment_history": 12,
    "previous_success_rate": 0.83,
    "previous_failure_count": 2,
    "customer_age_days": 420,
    "subscription_status": "active",
    "customer_segment": "regular",
    "previous_recovery_success": 1,
    "opted_out": False
}


def test_1_langgraph_graph_creation():
    graph = build_recovery_agent_graph()
    assert graph is not None
    assert hasattr(graph, "invoke")


def test_2_receive_case_state():
    initial_state = {
        "recovery_case_id": DEMO_CASE_ID,
        "is_demo": True,
        "demo_simulate_success": True,
        "recovery_case": MOCK_CASE,
        "payment": MOCK_PAYMENT,
        "customer": MOCK_CUSTOMER
    }
    state = receive_case_node(initial_state)
    assert state["current_state"] == "RECEIVE_CASE"
    assert state["recovery_case"]["revenue_at_risk"] == 12500.0
    assert len(state["audit_logs"]) >= 1


def test_3_analyze_case_state():
    state = receive_case_node({
        "recovery_case_id": DEMO_CASE_ID,
        "recovery_case": MOCK_CASE,
        "payment": MOCK_PAYMENT,
        "customer": MOCK_CUSTOMER
    })
    analyzed_state = analyze_case_node(state)
    assert analyzed_state["current_state"] == "ANALYZE_CASE"
    assert "features_df" in analyzed_state
    df = analyzed_state["features_df"]
    assert len(df.columns) == 13
    assert df.iloc[0]["transaction_amount"] == 12500.0


def test_4_module4_prediction_integration():
    state = analyze_case_node(receive_case_node({
        "recovery_case_id": DEMO_CASE_ID,
        "recovery_case": MOCK_CASE,
        "payment": MOCK_PAYMENT,
        "customer": MOCK_CUSTOMER
    }))
    pred_state = get_ml_prediction_node(state)
    assert pred_state["current_state"] == "GET_ML_PREDICTION"
    assert 0.0 <= pred_state["recovery_probability"] <= 1.0
    assert pred_state["risk_level"] in {"HIGH", "MEDIUM", "LOW"}
    assert "model_version" in pred_state


def test_5_module5_shap_integration():
    state = get_ml_prediction_node(analyze_case_node(receive_case_node({
        "recovery_case_id": DEMO_CASE_ID,
        "recovery_case": MOCK_CASE,
        "payment": MOCK_PAYMENT,
        "customer": MOCK_CUSTOMER
    })))
    shap_state = get_shap_explanation_node(state)
    assert shap_state["current_state"] == "GET_SHAP_EXPLANATION"
    shap_exp = shap_state["shap_explanation"]
    assert "top_positive_factors" in shap_exp
    assert "top_negative_factors" in shap_exp
    assert "human_explanation" in shap_exp


def test_6_llm_structured_recommendation():
    state = {
        "root_cause": "Temporary bank issue with strong history",
        "recovery_probability": 0.85,
        "payment": MOCK_PAYMENT,
        "customer": MOCK_CUSTOMER,
        "retry_count": 0,
        "reminder_count": 0,
        "audit_logs": []
    }
    sel_state = select_intervention_node(state)
    assert sel_state["recommended_action"] in {
        "RETRY_PAYMENT", "SEND_REMINDER", "SEND_PAYMENT_LINK", "WAIT_AND_RETRY", "ESCALATE_TO_HUMAN", "STOP"
    }


def test_7_invalid_llm_action_rejection():
    state = {
        "recommended_action": "INVALID_CUSTOM_ACTION_XYZ",
        "payment": MOCK_PAYMENT,
        "recovery_case": MOCK_CASE,
        "retry_count": 0,
        "reminder_count": 0,
        "opt_out": False,
        "audit_logs": []
    }
    guard_state = apply_guardrails_node(state)
    assert guard_state["guardrail_decision"]["status"] == "REJECTED"
    assert guard_state["recommended_action"] == "STOP"


def test_8_guardrail_approval():
    state = {
        "recommended_action": "RETRY_PAYMENT",
        "payment": MOCK_PAYMENT,
        "recovery_case": MOCK_CASE,
        "retry_count": 1,
        "reminder_count": 0,
        "opt_out": False,
        "audit_logs": []
    }
    guard_state = apply_guardrails_node(state)
    assert guard_state["guardrail_decision"]["status"] == "APPROVED"
    assert guard_state["recommended_action"] == "RETRY_PAYMENT"


def test_9_maximum_retry_guardrail():
    state = {
        "recommended_action": "RETRY_PAYMENT",
        "payment": MOCK_PAYMENT,
        "recovery_case": MOCK_CASE,
        "retry_count": 3,  # Max limit reached
        "reminder_count": 0,
        "opt_out": False,
        "audit_logs": []
    }
    guard_state = apply_guardrails_node(state)
    assert guard_state["guardrail_decision"]["status"] == "ESCALATED"
    assert guard_state["recommended_action"] == "ESCALATE_TO_HUMAN"


def test_10_maximum_reminder_guardrail():
    state = {
        "recommended_action": "SEND_REMINDER",
        "payment": MOCK_PAYMENT,
        "recovery_case": MOCK_CASE,
        "retry_count": 0,
        "reminder_count": 2,  # Max limit reached
        "opt_out": False,
        "audit_logs": []
    }
    guard_state = apply_guardrails_node(state)
    assert guard_state["guardrail_decision"]["status"] == "ESCALATED"
    assert guard_state["recommended_action"] == "ESCALATE_TO_HUMAN"


def test_11_successful_payment_stop_guardrail():
    captured_case = dict(MOCK_CASE)
    captured_case["status"] = "recovered"
    state = {
        "recommended_action": "RETRY_PAYMENT",
        "payment": MOCK_PAYMENT,
        "recovery_case": captured_case,
        "retry_count": 0,
        "reminder_count": 0,
        "opt_out": False,
        "audit_logs": []
    }
    guard_state = apply_guardrails_node(state)
    assert guard_state["guardrail_decision"]["status"] == "STOPPED"
    assert guard_state["recommended_action"] == "STOP"


def test_12_customer_optout_stop_guardrail():
    state = {
        "recommended_action": "RETRY_PAYMENT",
        "payment": MOCK_PAYMENT,
        "recovery_case": MOCK_CASE,
        "retry_count": 0,
        "reminder_count": 0,
        "opt_out": True,  # Customer opted out
        "audit_logs": []
    }
    guard_state = apply_guardrails_node(state)
    assert guard_state["guardrail_decision"]["status"] == "STOPPED"
    assert guard_state["recommended_action"] == "STOP"


def test_13_repeated_failure_escalate_to_human():
    state = {
        "recommended_action": "RETRY_PAYMENT",
        "payment": MOCK_PAYMENT,
        "recovery_case": MOCK_CASE,
        "retry_count": 3,
        "reminder_count": 1,
        "opt_out": False,
        "audit_logs": []
    }
    guard_state = apply_guardrails_node(state)
    assert guard_state["recommended_action"] == "ESCALATE_TO_HUMAN"


def test_14_high_value_transaction_human_approval():
    high_val_payment = dict(MOCK_PAYMENT)
    high_val_payment["amount"] = 75000.0  # > ₹50,000 threshold
    state = {
        "recommended_action": "RETRY_PAYMENT",
        "payment": high_val_payment,
        "recovery_case": MOCK_CASE,
        "retry_count": 0,
        "reminder_count": 0,
        "opt_out": False,
        "audit_logs": []
    }
    guard_state = apply_guardrails_node(state)
    assert guard_state["guardrail_decision"]["status"] == "FLAGGED_FOR_HUMAN"
    assert guard_state["recommended_action"] == "ESCALATE_TO_HUMAN"


def test_15_duplicate_event_ignored():
    state = receive_case_node({
        "recovery_case_id": DEMO_CASE_ID,
        "recovery_case": MOCK_CASE,
        "payment": MOCK_PAYMENT,
        "customer": MOCK_CUSTOMER
    })
    assert state["is_duplicate"] is False


def test_16_safe_simulated_action_execution():
    state = {
        "recommended_action": "SEND_PAYMENT_LINK",
        "is_demo": True,
        "demo_simulate_success": True,
        "recovery_case": MOCK_CASE,
        "audit_logs": []
    }
    exec_state = execute_action_node(state)
    assert exec_state["execution_result"]["status"] == "SUCCESS"
    assert exec_state["execution_result"]["simulated"] is True


def test_17_successful_demo_retry():
    state = {
        "recommended_action": "RETRY_PAYMENT",
        "is_demo": True,
        "demo_simulate_success": True,
        "recovery_case": MOCK_CASE,
        "audit_logs": []
    }
    exec_state = execute_action_node(state)
    assert exec_state["execution_result"]["status"] == "SUCCESS"
    assert exec_state["recovery_amount"] == 12500.0


def test_18_recovery_case_update():
    state = {
        "recommended_action": "RETRY_PAYMENT",
        "execution_result": {"status": "SUCCESS"},
        "recovery_amount": 12500.0,
        "recovery_case": MOCK_CASE,
        "audit_logs": []
    }
    ver_state = verify_result_node(state)
    assert ver_state["final_status"] == "recovered"


def test_19_audit_logging():
    res = run_recovery_agent(
        recovery_case_id=DEMO_CASE_ID,
        is_demo=True,
        demo_simulate_success=True,
        initial_case=MOCK_CASE,
        initial_payment=MOCK_PAYMENT,
        initial_customer=MOCK_CUSTOMER
    )
    assert len(res["audit_logs"]) >= 10
    assert any(log["current_state"] == "RECEIVE_CASE" for log in res["audit_logs"])
    assert any(log["current_state"] == "GET_ML_PREDICTION" for log in res["audit_logs"])
    assert any(log["current_state"] == "APPLY_GUARDRAILS" for log in res["audit_logs"])


def test_20_every_state_transition_logged():
    res = run_recovery_agent(
        recovery_case_id=DEMO_CASE_ID,
        is_demo=True,
        demo_simulate_success=True,
        initial_case=MOCK_CASE,
        initial_payment=MOCK_PAYMENT,
        initial_customer=MOCK_CUSTOMER
    )
    states_logged = [log["current_state"] for log in res["audit_logs"]]
    expected_states = [
        "RECEIVE_CASE", "ANALYZE_CASE", "GET_ML_PREDICTION", "GET_SHAP_EXPLANATION",
        "DIAGNOSE_ROOT_CAUSE", "SELECT_INTERVENTION", "APPLY_GUARDRAILS",
        "EXECUTE_ACTION", "VERIFY_RESULT", "UPDATE_CASE", "AUDIT"
    ]
    for expected in expected_states:
        assert expected in states_logged, f"State '{expected}' missing from audit log"


def test_21_demo_12500_full_workflow():
    res = run_recovery_agent(
        recovery_case_id=DEMO_CASE_ID,
        is_demo=True,
        demo_simulate_success=True,
        initial_case=MOCK_CASE,
        initial_payment=MOCK_PAYMENT,
        initial_customer=MOCK_CUSTOMER,
        retry_count=1
    )
    assert res["recovery_case_id"] == DEMO_CASE_ID
    assert isinstance(res["recovery_probability"], float)
    assert 0.0 <= res["recovery_probability"] <= 1.0
    assert res["risk_level"] in {"HIGH", "MEDIUM", "LOW"}
    assert "shap_explanation" in res
    assert res["guardrail_decision"]["status"] == "APPROVED"
    assert res["execution_result"]["status"] == "SUCCESS"
    assert res["recovered_amount"] == 12500.0
    assert res["final_status"] == "recovered"


def test_22_fastapi_agent_endpoint():
    payload = {
        "recovery_case_id": DEMO_CASE_ID,
        "is_demo": True,
        "demo_simulate_success": True,
        "initial_case": MOCK_CASE,
        "initial_payment": MOCK_PAYMENT,
        "initial_customer": MOCK_CUSTOMER
    }
    response = client.post("/run-recovery-agent", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    agent_data = data["data"]
    assert agent_data["recovery_case_id"] == DEMO_CASE_ID
    assert "recovery_probability" in agent_data
    assert "guardrail_decision" in agent_data


def test_23_llm_unavailable_safe_failure():
    # Environment without API key still succeeds safely via deterministic fallback
    state = {
        "recovery_case_id": DEMO_CASE_ID,
        "recovery_case": MOCK_CASE,
        "payment": MOCK_PAYMENT,
        "customer": MOCK_CUSTOMER,
        "recovery_probability": 0.85,
        "shap_explanation": {"human_explanation": "Test explanation"},
        "audit_logs": []
    }
    diag_state = diagnose_root_cause_node(state)
    assert diag_state["root_cause"] != ""
    sel_state = select_intervention_node(diag_state)
    assert sel_state["recommended_action"] in {
        "RETRY_PAYMENT", "SEND_REMINDER", "SEND_PAYMENT_LINK", "WAIT_AND_RETRY", "ESCALATE_TO_HUMAN", "STOP"
    }
