"""add_teams_table

Revision ID: bbcad033e5a5
Revises: dbaefc2c05e2
Create Date: 2026-03-16 22:40:57.362644

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bbcad033e5a5'
down_revision: Union[str, None] = 'dbaefc2c05e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Crear tabla teams (MySQL usa ENUM directamente en la columna)
    op.create_table('teams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('shield', sa.String(length=500), nullable=True),
        sa.Column('category', sa.Enum('sub_10', 'sub_12', 'sub_14', 'sub_16', 'sub_18', 'senior', name='teamcategory', create_constraint=True), nullable=False),
        sa.Column('coach_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['coach_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', 'category', name='uq_team_name_category')
    )
    op.create_index(op.f('ix_teams_id'), 'teams', ['id'], unique=False)
    op.create_index(op.f('ix_teams_name'), 'teams', ['name'], unique=False)
    op.create_index(op.f('ix_teams_category'), 'teams', ['category'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_teams_category'), table_name='teams')
    op.drop_index(op.f('ix_teams_name'), table_name='teams')
    op.drop_index(op.f('ix_teams_id'), table_name='teams')
    op.drop_table('teams')
