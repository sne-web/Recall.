import os
from fastapi import HTTPException
from supabase import create_client, Client, ClientOptions


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=500, detail=f"Server misconfigured: {name} is not set")
    return value


def get_anon_client() -> Client:
    """Unauthenticated client, used for sign-up / sign-in / token validation."""
    return create_client(_require_env("SUPABASE_URL"), _require_env("SUPABASE_KEY"))


def get_user_client(token: str) -> Client:
    """
    Client that talks to Postgres *as the calling user* by forwarding their JWT.
    Row-Level Security policies on the `meetings` table then restrict every
    query to that user's own rows, so routers don't need manual user_id filters.
    """
    return create_client(
        _require_env("SUPABASE_URL"),
        _require_env("SUPABASE_KEY"),
        options=ClientOptions(headers={"Authorization": f"Bearer {token}"}),
    )


def get_admin_client() -> Client:
    """Service-role client that bypasses RLS. Only used for deleting auth users."""
    return create_client(_require_env("SUPABASE_URL"), _require_env("SUPABASE_SERVICE_ROLE_KEY"))
