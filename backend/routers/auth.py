import os
import requests
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import AuthApiError, Client
from models.schemas import UserCreate, UserLogin, AuthResponse, RefreshRequest, NameUpdate
from services.supabase_client import get_anon_client, get_user_client, get_admin_client
from services.rag_engine import delete_index

router = APIRouter(prefix="/api/auth", tags=["auth"])

security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validates the bearer token with Supabase Auth and returns the user."""
    try:
        response = get_anon_client().auth.get_user(credentials.credentials)
    except AuthApiError:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")
    except Exception as e:
        # Network/config problems are not the user's fault — don't log them out for it.
        print(f"Auth service error: {e}")
        raise HTTPException(status_code=503, detail="Authentication service is unavailable. Try again shortly.")

    if not response or not response.user:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")
    return response.user


def get_user_db(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Client:
    """Supabase client scoped to the caller, so RLS applies to every query."""
    return get_user_client(credentials.credentials)


def _session_response(session) -> dict:
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "token_type": "bearer",
    }


@router.post("/register", response_model=AuthResponse)
def register(user: UserCreate):
    try:
        response = get_anon_client().auth.sign_up({"email": user.email, "password": user.password})
    except AuthApiError as e:
        raise HTTPException(status_code=400, detail=e.message)

    # When "Confirm email" is enabled in Supabase, sign-up succeeds but no session is issued yet.
    if not response.session:
        return {"requires_confirmation": True, "message": "Account created! Check your email to confirm it, then log in."}
    return _session_response(response.session)


@router.post("/login", response_model=AuthResponse)
def login(user: UserLogin):
    try:
        response = get_anon_client().auth.sign_in_with_password({"email": user.email, "password": user.password})
    except AuthApiError as e:
        raise HTTPException(status_code=401, detail=e.message)

    if not response.session:
        raise HTTPException(status_code=401, detail="Invalid login credentials")
    return _session_response(response.session)


@router.post("/refresh", response_model=AuthResponse)
def refresh(body: RefreshRequest):
    """Exchanges a refresh token for a new access token (Supabase access tokens expire after ~1h)."""
    try:
        response = get_anon_client().auth.refresh_session(body.refresh_token)
    except AuthApiError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

    if not response.session:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return _session_response(response.session)


@router.get("/me")
def get_me(user=Depends(get_current_user)):
    return {
        "email": user.email,
        "full_name": (user.user_metadata or {}).get("full_name", ""),
    }


@router.put("/me/name")
def update_name(name_update: NameUpdate, user=Depends(get_current_user),
                credentials: HTTPAuthorizationCredentials = Depends(security)):
    full_name = name_update.full_name.strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    # Supabase's "update current user" endpoint, called with the user's own token.
    resp = requests.put(
        f"{os.getenv('SUPABASE_URL')}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {credentials.credentials}",
            "apikey": os.getenv("SUPABASE_KEY"),
            "Content-Type": "application/json",
        },
        json={"data": {"full_name": full_name}},
        timeout=10,
    )
    if resp.status_code >= 400:
        raise HTTPException(status_code=400, detail="Failed to update name")
    return {"full_name": full_name}


@router.delete("/me")
def delete_account(user=Depends(get_current_user), db: Client = Depends(get_user_db)):
    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_SERVICE_ROLE_KEY is not set")

    # 1. Delete the user's meetings and their vector indexes. The vector store lives on
    #    the backend's local disk, so a Postgres cascade alone would leave it orphaned.
    meetings = db.table("meetings").delete().eq("user_id", str(user.id)).execute().data or []
    for m in meetings:
        delete_index(m["id"])

    # 2. Delete the auth user itself (needs the service-role key).
    try:
        get_admin_client().auth.admin.delete_user(str(user.id))
    except Exception as e:
        print(f"Admin delete failed: {e}")
        raise HTTPException(status_code=500, detail="Could not delete account. Please try again.")

    return {"deleted": True}
