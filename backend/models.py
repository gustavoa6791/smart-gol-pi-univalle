from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, ForeignKey, Date, UniqueConstraint, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum as py_enum
from database import Base

# Tabla de relación many-to-many entre Team y Player
team_players = Table(
    'team_players',
    Base.metadata,
    Column('team_id', Integer, ForeignKey('teams.id'), primary_key=True),
    Column('player_id', Integer, ForeignKey('players.id'), primary_key=True)
)
tournament_teams = Table(
    'tournament_teams',
    Base.metadata,
    Column('tournament_id', Integer, ForeignKey('tournaments.id'), primary_key=True),
    Column('team_id', Integer, ForeignKey('teams.id'), primary_key=True)
)


class PlayerPosition(str, py_enum.Enum):
    goalkeeper = "goalkeeper"
    defender = "defender"
    midfielder = "midfielder"
    forward = "forward"


class DocumentType(str, py_enum.Enum):
    CC = "CC"       # Cédula de Ciudadanía
    TI = "TI"       # Tarjeta de Identidad
    CE = "CE"       # Cédula de Extranjería
    PA = "PA"       # Pasaporte


class Gender(str, py_enum.Enum):
    M = "M"   # Masculino
    F = "F"   # Femenino
    O = "O"   # Otro


class TeamCategory(str, py_enum.Enum):
    sub_10 = "sub_10"
    sub_12 = "sub_12"
    sub_14 = "sub_14"
    sub_16 = "sub_16"
    sub_18 = "sub_18"
    senior = "senior"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(150), nullable=False)
    second_name = Column(String(150), nullable=True)
    first_surname = Column(String(150), nullable=False)
    second_surname = Column(String(150), nullable=True)
    document_type = Column(Enum(DocumentType), nullable=True)
    document_number = Column(String(50), nullable=True)
    position = Column(Enum(PlayerPosition), nullable=True)
    birth_date = Column(Date, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(150), nullable=True)
    address = Column(String(300), nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    photo_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    documents = relationship("PlayerDocument", back_populates="player", cascade="all, delete-orphan")


class PlayerDocument(Base):
    __tablename__ = "player_documents"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    original_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    player = relationship("Player", back_populates="documents")


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint('name', 'category', name='uq_team_name_category'),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    category = Column(Enum(TeamCategory), nullable=False, index=True)
    coach_name = Column(String(150), nullable=False)  # Nombre del formador como texto
    leader_id = Column(Integer, ForeignKey("players.id"), nullable=True, index=True)  # Un solo líder por equipo
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relación many-to-many con Player
    players = relationship("Player", secondary=team_players, backref="teams")
    leader = relationship("Player", foreign_keys=[leader_id])

class TournamentTemplate(Base):
    __tablename__ = "tournament_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    # Por ahora solo soportamos liga
    type = Column(String(50), default="league")
    # Configuración simple
    is_home_away = Column(
        Integer, default=0
    )  # 0 = solo ida, 1 = ida y vuelta
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    template_id = Column(Integer, ForeignKey("tournament_templates.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relación
    template = relationship("TournamentTemplate")
    teams = relationship("Team", secondary=tournament_teams)

class MatchStatus(str, py_enum.Enum):
    pending = "pending"
    played = "played"


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)

    tournament_id = Column(Integer, ForeignKey("tournaments.id"), nullable=False)

    home_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)

    round = Column(Integer, nullable=False)  # jornada

    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    status = Column(Enum(MatchStatus), default=MatchStatus.pending, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    tournament = relationship("Tournament")
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    player_stats = relationship("MatchPlayerStat", back_populates="match", cascade="all, delete-orphan")


class MatchPlayerStat(Base):
    __tablename__ = "match_player_stats"
    __table_args__ = (
        UniqueConstraint('match_id', 'player_id', name='uq_match_player'),
    )

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    goals = Column(Integer, default=0, nullable=False)
    yellow_cards = Column(Integer, default=0, nullable=False)
    red_cards = Column(Integer, default=0, nullable=False)

    match = relationship("Match", back_populates="player_stats")
    player = relationship("Player")
    team = relationship("Team")