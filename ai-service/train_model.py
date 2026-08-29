"""
Model Training and Evaluation Pipeline (Module 4)

Trains an XGBoost classifier pipeline on synthetic failed payment recovery data.
Saves the persisted pipeline artifact (.joblib) and model metadata (.json).

Features:
- Numerical (9): transaction_amount, customer_payment_history, previous_success_rate,
  previous_failure_count, retry_count, customer_age_days, time_since_failure, invoice_age, previous_recovery_success
- Categorical (4): failure_type, subscription_status, payment_method, customer_segment

Target:
- recovered (0 or 1)
"""

import json
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from generate_data import generate_synthetic_recovery_data

# Feature definitions
NUMERICAL_FEATURES = [
    'transaction_amount',
    'customer_payment_history',
    'previous_success_rate',
    'previous_failure_count',
    'retry_count',
    'customer_age_days',
    'time_since_failure',
    'invoice_age',
    'previous_recovery_success',
]

CATEGORICAL_FEATURES = [
    'failure_type',
    'subscription_status',
    'payment_method',
    'customer_segment',
]

ALL_FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES
TARGET = 'recovered'
MODEL_VERSION = "recovery-xgboost-v1.0"


def train_and_evaluate_model(random_state: int = 42) -> dict:
    """
    Executes data generation/loading, train/val/test splitting, pipeline training,
    test evaluation, and model persistence.
    """
    base_dir = Path(__file__).parent
    csv_path = base_dir / "data" / "synthetic_recovery_data.csv"

    if csv_path.exists():
        df = pd.read_csv(csv_path)
    else:
        df = generate_synthetic_recovery_data(n_samples=12000, random_state=random_state)

    X = df[ALL_FEATURES]
    y = df[TARGET]

    # 1. Stratified Split: 70% Train, 15% Validation, 15% Test
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=random_state, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=random_state, stratify=y_temp
    )

    print(f"Dataset Split Sizes -> Train: {len(X_train)}, Validation: {len(X_val)}, Test: {len(X_test)}")

    # 2. Reproducible Preprocessing Pipeline
    num_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='median'))
    ])

    cat_transformer = Pipeline([
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('encoder', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', num_transformer, NUMERICAL_FEATURES),
            ('cat', cat_transformer, CATEGORICAL_FEATURES)
        ]
    )

    # 3. XGBoost Classifier Pipeline
    xgb_params = {
        'n_estimators': 150,
        'max_depth': 4,
        'learning_rate': 0.05,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'random_state': random_state,
        'eval_metric': 'logloss'
    }

    full_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', XGBClassifier(**xgb_params))
    ])

    # 4. Train Model on Train Set
    print("Training XGBoost pipeline...")
    full_pipeline.fit(X_train, y_train)

    # 5. Validation Check
    val_probs = full_pipeline.predict_proba(X_val)[:, 1]
    val_preds = (val_probs >= 0.50).astype(int)
    val_auc = roc_auc_score(y_val, val_probs)
    print(f"Validation Set ROC-AUC: {val_auc:.4f}")

    # 6. Final Evaluation on UNSEEN Test Set
    test_probs = full_pipeline.predict_proba(X_test)[:, 1]
    test_preds = (test_probs >= 0.50).astype(int)

    acc = float(accuracy_score(y_test, test_preds))
    prec = float(precision_score(y_test, test_preds, zero_division=0))
    rec = float(recall_score(y_test, test_preds, zero_division=0))
    f1 = float(f1_score(y_test, test_preds, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, test_probs))
    cm = confusion_matrix(y_test, test_preds).tolist()

    print("\n========== FINAL UNSEEN TEST EVALUATION METRICS ==========")
    print(f"Accuracy:        {acc:.4f}")
    print(f"Precision:       {prec:.4f}")
    print(f"Recall:          {rec:.4f}")
    print(f"F1 Score:        {f1:.4f}")
    print(f"ROC-AUC:         {roc_auc:.4f}")
    print(f"Confusion Matrix:\n {np.array(cm)}")
    print("=========================================================\n")

    # 7. Model Persistence
    models_dir = base_dir / "models"
    models_dir.mkdir(exist_ok=True)
    model_path = models_dir / "recovery_model.joblib"
    metadata_path = models_dir / "model_metadata.json"

    joblib.dump(full_pipeline, model_path)
    print(f"Saved joblib model artifact to: {model_path}")

    metadata = {
        "model_version": MODEL_VERSION,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "feature_names": ALL_FEATURES,
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
        "test_samples": len(X_test),
        "metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "roc_auc": round(roc_auc, 4)
        },
        "confusion_matrix": cm,
        "hyperparameters": xgb_params
    }

    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved model metadata to: {metadata_path}")
    return metadata


if __name__ == "__main__":
    train_and_evaluate_model(random_state=42)
