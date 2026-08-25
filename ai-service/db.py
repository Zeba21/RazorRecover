"""
RazorRecover Database Client Layer
Initializes the Supabase client and provides database connectivity helpers.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import HTTPException

# Load environment variables. First look in the root folder.
root_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=root_env_path)

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SECRET_KEY")

supabase: Client = None

# Dry run/Safe initialization to prevent server crash on startup if variables are unset
if supabase_url and supabase_key:
    try:
        supabase = create_client(
            supabase_url.strip().strip('"').strip("'"), 
            supabase_key.strip().strip('"').strip("'")
        )
    except Exception as e:
        print(f"⚠️  Failed to initialize Supabase client: {str(e)}")
else:
    print("⚠️  Warning: SUPABASE_URL or SUPABASE_SECRET_KEY is missing from environment variables.")

def get_supabase_client() -> Client:
    """Returns the active Supabase client instance, raising an error if uninitialized."""
    if supabase is None:
        raise HTTPException(
            status_code=500, 
            detail="Database client is uninitialized. Verify SUPABASE_URL and SUPABASE_SECRET_KEY in environment."
        )
    return supabase

def handle_db_error(func):
    """Decorator to catch Supabase client errors and raise clean HTTP exceptions."""
    import functools
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as e:
            error_msg = str(e)
            if "apikey" in error_msg.lower() or "secret" in error_msg.lower():
                error_msg = "Database authorization error"
            raise HTTPException(status_code=500, detail=f"Database error: {error_msg}")
    return wrapper
