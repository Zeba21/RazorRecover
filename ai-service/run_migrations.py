"""
RazorRecover Database Migration Script
Applies SQL migration files and seeds the database.
"""

import os
import re
import sys
import psycopg2
from dotenv import load_dotenv

# Ensure stdout uses UTF-8 if possible, or fallback gracefully
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass  # In case stdout doesn't support reconfigure in some environments

def run_migrations():
    # Load environment variables from the root .env
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    root_env_path = os.path.join(root_dir, ".env")
    load_dotenv(dotenv_path=root_env_path)

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_db_password = os.getenv("SUPABASE_DB_PASSWORD")
    database_url = os.getenv("DATABASE_URL")

    if not supabase_url:
        print("[ERROR] SUPABASE_URL environment variable is missing from .env", file=sys.stderr)
        return False

    # Extract project ref from SUPABASE_URL
    match = re.search(r"https://(.*?)\.supabase\.co", supabase_url)
    if not match:
        print(f"[ERROR] Could not extract project reference from SUPABASE_URL: {supabase_url}", file=sys.stderr)
        return False
    project_ref = match.group(1)

    # Determine connection credentials
    conn = None
    if database_url:
        print("Connecting to database using DATABASE_URL...")
        try:
            conn = psycopg2.connect(database_url)
        except Exception as e:
            print(f"[ERROR] Failed to connect using DATABASE_URL: {e}", file=sys.stderr)
    
    if not conn:
        if not supabase_db_password:
            print("\n" + "="*80)
            print("[WARNING] DATABASE PASSWORD CONFIGURATION REQUIRED")
            print("="*80)
            print("To execute migrations, a PostgreSQL database connection is required.")
            print("Please add the following environment variable to your '.env' file in the project root:")
            print("\n    SUPABASE_DB_PASSWORD=your_database_password_here")
            print("\nThen run the migration script again.")
            print("="*80 + "\n")
            return False

        # Attempt connection using different host strategies
        # 1. Direct host (port 5432)
        # 2. Connection pooler host (port 6543)
        connection_strategies = [
            {
                "name": "Direct Host (IPv6/IPv4)",
                "host": f"db.{project_ref}.supabase.co",
                "port": 5432,
                "user": "postgres"
            },
            {
                "name": "Connection Pooler (IPv4 Fallback)",
                "host": "aws-0-ap-south-1.pooler.supabase.com",
                "port": 6543,
                "user": f"postgres.{project_ref}"
            }
        ]

        for strategy in connection_strategies:
            print(f"Attempting to connect via {strategy['name']}...")
            try:
                # Remove brackets/quotes/spaces from password
                pwd = supabase_db_password.strip().strip('"').strip("'")
                conn = psycopg2.connect(
                    host=strategy["host"],
                    port=strategy["port"],
                    database="postgres",
                    user=strategy["user"],
                    password=pwd,
                    connect_timeout=5
                )
                print(f"[SUCCESS] Connected successfully via {strategy['name']}!")
                break
            except Exception as e:
                # Clean error string representation to avoid printing raw password or complex objects
                err_str = str(e).replace(pwd, "********") if pwd else str(e)
                print(f"[WARNING] Connection strategy failed: {err_str}")

    if not conn:
        print("[ERROR] Could not connect to Supabase PostgreSQL database using any connection strategy.", file=sys.stderr)
        return False

    conn.autocommit = True
    cursor = conn.cursor()

    # Locate migrations and seed data
    migrations_dir = os.path.join(root_dir, "database", "migrations")
    migration_files = sorted([
        f for f in os.listdir(migrations_dir) if f.endswith(".sql")
    ])

    print(f"\nFound {len(migration_files)} migration files.")

    try:
        # Run migrations in order
        for m_file in migration_files:
            file_path = os.path.join(migrations_dir, m_file)
            print(f"Applying migration: {m_file}...")
            with open(file_path, "r", encoding="utf-8") as f:
                sql = f.read()
                if sql.strip():
                    cursor.execute(sql)
            print(f"[SUCCESS] Applied: {m_file}")

        # Run seed data
        seed_file_path = os.path.join(root_dir, "database", "seed.sql")
        if os.path.exists(seed_file_path):
            print("Applying seed data from seed.sql...")
            with open(seed_file_path, "r", encoding="utf-8") as f:
                sql = f.read()
                if sql.strip():
                    cursor.execute(sql)
            print("[SUCCESS] Seed data inserted successfully!")
        else:
            print("[WARNING] seed.sql not found. Skipping data seeding.")

        # Introspect database to verify all 10 tables exist
        cursor.execute("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
        """)
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\nVerified tables in 'public' schema ({len(tables)} total):")
        for table in sorted(tables):
            print(f"  - {table}")

        expected_tables = {
            "customers", "payments", "subscriptions", "invoices", 
            "recovery_cases", "recovery_attempts", "ai_predictions", 
            "ai_decisions", "audit_logs", "notifications"
        }
        
        missing_tables = expected_tables - set(tables)
        if missing_tables:
            print(f"[ERROR] Missing expected tables: {missing_tables}", file=sys.stderr)
            return False
        else:
            print("[SUCCESS] All 10 tables exist and schema was applied successfully.")

    except Exception as e:
        print(f"[ERROR] Exception during migration application: {str(e)}", file=sys.stderr)
        return False
    finally:
        cursor.close()
        conn.close()

    return True

if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)
