"""
TorreAdmin API — FastAPI entry point.
Deployed as Vercel Serverless Function via api/index.py.
"""
import sys
import os

# Ensure the api/ directory is on the path so relative imports work
# both locally and on Vercel (which runs from the project root).
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from db import init_db, seed_db
from routers import (
    auth, edificios, usuarios, cuotas, mantenimientos,
    comunicados, zonas_comunes, accesos, paquetes,
    guardias, reportes, chat, superadmin
)

# ── DB bootstrap ─────────────────────────────────────────────────────────────
# Vercel serverless functions don't keep a persistent process, so lifespan
# events are unreliable. We initialize the DB at module load time instead —
# this runs once per cold start, which is exactly what we need.
_db_ready = False

def _bootstrap_db():
    global _db_ready
    if _db_ready:
        return
    if not os.environ.get("DATABASE_URL"):
        print("⚠️  DATABASE_URL not set — skipping DB init")
        return
    try:
        init_db()
        seed_db()
        _db_ready = True
    except Exception as e:
        print(f"⚠️  DB bootstrap warning: {e}")

_bootstrap_db()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TorreAdmin API",
    version="1.0.0",
    description="API para la plataforma de administración de propiedad horizontal TorreAdmin",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,           prefix="/api/auth",           tags=["Auth"])
app.include_router(edificios.router,      prefix="/api/edificios",      tags=["Edificios"])
app.include_router(usuarios.router,       prefix="/api/usuarios",       tags=["Usuarios"])
app.include_router(cuotas.router,         prefix="/api/cuotas",         tags=["Finanzas"])
app.include_router(mantenimientos.router, prefix="/api/mantenimientos", tags=["Mantenimiento"])
app.include_router(comunicados.router,    prefix="/api/comunicados",    tags=["Comunicados"])
app.include_router(zonas_comunes.router,  prefix="/api/zonas-comunes",  tags=["Zonas Comunes"])
app.include_router(accesos.router,        prefix="/api/accesos",        tags=["Accesos"])
app.include_router(paquetes.router,       prefix="/api/paquetes",       tags=["Paquetes"])
app.include_router(guardias.router,       prefix="/api/guardias",       tags=["Guardias"])
app.include_router(reportes.router,       prefix="/api/reportes",       tags=["Reportes"])
app.include_router(chat.router,           prefix="/api/chat",           tags=["Chat Seguridad"])
app.include_router(superadmin.router,     prefix="/api/superadmin",     tags=["Super Admin"])


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "TorreAdmin API", "db_ready": _db_ready}


@app.get("/api/setup")
def setup():
    """Manually trigger DB initialization and seed. Call once after deploy."""
    global _db_ready
    try:
        init_db()
        seed_db()
        _db_ready = True
        return {"status": "ok", "message": "DB initialized and seeded"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
