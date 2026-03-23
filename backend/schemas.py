from pydantic import BaseModel, EmailStr
from typing import Optional, List
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


# ─── Team Schemas ────────────────────────────────────────────────────────────

class TeamCategory(str, Enum):
    sub_10 = "sub_10"
    sub_12 = "sub_12"
    sub_14 = "sub_14"
    sub_16 = "sub_16"
    sub_18 = "sub_18"
    senior = "senior"


class TeamBase(BaseModel):
    name: str
    category: TeamCategory
    coach_name: str


class TeamCreate(TeamBase):
    player_ids: Optional[List[int]] = None  # Lista de IDs de jugadores (solo para creación)
    leader_id: Optional[int] = None  # Líder del equipo (debe estar en player_ids)


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[TeamCategory] = None
    coach_name: Optional[str] = None
    player_ids: Optional[List[int]] = None
    leader_id: Optional[int] = None  # Líder del equipo (debe ser miembro del equipo)


class TeamOut(TeamBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    players: Optional[List[PlayerOut]] = None  # Lista completa de jugadores (no player_ids)
    leader_id: Optional[int] = None
    leader: Optional[PlayerOut] = None  # Datos del jugador líder (capitán/contacto)

    class Config:
        from_attributes = True


class SetLeaderBody(BaseModel):
    """Solo se puede designar un líder por equipo; el jugador debe estar en el equipo."""
    player_id: Optional[int] = None  # null para quitar el líder

# ─── Tournament Template Schemas ────────────────────────────────────────────

class TournamentTemplateBase(BaseModel):
    name: str
    is_home_away: Optional[bool] = False

class TournamentTemplateCreate(TournamentTemplateBase):
    pass

class TournamentTemplateOut(TournamentTemplateBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Tournament Schemas ────────────────────────────────────────────

class TournamentBase(BaseModel):
    name: str
    template_id: int

class TournamentCreate(TournamentBase):
    pass

class TournamentOut(TournamentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
        
class TournamentTeamAssign(BaseModel):
    team_ids: List[int]

class MatchOut(BaseModel):
    id: int
    round: int

    home_team: TeamOut
    away_team: TeamOut

    class Config:
        from_attributes = True