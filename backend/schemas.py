from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum
from datetime import datetime, date


# ─── Auth Schemas ────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ─── Player Schemas ───────────────────────────────────────────────────────────

class PlayerPosition(str, Enum):
    goalkeeper = "goalkeeper"
    defender = "defender"
    midfielder = "midfielder"
    forward = "forward"


class PlayerBase(BaseModel):
    name: str
    surname: Optional[str] = None
    number: Optional[int] = None
    position: Optional[PlayerPosition] = None
    nationality: Optional[str] = None
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(PlayerBase):
    name: Optional[str] = None


class PlayerOut(PlayerBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
