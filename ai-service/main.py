"""
RazorRecover AI Service — FastAPI Application
Provides ML prediction, LangGraph agent, and Database access endpoints.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
from db import get_supabase_client, handle_db_error

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


@app.get("/health")
async def health_check():
    """Health endpoint — returns service status."""
    db_connected = False
    try:
        client = get_supabase_client()
        # Test connection by selecting 1 row from payments
        # We handle table-not-exist case gracefully since health check checks connection, not schema existence
        res = client.table("payments").select("id").limit(1).execute()
        db_connected = True
    except Exception as e:
        # If credentials exist, but connection fails, db_connected is false
        # We do not crash the health check
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
        },
    }


@app.get("/api/payments")
@handle_db_error
def get_payments():
    """Returns payment records needed by the dashboard/demo."""
    client = get_supabase_client()
    # Query payments table joined with customer name/email
    # PostgREST syntax for join: table(field1, field2)
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
    
    # 1. Fetch payments for status aggregation
    payments_res = client.table("payments").select("amount, status").execute()
    payments = payments_res.data or []
    
    total_payments = len(payments)
    successful_payments = sum(1 for p in payments if p["status"] == "captured")
    failed_payments = sum(1 for p in payments if p["status"] in ("failed", "failed_checkout"))
    
    # 2. Fetch recovery cases for recovery metrics
    cases_res = client.table("recovery_cases").select("revenue_at_risk, recovered_amount, status, recovery_probability").execute()
    cases = cases_res.data or []
    
    recovery_cases_count = len(cases)
    
    # Revenue at risk is sum of failed payment amounts which are currently in recovery
    revenue_at_risk = sum(float(c["revenue_at_risk"]) for c in cases if c["status"] in ("open", "in_recovery"))
    
    # Recoverable amount is probability-weighted revenue at risk of active cases
    recoverable_amount = sum(
        float(c["revenue_at_risk"]) * float(c["recovery_probability"] or 0) 
        for c in cases if c["status"] in ("open", "in_recovery")
    )
    
    # 3. Fetch recovery attempts
    attempts_res = client.table("recovery_attempts").select("status").execute()
    attempts = attempts_res.data or []
    recovery_attempts_count = len(attempts)
    
    # 4. Outome counts
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
