import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import time
import models
from database import engine
from sqlalchemy import text

app = FastAPI(
    title="Smart Gol API",
    description="Sports team management API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import auth, players, teams, templates, tournaments
app.include_router(auth.router)
app.include_router(players.router)
app.include_router(teams.router)
app.include_router(templates.router)
app.include_router(tournaments.router)

# Servir archivos subidos como estáticos
UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup():
    """Wait for MySQL to be ready, then create tables."""
    max_retries = 30
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("✅ Database connected")
            break
        except Exception as e:
            print(f"⏳ DB not ready (attempt {attempt}/{max_retries}): {e}")
            if attempt == max_retries:
                raise
            time.sleep(3)


@app.get("/")
def root():
    return {"message": "Smart Gol API is running", "docs": "/docs"}
