"""remove_shield_add_coach_name_and_players

Revision ID: 0d74b562c8ae
Revises: e2ba8bcbfd8a
Create Date: 2026-03-16 22:56:09.737797

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d74b562c8ae'
down_revision: Union[str, None] = 'e2ba8bcbfd8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Crear tabla de relación many-to-many team_players
    op.create_table('team_players',
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['player_id'], ['players.id'], ),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
        sa.PrimaryKeyConstraint('team_id', 'player_id')
    )
    
    # Eliminar columna shield
    op.drop_column('teams', 'shield')
    
    # Eliminar foreign key de coach_id
    op.drop_constraint('teams_ibfk_1', 'teams', type_='foreignkey')
    
    # Eliminar columna coach_id
    op.drop_column('teams', 'coach_id')
    
    # Agregar columna coach_name
    op.add_column('teams', sa.Column('coach_name', sa.String(length=150), nullable=False, server_default=''))


def downgrade() -> None:
    # Eliminar columna coach_name
    op.drop_column('teams', 'coach_name')
    
    # Agregar columna coach_id
    op.add_column('teams', sa.Column('coach_id', sa.Integer(), nullable=False, server_default='1'))
    
    # Agregar foreign key de coach_id
    op.create_foreign_key('teams_ibfk_1', 'teams', 'users', ['coach_id'], ['id'])
    
    # Agregar columna shield
    op.add_column('teams', sa.Column('shield', sa.Text(), nullable=True))
    
    # Eliminar tabla team_players
    op.drop_table('team_players')
