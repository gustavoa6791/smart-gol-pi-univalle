"""merge role and descripcion heads

Revision ID: a1b2c3d4e5f6
Revises: 34b45ea71b8f, fefc36503808
Create Date: 2026-05-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, tuple[str, ...], None] = ('34b45ea71b8f', 'fefc36503808')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
