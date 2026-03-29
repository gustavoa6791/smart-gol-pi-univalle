"""tournament types and match phases

Revision ID: 0cca915f0858
Revises: 0bd038112eff
Create Date: 2026-03-29 20:13:53.023439

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '0cca915f0858'
down_revision: Union[str, None] = '0bd038112eff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

tournament_type_enum = sa.Enum('round_robin', 'knockout', 'mixed', name='tournamenttype')
match_phase_enum = sa.Enum('group', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final', name='matchphase')


def upgrade() -> None:
    # -- Match: new columns --
    op.add_column('matches', sa.Column('phase', match_phase_enum, nullable=True))
    op.add_column('matches', sa.Column('group_name', sa.String(length=10), nullable=True))
    op.add_column('matches', sa.Column('bracket_position', sa.Integer(), nullable=True))
    op.add_column('matches', sa.Column('next_match_id', sa.Integer(), nullable=True))
    op.alter_column('matches', 'home_team_id',
               existing_type=mysql.INTEGER(),
               nullable=True)
    op.alter_column('matches', 'away_team_id',
               existing_type=mysql.INTEGER(),
               nullable=True)
    op.create_foreign_key('fk_match_next_match', 'matches', 'matches', ['next_match_id'], ['id'])

    # -- TournamentTemplate: new columns with server defaults for existing rows --
    op.add_column('tournament_templates', sa.Column('points_win', sa.Integer(), server_default='3', nullable=False))
    op.add_column('tournament_templates', sa.Column('points_draw', sa.Integer(), server_default='1', nullable=False))
    op.add_column('tournament_templates', sa.Column('points_loss', sa.Integer(), server_default='0', nullable=False))
    op.add_column('tournament_templates', sa.Column('num_groups', sa.Integer(), nullable=True))
    op.add_column('tournament_templates', sa.Column('teams_advance_per_group', sa.Integer(), nullable=True))
    op.add_column('tournament_templates', sa.Column('third_place_match', sa.Integer(), server_default='0', nullable=True))

    # -- Data migration: convert existing type values before changing column type --
    op.execute("UPDATE tournament_templates SET type = 'round_robin' WHERE type = 'league' OR type IS NULL")

    # -- Change type column from VARCHAR to ENUM --
    op.alter_column('tournament_templates', 'type',
               existing_type=mysql.VARCHAR(length=50),
               type_=tournament_type_enum,
               existing_nullable=True,
               nullable=False,
               server_default='round_robin')


def downgrade() -> None:
    op.alter_column('tournament_templates', 'type',
               existing_type=tournament_type_enum,
               type_=mysql.VARCHAR(length=50),
               nullable=True)
    op.drop_column('tournament_templates', 'third_place_match')
    op.drop_column('tournament_templates', 'teams_advance_per_group')
    op.drop_column('tournament_templates', 'num_groups')
    op.drop_column('tournament_templates', 'points_loss')
    op.drop_column('tournament_templates', 'points_draw')
    op.drop_column('tournament_templates', 'points_win')
    op.drop_constraint('fk_match_next_match', 'matches', type_='foreignkey')
    op.alter_column('matches', 'away_team_id',
               existing_type=mysql.INTEGER(),
               nullable=False)
    op.alter_column('matches', 'home_team_id',
               existing_type=mysql.INTEGER(),
               nullable=False)
    op.drop_column('matches', 'next_match_id')
    op.drop_column('matches', 'bracket_position')
    op.drop_column('matches', 'group_name')
    op.drop_column('matches', 'phase')
