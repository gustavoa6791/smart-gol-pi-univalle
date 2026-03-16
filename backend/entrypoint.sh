#!/bin/bash
set -e

echo "Verificando estado de la base de datos..."

echo "Aplicando migraciones de Alembic (upgrade head)..."
alembic upgrade head || true

echo "Iniciando servidor FastAPI..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
