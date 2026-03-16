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


class PlayerPosition(str, py_enum.Enum):
    goalkeeper = "goalkeeper"
    defender = "defender"
    midfielder = "midfielder"
    forward = "forward"


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
    name = Column(String(150), nullable=False)
    surname = Column(String(150), nullable=True)
    number = Column(Integer, nullable=True)
    position = Column(Enum(PlayerPosition), nullable=True)
    nationality = Column(String(100), nullable=True)
    birth_date = Column(Date, nullable=True)
    phone = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint('name', 'category', name='uq_team_name_category'),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    category = Column(Enum(TeamCategory), nullable=False, index=True)
    coach_name = Column(String(150), nullable=False)  # Nombre del formador como texto
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relación many-to-many con Player
    players = relationship("Player", secondary=team_players, backref="teams")
