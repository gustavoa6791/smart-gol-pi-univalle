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

## 🗄️ Ritual de Cambio en Base de Datos (Alembic)

Cuando quieras hacer un cambio en la base de datos (ej: añadir un campo), sigue estos 4 pasos:

### 1. Modificar el Código
Actualiza tus definiciones:
- **`backend/models.py`**: Añade la columna a la tabla.
- **`backend/schemas.py`**: Añade el campo al esquema Pydantic.
- **Frontend**: Actualiza `types.ts` y formularios necesarios.

### 2. Generar el "Mapa de Cambio" (Migración)
Con Docker corriendo, ejecuta:
```bash
docker exec smart_gol_backend alembic revision --autogenerate -m "descripcion_del_cambio"
```
*Aparecerá un nuevo archivo en `backend/migrations/versions/`.*

### 3. Revisar el archivo generado
Abre el nuevo archivo en `versions/`:
- **`upgrade()`**: Verifica qué se añade.
- **`downgrade()`**: Verifica cómo se deshace.

### 4. Aplicar el cambio
Ejecuta:
```bash
docker exec smart_gol_backend alembic upgrade head
```
*(O reinicia el contenedor, el `entrypoint.sh` lo hace por ti).*

---

### 💡 Paso Extra: Seeders
Si el campo es esencial para pruebas, actualiza **`backend/seed.py`** y ejecútalo manualmente:
```bash
docker exec smart_gol_backend python seed.py
```
**Credenciales Admin**: `admin@smartgol.com` / `admin123`

## Desarrollo Local

### Backend
```bash
cd backend
pip install -r requirements.txt
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
│   ├── migrations/    # Historial de versiones de la DB
│   ├── routers/       # Endpoints de la API
│   ├── models.py      # Tablas SQLAlchemy
│   ├── schemas.py     # Pydantic schemas
│   ├── seed.py        # Datos iniciales (Manual)
│   └── entrypoint.sh  # Auto-upgrade al iniciar
└── frontend/          # App Next.js
```
