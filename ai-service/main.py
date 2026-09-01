"""
RazorRecover AI Service — FastAPI Application
Provides ML prediction, LangGraph agent, and Database access endpoints.
"""

import json
from pathlib import Path
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import joblib
import pandas as pd
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator

from db import get_supabase_client, handle_db_error
from explain_model import generate_shap_explanation

app = FastAPI(
    title="RazorRecover AI Service",
    description="AI-powered payment recovery prediction and orchestration",
    version="1.0.0",
)

# CORS — allow frontend and backend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- Module 4: XGBoost Prediction Schemas & Logic -----------------

MODEL_PATH = Path(__file__).parent / "models" / "recovery_model.joblib"
METADATA_PATH = Path(__file__).parent / "models" / "model_metadata.json"

_loaded_pipeline = None
_loaded_version = "recovery-xgboost-v1.0"


def get_model_pipeline():
    global _loaded_pipeline, _loaded_version
    if _loaded_pipeline is None:
        if not MODEL_PATH.exists():
            raise HTTPException(
                status_code=503,
                detail=f"Model artifact not found at {MODEL_PATH}. Please run train_model.py first."
            )
        _loaded_pipeline = joblib.load(MODEL_PATH)
        if METADATA_PATH.exists():
            try:
                with open(METADATA_PATH, 'r') as f:
                    meta = json.load(f)
                    _loaded_version = meta.get("model_version", "recovery-xgboost-v1.0")
            except Exception:
                pass
    return _loaded_pipeline, _loaded_version


class PredictRecoveryRequest(BaseModel):
    transaction_amount: float = Field(..., ge=0, description="Payment transaction amount in INR")
    customer_payment_history: int = Field(..., ge=0, description="Count of past payments")
    previous_success_rate: float = Field(..., ge=0.0, le=1.0, description="Historical payment success rate (0.0 - 1.0)")
    previous_failure_count: int = Field(..., ge=0, description="Count of past payment failures")
    failure_type: str = Field(..., description="Failure category")
    retry_count: int = Field(..., ge=0, description="Number of retries attempted")
    customer_age_days: int = Field(..., ge=0, description="Days customer has been registered")
    subscription_status: str = Field(..., description="Current subscription status")
    time_since_failure: float = Field(..., ge=0, description="Time elapsed since failure")
    payment_method: str = Field(..., description="Payment method used")
    customer_segment: str = Field(..., description="Customer tier / segment")
    invoice_age: float = Field(..., ge=0, description="Invoice age in days")
    previous_recovery_success: int = Field(..., ge=0, le=1, description="Historical recovery success indicator (0 or 1)")

    @field_validator('failure_type')
    @classmethod
    def validate_failure_type(cls, v: str) -> str:
        valid_types = {'insufficient_funds', 'authentication_failed', 'gateway_timeout', 'card_expired', 'network_error'}
        if v not in valid_types:
            raise ValueError(f"Invalid failure_type '{v}'. Must be one of: {sorted(list(valid_types))}")
        return v

    @field_validator('subscription_status')
    @classmethod
    def validate_sub_status(cls, v: str) -> str:
        valid_statuses = {'active', 'past_due', 'trialing', 'canceled', 'unpaid', 'paused'}
        if v not in valid_statuses:
            raise ValueError(f"Invalid subscription_status '{v}'. Must be one of: {sorted(list(valid_statuses))}")
        return v

    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v: str) -> str:
        valid_methods = {'card', 'upi', 'netbanking', 'wallet'}
        if v not in valid_methods:
            raise ValueError(f"Invalid payment_method '{v}'. Must be one of: {sorted(list(valid_methods))}")
        return v

    @field_validator('customer_segment')
    @classmethod
    def validate_customer_segment(cls, v: str) -> str:
        valid_segments = {'regular', 'enterprise', 'vip', 'starter'}
        if v not in valid_segments:
            raise ValueError(f"Invalid customer_segment '{v}'. Must be one of: {sorted(list(valid_segments))}")
        return v


class PredictRecoveryResponse(BaseModel):
    recovery_probability: float
    risk_level: str
    model_version: str


def calculate_risk_level(probability: float) -> str:
    """
    Deterministic risk level logic based strictly on RECOVERY probability:
    - probability < 0.40 -> HIGH (low chance of recovery)
    - 0.40 <= probability < 0.70 -> MEDIUM
    - probability >= 0.70 -> LOW (high chance of recovery)
    """
    if probability < 0.40:
        return "HIGH"
    elif probability < 0.70:
        return "MEDIUM"
    else:
        return "LOW"


@app.post("/predict-recovery", response_model=PredictRecoveryResponse)
async def predict_recovery(request: PredictRecoveryRequest):
    """
    Predicts payment recovery probability using trained XGBoost pipeline.
    """
    pipeline, model_version = get_model_pipeline()

    input_df = pd.DataFrame([{
        "transaction_amount": request.transaction_amount,
        "customer_payment_history": request.customer_payment_history,
        "previous_success_rate": request.previous_success_rate,
        "previous_failure_count": request.previous_failure_count,
        "failure_type": request.failure_type,
        "retry_count": request.retry_count,
        "customer_age_days": request.customer_age_days,
        "subscription_status": request.subscription_status,
        "time_since_failure": request.time_since_failure,
        "payment_method": request.payment_method,
        "customer_segment": request.customer_segment,
        "invoice_age": request.invoice_age,
        "previous_recovery_success": request.previous_recovery_success,
    }])

    try:
        proba = float(pipeline.predict_proba(input_df)[0][1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    risk_level = calculate_risk_level(proba)

    return PredictRecoveryResponse(
        recovery_probability=round(proba, 4),
        risk_level=risk_level,
        model_version=model_version
    )


# ----------------- Module 5: SHAP Explainability Endpoints -----------------

class FactorDetail(BaseModel):
    feature: str
    importance: str
    explanation: str


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: str
    impact: str


class ExplainRecoveryResponse(BaseModel):
    recovery_probability: float
    risk_level: str
    model_version: str
    top_positive_factors: List[FactorDetail]
    top_negative_factors: List[FactorDetail]
    feature_importance: List[FeatureImportanceItem]
    human_explanation: str


@app.post("/explain-recovery", response_model=ExplainRecoveryResponse)
async def explain_recovery(request: PredictRecoveryRequest):
    """
    Predicts recovery probability AND generates human-readable SHAP feature explanations
    using the persisted Module 4 XGBoost model pipeline without retraining.
    """
    pipeline, model_version = get_model_pipeline()

    input_df = pd.DataFrame([{
        "transaction_amount": request.transaction_amount,
        "customer_payment_history": request.customer_payment_history,
        "previous_success_rate": request.previous_success_rate,
        "previous_failure_count": request.previous_failure_count,
        "failure_type": request.failure_type,
        "retry_count": request.retry_count,
        "customer_age_days": request.customer_age_days,
        "subscription_status": request.subscription_status,
        "time_since_failure": request.time_since_failure,
        "payment_method": request.payment_method,
        "customer_segment": request.customer_segment,
        "invoice_age": request.invoice_age,
        "previous_recovery_success": request.previous_recovery_success,
    }])

    try:
        proba = float(pipeline.predict_proba(input_df)[0][1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    risk_level = calculate_risk_level(proba)

    try:
        explanation_data = generate_shap_explanation(pipeline, input_df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SHAP explanation error: {str(e)}")

    return ExplainRecoveryResponse(
        recovery_probability=round(proba, 4),
        risk_level=risk_level,
        model_version=model_version,
        top_positive_factors=explanation_data["top_positive_factors"],
        top_negative_factors=explanation_data["top_negative_factors"],
        feature_importance=explanation_data["feature_importance"],
        human_explanation=explanation_data["human_explanation"],
    )


# ----------------- Module 6: LangGraph Agent Endpoint -----------------

class RunRecoveryAgentRequest(BaseModel):
    recovery_case_id: str = Field(..., description="UUID of recovery case")
    is_demo: bool = Field(True, description="Flag indicating simulated demo execution")
    demo_simulate_success: bool = Field(True, description="Simulate payment retry success in demo mode")
    initial_case: Optional[Dict[str, Any]] = None
    initial_payment: Optional[Dict[str, Any]] = None
    initial_customer: Optional[Dict[str, Any]] = None
    retry_count: Optional[int] = None
    reminder_count: Optional[int] = None


class RunRecoveryAgentResponse(BaseModel):
    success: bool
    data: Dict[str, Any]


@app.post("/run-recovery-agent", response_model=RunRecoveryAgentResponse)
async def run_agent_endpoint(request: RunRecoveryAgentRequest):
    """
    Executes Module 6 LangGraph Revenue Recovery Agent workflow for a given case.
    """
    try:
        from agent import run_recovery_agent
        result = run_recovery_agent(
            recovery_case_id=request.recovery_case_id,
            is_demo=request.is_demo,
            demo_simulate_success=request.demo_simulate_success,
            initial_case=request.initial_case,
            initial_payment=request.initial_payment,
            initial_customer=request.initial_customer,
            retry_count=request.retry_count,
            reminder_count=request.reminder_count
        )
        return RunRecoveryAgentResponse(success=True, data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent execution error: {str(e)}")


# ----------------- Existing Endpoints (Module 0-3) -----------------

@app.get("/health")
async def health_check():
    """Health endpoint — returns service status."""
    db_connected = False
    try:
        client = get_supabase_client()
        client.table("payments").select("id").limit(1).execute()
        db_connected = True
    except Exception:
        pass

    return {
        "success": True,
        "data": {
            "status": "healthy" if db_connected else "degraded",
            "service": "razorrecover-ai",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "database": "connected" if db_connected else "disconnected"
        },
    }


@app.get("/")
async def root():
    """Root endpoint — service info."""
    return {
        "success": True,
        "data": {
            "name": "RazorRecover AI Service",
            "version": "1.0.0",
            "description": "AI-powered payment recovery prediction and orchestration",
            "docs": "/docs",
            "health": "/health",
            "predict": "/predict-recovery",
        },
    }


@app.get("/api/payments")
@handle_db_error
def get_payments():
    """Returns payment records needed by the dashboard/demo."""
    client = get_supabase_client()
    response = client.table("payments").select("*, customers(name, email)").order("created_at", desc=True).execute()
    return {
        "success": True,
        "data": response.data
    }


@app.get("/api/recovery-cases")
@handle_db_error
def get_recovery_cases():
    """Returns recovery cases with nested payment and customer details."""
    client = get_supabase_client()
    response = client.table("recovery_cases").select("*, payments(*), customers(name, email)").order("created_at", desc=True).execute()
    return {
        "success": True,
        "data": response.data
    }


@app.get("/api/dashboard/summary")
@handle_db_error
def get_dashboard_summary():
    """Returns summary metrics aggregated from the database."""
    client = get_supabase_client()
    
    payments_res = client.table("payments").select("amount, status").execute()
    payments = payments_res.data or []
    
    total_payments = len(payments)
    successful_payments = sum(1 for p in payments if p["status"] == "captured")
    failed_payments = sum(1 for p in payments if p["status"] in ("failed", "failed_checkout"))
    
    cases_res = client.table("recovery_cases").select("revenue_at_risk, recovered_amount, status, recovery_probability").execute()
    cases = cases_res.data or []
    
    recovery_cases_count = len(cases)
    revenue_at_risk = sum(float(c["revenue_at_risk"]) for c in cases if c["status"] in ("open", "in_recovery"))
    
    recoverable_amount = sum(
        float(c["revenue_at_risk"]) * float(c["recovery_probability"] or 0) 
        for c in cases if c["status"] in ("open", "in_recovery")
    )
    
    attempts_res = client.table("recovery_attempts").select("status").execute()
    attempts = attempts_res.data or []
    recovery_attempts_count = len(attempts)
    
    recovered_cases = sum(1 for c in cases if c["status"] == "recovered")
    failed_cases = sum(1 for c in cases if c["status"] == "failed")
    
    return {
        "success": True,
        "data": {
            "total_payments": total_payments,
            "successful_payments": successful_payments,
            "failed_payments": failed_payments,
            "revenue_at_risk": revenue_at_risk,
            "recovery_cases": recovery_cases_count,
            "recoverable_amount": recoverable_amount,
            "recovery_attempts": recovery_attempts_count,
            "recovery_outcomes": {
                "recovered": recovered_cases,
                "failed": failed_cases,
                "success_rate": (recovered_cases / (recovered_cases + failed_cases)) if (recovered_cases + failed_cases) > 0 else 0.0
            }
        }
    }
