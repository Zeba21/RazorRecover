"""
Module 5 Automated Tests (Pytest) — SHAP Explainability

Tests:
1. SHAP dependency/import
2. Existing Module 4 model loads successfully
3. Model is NOT retrained (file timestamp / hash check)
4. SHAP explanation is generated
5. Recovery probability is between 0 and 1
6. Risk level uses exact Module 4 thresholds
7. Positive factors are returned
8. Negative factors are returned
9. Factors are ranked by contribution
10. Human-readable feature names are returned
11. Raw SHAP arrays are NOT returned to caller
12. Human-readable narrative explanation is returned
13. Invalid payload is rejected
14. Missing feature is rejected
15. ₹12,500 demo explanation works
16. FastAPI POST /explain-recovery endpoint works
17. Existing Module 4 POST /predict-recovery endpoint still works
"""

import pytest
from pathlib import Path
import joblib
import pandas as pd
from fastapi.testclient import TestClient

import shap
from main import app, calculate_risk_level, MODEL_PATH
from explain_model import generate_shap_explanation

client = TestClient(app)

SAMPLE_PAYLOAD = {
    "transaction_amount": 12500,
    "customer_payment_history": 12,
    "previous_success_rate": 0.83,
    "previous_failure_count": 2,
    "failure_type": "insufficient_funds",
    "retry_count": 1,
    "customer_age_days": 420,
    "subscription_status": "active",
    "time_since_failure": 2.0,
    "payment_method": "upi",
    "customer_segment": "regular",
    "invoice_age": 0.0,
    "previous_recovery_success": 1
}


def test_1_shap_dependency_import():
    assert hasattr(shap, "TreeExplainer")
    assert hasattr(shap, "__version__")


def test_2_existing_module4_model_loads():
    assert MODEL_PATH.exists()
    pipeline = joblib.load(MODEL_PATH)
    assert hasattr(pipeline, "predict_proba")
    assert "preprocessor" in pipeline.named_steps
    assert "classifier" in pipeline.named_steps


def test_3_model_is_not_retrained():
    # Verify model file modification time is untouched during explainability call
    mtime_before = MODEL_PATH.stat().st_mtime
    pipeline = joblib.load(MODEL_PATH)
    sample_df = pd.DataFrame([SAMPLE_PAYLOAD])
    generate_shap_explanation(pipeline, sample_df)
    mtime_after = MODEL_PATH.stat().st_mtime
    assert mtime_before == mtime_after, "Model file must not be modified or retrained"


def test_4_shap_explanation_generated():
    pipeline = joblib.load(MODEL_PATH)
    sample_df = pd.DataFrame([SAMPLE_PAYLOAD])
    explanation = generate_shap_explanation(pipeline, sample_df)
    assert "top_positive_factors" in explanation
    assert "top_negative_factors" in explanation
    assert "feature_importance" in explanation
    assert "human_explanation" in explanation


def test_5_recovery_probability_valid_range():
    response = client.post("/explain-recovery", json=SAMPLE_PAYLOAD)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["recovery_probability"] <= 1.0


def test_6_risk_level_exact_thresholds():
    assert calculate_risk_level(0.25) == "HIGH"
    assert calculate_risk_level(0.3999) == "HIGH"
    assert calculate_risk_level(0.40) == "MEDIUM"
    assert calculate_risk_level(0.6999) == "MEDIUM"
    assert calculate_risk_level(0.70) == "LOW"
    assert calculate_risk_level(0.9662) == "LOW"


def test_7_8_positive_and_negative_factors_returned():
    response = client.post("/explain-recovery", json=SAMPLE_PAYLOAD)
    data = response.json()
    assert isinstance(data["top_positive_factors"], list)
    assert isinstance(data["top_negative_factors"], list)
    assert len(data["top_positive_factors"]) > 0
    assert len(data["top_negative_factors"]) > 0


def test_9_factors_ranked_by_contribution():
    pipeline = joblib.load(MODEL_PATH)
    sample_df = pd.DataFrame([SAMPLE_PAYLOAD])
    exp = generate_shap_explanation(pipeline, sample_df)
    # Verify importance level assignments match contribution ranking
    pos = exp["top_positive_factors"]
    if len(pos) >= 2:
        valid_ranks = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
        assert valid_ranks[pos[0]["importance"]] >= valid_ranks[pos[1]["importance"]]


def test_10_human_readable_feature_names():
    response = client.post("/explain-recovery", json=SAMPLE_PAYLOAD)
    data = response.json()
    for item in data["top_positive_factors"] + data["top_negative_factors"]:
        # Verify no raw pipeline prefixes
        assert not item["feature"].startswith("num__")
        assert not item["feature"].startswith("cat__")


def test_11_raw_shap_arrays_not_returned():
    response = client.post("/explain-recovery", json=SAMPLE_PAYLOAD)
    data = response.json()
    assert "shap_values" not in data
    assert "base_values" not in data
    assert "raw_shap" not in data


def test_12_human_readable_narrative_explanation():
    response = client.post("/explain-recovery", json=SAMPLE_PAYLOAD)
    data = response.json()
    text = data["human_explanation"]
    assert isinstance(text, str)
    assert len(text) > 10
    assert text[0].isupper()


def test_13_invalid_payload_rejection():
    invalid_payload = SAMPLE_PAYLOAD.copy()
    invalid_payload["previous_success_rate"] = 1.8  # > 1.0
    response = client.post("/explain-recovery", json=invalid_payload)
    assert response.status_code == 422


def test_14_missing_feature_rejection():
    incomplete = SAMPLE_PAYLOAD.copy()
    del incomplete["transaction_amount"]
    response = client.post("/explain-recovery", json=incomplete)
    assert response.status_code == 422


def test_15_demo_12500_explanation_works():
    response = client.post("/explain-recovery", json=SAMPLE_PAYLOAD)
    assert response.status_code == 200
    data = response.json()
    assert data["recovery_probability"] == 0.9662
    assert data["risk_level"] == "LOW"
    assert data["model_version"] == "recovery-xgboost-v1.0"


def test_16_fastapi_explain_recovery_endpoint():
    response = client.post("/explain-recovery", json=SAMPLE_PAYLOAD)
    assert response.status_code == 200


def test_17_existing_module4_predict_recovery_still_works():
    response = client.post("/predict-recovery", json=SAMPLE_PAYLOAD)
    assert response.status_code == 200
    data = response.json()
    assert "recovery_probability" in data
    assert "risk_level" in data
