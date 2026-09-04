# LangGraph 12-State Recovery Agent Workflow

## 1. Overview

RazorRecover implements a 12-state stateful agent workflow using **LangGraph** (`ai-service/agent.py`). The agent orchestrates root-cause diagnosis, integrates ML predictions and SHAP explainability, queries Google Gemini LLM for structured recommendations, validates decisions against deterministic policy guardrails, and executes bounded recovery actions.

---

## 2. 12-State Workflow Graph

```
 [1. RECEIVE_CASE]
         │
         ▼
 [2. ANALYZE_CASE]
         │
         ▼
 [3. GET_ML_PREDICTION] ──► (Calls XGBoost Classifier)
         │
         ▼
 [4. GET_SHAP_EXPLANATION] ──► (Calls SHAP TreeExplainer)
         │
         ▼
 [5. DIAGNOSE_ROOT_CAUSE] ──► (Queries Gemini LLM / Heuristic Fallback)
         │
         ▼
 [6. SELECT_INTERVENTION] ──► (Generates Structured Recommendation)
         │
         ▼
 [7. APPLY_GUARDRAILS] ──► (Enforces Policy Rules)
         │
         ▼
 [8. EXECUTE_ACTION] ──► (Calls MockPaymentProvider)
         │
         ▼
 [9. VERIFY_RESULT] ──► (Inspects Payment Outcome)
         │
         ▼
 [10. UPDATE_CASE] ──► (Updates Supabase PostgreSQL Status)
         │
         ▼
 [11. AUDIT] ──► (Writes Immutable Audit Log Entry)
         │
         ▼
 [12. STOP] ──► (Workflow Completed)
```

---

## 3. Detailed State Specifications

| State Index | State Name | Function & Logic |
| :--- | :--- | :--- |
| **State 1** | `RECEIVE_CASE` | Ingests case ID, customer profile, invoice data, and billing event payload. |
| **State 2** | `ANALYZE_CASE` | Parses gateway error code (`BAD_REQUEST`, `GATEWAY_ERROR`), payment method, and failure history. |
| **State 3** | `GET_ML_PREDICTION` | Preprocesses 13 features and calls XGBoost model for $P_{recovery}$ and risk level (`LOW`, `MEDIUM`, `HIGH`). |
| **State 4** | `GET_SHAP_EXPLANATION` | Generates positive/negative feature attributions and narrative explanation. |
| **State 5** | `DIAGNOSE_ROOT_CAUSE` | Formulates failure diagnosis (e.g. *Temporary bank gateway timeout during peak processing*). Uses Gemini LLM or heuristic fallback. |
| **State 6** | `SELECT_INTERVENTION` | Selects structured action (`RETRY_PAYMENT`, `SEND_UPDATE_PAYMENT_LINK`, `SEND_SMART_REMINDER`, `ESCALATE_TO_HUMAN`, `OFFER_DISCOUNT_OR_PAUSE`). |
| **State 7** | `APPLY_GUARDRAILS` | Passes recommendation to deterministic policy guardrail engine (`APPROVED`, `MODIFIED`, or `REJECTED`). |
| **State 8** | `EXECUTE_ACTION` | Dispatches approved action to `MockPaymentProvider` via backend payment execution service. |
| **State 9** | `VERIFY_RESULT` | Validates settlement result (`SUCCESS`, `FAILED`, `PENDING`, `CANCELLED`). |
| **State 10** | `UPDATE_CASE` | Updates `recovery_cases` status (`recovered`, `failed`, `escalated_to_human`) and `recovered_amount`. |
| **State 11** | `AUDIT` | Creates structured entry in `audit_logs` table with actor, action, reason, and guardrail verdict. |
| **State 12** | `STOP` | Terminates workflow execution cleanly. |

---

## 4. LLM Diagnosis & Structured Recommendation

The agent uses `ChatGoogleGenerativeAI` (`gemini-1.5-flash` / `gemini-2.0-flash`) to generate structured JSON recommendations:

```json
{
  "root_cause": "Temporary bank gateway failure during recurring subscription charge.",
  "recommended_action": "RETRY_PAYMENT",
  "reasoning": "High historical success rate (95%) and active subscription status indicate high likelihood of immediate retry settlement.",
  "suggested_delay_hours": 0,
  "confidence_score": 0.92
}
```

### Fallback Guarantee
If `GEMINI_API_KEY` is not configured or LLM API is unavailable, the agent seamlessly transitions to a deterministic heuristic rule engine without failing or interrupting the workflow.

---

## 5. Interaction with Safety Guardrails

All LLM recommendations must pass through State 7 (`APPLY_GUARDRAILS`):
- **LLM recommends `RETRY_PAYMENT`**, but retry count $= 3 \rightarrow$ Guardrail overrides action to `ESCALATE_TO_HUMAN`.
- **LLM recommends `RETRY_PAYMENT`**, but amount $= \text{₹}75,000 \rightarrow$ Guardrail overrides action to `FLAG_FOR_HUMAN_APPROVAL`.
- **LLM recommends `RETRY_PAYMENT`**, but customer opted out $\rightarrow$ Guardrail overrides action to `STOP`.
- **LLM recommends invalid action** $\rightarrow$ Guardrail rejects action and applies fallback `SEND_SMART_REMINDER`.
