"""
Database connection and schema initialization for TorreAdmin.
Uses psycopg2 with Supabase (PostgreSQL).
"""
import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from urllib.parse import urlparse, unquote

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def get_connection():
    r = urlparse(DATABASE_URL)
    try:
        port = r.port or 5432
    except ValueError:
        port = 5432
        print(f"⚠️  DATABASE_URL has invalid port — check Vercel env var. hostname={r.hostname!r}")
    return psycopg2.connect(
        host=r.hostname,
        port=port,
        dbname=(r.path or "/postgres").lstrip("/"),
        user=unquote(r.username or ""),
        password=unquote(r.password or ""),
        connect_timeout=5,
        sslmode="require",
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ─── Schema SQL ────────────────────────────────────────────────────────────────
# Hierarchy: Conjunto (optional) → Edificio → Torre → Unidad (apto/local/oficina)
#            Conjunto (optional) → Unidad (casa, tipo='casa')
SCHEMA_SQL = """
-- Conjuntos Residenciales (agrupan edificios y/o casas)
CREATE TABLE IF NOT EXISTS conjuntos (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    direccion   TEXT,
    ciudad      TEXT,
    pais        TEXT NOT NULL DEFAULT 'Colombia',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Edificios (pueden pertenecer a un conjunto o ser independientes)
CREATE TABLE IF NOT EXISTS edificios (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    direccion       TEXT NOT NULL,
    pisos           INTEGER NOT NULL DEFAULT 1,
    conjunto_id     INTEGER REFERENCES conjuntos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Torres (bloques físicos dentro de un edificio; todo edificio tiene al menos 1)
CREATE TABLE IF NOT EXISTS torres (
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,          -- "Torre A", "Torre Norte", "Torre Principal"
    numero          TEXT,                   -- identificador corto: "A", "1", "B"
    pisos           INTEGER,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unidades privadas (apartamentos, locales, oficinas, casas)
-- torre_id  → unidad dentro de una torre (aptos, locales, oficinas)
-- conjunto_id → casa directamente en el conjunto (sin edificio/torre)
CREATE TABLE IF NOT EXISTS unidades (
    id              SERIAL PRIMARY KEY,
    torre_id        INTEGER REFERENCES torres(id) ON DELETE CASCADE,
    conjunto_id     INTEGER REFERENCES conjuntos(id),
    numero          TEXT NOT NULL,
    piso            INTEGER,
    tipo            TEXT NOT NULL DEFAULT 'apartamento'
                        CHECK (tipo IN ('apartamento','local','oficina','casa','otro')),
    area_m2         NUMERIC(8,2),
    coeficiente     NUMERIC(6,4),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unidades_torre_numero
    ON unidades(torre_id, numero) WHERE torre_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unidades_casa_numero
    ON unidades(conjunto_id, numero) WHERE conjunto_id IS NOT NULL AND tipo = 'casa';

-- Usuarios (todos los roles del sistema)
CREATE TABLE IF NOT EXISTS usuarios (
    id                  SERIAL PRIMARY KEY,
    nombre              TEXT NOT NULL,
    cedula              TEXT UNIQUE,
    email               TEXT UNIQUE,
    telefono            TEXT,
    rol                 TEXT NOT NULL CHECK (rol IN (
                            'superadmin','administrador','propietario','inquilino','portero','servicios'
                        )),
    password_hash       TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    notif_sistema       BOOLEAN NOT NULL DEFAULT TRUE,
    notif_email         BOOLEAN NOT NULL DEFAULT FALSE,
    notif_whatsapp      BOOLEAN NOT NULL DEFAULT FALSE,
    eps                 TEXT,
    aseguradora_riesgo  TEXT,
    proveedor_id        INTEGER,            -- FK to proveedores added after that table exists
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ocupaciones (quién vive en qué unidad)
CREATE TABLE IF NOT EXISTS ocupaciones (
    id              SERIAL PRIMARY KEY,
    unidad_id       INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN ('propietario','inquilino')),
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cuotas de administración
CREATE TABLE IF NOT EXISTS cuotas (
    id                  SERIAL PRIMARY KEY,
    unidad_id           INTEGER NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    mes                 TEXT NOT NULL,          -- "2025-07"
    monto               NUMERIC(12,2) NOT NULL,
    estado              TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pagado','pendiente','vencido')),
    fecha_vencimiento   DATE NOT NULL,
    fecha_pago          DATE,
    metodo_pago         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehículos de residentes
CREATE TABLE IF NOT EXISTS vehiculos (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    placa       TEXT NOT NULL,
    marca       TEXT,
    modelo      TEXT,
    color       TEXT,
    tipo        TEXT NOT NULL DEFAULT 'carro' CHECK (tipo IN ('carro','moto','bicicleta','otro')),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mascotas de residentes
CREATE TABLE IF NOT EXISTS mascotas (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    especie     TEXT NOT NULL DEFAULT 'perro' CHECK (especie IN ('perro','gato','ave','otro')),
    raza        TEXT,
    color       TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proveedores de servicios
-- La asociación a conjuntos/edificios se hace vía contratos_servicio.
-- Los campos edificio_id/conjunto_id son legacy, se mantienen como nullable.
CREATE TABLE IF NOT EXISTS proveedores (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    contacto        TEXT,
    telefono        TEXT,
    email           TEXT,
    especialidad    TEXT,
    nit             TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_por      INTEGER REFERENCES usuarios(id),
    edificio_id     INTEGER REFERENCES edificios(id),
    conjunto_id     INTEGER REFERENCES conjuntos(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK diferido: usuarios.proveedor_id → proveedores (tabla creada después)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id);

-- Asociación muchos-a-muchos: proveedor ↔ edificio o conjunto
CREATE TABLE IF NOT EXISTS proveedor_edificios (
    id              SERIAL PRIMARY KEY,
    proveedor_id    INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    edificio_id     INTEGER REFERENCES edificios(id) ON DELETE CASCADE,
    conjunto_id     INTEGER REFERENCES conjuntos(id) ON DELETE CASCADE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pe_one_target CHECK (
        (edificio_id IS NOT NULL)::int + (conjunto_id IS NOT NULL)::int = 1
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pe_proveedor_edificio
    ON proveedor_edificios(proveedor_id, edificio_id) WHERE edificio_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pe_proveedor_conjunto
    ON proveedor_edificios(proveedor_id, conjunto_id) WHERE conjunto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pe_proveedor ON proveedor_edificios(proveedor_id);

-- Contratos de servicio (vinculan proveedor con conjunto o edificio)
CREATE TABLE IF NOT EXISTS contratos_servicio (
    id              SERIAL PRIMARY KEY,
    proveedor_id    INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    conjunto_id     INTEGER REFERENCES conjuntos(id),
    edificio_id     INTEGER REFERENCES edificios(id),
    tipo_servicio   TEXT NOT NULL,  -- 'seguridad','aseo','jardineria','mantenimiento','otro'
    descripcion     TEXT,
    fecha_inicio    DATE,
    fecha_fin       DATE,
    condiciones     TEXT,
    archivo_url     TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solicitudes de mantenimiento
CREATE TABLE IF NOT EXISTS mantenimientos (
    id                  SERIAL PRIMARY KEY,
    edificio_id         INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    unidad_id           INTEGER REFERENCES unidades(id),
    torre_id            INTEGER REFERENCES torres(id),
    titulo              TEXT NOT NULL,
    descripcion         TEXT,
    categoria           TEXT NOT NULL CHECK (categoria IN (
                            'plomeria','electricidad','estructura','ascensor','zonas_comunes','piscina','otro'
                        )),
    prioridad           TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
    estado              TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','en_proceso','resuelto','cancelado')),
    solicitante_id      INTEGER REFERENCES usuarios(id),
    asignado_a          INTEGER REFERENCES usuarios(id),
    proveedor_id        INTEGER REFERENCES proveedores(id),
    fecha_solicitud     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_resolucion    TIMESTAMPTZ,
    costo               NUMERIC(12,2),
    es_programado       BOOLEAN NOT NULL DEFAULT FALSE,
    periodicidad        TEXT CHECK (periodicidad IN ('diario','semanal','mensual','trimestral','anual')),
    contrato_url        TEXT,
    fecha_vencimiento   DATE,
    presupuesto         NUMERIC(12,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Archivos adjuntos de mantenimiento
CREATE TABLE IF NOT EXISTS mantenimiento_archivos (
    id                  SERIAL PRIMARY KEY,
    mantenimiento_id    INTEGER NOT NULL REFERENCES mantenimientos(id) ON DELETE CASCADE,
    tipo                TEXT NOT NULL CHECK (tipo IN ('foto','factura','otro')),
    url                 TEXT NOT NULL,
    nombre_archivo      TEXT,
    subido_por          INTEGER REFERENCES usuarios(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alertas de mantenimiento preventivo
CREATE TABLE IF NOT EXISTS mantenimiento_alertas (
    id                  SERIAL PRIMARY KEY,
    edificio_id         INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    titulo              TEXT NOT NULL,
    descripcion         TEXT,
    tipo                TEXT NOT NULL CHECK (tipo IN ('preventivo','correctivo','inspeccion')),
    fecha_programada    DATE NOT NULL,
    estado              TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente','completado','cancelado')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comunicados
CREATE TABLE IF NOT EXISTS comunicados (
    id          SERIAL PRIMARY KEY,
    edificio_id INTEGER REFERENCES edificios(id),   -- NULL = todos
    titulo      TEXT NOT NULL,
    contenido   TEXT NOT NULL,
    tipo        TEXT NOT NULL CHECK (tipo IN ('informativo','urgente','convocatoria','recordatorio')),
    autor_id    INTEGER REFERENCES usuarios(id),
    fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat de seguridad
CREATE TABLE IF NOT EXISTS chat_mensajes (
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    remitente_id    INTEGER NOT NULL REFERENCES usuarios(id),
    contenido       TEXT NOT NULL,
    tipo            TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto','imagen','alerta')),
    leido           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zonas comunes
CREATE TABLE IF NOT EXISTS zonas_comunes (
    id                      SERIAL PRIMARY KEY,
    edificio_id             INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    torre_id                INTEGER REFERENCES torres(id),  -- NULL = aplica a todo el edificio
    nombre                  TEXT NOT NULL,
    descripcion             TEXT,
    capacidad               INTEGER,
    icono                   TEXT,
    disponible              BOOLEAN NOT NULL DEFAULT TRUE,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    duracion_min_horas      NUMERIC(4,2) NOT NULL DEFAULT 1,
    duracion_max_horas      NUMERIC(4,2) NOT NULL DEFAULT 4,
    anticipacion_min_dias   INTEGER NOT NULL DEFAULT 1,
    anticipacion_max_dias   INTEGER NOT NULL DEFAULT 30,
    horario_inicio          TIME NOT NULL DEFAULT '07:00',
    horario_fin             TIME NOT NULL DEFAULT '22:00',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reservas de zonas comunes
CREATE TABLE IF NOT EXISTS reservas (
    id                  SERIAL PRIMARY KEY,
    zona_id             INTEGER NOT NULL REFERENCES zonas_comunes(id) ON DELETE CASCADE,
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id),
    registrado_por_id   INTEGER REFERENCES usuarios(id),
    unidad_id           INTEGER REFERENCES unidades(id),
    fecha               DATE NOT NULL,
    hora_inicio         TIME NOT NULL,
    hora_fin            TIME NOT NULL,
    estado              TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('confirmada','pendiente','cancelada','no_usada')),
    notas               TEXT,
    cancelada_por       TEXT,
    motivo_cancelacion  TEXT,
    alerta_enviada      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Control de accesos / visitantes
CREATE TABLE IF NOT EXISTS accesos (
    id                  SERIAL PRIMARY KEY,
    edificio_id         INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    visitante_nombre    TEXT NOT NULL,
    visitante_documento TEXT,
    destino_unidad_id   INTEGER REFERENCES unidades(id),
    anfitrion_id        INTEGER REFERENCES usuarios(id),
    motivo              TEXT NOT NULL CHECK (motivo IN ('visita','domicilio','servicio_tecnico','mudanza','otro')),
    autorizado          BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_entrada       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_salida        TIMESTAMPTZ,
    registrado_por      INTEGER REFERENCES usuarios(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Paquetes / Correspondencia
CREATE TABLE IF NOT EXISTS paquetes (
    id                  SERIAL PRIMARY KEY,
    edificio_id         INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    destinatario_id     INTEGER REFERENCES usuarios(id),
    unidad_id           INTEGER REFERENCES unidades(id),
    remitente           TEXT,
    descripcion         TEXT,
    empresa_mensajeria  TEXT,
    numero_guia         TEXT,
    estado              TEXT NOT NULL DEFAULT 'recibido'
                            CHECK (estado IN ('recibido','notificado','entregado','devuelto')),
    foto_url            TEXT,
    recibido_por        INTEGER REFERENCES usuarios(id),
    fecha_recepcion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_entrega       TIMESTAMPTZ,
    entregado_a         TEXT,
    notas               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notificaciones de paquetes
CREATE TABLE IF NOT EXISTS paquete_notificaciones (
    id          SERIAL PRIMARY KEY,
    paquete_id  INTEGER NOT NULL REFERENCES paquetes(id) ON DELETE CASCADE,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
    canal       TEXT NOT NULL CHECK (canal IN ('app','email','sms')),
    enviado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    leido       BOOLEAN NOT NULL DEFAULT FALSE
);

-- Guardias / Personal de seguridad
CREATE TABLE IF NOT EXISTS guardias (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Turnos de guardias
CREATE TABLE IF NOT EXISTS turnos (
    id              SERIAL PRIMARY KEY,
    guardia_id      INTEGER NOT NULL REFERENCES guardias(id) ON DELETE CASCADE,
    edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    fecha_inicio    TIMESTAMPTZ NOT NULL,
    fecha_fin       TIMESTAMPTZ NOT NULL,
    tipo_turno      TEXT NOT NULL CHECK (tipo_turno IN ('dia','noche','fin_semana')),
    estado          TEXT NOT NULL DEFAULT 'programado'
                        CHECK (estado IN ('programado','en_curso','completado','ausente')),
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eventos de guardias durante el turno
CREATE TABLE IF NOT EXISTS guardia_eventos (
    id          SERIAL PRIMARY KEY,
    turno_id    INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
    guardia_id  INTEGER NOT NULL REFERENCES guardias(id),
    tipo        TEXT NOT NULL CHECK (tipo IN ('novedad','incidente','ronda','alerta','otro')),
    descripcion TEXT NOT NULL,
    foto_url    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulos disponibles
CREATE TABLE IF NOT EXISTS modulos (
    id      SERIAL PRIMARY KEY,
    clave   TEXT UNIQUE NOT NULL,
    nombre  TEXT NOT NULL,
    icono   TEXT
);

-- Módulos activos por edificio
CREATE TABLE IF NOT EXISTS edificio_modulos (
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    modulo_id   INTEGER NOT NULL REFERENCES modulos(id)   ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (edificio_id, modulo_id)
);

-- Admins/staff asociados a edificios (con fechas de vigencia)
CREATE TABLE IF NOT EXISTS usuario_edificios (
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_inicio DATE,
    fecha_fin    DATE,
    PRIMARY KEY (usuario_id, edificio_id)
);

-- Admins/staff asociados a conjuntos (con fechas de vigencia)
CREATE TABLE IF NOT EXISTS usuario_conjuntos (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    conjunto_id     INTEGER NOT NULL REFERENCES conjuntos(id) ON DELETE CASCADE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_inicio    DATE,
    fecha_fin       DATE,
    UNIQUE(usuario_id, conjunto_id)
);

-- Registro de uso de módulos (analytics)
CREATE TABLE IF NOT EXISTS modulos_uso (
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER REFERENCES edificios(id),
    modulo_clave    TEXT NOT NULL,
    usuario_id      INTEGER REFERENCES usuarios(id),
    fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_torres_edificio         ON torres(edificio_id);
CREATE INDEX IF NOT EXISTS idx_unidades_torre          ON unidades(torre_id);
CREATE INDEX IF NOT EXISTS idx_unidades_conjunto       ON unidades(conjunto_id);
CREATE INDEX IF NOT EXISTS idx_ocupaciones_unidad      ON ocupaciones(unidad_id);
CREATE INDEX IF NOT EXISTS idx_ocupaciones_usuario     ON ocupaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_unidad           ON cuotas(unidad_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado           ON cuotas(estado);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_edificio ON mantenimientos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_estado   ON mantenimientos(estado);
CREATE INDEX IF NOT EXISTS idx_accesos_edificio        ON accesos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_accesos_fecha           ON accesos(fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_paquetes_unidad         ON paquetes(unidad_id);
CREATE INDEX IF NOT EXISTS idx_paquetes_estado         ON paquetes(estado);
CREATE INDEX IF NOT EXISTS idx_chat_edificio           ON chat_mensajes(edificio_id);
CREATE INDEX IF NOT EXISTS idx_turnos_guardia          ON turnos(guardia_id);
CREATE INDEX IF NOT EXISTS idx_reservas_zona           ON reservas(zona_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha          ON reservas(fecha);
CREATE INDEX IF NOT EXISTS idx_edificio_modulos        ON edificio_modulos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_usuario_edificios       ON usuario_edificios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_usuario       ON vehiculos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_usuario        ON mascotas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_creado_por  ON proveedores(creado_por);
CREATE INDEX IF NOT EXISTS idx_contratos_proveedor     ON contratos_servicio(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_usuario_conjuntos       ON usuario_conjuntos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_modulos_uso_edificio    ON modulos_uso(edificio_id);
CREATE INDEX IF NOT EXISTS idx_modulos_uso_fecha       ON modulos_uso(fecha);
CREATE INDEX IF NOT EXISTS idx_edificios_conjunto      ON edificios(conjunto_id);
"""


# Incremental migrations for upgrading existing databases
MIGRATION_SQL = """
-- v3.5 — Jerarquía Conjunto → Edificio → Torre → Unidad

-- Nuevas columnas en edificios (si vienen de versión anterior)
ALTER TABLE edificios DROP COLUMN IF EXISTS unidades;
ALTER TABLE edificios ADD COLUMN IF NOT EXISTS conjunto_id INTEGER REFERENCES conjuntos(id);
CREATE INDEX IF NOT EXISTS idx_edificios_conjunto ON edificios(conjunto_id);

-- Torres (nueva tabla)
CREATE TABLE IF NOT EXISTS torres (
    id          SERIAL PRIMARY KEY,
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    numero      TEXT,
    pisos       INTEGER,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_torres_edificio ON torres(edificio_id);

-- Unidades: agregar torre_id y campos nuevos (NO se elimina edificio_id para no romper datos)
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS torre_id     INTEGER REFERENCES torres(id);
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS conjunto_id  INTEGER REFERENCES conjuntos(id);
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS tipo         TEXT DEFAULT 'apartamento'
    CHECK (tipo IN ('apartamento','local','oficina','casa','otro'));
ALTER TABLE unidades ADD COLUMN IF NOT EXISTS activo       BOOLEAN DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_unidades_torre    ON unidades(torre_id);
CREATE INDEX IF NOT EXISTS idx_unidades_conjunto ON unidades(conjunto_id);

-- Nuevas columnas en usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eps                TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aseguradora_riesgo TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_sistema   BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_email     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_whatsapp  BOOLEAN NOT NULL DEFAULT FALSE;

-- Actualizar constraint de rol
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
    CHECK (rol IN ('superadmin','administrador','propietario','inquilino','portero','servicios'));

-- Proveedores: hacer edificio_id nullable, agregar creado_por y conjunto_id
ALTER TABLE proveedores ALTER COLUMN edificio_id DROP NOT NULL;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS conjunto_id INTEGER REFERENCES conjuntos(id);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS creado_por  INTEGER REFERENCES usuarios(id);
CREATE INDEX IF NOT EXISTS idx_proveedores_conjunto    ON proveedores(conjunto_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_creado_por  ON proveedores(creado_por);

-- Contratos de servicio (nueva tabla)
CREATE TABLE IF NOT EXISTS contratos_servicio (
    id              SERIAL PRIMARY KEY,
    proveedor_id    INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    conjunto_id     INTEGER REFERENCES conjuntos(id),
    edificio_id     INTEGER REFERENCES edificios(id),
    tipo_servicio   TEXT NOT NULL,
    descripcion     TEXT,
    fecha_inicio    DATE,
    fecha_fin       DATE,
    condiciones     TEXT,
    archivo_url     TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contratos_proveedor ON contratos_servicio(proveedor_id);

-- Usuarios asociados a conjuntos (nueva tabla)
CREATE TABLE IF NOT EXISTS usuario_conjuntos (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    conjunto_id INTEGER NOT NULL REFERENCES conjuntos(id) ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_inicio DATE,
    fecha_fin    DATE,
    UNIQUE(usuario_id, conjunto_id)
);
CREATE INDEX IF NOT EXISTS idx_usuario_conjuntos ON usuario_conjuntos(usuario_id);

-- Fechas de vigencia en usuario_edificios
ALTER TABLE usuario_edificios ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE usuario_edificios ADD COLUMN IF NOT EXISTS fecha_fin    DATE;

-- FK de usuarios.proveedor_id
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id);

-- proveedor_edificios (muchos-a-muchos proveedor ↔ edificio/conjunto)
CREATE TABLE IF NOT EXISTS proveedor_edificios (
    id              SERIAL PRIMARY KEY,
    proveedor_id    INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    edificio_id     INTEGER REFERENCES edificios(id) ON DELETE CASCADE,
    conjunto_id     INTEGER REFERENCES conjuntos(id) ON DELETE CASCADE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pe_one_target CHECK (
        (edificio_id IS NOT NULL)::int + (conjunto_id IS NOT NULL)::int = 1
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pe_proveedor_edificio
    ON proveedor_edificios(proveedor_id, edificio_id) WHERE edificio_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pe_proveedor_conjunto
    ON proveedor_edificios(proveedor_id, conjunto_id) WHERE conjunto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pe_proveedor ON proveedor_edificios(proveedor_id);

-- Mantenimientos: columnas adicionales
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS es_programado     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS periodicidad       TEXT
    CHECK (periodicidad IN ('diario','semanal','mensual','trimestral','anual'));
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS proveedor_id      INTEGER REFERENCES proveedores(id);
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS contrato_url      TEXT;
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS presupuesto       NUMERIC(12,2);
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS torre_id          INTEGER REFERENCES torres(id);
ALTER TABLE mantenimientos DROP CONSTRAINT IF EXISTS mantenimientos_categoria_check;
ALTER TABLE mantenimientos ADD CONSTRAINT mantenimientos_categoria_check
    CHECK (categoria IN ('plomeria','electricidad','estructura','ascensor','zonas_comunes','piscina','otro'));

-- Zonas comunes: actualizar torre_id FK a apuntar a torres
ALTER TABLE zonas_comunes ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE zonas_comunes ADD COLUMN IF NOT EXISTS torre_id_new INTEGER REFERENCES torres(id);

-- Reservas: columnas adicionales
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS registrado_por_id  INTEGER REFERENCES usuarios(id);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS cancelada_por      TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS alerta_enviada     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;
ALTER TABLE reservas ADD CONSTRAINT reservas_estado_check
    CHECK (estado IN ('confirmada','pendiente','cancelada','no_usada'));
"""


def init_db():
    """Create all tables if they don't exist. Called on startup."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
            cur.execute(MIGRATION_SQL)
    print("✅ Database schema initialized")


def _ensure_passwords(cur, pwd_context):
    """Update password_hash for seeded users that don't have one yet."""
    demo_passwords = {
        "admin@torreadmin.co":      "Admin123!",
        "superadmin@torreadmin.co": "Super123!",
        "guardia1@torreadmin.co":   "Guardia123!",
        "c.martinez@gmail.com":     "Prop123!",
        "mfgomez@hotmail.com":      "Torre123!",
        "jsrojas@gmail.com":        "Torre123!",
        "lv.herrera@outlook.com":   "Torre123!",
    }
    for email, pw in demo_passwords.items():
        cur.execute(
            "UPDATE usuarios SET password_hash = %s WHERE email = %s AND password_hash IS NULL",
            (pwd_context.hash(pw), email),
        )
    print("✅ Demo passwords set")


def _ensure_edificio_assignments(cur):
    """Insert missing guardias, ocupaciones and usuario_edificios for demo users."""
    cur.execute("SELECT id FROM edificios ORDER BY id LIMIT 1")
    row = cur.fetchone()
    if not row:
        return
    eid = row["id"]

    cur.execute("SELECT id FROM usuarios WHERE email = 'guardia1@torreadmin.co'")
    guardia_user = cur.fetchone()
    if guardia_user:
        cur.execute(
            "INSERT INTO guardias (usuario_id, edificio_id, activo) VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
            (guardia_user["id"], eid),
        )

    cur.execute("SELECT id FROM usuarios WHERE email = 'admin@torreadmin.co'")
    admin_user = cur.fetchone()
    if admin_user:
        cur.execute(
            "INSERT INTO usuario_edificios (usuario_id, edificio_id, activo) VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
            (admin_user["id"], eid),
        )

    # Ensure modules exist
    modulos = [
        ("finanzas",      "Finanzas",         "💰"),
        ("mantenimiento", "Mantenimiento",     "🔧"),
        ("comunicados",   "Comunicados",       "📢"),
        ("zonas_comunes", "Zonas Comunes",     "🏊"),
        ("accesos",       "Control de Acceso", "🔐"),
        ("paquetes",      "Paquetería",        "📦"),
        ("chat",          "Chat Seguridad",    "💬"),
        ("guardias",      "Guardias y Turnos", "👮"),
        ("reportes",      "Reportes",          "📈"),
    ]
    for clave, nombre, icono in modulos:
        cur.execute(
            "INSERT INTO modulos (clave, nombre, icono) VALUES (%s,%s,%s) ON CONFLICT (clave) DO NOTHING",
            (clave, nombre, icono),
        )

    cur.execute("SELECT id FROM edificios")
    edificio_ids = [r["id"] for r in cur.fetchall()]
    cur.execute("SELECT id FROM modulos")
    modulo_ids = [r["id"] for r in cur.fetchall()]
    for e in edificio_ids:
        for m in modulo_ids:
            cur.execute(
                "INSERT INTO edificio_modulos (edificio_id, modulo_id, activo) VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
                (e, m),
            )

    cur.execute("SELECT id FROM usuarios WHERE email = 'superadmin@torreadmin.co'")
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO usuarios (nombre, cedula, email, telefono, rol) VALUES (%s,%s,%s,%s,%s)",
            ("Super Admin", "00.000.001", "superadmin@torreadmin.co", "300 000 0000", "superadmin"),
        )

    print("✅ Demo edificio assignments ensured")


def seed_db():
    """Insert demo data if tables are empty."""
    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    except ImportError:
        pwd_context = None
        print("⚠️  passlib not available — passwords will not be hashed")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM edificios")
            if cur.fetchone()["count"] > 0:
                if pwd_context:
                    _ensure_passwords(cur, pwd_context)
                _ensure_edificio_assignments(cur)
                print("ℹ️  Database already seeded, skipping.")
                return

            # ── Módulos ──────────────────────────────────────────────────────
            modulos = [
                ("finanzas",      "Finanzas",         "💰"),
                ("mantenimiento", "Mantenimiento",     "🔧"),
                ("comunicados",   "Comunicados",       "📢"),
                ("zonas_comunes", "Zonas Comunes",     "🏊"),
                ("accesos",       "Control de Acceso", "🔐"),
                ("paquetes",      "Paquetería",        "📦"),
                ("chat",          "Chat Seguridad",    "💬"),
                ("guardias",      "Guardias y Turnos", "👮"),
                ("reportes",      "Reportes",          "📈"),
            ]
            cur.executemany(
                "INSERT INTO modulos (clave, nombre, icono) VALUES (%s,%s,%s)",
                modulos,
            )

            # ── Super Admin ──────────────────────────────────────────────────
            sa_hash = pwd_context.hash("Super123!") if pwd_context else None
            cur.execute(
                "INSERT INTO usuarios (nombre,cedula,email,telefono,rol,password_hash) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                ("Super Admin", "00.000.001", "superadmin@torreadmin.co", "300 000 0000", "superadmin", sa_hash),
            )
            sa_id = cur.fetchone()["id"]

            # ── Conjunto Nórdico ─────────────────────────────────────────────
            cur.execute(
                "INSERT INTO conjuntos (nombre, direccion, ciudad) VALUES (%s,%s,%s) RETURNING id",
                ("Conjunto Nórdico", "Cra 15 #85-32, Bogotá", "Bogotá"),
            )
            conjunto_id = cur.fetchone()["id"]

            # ── Edificio 1: Torres del Norte (dentro del conjunto) ───────────
            cur.execute(
                "INSERT INTO edificios (nombre, direccion, pisos, conjunto_id) VALUES (%s,%s,%s,%s) RETURNING id",
                ("Torres del Norte", "Cra 15 #85-32, Bogotá", 8, conjunto_id),
            )
            edificio_tdn_id = cur.fetchone()["id"]

            # Torres A y B
            cur.execute(
                "INSERT INTO torres (edificio_id, nombre, numero, pisos) VALUES (%s,%s,%s,%s) RETURNING id",
                (edificio_tdn_id, "Torre A", "A", 8),
            )
            torre_a_id = cur.fetchone()["id"]

            cur.execute(
                "INSERT INTO torres (edificio_id, nombre, numero, pisos) VALUES (%s,%s,%s,%s) RETURNING id",
                (edificio_tdn_id, "Torre B", "B", 4),
            )
            torre_b_id = cur.fetchone()["id"]

            # Unidades Torre A (8 pisos × 3 aptos)
            for piso in range(1, 9):
                for apt in range(1, 4):
                    cur.execute(
                        "INSERT INTO unidades (torre_id, numero, piso, tipo, coeficiente) VALUES (%s,%s,%s,%s,%s)",
                        (torre_a_id, f"Apto {piso}0{apt}A", piso, "apartamento", round(1/24, 4)),
                    )

            # Unidades Torre B (4 pisos × 2 aptos)
            for piso in range(1, 5):
                for apt in range(1, 3):
                    cur.execute(
                        "INSERT INTO unidades (torre_id, numero, piso, tipo, coeficiente) VALUES (%s,%s,%s,%s,%s)",
                        (torre_b_id, f"Apto {piso}0{apt}B", piso, "apartamento", round(1/8, 4)),
                    )

            # ── Edificio 2: Reserva del Parque (independiente) ───────────────
            cur.execute(
                "INSERT INTO edificios (nombre, direccion, pisos) VALUES (%s,%s,%s) RETURNING id",
                ("Reserva del Parque", "Av. El Dorado #68-11, Bogotá", 6),
            )
            edificio_rp_id = cur.fetchone()["id"]

            cur.execute(
                "INSERT INTO torres (edificio_id, nombre, numero, pisos) VALUES (%s,%s,%s,%s) RETURNING id",
                (edificio_rp_id, "Torre Principal", "1", 6),
            )
            torre_rp_id = cur.fetchone()["id"]

            for piso in range(1, 7):
                for apt in range(1, 3):
                    cur.execute(
                        "INSERT INTO unidades (torre_id, numero, piso, tipo, coeficiente) VALUES (%s,%s,%s,%s,%s)",
                        (torre_rp_id, f"Apto {piso}0{apt}", piso, "apartamento", round(1/12, 4)),
                    )

            # ── Edificio 3: Palma Real (independiente) ───────────────────────
            cur.execute(
                "INSERT INTO edificios (nombre, direccion, pisos) VALUES (%s,%s,%s) RETURNING id",
                ("Edificio Palma Real", "Calle 100 #14-55, Bogotá", 5),
            )
            edificio_pr_id = cur.fetchone()["id"]

            cur.execute(
                "INSERT INTO torres (edificio_id, nombre, numero, pisos) VALUES (%s,%s,%s,%s) RETURNING id",
                (edificio_pr_id, "Torre Única", "1", 5),
            )
            torre_pr_id = cur.fetchone()["id"]

            for piso in range(1, 6):
                for apt in range(1, 3):
                    cur.execute(
                        "INSERT INTO unidades (torre_id, numero, piso, tipo, coeficiente) VALUES (%s,%s,%s,%s,%s)",
                        (torre_pr_id, f"Apto {piso}0{apt}", piso, "apartamento", round(1/10, 4)),
                    )

            # ── Usuarios demo ────────────────────────────────────────────────
            admin_hash    = pwd_context.hash("Admin123!")   if pwd_context else None
            prop_hash     = pwd_context.hash("Prop123!")    if pwd_context else None
            torre_hash    = pwd_context.hash("Torre123!")   if pwd_context else None
            guardia_hash  = pwd_context.hash("Guardia123!") if pwd_context else None

            demo_users = [
                ("Juan Rodríguez",         "79.111.222",    "admin@torreadmin.co",    "310 000 0001", "administrador", admin_hash,   None, None),
                ("Carlos Andrés Martínez", "79.456.123",    "c.martinez@gmail.com",   "310 456 7890", "propietario",   prop_hash,    "Compensar", "ARL Sura"),
                ("María Fernanda Gómez",   "52.789.456",    "mfgomez@hotmail.com",    "315 234 5678", "propietario",   torre_hash,   None, None),
                ("Jhon Sebastián Rojas",   "1.020.345.678", "jsrojas@gmail.com",      "300 987 6543", "inquilino",     torre_hash,   None, None),
                ("Luisa Valentina Herrera","43.567.890",    "lv.herrera@outlook.com", "318 765 4321", "propietario",   torre_hash,   None, None),
                ("Pedro Guardia",          "80.999.111",    "guardia1@torreadmin.co", "311 000 0001", "portero",       guardia_hash, None, None),
            ]
            user_ids = {}
            for nombre, cedula, email, telefono, rol, ph, eps, aseg in demo_users:
                cur.execute(
                    """INSERT INTO usuarios (nombre,cedula,email,telefono,rol,password_hash,eps,aseguradora_riesgo)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (nombre, cedula, email, telefono, rol, ph, eps, aseg),
                )
                user_ids[email] = cur.fetchone()["id"]

            # ── Admin y guardia → Torres del Norte ───────────────────────────
            admin_id = user_ids["admin@torreadmin.co"]
            guardia_uid = user_ids["guardia1@torreadmin.co"]

            cur.execute(
                "INSERT INTO usuario_edificios (usuario_id, edificio_id, activo, fecha_inicio) VALUES (%s,%s,TRUE,CURRENT_DATE)",
                (admin_id, edificio_tdn_id),
            )
            cur.execute(
                "INSERT INTO guardias (usuario_id, edificio_id, activo) VALUES (%s,%s,TRUE)",
                (guardia_uid, edificio_tdn_id),
            )
            cur.execute(
                "INSERT INTO usuario_edificios (usuario_id, edificio_id, activo, fecha_inicio) VALUES (%s,%s,TRUE,CURRENT_DATE)",
                (guardia_uid, edificio_tdn_id),
            )

            # ── Ocupaciones demo (Torre A) ────────────────────────────────────
            ocupaciones_demo = [
                ("c.martinez@gmail.com",   "Apto 101A", "propietario"),
                ("mfgomez@hotmail.com",    "Apto 201A", "propietario"),
                ("lv.herrera@outlook.com", "Apto 301A", "propietario"),
                ("jsrojas@gmail.com",      "Apto 102A", "inquilino"),
            ]
            for email, numero, tipo in ocupaciones_demo:
                uid = user_ids[email]
                cur.execute(
                    "SELECT id FROM unidades WHERE torre_id = %s AND numero = %s",
                    (torre_a_id, numero),
                )
                un = cur.fetchone()
                if un:
                    cur.execute(
                        "INSERT INTO ocupaciones (unidad_id, usuario_id, tipo, fecha_inicio, activo) VALUES (%s,%s,%s,CURRENT_DATE,TRUE)",
                        (un["id"], uid, tipo),
                    )

            # ── Zonas comunes ────────────────────────────────────────────────
            cur.execute("""
                INSERT INTO zonas_comunes (edificio_id, torre_id, nombre, descripcion, capacidad, icono, duracion_min_horas, duracion_max_horas) VALUES
                (%s, %s, 'Gimnasio', 'Equipado con máquinas cardiovasculares y pesas libres.', 15, '🏋️', 1, 2),
                (%s, %s, 'Piscina',  'Piscina semiolímpica con zona de niños.', 30, '🏊', 1, 3),
                (%s, NULL, 'Zona BBQ', 'Área de parrilla con mesas y sillas.', 20, '🔥', 2, 6),
                (%s, NULL, 'Salón de Billar', 'Dos mesas de billar profesional.', 8, '🎱', 1, 2),
                (%s, NULL, 'Salón Comunal', 'Espacio para eventos y reuniones.', 60, '🏛️', 2, 8),
                (%s, NULL, 'Cancha de Tenis', 'Cancha en superficie dura con iluminación.', 4, '🎾', 1, 2)
            """, (
                edificio_tdn_id, torre_a_id,
                edificio_tdn_id, torre_a_id,
                edificio_tdn_id,
                edificio_tdn_id,
                edificio_rp_id,
                edificio_rp_id,
            ))

            # ── Proveedores demo ─────────────────────────────────────────────
            cur.execute("""
                INSERT INTO proveedores (nombre,contacto,telefono,email,especialidad,nit,creado_por) VALUES
                ('Elevadores Técnicos S.A.S','Carlos Mora','601 234 5678','contacto@elevtec.co','Ascensores','900.123.456-1',%s),
                ('AquaServ Colombia','Luz Marina Pérez','314 567 8901','info@aquaserv.co','Piscinas y sistemas hidráulicos','900.234.567-2',%s),
                ('Electrored Mantenimientos','Fabio Torres','315 678 9012','fabio@electrored.co','Electricidad','900.345.678-3',%s)
                RETURNING id
            """, (sa_id, sa_id, sa_id))

            # ── Activar todos los módulos en todos los edificios ─────────────
            cur.execute("SELECT id FROM modulos")
            modulo_ids = [r["id"] for r in cur.fetchall()]
            for eid in [edificio_tdn_id, edificio_rp_id, edificio_pr_id]:
                for mid in modulo_ids:
                    cur.execute(
                        "INSERT INTO edificio_modulos (edificio_id, modulo_id, activo) VALUES (%s,%s,TRUE)",
                        (eid, mid),
                    )

            # ── Cuotas demo (mes actual) ─────────────────────────────────────
            from datetime import date
            mes_actual = date.today().strftime("%Y-%m")
            cur.execute("""
                SELECT u.id FROM unidades u
                JOIN torres t ON t.id = u.torre_id
                WHERE t.edificio_id = %s
                LIMIT 10
            """, (edificio_tdn_id,))
            for row in cur.fetchall():
                cur.execute(
                    """INSERT INTO cuotas (unidad_id, mes, monto, estado, fecha_vencimiento)
                       VALUES (%s, %s, 350000, 'pendiente', %s)
                       ON CONFLICT DO NOTHING""",
                    (row["id"], mes_actual, date.today().replace(day=15)),
                )

            print("✅ Database seeded with demo data (v3.5 — jerarquía torres)")
