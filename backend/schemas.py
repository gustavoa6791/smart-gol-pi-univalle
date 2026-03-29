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


class DocumentType(str, Enum):
    CC = "CC"
    TI = "TI"
    CE = "CE"
    PA = "PA"


class Gender(str, Enum):
    M = "M"
    F = "F"
    O = "O"


class PlayerDocumentOut(BaseModel):
    id: int
    player_id: int
    filename: str
    original_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class PlayerBase(BaseModel):
    first_name: str
    second_name: Optional[str] = None
    first_surname: str
    second_surname: Optional[str] = None
    document_type: Optional[DocumentType] = None
    document_number: Optional[str] = None
    position: Optional[PlayerPosition] = None
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[Gender] = None
    notes: Optional[str] = None


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    first_name: Optional[str] = None
    second_name: Optional[str] = None
    first_surname: Optional[str] = None
    second_surname: Optional[str] = None
    document_type: Optional[DocumentType] = None
    document_number: Optional[str] = None
    position: Optional[PlayerPosition] = None
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[Gender] = None
    notes: Optional[str] = None


class PlayerOut(PlayerBase):
    id: int
    photo_url: Optional[str] = None
    documents: Optional[List[PlayerDocumentOut]] = None
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
    category: Optional[TeamCategory] = None
    coach_name: str


class TeamCreate(TeamBase):
    player_ids: Optional[List[int]] = None
    leader_id: Optional[int] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[TeamCategory] = None
    coach_name: Optional[str] = None
    player_ids: Optional[List[int]] = None
    leader_id: Optional[int] = None


class TeamOut(BaseModel):
    id: int
    name: str
    category: Optional[TeamCategory] = None
    coach_name: str
    shield_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    players: Optional[List[PlayerOut]] = None
    leader_id: Optional[int] = None
    leader: Optional[PlayerOut] = None

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

class MatchStatus(str, Enum):
    pending = "pending"
    played = "played"


class MatchOut(BaseModel):
    id: int
    round: int
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: MatchStatus = MatchStatus.pending

    home_team: TeamOut
    away_team: TeamOut

    class Config:
        from_attributes = True


class MatchUpdateScore(BaseModel):
    home_score: int
    away_score: int


# ─── Match Player Stats Schemas ──────────────────────────────────────────

class MatchPlayerStatBase(BaseModel):
    player_id: int
    team_id: int
    goals: int = 0
    yellow_cards: int = 0
    red_cards: int = 0


class MatchPlayerStatOut(MatchPlayerStatBase):
    id: int
    player: PlayerOut

    class Config:
        from_attributes = True


class MatchDetailOut(BaseModel):
    id: int
    round: int
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    status: MatchStatus = MatchStatus.pending
    home_team: TeamOut
    away_team: TeamOut
    player_stats: List[MatchPlayerStatOut] = []

    class Config:
        from_attributes = True


class SaveMatchStats(BaseModel):
    stats: List[MatchPlayerStatBase]


# ─── Standings Schemas ───────────────────────────────────────────────────

class StandingRow(BaseModel):
    team_id: int
    team_name: str
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_difference: int = 0
    points: int = 0