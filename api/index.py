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
    guardias, reportes, chat, superadmin,
    conjuntos, vehiculos, mascotas, proveedores, backoffice, encuestas,
    procurement,
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
app.include_router(conjuntos.router,      prefix="/api/conjuntos",       tags=["Conjuntos"])
app.include_router(vehiculos.router,      prefix="/api/vehiculos",       tags=["Vehículos"])
app.include_router(mascotas.router,       prefix="/api/mascotas",        tags=["Mascotas"])
app.include_router(proveedores.router,    prefix="/api/proveedores",     tags=["Proveedores"])
app.include_router(backoffice.router,     prefix="/api/backoffice",      tags=["Backoffice"])
app.include_router(encuestas.router,      prefix="/api/encuestas",        tags=["Encuestas"])
app.include_router(procurement.router,    prefix="/api/procurement",      tags=["Procurement"])


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


@app.get("/api/migrate-v7")
def migrate_v7():
    """Apply v7 migrations: encuestas tables + unidades_destino en comunicados."""
    from db import get_db
    migrations = [
        ("comunicados unidades_destino",
         "ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS unidades_destino TEXT DEFAULT NULL;"),
        ("encuestas table", """
            CREATE TABLE IF NOT EXISTS encuestas (
                id SERIAL PRIMARY KEY,
                edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
                titulo TEXT NOT NULL, descripcion TEXT,
                estado TEXT NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('borrador','activa','cerrada')),
                anonima BOOLEAN NOT NULL DEFAULT FALSE,
                unidades_destino TEXT DEFAULT NULL,
                fecha_inicio TIMESTAMPTZ, fecha_cierre TIMESTAMPTZ,
                autor_id INTEGER REFERENCES usuarios(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """),
        ("encuesta_preguntas table", """
            CREATE TABLE IF NOT EXISTS encuesta_preguntas (
                id SERIAL PRIMARY KEY,
                encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
                orden INTEGER NOT NULL DEFAULT 1, texto TEXT NOT NULL,
                tipo TEXT NOT NULL CHECK (tipo IN ('unica','multiple','escala','texto')),
                requerida BOOLEAN NOT NULL DEFAULT TRUE, escala_max INTEGER NOT NULL DEFAULT 5
            );
        """),
        ("encuesta_opciones table", """
            CREATE TABLE IF NOT EXISTS encuesta_opciones (
                id SERIAL PRIMARY KEY,
                pregunta_id INTEGER NOT NULL REFERENCES encuesta_preguntas(id) ON DELETE CASCADE,
                orden INTEGER NOT NULL DEFAULT 1, texto TEXT NOT NULL
            );
        """),
        ("encuesta_sesiones table", """
            CREATE TABLE IF NOT EXISTS encuesta_sesiones (
                id SERIAL PRIMARY KEY,
                encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
                usuario_id INTEGER REFERENCES usuarios(id),
                unidad_id INTEGER REFERENCES unidades(id),
                respondida_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(encuesta_id, usuario_id)
            );
        """),
        ("encuesta_respuestas table", """
            CREATE TABLE IF NOT EXISTS encuesta_respuestas (
                id SERIAL PRIMARY KEY,
                sesion_id INTEGER NOT NULL REFERENCES encuesta_sesiones(id) ON DELETE CASCADE,
                pregunta_id INTEGER NOT NULL REFERENCES encuesta_preguntas(id),
                opcion_id INTEGER REFERENCES encuesta_opciones(id),
                texto_libre TEXT, valor_escala INTEGER
            );
        """),
        ("encuestas indices", """
            CREATE INDEX IF NOT EXISTS idx_encuestas_edificio  ON encuestas(edificio_id);
            CREATE INDEX IF NOT EXISTS idx_encuesta_preguntas  ON encuesta_preguntas(encuesta_id);
            CREATE INDEX IF NOT EXISTS idx_encuesta_sesiones   ON encuesta_sesiones(encuesta_id);
            CREATE INDEX IF NOT EXISTS idx_encuesta_respuestas ON encuesta_respuestas(sesion_id);
        """),
    ]
    results = []
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                for name, sql in migrations:
                    try:
                        cur.execute(sql)
                        results.append({"migration": name, "status": "ok"})
                    except Exception as e:
                        results.append({"migration": name, "status": "error", "detail": str(e)})
        return {"status": "ok", "migrations": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/migrate-v8")
def migrate_v8():
    """Apply v8 migrations: procurement tables (ordenes, items, cotizaciones, flujos, aprobaciones)."""
    from db import get_db
    migrations = [
        ("ordenes_compra table", """
            CREATE TABLE IF NOT EXISTS ordenes_compra (
                id              SERIAL PRIMARY KEY,
                numero_orden    TEXT UNIQUE NOT NULL,
                titulo          TEXT NOT NULL,
                tipo_orden      TEXT NOT NULL CHECK (tipo_orden IN (
                                    'compra_bienes','servicio_mantenimiento','servicio_seguridad',
                                    'servicio_aseo','obra_civil','otro')),
                proveedor_id    INTEGER REFERENCES proveedores(id),
                descripcion     TEXT,
                monto_estimado  NUMERIC(15,2) NOT NULL DEFAULT 0,
                monto_final     NUMERIC(15,2),
                estado          TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN (
                                    'borrador','pendiente_aprobacion','aprobada',
                                    'rechazada','en_ejecucion','completada','cancelada')),
                fecha_necesidad DATE,
                edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
                solicitante_id  INTEGER REFERENCES usuarios(id),
                motivo_cancelacion TEXT,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """),
        ("orden_items table", """
            CREATE TABLE IF NOT EXISTS orden_items (
                id              SERIAL PRIMARY KEY,
                orden_id        INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
                descripcion     TEXT NOT NULL,
                cantidad        NUMERIC(10,2) NOT NULL DEFAULT 1,
                unidad_medida   TEXT DEFAULT 'und',
                precio_unitario NUMERIC(15,2) NOT NULL DEFAULT 0,
                subtotal        NUMERIC(15,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
            );
        """),
        ("solicitudes_cotizacion table", """
            CREATE TABLE IF NOT EXISTS solicitudes_cotizacion (
                id              SERIAL PRIMARY KEY,
                titulo          TEXT NOT NULL,
                tipo            TEXT NOT NULL CHECK (tipo IN ('RFP','RFQ')),
                descripcion     TEXT,
                fecha_limite    DATE,
                criterios_evaluacion TEXT,
                estado          TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
                edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
                created_by      INTEGER REFERENCES usuarios(id),
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """),
        ("cotizaciones table", """
            CREATE TABLE IF NOT EXISTS cotizaciones (
                id                  SERIAL PRIMARY KEY,
                solicitud_id        INTEGER REFERENCES solicitudes_cotizacion(id) ON DELETE SET NULL,
                orden_id            INTEGER REFERENCES ordenes_compra(id) ON DELETE SET NULL,
                proveedor_id        INTEGER NOT NULL REFERENCES proveedores(id),
                numero_cotizacion   TEXT,
                fecha_recepcion     DATE NOT NULL DEFAULT CURRENT_DATE,
                monto               NUMERIC(15,2) NOT NULL,
                condiciones_pago    TEXT,
                tiempo_entrega      TEXT,
                vigencia            DATE,
                estado              TEXT NOT NULL DEFAULT 'recibida'
                                        CHECK (estado IN ('recibida','ganadora','perdedora')),
                observaciones       TEXT,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """),
        ("flujos_aprobacion table", """
            CREATE TABLE IF NOT EXISTS flujos_aprobacion (
                id              SERIAL PRIMARY KEY,
                nombre          TEXT NOT NULL,
                tipo_orden      TEXT DEFAULT NULL,
                monto_minimo    NUMERIC(15,2) NOT NULL DEFAULT 0,
                monto_maximo    NUMERIC(15,2),
                nivel           INTEGER NOT NULL DEFAULT 1,
                approver_rol    TEXT NOT NULL,
                approver_id     INTEGER REFERENCES usuarios(id),
                edificio_id     INTEGER REFERENCES edificios(id) ON DELETE CASCADE,
                activo          BOOLEAN NOT NULL DEFAULT TRUE,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """),
        ("orden_aprobaciones table", """
            CREATE TABLE IF NOT EXISTS orden_aprobaciones (
                id              SERIAL PRIMARY KEY,
                orden_id        INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
                approver_id     INTEGER REFERENCES usuarios(id),
                approver_rol    TEXT,
                nivel           INTEGER NOT NULL DEFAULT 1,
                estado          TEXT NOT NULL DEFAULT 'pendiente'
                                    CHECK (estado IN ('pendiente','aprobada','rechazada')),
                comentario      TEXT,
                fecha_decision  TIMESTAMPTZ,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """),
        ("procurement indices", """
            CREATE INDEX IF NOT EXISTS idx_ordenes_edificio    ON ordenes_compra(edificio_id);
            CREATE INDEX IF NOT EXISTS idx_ordenes_estado      ON ordenes_compra(estado);
            CREATE INDEX IF NOT EXISTS idx_ordenes_proveedor   ON ordenes_compra(proveedor_id);
            CREATE INDEX IF NOT EXISTS idx_orden_items         ON orden_items(orden_id);
            CREATE INDEX IF NOT EXISTS idx_cotizaciones_sol    ON cotizaciones(solicitud_id);
            CREATE INDEX IF NOT EXISTS idx_cotizaciones_orden  ON cotizaciones(orden_id);
            CREATE INDEX IF NOT EXISTS idx_orden_aprob         ON orden_aprobaciones(orden_id);
            CREATE INDEX IF NOT EXISTS idx_flujos_edificio     ON flujos_aprobacion(edificio_id);
        """),
    ]
    results = []
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                for name, sql in migrations:
                    try:
                        cur.execute(sql)
                        results.append({"migration": name, "status": "ok"})
                    except Exception as e:
                        results.append({"migration": name, "status": "error", "detail": str(e)})
        return {"status": "ok", "migrations": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/migrate-v6")
def migrate_v6():
    """Apply v6 migrations: backoffice role, unit types, contract valor/moneda columns."""
    from db import get_db
    migrations = [
        ("usuarios rol check", """
            ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
            ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
              CHECK (rol IN ('superadmin','administrador','propietario','inquilino','portero','servicios','backoffice'));
        """),
        ("unidades tipo check", """
            ALTER TABLE unidades DROP CONSTRAINT IF EXISTS unidades_tipo_check;
            ALTER TABLE unidades ADD CONSTRAINT unidades_tipo_check
              CHECK (tipo IN ('apartamento','local','oficina','casa','otro','cuarto_util','parqueadero'));
        """),
        ("contratos valor", "ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS valor NUMERIC(15,2);"),
        ("contratos moneda", "ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'COP';"),
        ("usuarios tipo_documento", "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'CC';"),
    ]
    results = []
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                for name, sql in migrations:
                    try:
                        for stmt in sql.strip().split(";"):
                            stmt = stmt.strip()
                            if stmt:
                                cur.execute(stmt)
                        results.append({"migration": name, "status": "ok"})
                    except Exception as e:
                        results.append({"migration": name, "status": "error", "detail": str(e)})
        return {"status": "ok", "migrations": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}
