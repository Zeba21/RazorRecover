"""
RazorRecover — Module 6 LangGraph AI Recovery Agent

Orchestrates payment recovery using a 12-state LangGraph workflow:
1. RECEIVE_CASE
2. ANALYZE_CASE
3. GET_ML_PREDICTION
4. GET_SHAP_EXPLANATION
5. DIAGNOSE_ROOT_CAUSE
6. SELECT_INTERVENTION
7. APPLY_GUARDRAILS
8. EXECUTE_ACTION
9. VERIFY_RESULT
10. UPDATE_CASE
11. AUDIT
12. STOP
"""

import os
import json
from datetime import datetime, timezone
from typing import TypedDict, Optional, List, Dict, Any
import httpx
import pandas as pd

from langgraph.graph import StateGraph, END

from db import get_supabase_client
from explain_model import generate_shap_explanation
from main import get_model_pipeline, calculate_risk_level

# Configuration
HIGH_VALUE_THRESHOLD = float(os.getenv("HIGH_VALUE_THRESHOLD", 50000.0))
MAX_RETRIES = 3
MAX_REMINDERS = 2
ALLOWED_ACTIONS = {
    "RETRY_PAYMENT",
    "SEND_REMINDER",
    "SEND_PAYMENT_LINK",
    "WAIT_AND_RETRY",
    "ESCALATE_TO_HUMAN",
    "STOP"
}

# State Definition
class RecoveryAgentState(TypedDict, total=False):
    # Inputs & Core Identifiers
    recovery_case_id: str
    is_demo: bool
    demo_simulate_success: bool
    
    # Entity Objects
    recovery_case: Dict[str, Any]
    payment: Dict[str, Any]
    customer: Dict[str, Any]
    
    # ML & SHAP Outputs
    recovery_probability: float
    risk_level: str
    model_version: str
    shap_explanation: Dict[str, Any]
    
    # Features DataFrame
    features_df: Any
    
    # LLM & Policy Outputs
    root_cause: str
    recommended_action: str
    llm_reason: str
    customer_message: str
    llm_available: bool
    
    # Safety & Guardrail State
    retry_count: int
    reminder_count: int
    high_value: bool
    opt_out: bool
    is_duplicate: bool
    guardrail_decision: Dict[str, Any]
    
    # Execution & Verification
    execution_result: Dict[str, Any]
    recovery_amount: float
    final_status: str
    
    # Audit Trail
    audit_logs: List[Dict[str, Any]]
    current_state: str
    previous_state: str


def log_state_transition(state: RecoveryAgentState, from_state: str, to_state: str, details: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Helper to record state transition in audit trail."""
    audit_list = list(state.get("audit_logs", []))
    entry = {
        "case_id": state.get("recovery_case_id"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "previous_state": from_state,
        "current_state": to_state,
        "action": state.get("recommended_action", "NONE"),
        "guardrail_status": state.get("guardrail_decision", {}).get("status", "PENDING"),
        "result": state.get("execution_result", {}).get("status", "NOT_EXECUTED"),
        "model_version": state.get("model_version", "unknown"),
        "details": details or {}
    }
    audit_list.append(entry)
    
    # Persist to Supabase audit_logs table if client available
    try:
        supabase = get_supabase_client()
        if supabase:
            supabase.table("audit_logs").insert({
                "event_type": f"agent_state_{to_state.lower()}",
                "entity_type": "recovery_case",
                "entity_id": state.get("recovery_case_id"),
                "actor": "ai_agent",
                "details": {
                    "from_state": from_state,
                    "to_state": to_state,
                    "recommended_action": state.get("recommended_action"),
                    "guardrail_decision": state.get("guardrail_decision"),
                    "recovery_probability": state.get("recovery_probability"),
                    "details": details or {}
                },
                "severity": "info" if state.get("guardrail_decision", {}).get("status") != "REJECTED" else "warning"
            }).execute()
    except Exception as e:
        print(f"⚠️ Audit log persistence warning: {str(e)}")
        
    return audit_list


# ---------------- 12 Explicit State Nodes ----------------

def receive_case_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 1: RECEIVE_CASE — Fetch & validate case, payment, and customer details."""
    case_id = state.get("recovery_case_id")
    is_demo = state.get("is_demo", True)
    demo_simulate_success = state.get("demo_simulate_success", True)
    
    case_data = state.get("recovery_case")
    payment_data = state.get("payment")
    customer_data = state.get("customer")
    
    if not case_data or not payment_data or not customer_data:
        try:
            client = get_supabase_client()
            res = client.table("recovery_cases").select("*, payments(*), customers(*)").eq("id", case_id).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                case_data = {
                    "id": row["id"],
                    "payment_id": row["payment_id"],
                    "customer_id": row["customer_id"],
                    "status": row.get("status", "open"),
                    "revenue_at_risk": float(row.get("revenue_at_risk", 0.0)),
                    "recovered_amount": float(row.get("recovered_amount", 0.0)),
                    "strategy": row.get("strategy"),
                    "stopping_rule_triggered": row.get("stopping_rule_triggered"),
                    "escalated_to_human": row.get("escalated_to_human", False)
                }
                payment_data = row.get("payments") or {}
                customer_data = row.get("customers") or {}
        except Exception as e:
            print(f"Fetch case error: {str(e)}")

    if not case_data:
        raise ValueError(f"Recovery case '{case_id}' not found.")

    # Count existing attempts for retries and reminders if not provided
    retry_cnt = state.get("retry_count")
    reminder_cnt = state.get("reminder_count")
    
    if retry_cnt is None or reminder_cnt is None:
        db_retries = 0
        db_reminders = 0
        try:
            client = get_supabase_client()
            att_res = client.table("recovery_attempts").select("strategy, status").eq("case_id", case_id).execute()
            if att_res.data:
                for att in att_res.data:
                    strat = att.get("strategy")
                    if strat in ("retry", "RETRY_PAYMENT"):
                        db_retries += 1
                    elif strat in ("reminder_email", "SEND_REMINDER", "payment_link", "SEND_PAYMENT_LINK"):
                        db_reminders += 1
        except Exception:
            pass
        if retry_cnt is None:
            retry_cnt = db_retries
        if reminder_cnt is None:
            reminder_cnt = db_reminders

    tx_amount = float(payment_data.get("amount", case_data.get("revenue_at_risk", 0.0)))

    new_state = dict(state)
    new_state["recovery_case"] = case_data
    new_state["payment"] = payment_data
    new_state["customer"] = customer_data
    new_state["retry_count"] = retry_cnt
    new_state["reminder_count"] = reminder_cnt
    new_state["high_value"] = tx_amount >= HIGH_VALUE_THRESHOLD
    new_state["opt_out"] = customer_data.get("opted_out", False)
    new_state["is_duplicate"] = False
    new_state["is_demo"] = is_demo
    new_state["demo_simulate_success"] = demo_simulate_success
    new_state["previous_state"] = "START"
    new_state["current_state"] = "RECEIVE_CASE"
    new_state["audit_logs"] = log_state_transition(new_state, "START", "RECEIVE_CASE", {"tx_amount": tx_amount})
    
    return new_state


def analyze_case_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 2: ANALYZE_CASE — Extract features dataframe for prediction & SHAP."""
    pmt = dict(state.get("payment", {}))
    cust = state.get("customer", {})
    case = state.get("recovery_case", {})

    # Extract 13 features matching XGBoost pipeline schema exactly
    tx_amount = float(pmt.get("amount", case.get("revenue_at_risk", 0.0)))
    pmt_history = int(cust.get("customer_payment_history", 10))
    prev_success_rate = float(cust.get("previous_success_rate", 0.85))
    prev_failures = int(cust.get("previous_failure_count", 1))
    
    raw_fail_reason = pmt.get("error_reason") or pmt.get("failure_type") or pmt.get("error_code")
    valid_fail_types = {'insufficient_funds', 'authentication_failed', 'gateway_timeout', 'card_expired', 'network_error'}
    
    if raw_fail_reason and str(raw_fail_reason).lower() in valid_fail_types:
        provider_fail_reason = str(raw_fail_reason).lower()
        model_fail_type = provider_fail_reason
    else:
        # Preserve actual failure reason or UNKNOWN (NEVER convert UNKNOWN to insufficient_funds)
        provider_fail_reason = str(raw_fail_reason) if raw_fail_reason else "UNKNOWN"
        model_fail_type = "network_error"

    # Ensure payment object retains actual failure reason for diagnosis & UI
    if not pmt.get("error_reason"):
        pmt["error_reason"] = provider_fail_reason

    retry_count = state.get("retry_count", 0)
    cust_age = int(cust.get("customer_age_days", 300))
    sub_status = cust.get("subscription_status") or "active"
    valid_sub_statuses = {'active', 'past_due', 'trialing', 'canceled', 'unpaid', 'paused'}
    if sub_status not in valid_sub_statuses:
        sub_status = "active"

    time_since_fail = float(pmt.get("time_since_failure", 2.0))
    pmt_method = pmt.get("method") or pmt.get("payment_method") or "card"
    valid_methods = {'card', 'upi', 'netbanking', 'wallet'}
    if pmt_method not in valid_methods:
        pmt_method = "card"

    cust_segment = cust.get("customer_segment") or cust.get("tier") or "regular"
    valid_segments = {'regular', 'enterprise', 'vip', 'starter'}
    if cust_segment not in valid_segments:
        cust_segment = "regular"

    invoice_age = float(pmt.get("invoice_age", 1.0))
    prev_recovery_succ = int(cust.get("previous_recovery_success", 1))

    features_df = pd.DataFrame([{
        "transaction_amount": tx_amount,
        "customer_payment_history": pmt_history,
        "previous_success_rate": prev_success_rate,
        "previous_failure_count": prev_failures,
        "failure_type": model_fail_type,
        "retry_count": retry_count,
        "customer_age_days": cust_age,
        "subscription_status": sub_status,
        "time_since_failure": time_since_fail,
        "payment_method": pmt_method,
        "customer_segment": cust_segment,
        "invoice_age": invoice_age,
        "previous_recovery_success": prev_recovery_succ
    }])

    new_state = dict(state)
    new_state["payment"] = pmt
    new_state["features_df"] = features_df
    new_state["previous_state"] = "RECEIVE_CASE"
    new_state["current_state"] = "ANALYZE_CASE"
    new_state["audit_logs"] = log_state_transition(new_state, "RECEIVE_CASE", "ANALYZE_CASE", {"failure_type": provider_fail_reason})
    return new_state


def get_ml_prediction_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 3: GET_ML_PREDICTION — Real XGBoost prediction inference."""
    pipeline, model_ver = get_model_pipeline()
    df = state.get("features_df")
    
    try:
        proba = float(pipeline.predict_proba(df)[0][1])
    except Exception as e:
        print(f"ML inference error: {str(e)}")
        proba = 0.50

    risk = calculate_risk_level(proba)

    new_state = dict(state)
    new_state["recovery_probability"] = round(proba, 4)
    new_state["risk_level"] = risk
    new_state["model_version"] = model_ver
    new_state["previous_state"] = "ANALYZE_CASE"
    new_state["current_state"] = "GET_ML_PREDICTION"
    new_state["audit_logs"] = log_state_transition(
        new_state, "ANALYZE_CASE", "GET_ML_PREDICTION",
        {"probability": round(proba, 4), "risk_level": risk, "model_version": model_ver}
    )
    return new_state


def get_shap_explanation_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 4: GET_SHAP_EXPLANATION — Compute SHAP explanations using Module 5 engine."""
    pipeline, _ = get_model_pipeline()
    df = state.get("features_df")
    
    try:
        shap_data = generate_shap_explanation(pipeline, df)
    except Exception as e:
        print(f"SHAP generation error: {str(e)}")
        shap_data = {
            "top_positive_factors": [],
            "top_negative_factors": [],
            "feature_importance": [],
            "human_explanation": "Payment analysis complete."
        }

    new_state = dict(state)
    new_state["shap_explanation"] = shap_data
    new_state["previous_state"] = "GET_ML_PREDICTION"
    new_state["current_state"] = "GET_SHAP_EXPLANATION"
    new_state["audit_logs"] = log_state_transition(
        new_state, "GET_ML_PREDICTION", "GET_SHAP_EXPLANATION",
        {"human_explanation": shap_data.get("human_explanation")}
    )
    return new_state


def diagnose_root_cause_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 5: DIAGNOSE_ROOT_CAUSE — LLM root cause analysis with safe fallback."""
    pmt = state.get("payment", {})
    cust = state.get("customer", {})
    proba = state.get("recovery_probability", 0.0)
    shap_info = state.get("shap_explanation", {})
    
    prompt = f"""You are RazorRecover AI Agent. Diagnose the payment failure.
Payment Amount: ₹{pmt.get('amount', 0.0)}
Failure Reason: {pmt.get('error_reason') or pmt.get('error_description')}
Customer Tier: {cust.get('tier') or cust.get('customer_segment')}
Recovery Probability: {proba * 100:.1f}%
Key Insights: {shap_info.get('human_explanation')}

Provide a concise, professional 1-2 sentence root cause diagnosis. Do not claim absolute certainty."""

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("Gemini_API_Key")
    root_cause = ""
    llm_available = False

    if api_key:
        try:
            # Gemini API standard REST call
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    root_cause = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    llm_available = True
        except Exception as e:
            print(f"⚠️ LLM API call error: {str(e)}")

    if not root_cause:
        # Safe deterministic fallback diagnosis
        llm_available = False
        fail_desc = pmt.get("error_description") or pmt.get("error_reason") or "temporary bank decline"
        if proba >= 0.70:
            root_cause = f"Likely temporary payment failure ({fail_desc}) for a high-value customer with strong recovery probability."
        elif proba >= 0.40:
            root_cause = f"Payment failed due to {fail_desc}. Customer shows moderate recovery probability."
        else:
            root_cause = f"Payment failure ({fail_desc}) with low historical recovery probability."

    new_state = dict(state)
    new_state["root_cause"] = root_cause
    new_state["llm_available"] = llm_available
    new_state["previous_state"] = "GET_SHAP_EXPLANATION"
    new_state["current_state"] = "DIAGNOSE_ROOT_CAUSE"
    new_state["audit_logs"] = log_state_transition(
        new_state, "GET_SHAP_EXPLANATION", "DIAGNOSE_ROOT_CAUSE",
        {"root_cause": root_cause, "llm_available": llm_available}
    )
    return new_state


def select_intervention_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 6: SELECT_INTERVENTION — Recommend recovery action, reason, and message."""
    root_cause = state.get("root_cause", "")
    proba = state.get("recovery_probability", 0.0)
    pmt = state.get("payment", {})
    cust = state.get("customer", {})
    retry_cnt = state.get("retry_count", 0)
    reminder_cnt = state.get("reminder_count", 0)
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("Gemini_API_Key")
    
    recommended_action = ""
    llm_reason = ""
    customer_message = ""

    if api_key and state.get("llm_available", True):
        prompt = f"""Based on the root cause analysis: "{root_cause}"
Recovery Probability: {proba}
Retries done: {retry_cnt}, Reminders sent: {reminder_cnt}

Choose EXACTLY ONE action from this list:
RETRY_PAYMENT, SEND_REMINDER, SEND_PAYMENT_LINK, WAIT_AND_RETRY, ESCALATE_TO_HUMAN, STOP

Respond ONLY in valid JSON:
{{
  "recommended_action": "RETRY_PAYMENT",
  "reason": "...",
  "customer_message": "..."
}}"""
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            with httpx.Client(timeout=10.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    # Strip markdown codeblocks if present
                    if text.startswith("```"):
                        text = text.split("\n", 1)[1].rsplit("\n", 1)[0].strip()
                        if text.startswith("json"):
                            text = text[4:].strip()
                    data = json.loads(text)
                    recommended_action = data.get("recommended_action", "").upper()
                    llm_reason = data.get("reason", "")
                    customer_message = data.get("customer_message", "")
        except Exception as e:
            print(f"⚠️ LLM intervention parsing error: {str(e)}")

    # Fallback to deterministic policy selection if LLM unavailable or invalid action returned
    if recommended_action not in ALLOWED_ACTIONS:
        if retry_cnt >= MAX_RETRIES:
            recommended_action = "ESCALATE_TO_HUMAN"
            llm_reason = f"Max retries ({MAX_RETRIES}) reached."
        elif proba >= 0.70:
            recommended_action = "RETRY_PAYMENT"
            llm_reason = "High recovery probability with temporary payment issue."
            customer_message = f"Hello {cust.get('name', 'Valued Customer')}, we noticed your payment of ₹{pmt.get('amount')} was incomplete. We are retrying payment processing."
        elif proba >= 0.40:
            recommended_action = "SEND_PAYMENT_LINK"
            llm_reason = "Moderate recovery probability; payment link sent to customer."
            customer_message = f"Hello {cust.get('name', 'Valued Customer')}, please update your payment method to keep your account active."
        else:
            recommended_action = "SEND_REMINDER" if reminder_cnt < MAX_REMINDERS else "ESCALATE_TO_HUMAN"
            llm_reason = "Low recovery probability; sending reminder notification."

    new_state = dict(state)
    new_state["recommended_action"] = recommended_action
    new_state["llm_reason"] = llm_reason
    new_state["customer_message"] = customer_message
    new_state["previous_state"] = "DIAGNOSE_ROOT_CAUSE"
    new_state["current_state"] = "SELECT_INTERVENTION"
    new_state["audit_logs"] = log_state_transition(
        new_state, "DIAGNOSE_ROOT_CAUSE", "SELECT_INTERVENTION",
        {"recommended_action": recommended_action, "reason": llm_reason}
    )
    return new_state


def apply_guardrails_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 7: APPLY_GUARDRAILS — Deterministic safety guardrail enforcement."""
    action = state.get("recommended_action")
    tx_amount = float(state.get("payment", {}).get("amount", state.get("recovery_case", {}).get("revenue_at_risk", 0.0)))
    retry_cnt = state.get("retry_count", 0)
    reminder_cnt = state.get("reminder_count", 0)
    opt_out = state.get("opt_out", False)
    case_status = state.get("recovery_case", {}).get("status", "")
    
    decision_status = "APPROVED"
    reason = "All deterministic safety guardrails passed."
    final_action = action

    # 1. Action Validity Check
    if action not in ALLOWED_ACTIONS:
        decision_status = "REJECTED"
        reason = f"Invalid/unknown action '{action}' rejected by safety guardrails."
        final_action = "STOP"

    # 2. Case Already Closed / Recovered Check
    elif case_status in ("recovered", "captured"):
        decision_status = "STOPPED"
        reason = "Payment already captured/recovered. Automated recovery stopped."
        final_action = "STOP"

    # 3. Customer Opt-Out Check
    elif opt_out:
        decision_status = "STOPPED"
        reason = "Customer has opted out of automated recovery communications."
        final_action = "STOP"

    # 4. High-Value Transaction Check (Requires Human Approval)
    elif tx_amount >= HIGH_VALUE_THRESHOLD:
        decision_status = "FLAGGED_FOR_HUMAN"
        reason = f"Transaction amount ₹{tx_amount:,.2f} exceeds high-value threshold ₹{HIGH_VALUE_THRESHOLD:,.2f}. Human approval required."
        final_action = "ESCALATE_TO_HUMAN"

    # 5. Maximum Retry Count Check
    elif action in ("RETRY_PAYMENT", "WAIT_AND_RETRY") and retry_cnt >= MAX_RETRIES:
        decision_status = "ESCALATED"
        reason = f"Retry count ({retry_cnt}) reached maximum limit of {MAX_RETRIES}. Escalated to human team."
        final_action = "ESCALATE_TO_HUMAN"

    # 6. Maximum Reminder Count Check
    elif action == "SEND_REMINDER" and reminder_cnt >= MAX_REMINDERS:
        decision_status = "ESCALATED"
        reason = f"Reminder count ({reminder_cnt}) reached maximum limit of {MAX_REMINDERS}. Escalated to human team."
        final_action = "ESCALATE_TO_HUMAN"

    guardrail_info = {
        "status": decision_status,
        "reason": reason,
        "original_action": action,
        "enforced_action": final_action,
        "high_value_threshold": HIGH_VALUE_THRESHOLD,
        "max_retries": MAX_RETRIES,
        "max_reminders": MAX_REMINDERS
    }

    new_state = dict(state)
    new_state["recommended_action"] = final_action
    new_state["guardrail_decision"] = guardrail_info
    new_state["previous_state"] = "SELECT_INTERVENTION"
    new_state["current_state"] = "APPLY_GUARDRAILS"
    new_state["audit_logs"] = log_state_transition(
        new_state, "SELECT_INTERVENTION", "APPLY_GUARDRAILS",
        {"guardrail_status": decision_status, "reason": reason, "final_action": final_action}
    )
    return new_state


def execute_action_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 8: EXECUTE_ACTION — Safe demo/simulation action execution layer."""
    action = state.get("recommended_action")
    is_demo = state.get("is_demo", True)
    demo_simulate_success = state.get("demo_simulate_success", True)
    case = state.get("recovery_case", {})
    revenue_at_risk = float(case.get("revenue_at_risk", 0.0))

    exec_status = "EXECUTED"
    recovered = 0.0
    details = ""

    if action == "RETRY_PAYMENT":
        if is_demo and demo_simulate_success:
            exec_status = "SUCCESS"
            recovered = revenue_at_risk
            details = f"DEMO SIMULATION: Payment retry succeeded. Recovered ₹{recovered:,.2f}."
        else:
            exec_status = "FAILED"
            details = "DEMO SIMULATION: Payment retry attempt failed."

    elif action == "SEND_REMINDER":
        exec_status = "SUCCESS"
        details = "DEMO SIMULATION: Automated reminder email/SMS sent to customer."

    elif action == "SEND_PAYMENT_LINK":
        exec_status = "SUCCESS"
        details = f"DEMO SIMULATION: Payment link created for ₹{revenue_at_risk:,.2f}."

    elif action == "WAIT_AND_RETRY":
        exec_status = "SCHEDULED"
        details = "DEMO SIMULATION: Payment retry scheduled for 24 hours later."

    elif action == "ESCALATE_TO_HUMAN":
        exec_status = "ESCALATED"
        details = "Case flagged and assigned for manual review by human agent."

    elif action == "STOP":
        exec_status = "TERMINATED"
        details = "Automated recovery workflow terminated."

    execution_res = {
        "status": exec_status,
        "action": action,
        "simulated": True,
        "recovered_amount": recovered,
        "details": details,
        "executed_at": datetime.now(timezone.utc).isoformat()
    }

    new_state = dict(state)
    new_state["execution_result"] = execution_res
    new_state["recovery_amount"] = recovered
    new_state["previous_state"] = "APPLY_GUARDRAILS"
    new_state["current_state"] = "EXECUTE_ACTION"
    new_state["audit_logs"] = log_state_transition(
        new_state, "APPLY_GUARDRAILS", "EXECUTE_ACTION",
        {"execution_status": exec_status, "details": details}
    )
    return new_state


def verify_result_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 9: VERIFY_RESULT — Evaluate execution outcomes and determine case status."""
    action = state.get("recommended_action")
    exec_res = state.get("execution_result", {})
    exec_status = exec_res.get("status")
    recovered = state.get("recovery_amount", 0.0)
    case = state.get("recovery_case", {})

    if action == "RETRY_PAYMENT" and exec_status == "SUCCESS" and recovered > 0:
        final_status = "recovered"
    elif action == "ESCALATE_TO_HUMAN":
        final_status = "escalated"
    elif action == "STOP":
        final_status = "closed" if case.get("status") != "recovered" else "recovered"
    else:
        final_status = "in_recovery"

    new_state = dict(state)
    new_state["final_status"] = final_status
    new_state["previous_state"] = "EXECUTE_ACTION"
    new_state["current_state"] = "VERIFY_RESULT"
    new_state["audit_logs"] = log_state_transition(
        new_state, "EXECUTE_ACTION", "VERIFY_RESULT",
        {"final_status": final_status, "recovered_amount": recovered}
    )
    return new_state


def update_case_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 10: UPDATE_CASE — Update database tables with new case status, attempts, and AI decisions."""
    case_id = state.get("recovery_case_id")
    final_status = state.get("final_status", "in_recovery")
    recovered = state.get("recovery_amount", 0.0)
    pmt = state.get("payment", {})
    action = state.get("recommended_action")
    proba = state.get("recovery_probability", 0.0)
    shap_info = state.get("shap_explanation", {})
    guard_info = state.get("guardrail_decision", {})
    root_cause = state.get("root_cause", "")
    
    try:
        client = get_supabase_client()
        if client and case_id:
            # Update recovery_cases table
            update_payload = {
                "status": final_status,
                "recovery_probability": proba,
                "strategy": action.lower(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if final_status == "recovered":
                update_payload["recovered_amount"] = recovered
                update_payload["revenue_at_risk"] = 0.0
            elif final_status == "escalated":
                update_payload["escalated_to_human"] = True
                update_payload["escalated_at"] = datetime.now(timezone.utc).isoformat()
                
            client.table("recovery_cases").update(update_payload).eq("id", case_id).execute()

            # Record recovery_attempt
            attempt_payload = {
                "case_id": case_id,
                "payment_id": pmt.get("id"),
                "strategy": action.lower() if action.lower() in ('retry', 'payment_link', 'reminder_email', 'alternate_method') else 'retry',
                "status": "success" if final_status == "recovered" else ("failed" if final_status == "failed" else "in_progress"),
                "recovery_probability": proba,
                "predicted_amount": pmt.get("amount"),
                "actual_amount": recovered,
                "diagnosis": root_cause,
                "shap_explanation": shap_info,
                "safety_check_passed": guard_info.get("status") == "APPROVED",
                "guardrail_notes": guard_info.get("reason"),
                "attempt_number": state.get("retry_count", 0) + 1,
                "max_attempts": MAX_RETRIES,
                "executed_at": datetime.now(timezone.utc).isoformat(),
                "is_demo": True
            }
            client.table("recovery_attempts").insert(attempt_payload).execute()

            # Record AI Decision
            action_type_map = {
                "RETRY_PAYMENT": "trigger_retry",
                "SEND_PAYMENT_LINK": "send_payment_link",
                "SEND_REMINDER": "send_email",
                "ESCALATE_TO_HUMAN": "escalate_human",
                "STOP": "stop_recovery"
            }
            decision_payload = {
                "case_id": case_id,
                "action_type": action_type_map.get(action, "trigger_retry"),
                "rationale": root_cause,
                "confidence_score": proba,
                "safety_check_status": "passed" if guard_info.get("status") == "APPROVED" else "blocked"
            }
            client.table("ai_decisions").insert(decision_payload).execute()

    except Exception as e:
        print(f"⚠️ Database update error: {str(e)}")

    new_state = dict(state)
    new_state["previous_state"] = "VERIFY_RESULT"
    new_state["current_state"] = "UPDATE_CASE"
    new_state["audit_logs"] = log_state_transition(
        new_state, "VERIFY_RESULT", "UPDATE_CASE",
        {"case_id": case_id, "updated_status": final_status}
    )
    return new_state


def audit_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 11: AUDIT — Log complete workflow audit trail summary."""
    new_state = dict(state)
    new_state["previous_state"] = "UPDATE_CASE"
    new_state["current_state"] = "AUDIT"
    new_state["audit_logs"] = log_state_transition(
        new_state, "UPDATE_CASE", "AUDIT",
        {"total_steps": len(new_state.get("audit_logs", []))}
    )
    return new_state


def stop_node(state: RecoveryAgentState) -> RecoveryAgentState:
    """State 12: STOP — Terminal graph state."""
    new_state = dict(state)
    new_state["previous_state"] = "AUDIT"
    new_state["current_state"] = "STOP"
    return new_state


# ---------------- Conditional Routing Logic ----------------

def route_after_guardrails(state: RecoveryAgentState) -> str:
    """Conditional router after APPLY_GUARDRAILS node."""
    status = state.get("guardrail_decision", {}).get("status")
    action = state.get("recommended_action")

    if status == "REJECTED" or action == "STOP":
        return "audit_node"
    return "execute_action_node"


# ---------------- LangGraph Workflow Construction ----------------

def build_recovery_agent_graph():
    """Builds and compiles explicit 12-state LangGraph workflow."""
    builder = StateGraph(RecoveryAgentState)

    # 1. Add all 12 explicit nodes
    builder.add_node("receive_case_node", receive_case_node)
    builder.add_node("analyze_case_node", analyze_case_node)
    builder.add_node("get_ml_prediction_node", get_ml_prediction_node)
    builder.add_node("get_shap_explanation_node", get_shap_explanation_node)
    builder.add_node("diagnose_root_cause_node", diagnose_root_cause_node)
    builder.add_node("select_intervention_node", select_intervention_node)
    builder.add_node("apply_guardrails_node", apply_guardrails_node)
    builder.add_node("execute_action_node", execute_action_node)
    builder.add_node("verify_result_node", verify_result_node)
    builder.add_node("update_case_node", update_case_node)
    builder.add_node("audit_node", audit_node)
    builder.add_node("stop_node", stop_node)

    # 2. Add explicit state edges
    builder.set_entry_point("receive_case_node")
    builder.add_edge("receive_case_node", "analyze_case_node")
    builder.add_edge("analyze_case_node", "get_ml_prediction_node")
    builder.add_edge("get_ml_prediction_node", "get_shap_explanation_node")
    builder.add_edge("get_shap_explanation_node", "diagnose_root_cause_node")
    builder.add_edge("diagnose_root_cause_node", "select_intervention_node")
    builder.add_edge("select_intervention_node", "apply_guardrails_node")

    # 3. Conditional routing after guardrails
    builder.add_conditional_edges(
        "apply_guardrails_node",
        route_after_guardrails,
        {
            "execute_action_node": "execute_action_node",
            "audit_node": "audit_node"
        }
    )

    builder.add_edge("execute_action_node", "verify_result_node")
    builder.add_edge("verify_result_node", "update_case_node")
    builder.add_edge("update_case_node", "audit_node")
    builder.add_edge("audit_node", "stop_node")
    builder.add_edge("stop_node", END)

    return builder.compile()


# Global agent instance
recovery_agent_app = build_recovery_agent_graph()


def run_recovery_agent(
    recovery_case_id: str,
    is_demo: bool = True,
    demo_simulate_success: bool = True,
    initial_case: Optional[Dict[str, Any]] = None,
    initial_payment: Optional[Dict[str, Any]] = None,
    initial_customer: Optional[Dict[str, Any]] = None,
    retry_count: Optional[int] = None,
    reminder_count: Optional[int] = None
) -> Dict[str, Any]:
    """Helper entry point to execute recovery agent graph for a given case."""
    r_cnt = retry_count if retry_count is not None else (initial_case.get("retry_count") if initial_case and "retry_count" in initial_case else None)
    rem_cnt = reminder_count if reminder_count is not None else (initial_case.get("reminder_count") if initial_case and "reminder_count" in initial_case else None)

    initial_state: RecoveryAgentState = {
        "recovery_case_id": recovery_case_id,
        "is_demo": is_demo,
        "demo_simulate_success": demo_simulate_success,
        "recovery_case": initial_case or {},
        "payment": initial_payment or {},
        "customer": initial_customer or {},
        "retry_count": r_cnt,
        "reminder_count": rem_cnt,
        "audit_logs": []
    }

    final_state = recovery_agent_app.invoke(initial_state)

    # Return clean structured dictionary
    return {
        "recovery_case_id": final_state.get("recovery_case_id"),
        "recovery_probability": final_state.get("recovery_probability"),
        "risk_level": final_state.get("risk_level"),
        "model_version": final_state.get("model_version"),
        "shap_explanation": final_state.get("shap_explanation"),
        "root_cause": final_state.get("root_cause"),
        "recommended_action": final_state.get("recommended_action"),
        "llm_reason": final_state.get("llm_reason"),
        "customer_message": final_state.get("customer_message"),
        "guardrail_decision": final_state.get("guardrail_decision"),
        "execution_result": final_state.get("execution_result"),
        "recovered_amount": final_state.get("recovery_amount"),
        "final_status": final_state.get("final_status"),
        "audit_logs": final_state.get("audit_logs", [])
    }
