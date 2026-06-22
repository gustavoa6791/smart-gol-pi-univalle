"""merge heads

Revision ID: eaa2880b3e4f
Revises: a1b2c3d4e5f6, a6b1374c7a67
Create Date: 2026-06-22 22:58:37.218194

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eaa2880b3e4f'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', 'a6b1374c7a67')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
