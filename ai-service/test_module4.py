"""
Module 4 Automated Tests (Pytest)

Tests:
1. Dataset generation
2. Required feature columns (13 features + 1 target)
3. Target values are 0/1
4. Dataset size = 12,000
5. Reproducible preprocessing pipeline
6. Train/validation/test split (70%/15%/15%)
7. XGBoost classifier training
8. Model persistence (.joblib & metadata.json)
9. Model loading via joblib
10. Real prediction inference
11. Prediction probability in valid range [0, 1]
12. Risk-level mapping thresholds (< 0.40 HIGH, 0.40 - 0.70 MEDIUM, >= 0.70 LOW)
13. Invalid payload rejection
14. Missing feature rejection
15. ₹12,500 demo prediction
16. FastAPI POST /predict-recovery endpoint
17. Existing GET /health endpoint compatibility
"""

import pytest
from pathlib import Path
import joblib
import pandas as pd
from fastapi.testclient import TestClient

from generate_data import generate_synthetic_recovery_data
from train_model import (
    train_and_evaluate_model,
    ALL_FEATURES,
    NUMERICAL_FEATURES,
    CATEGORICAL_FEATURES,
    MODEL_VERSION,
)
from main import app, calculate_risk_level

client = TestClient(app)


def test_1_dataset_generation():
    df = generate_synthetic_recovery_data(n_samples=500, random_state=42)
    assert len(df) == 500
    assert not df.empty


def test_2_dataset_has_required_columns():
    df = generate_synthetic_recovery_data(n_samples=100, random_state=42)
    expected_columns = ALL_FEATURES + ['recovered']
    for col in expected_columns:
        assert col in df.columns, f"Missing expected column: {col}"
    assert len(ALL_FEATURES) == 13


def test_3_target_contains_binary_0_and_1():
    df = generate_synthetic_recovery_data(n_samples=500, random_state=42)
    unique_vals = set(df['recovered'].unique())
    assert unique_vals.issubset({0, 1})
    assert 0 in unique_vals and 1 in unique_vals


def test_4_dataset_size_12000():
    df = generate_synthetic_recovery_data(n_samples=12000, random_state=42)
    assert len(df) == 12000, f"Expected 12,000 rows, got {len(df)}"


def test_5_preprocessing_pipeline():
    meta = train_and_evaluate_model(random_state=42)
    assert "metrics" in meta
    model_path = Path(__file__).parent / "models" / "recovery_model.joblib"
    pipeline = joblib.load(model_path)
    assert hasattr(pipeline, "named_steps")
    assert "preprocessor" in pipeline.named_steps
    assert "classifier" in pipeline.named_steps


def test_6_train_val_test_split_sizes():
    meta = train_and_evaluate_model(random_state=42)
    assert meta["training_samples"] == 8400, f"Expected 8400 training samples, got {meta['training_samples']}"
    assert meta["validation_samples"] == 1800, f"Expected 1800 validation samples, got {meta['validation_samples']}"
    assert meta["test_samples"] == 1800, f"Expected 1800 test samples, got {meta['test_samples']}"


def test_7_xgboost_training():
    meta = train_and_evaluate_model(random_state=42)
    assert meta["metrics"]["accuracy"] > 0.50
    assert meta["metrics"]["roc_auc"] > 0.50


def test_8_model_persistence():
    model_path = Path(__file__).parent / "models" / "recovery_model.joblib"
    metadata_path = Path(__file__).parent / "models" / "model_metadata.json"
    assert model_path.exists(), "Model joblib artifact must exist"
    assert metadata_path.exists(), "Model metadata JSON must exist"


def test_9_model_loading_using_joblib():
    model_path = Path(__file__).parent / "models" / "recovery_model.joblib"
    pipeline = joblib.load(model_path)
    assert hasattr(pipeline, "predict_proba"), "Loaded pipeline must support predict_proba"


def test_10_real_prediction():
    model_path = Path(__file__).parent / "models" / "recovery_model.joblib"
    pipeline = joblib.load(model_path)

    sample_df = pd.DataFrame([{
        "transaction_amount": 12500,
        "customer_payment_history": 10,
        "previous_success_rate": 0.85,
        "previous_failure_count": 1,
        "failure_type": "insufficient_funds",
        "retry_count": 1,
        "customer_age_days": 300,
        "subscription_status": "active",
        "time_since_failure": 2.0,
        "payment_method": "upi",
        "customer_segment": "regular",
        "invoice_age": 1.0,
        "previous_recovery_success": 1
    }])

    probs = pipeline.predict_proba(sample_df)
    assert probs.shape == (1, 2)
    proba = float(probs[0][1])
    assert isinstance(proba, float)


def test_11_prediction_probability_in_valid_range():
    model_path = Path(__file__).parent / "models" / "recovery_model.joblib"
    pipeline = joblib.load(model_path)

    sample_df = pd.DataFrame([{
        "transaction_amount": 12500,
        "customer_payment_history": 10,
        "previous_success_rate": 0.85,
        "previous_failure_count": 1,
        "failure_type": "insufficient_funds",
        "retry_count": 1,
        "customer_age_days": 300,
        "subscription_status": "active",
        "time_since_failure": 2.0,
        "payment_method": "upi",
        "customer_segment": "regular",
        "invoice_age": 1.0,
        "previous_recovery_success": 1
    }])

    proba = float(pipeline.predict_proba(sample_df)[0][1])
    assert 0.0 <= proba <= 1.0, f"Probability {proba} out of range [0, 1]"


def test_12_risk_level_mapping_exact_thresholds():
    assert calculate_risk_level(0.20) == "HIGH"
    assert calculate_risk_level(0.3999) == "HIGH"
    assert calculate_risk_level(0.40) == "MEDIUM"
    assert calculate_risk_level(0.6999) == "MEDIUM"
    assert calculate_risk_level(0.70) == "LOW"
    assert calculate_risk_level(0.95) == "LOW"


def test_13_invalid_payload_rejection():
    # Out of range success rate
    payload = {
        "transaction_amount": 12500,
        "customer_payment_history": 10,
        "previous_success_rate": 1.5,  # invalid > 1.0
        "previous_failure_count": 1,
        "failure_type": "insufficient_funds",
        "retry_count": 1,
        "customer_age_days": 300,
        "subscription_status": "active",
        "time_since_failure": 2.0,
        "payment_method": "upi",
        "customer_segment": "regular",
        "invoice_age": 1.0,
        "previous_recovery_success": 1
    }
    response = client.post("/predict-recovery", json=payload)
    assert response.status_code == 422

    # Invalid categorical value
    payload_cat = payload.copy()
    payload_cat["previous_success_rate"] = 0.85
    payload_cat["failure_type"] = "invalid_failure_code"
    response_cat = client.post("/predict-recovery", json=payload_cat)
    assert response_cat.status_code == 422


def test_14_missing_feature_rejection():
    payload = {
        "transaction_amount": 12500,
        # missing customer_payment_history
        "previous_success_rate": 0.85,
        "previous_failure_count": 1,
        "failure_type": "insufficient_funds",
        "retry_count": 1,
        "customer_age_days": 300,
        "subscription_status": "active",
        "time_since_failure": 2.0,
        "payment_method": "upi",
        "customer_segment": "regular",
        "invoice_age": 1.0,
        "previous_recovery_success": 1
    }
    response = client.post("/predict-recovery", json=payload)
    assert response.status_code == 422


def test_15_demo_12500_payment_prediction():
    payload = {
        "transaction_amount": 12500,
        "customer_payment_history": 12,
        "previous_success_rate": 0.83,
        "previous_failure_count": 2,
        "failure_type": "insufficient_funds",
        "retry_count": 1,
        "customer_age_days": 420,
        "subscription_status": "active",
        "time_since_failure": 2,
        "payment_method": "upi",
        "customer_segment": "regular",
        "invoice_age": 0,
        "previous_recovery_success": 1
    }
    response = client.post("/predict-recovery", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["recovery_probability"], float)
    assert 0.0 <= data["recovery_probability"] <= 1.0
    assert data["risk_level"] in {"HIGH", "MEDIUM", "LOW"}
    assert data["model_version"] == MODEL_VERSION


def test_16_fastapi_post_predict_recovery_endpoint():
    payload = {
        "transaction_amount": 12500,
        "customer_payment_history": 12,
        "previous_success_rate": 0.83,
        "previous_failure_count": 2,
        "failure_type": "insufficient_funds",
        "retry_count": 1,
        "customer_age_days": 420,
        "subscription_status": "active",
        "time_since_failure": 2,
        "payment_method": "upi",
        "customer_segment": "regular",
        "invoice_age": 0,
        "previous_recovery_success": 1
    }
    response = client.post("/predict-recovery", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "recovery_probability" in data
    assert "risk_level" in data
    assert "model_version" in data


def test_17_existing_health_endpoint_still_works():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "status" in data["data"]
