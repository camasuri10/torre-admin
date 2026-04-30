"""
TorreAdmin API — FastAPI entry point.
Deployed as Vercel Serverless Function via api/index.py.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from db import init_db, seed_db
from routers import (
    edificios, usuarios, cuotas, mantenimientos,
    comunicados, zonas_comunes, accesos, paquetes,
    guardias, reportes, chat
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema on startup
    try:
        init_db()
        seed_db()
    except Exception as e:
        print(f"⚠️  DB init warning: {e}")
    yield


app = FastAPI(
    title="TorreAdmin API",
    version="1.0.0",
    description="API para la plataforma de administración de propiedad horizontal TorreAdmin",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
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


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "TorreAdmin API"}
