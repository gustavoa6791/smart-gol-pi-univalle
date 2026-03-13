from sqlalchemy import Column, Integer, String, DateTime, Enum, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum as py_enum
from database import Base


class PlayerPosition(str, py_enum.Enum):
    goalkeeper = "goalkeeper"
    defender = "defender"
    midfielder = "midfielder"
    forward = "forward"


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
