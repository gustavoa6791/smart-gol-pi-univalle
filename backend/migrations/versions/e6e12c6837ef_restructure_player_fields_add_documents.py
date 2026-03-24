"""restructure_player_fields_add_documents

Revision ID: e6e12c6837ef
Revises: b48ee6cdcd8d
Create Date: 2026-03-24 14:00:25.645351

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6e12c6837ef'
down_revision: Union[str, None] = 'b48ee6cdcd8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Agregar nuevas columnas a players
    op.add_column('players', sa.Column('first_name', sa.String(150), nullable=True))
    op.add_column('players', sa.Column('second_name', sa.String(150), nullable=True))
    op.add_column('players', sa.Column('first_surname', sa.String(150), nullable=True))
    op.add_column('players', sa.Column('second_surname', sa.String(150), nullable=True))
    op.add_column('players', sa.Column('document_type', sa.Enum('CC', 'TI', 'CE', 'PA', name='documenttype'), nullable=True))
    op.add_column('players', sa.Column('document_number', sa.String(50), nullable=True))
    op.add_column('players', sa.Column('photo_url', sa.String(500), nullable=True))

    # 2. Copiar datos existentes
    op.execute("UPDATE players SET first_name = name, first_surname = COALESCE(surname, 'Sin apellido')")

    # 3. Hacer NOT NULL las columnas requeridas
    op.alter_column('players', 'first_name', existing_type=sa.String(150), nullable=False)
    op.alter_column('players', 'first_surname', existing_type=sa.String(150), nullable=False)

    # 4. Eliminar columnas antiguas
    op.drop_column('players', 'name')
    op.drop_column('players', 'surname')
    op.drop_column('players', 'number')
    op.drop_column('players', 'nationality')

    # 5. Crear tabla player_documents
    op.create_table(
        'player_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('original_name', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['player_id'], ['players.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_player_documents_id', 'player_documents', ['id'])


def downgrade() -> None:
    op.drop_table('player_documents')

    op.add_column('players', sa.Column('name', sa.String(150), nullable=True))
    op.add_column('players', sa.Column('surname', sa.String(150), nullable=True))
    op.add_column('players', sa.Column('number', sa.Integer(), nullable=True))
    op.add_column('players', sa.Column('nationality', sa.String(100), nullable=True))

    op.execute("UPDATE players SET name = first_name, surname = first_surname")
    op.alter_column('players', 'name', nullable=False)

    op.drop_column('players', 'first_name')
    op.drop_column('players', 'second_name')
    op.drop_column('players', 'first_surname')
    op.drop_column('players', 'second_surname')
    op.drop_column('players', 'document_type')
    op.drop_column('players', 'document_number')
    op.drop_column('players', 'photo_url')
