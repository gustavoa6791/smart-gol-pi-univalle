# Smart Gol

Aplicación de gestión de equipos de fútbol con analítica y administración de jugadores.

## Stack Tecnológico

- **Frontend**: Next.js 16 + Tailwind CSS (Shadcn UI)
- **Backend**: FastAPI + SQLAlchemy + MySQL
- **Base de Datos**: MySQL (Latest)
- **Contenedores**: Docker Compose

## Despliegue con Docker

### Un solo comando
```bash
docker compose -p smart_gol up --build -d
```

### Servicios
| Servicio  | URL |
|-----------|-----|
| Frontend  | [http://localhost:3000](http://localhost:3000) |
| Backend   | [http://localhost:8000](http://localhost:8000) |
| API Docs  | [http://localhost:8000/docs](http://localhost:8000/docs) |

## 🗄️ Base de Datos y Migraciones (Alembic)

Ya no utilizamos la creación automática de tablas por código. Ahora todo se gestiona mediante **Alembic** para permitir versiones.

### ¿Cómo se crean/actualizan las tablas?
Las tablas se crean automáticamente al desplegar con Docker, pero si necesitas hacerlo manual o crear nuevas versiones:

1. **Generar una nueva migración** (tras cambiar `models.py`):
   ```bash
   docker exec smart_gol_backend alembic revision --autogenerate -m "descripcion del cambio"
   ```
2. **Aplicar cambios a la DB**:
   ```bash
   docker exec smart_gol_backend alembic upgrade head
   ```
3. **Ver estado actual**:
   ```bash
   docker exec smart_gol_backend alembic current
   ```

## 🌱 Seeders (Datos Iniciales)

Para poblar la base de datos con un usuario administrador y jugadores de prueba:

```bash
docker exec smart_gol_backend python seed.py
```

**Credenciales por defecto:**
- **Email**: `admin@smartgol.com`
- **Password**: `admin123`

## Desarrollo Local

### Backend
```bash
cd backend
pip install -r requirements.txt
# Asegúrate de tener las variables de entorno configuradas
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Estructura del Proyecto
```
smart_gol/
├── backend/
│   ├── migrations/    # Historial de versiones de la DB (Alembic)
│   ├── routers/       # Endpoints de la API
│   ├── models.py      # Definición de tablas
│   ├── schemas.py     # Validación de datos (Pydantic)
│   ├── seed.py        # Script para datos iniciales
│   └── alembic.ini    # Configuración de migraciones
├── frontend/
│   ├── app/           # Páginas y componentes (Next.js App Router)
│   ├── components/    # UI Components (Shadcn)
│   └── lib/           # Utilidades y tipos
└── docker-compose.yml
```
