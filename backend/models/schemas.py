from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    requires_confirmation: bool = False
    message: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class NameUpdate(BaseModel):
    full_name: str = Field(max_length=100)


class ChatRequest(BaseModel):
    question: str = Field(max_length=2000)
    meeting_id: Optional[UUID] = None  # None = search across all of the user's meetings
