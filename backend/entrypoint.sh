#!/bin/bash

# Esperar un poco a que la DB esté lista (aunque Docker tiene healthcheck)
echo "🚀 Verificando estado de la base de datos..."

# Ejecutar migraciones automáticamente
echo "📂 Aplicando migraciones de Alembic (upgrade head)..."
alembic upgrade head

# Iniciar el servidor FastAPI
echo "🔥 Iniciando servidor FastAPI..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
