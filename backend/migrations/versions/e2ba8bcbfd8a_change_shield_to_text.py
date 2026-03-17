"""change_shield_to_text

Revision ID: e2ba8bcbfd8a
Revises: bbcad033e5a5
Create Date: 2026-03-16 22:53:54.588327

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2ba8bcbfd8a'
down_revision: Union[str, None] = 'bbcad033e5a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cambiar la columna shield de VARCHAR(500) a TEXT
    op.alter_column('teams', 'shield',
                    existing_type=sa.String(length=500),
                    type_=sa.Text(),
                    existing_nullable=True)


def downgrade() -> None:
    # Revertir a VARCHAR(500)
    op.alter_column('teams', 'shield',
                    existing_type=sa.Text(),
                    type_=sa.String(length=500),
                    existing_nullable=True)
