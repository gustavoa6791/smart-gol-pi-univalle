"""add_team_leader

Revision ID: f1a2b3c4d5e6
Revises: 0d74b562c8ae
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '0d74b562c8ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('teams', sa.Column('leader_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_teams_leader_id', 'teams', 'players', ['leader_id'], ['id'])
    op.create_index(op.f('ix_teams_leader_id'), 'teams', ['leader_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_teams_leader_id'), table_name='teams')
    op.drop_constraint('fk_teams_leader_id', 'teams', type_='foreignkey')
    op.drop_column('teams', 'leader_id')
