"""
RazorRecover AI Service — FastAPI Application
Provides ML prediction and LangGraph agent endpoints (Module 1: health only).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone

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
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "service": "razorrecover-ai",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
