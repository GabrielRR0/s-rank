from datetime import datetime

from pydantic import BaseModel


class CreateRoomRequest(BaseModel):
    room_id: str
    password: str
    turnstile_token: str | None = None


class RealtimeTokenRequest(BaseModel):
    room_id: str
    turnstile_token: str | None = None
    password: str | None = None


class RefreshTokenRequest(BaseModel):
    room_id: str
    session_token: str


class InitialTokenResponse(BaseModel):
    access_token: str
    access_expires_at: datetime
    session_token: str
    session_expires_at: datetime


class RefreshTokenResponse(BaseModel):
    access_token: str
    access_expires_at: datetime
