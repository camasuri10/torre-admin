"""
Database connection and schema initialization for TorreAdmin.
Uses psycopg2 with Supabase (PostgreSQL).
"""
import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

DATABASE_URL = os.environ.get("DATABASE_URL", "")


def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


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


# ─── Schema SQL ───────────────────────────────────────────────────────────────
SCHEMA_SQL = """
-- Edificios
CREATE TABLE IF NOT EXISTS edificios (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    direccion   TEXT NOT NULL,
    unidades    INTEGER NOT NULL DEFAULT 0,
    pisos       INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unidades (apartamentos)
CREATE TABLE IF NOT EXISTS unidades (
    id          SERIAL PRIMARY KEY,
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    numero      TEXT NOT NULL,           -- e.g. "101", "Apto 301"
    piso        INTEGER,
    area_m2     NUMERIC(8,2),
    coeficiente NUMERIC(6,4),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(edificio_id, numero)
);

-- Usuarios / Residentes
CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    cedula          TEXT UNIQUE,
    email           TEXT UNIQUE,
    telefono        TEXT,
    rol             TEXT NOT NULL CHECK (rol IN ('administrador','propietario','inquilino','portero')),
    password_hash   TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    estado              TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pagado','pendiente','vencido')),
    fecha_vencimiento   DATE NOT NULL,
    fecha_pago          DATE,
    metodo_pago         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solicitudes de mantenimiento
CREATE TABLE IF NOT EXISTS mantenimientos (
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    unidad_id       INTEGER REFERENCES unidades(id),
    titulo          TEXT NOT NULL,
    descripcion     TEXT,
    categoria       TEXT NOT NULL CHECK (categoria IN ('plomeria','electricidad','estructura','ascensor','zonas_comunes','otro')),
    prioridad       TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
    estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','resuelto','cancelado')),
    solicitante_id  INTEGER REFERENCES usuarios(id),
    asignado_a      INTEGER REFERENCES usuarios(id),
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_resolucion TIMESTAMPTZ,
    costo           NUMERIC(12,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Archivos adjuntos de mantenimiento (fotos, facturas)
CREATE TABLE IF NOT EXISTS mantenimiento_archivos (
    id                  SERIAL PRIMARY KEY,
    mantenimiento_id    INTEGER NOT NULL REFERENCES mantenimientos(id) ON DELETE CASCADE,
    tipo                TEXT NOT NULL CHECK (tipo IN ('foto','factura','otro')),
    url                 TEXT NOT NULL,
    nombre_archivo      TEXT,
    subido_por          INTEGER REFERENCES usuarios(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alertas de mantenimiento
CREATE TABLE IF NOT EXISTS mantenimiento_alertas (
    id                  SERIAL PRIMARY KEY,
    edificio_id         INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    titulo              TEXT NOT NULL,
    descripcion         TEXT,
    tipo                TEXT NOT NULL CHECK (tipo IN ('preventivo','correctivo','inspeccion')),
    fecha_programada    DATE NOT NULL,
    estado              TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','completado','cancelado')),
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
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    capacidad       INTEGER,
    icono           TEXT,
    disponible      BOOLEAN NOT NULL DEFAULT TRUE,
    -- Configuración de reservas
    duracion_min_horas  NUMERIC(4,2) NOT NULL DEFAULT 1,
    duracion_max_horas  NUMERIC(4,2) NOT NULL DEFAULT 4,
    anticipacion_min_dias INTEGER NOT NULL DEFAULT 1,
    anticipacion_max_dias INTEGER NOT NULL DEFAULT 30,
    horario_inicio  TIME NOT NULL DEFAULT '07:00',
    horario_fin     TIME NOT NULL DEFAULT '22:00',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reservas de zonas comunes
CREATE TABLE IF NOT EXISTS reservas (
    id              SERIAL PRIMARY KEY,
    zona_id         INTEGER NOT NULL REFERENCES zonas_comunes(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    unidad_id       INTEGER REFERENCES unidades(id),
    fecha           DATE NOT NULL,
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    estado          TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('confirmada','pendiente','cancelada')),
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    estado              TEXT NOT NULL DEFAULT 'recibido' CHECK (estado IN ('recibido','notificado','entregado','devuelto')),
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
    estado          TEXT NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado','en_curso','completado','ausente')),
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eventos de guardias (novedades durante el turno)
CREATE TABLE IF NOT EXISTS guardia_eventos (
    id          SERIAL PRIMARY KEY,
    turno_id    INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
    guardia_id  INTEGER NOT NULL REFERENCES guardias(id),
    tipo        TEXT NOT NULL CHECK (tipo IN ('novedad','incidente','ronda','alerta','otro')),
    descripcion TEXT NOT NULL,
    foto_url    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ocupaciones_unidad ON ocupaciones(unidad_id);
CREATE INDEX IF NOT EXISTS idx_ocupaciones_usuario ON ocupaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_unidad ON cuotas(unidad_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado ON cuotas(estado);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_edificio ON mantenimientos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_estado ON mantenimientos(estado);
CREATE INDEX IF NOT EXISTS idx_accesos_edificio ON accesos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_accesos_fecha ON accesos(fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_paquetes_unidad ON paquetes(unidad_id);
CREATE INDEX IF NOT EXISTS idx_paquetes_estado ON paquetes(estado);
CREATE INDEX IF NOT EXISTS idx_chat_edificio ON chat_mensajes(edificio_id);
CREATE INDEX IF NOT EXISTS idx_turnos_guardia ON turnos(guardia_id);
CREATE INDEX IF NOT EXISTS idx_reservas_zona ON reservas(zona_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha);
"""


def init_db():
    """Create all tables if they don't exist. Called on startup."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
    print("✅ Database schema initialized")


def seed_db():
    """Insert demo data if tables are empty."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM edificios")
            count = cur.fetchone()["count"]
            if count > 0:
                print("ℹ️  Database already seeded, skipping.")
                return

            # Edificios
            cur.execute("""
                INSERT INTO edificios (nombre, direccion, unidades, pisos) VALUES
                ('Torres del Norte', 'Cra 15 #85-32, Bogotá', 20, 8),
                ('Conjunto Reserva del Parque', 'Av. El Dorado #68-11, Bogotá', 16, 6),
                ('Edificio Palma Real', 'Calle 100 #14-55, Bogotá', 12, 5)
                RETURNING id
            """)

            # Unidades para Torres del Norte (id=1)
            for piso in range(1, 9):
                for apt in range(1, 4):
                    cur.execute(
                        "INSERT INTO unidades (edificio_id, numero, piso, coeficiente) VALUES (%s, %s, %s, %s)",
                        (1, f"Apto {piso}0{apt}", piso, round(1/24, 4))
                    )

            # Usuarios demo
            cur.execute("""
                INSERT INTO usuarios (nombre, cedula, email, telefono, rol) VALUES
                ('Juan Rodríguez', '79.111.222', 'admin@torreadmin.co', '310 000 0001', 'administrador'),
                ('Carlos Andrés Martínez', '79.456.123', 'c.martinez@gmail.com', '310 456 7890', 'propietario'),
                ('María Fernanda Gómez', '52.789.456', 'mfgomez@hotmail.com', '315 234 5678', 'propietario'),
                ('Jhon Sebastián Rojas', '1.020.345.678', 'jsrojas@gmail.com', '300 987 6543', 'inquilino'),
                ('Luisa Valentina Herrera', '43.567.890', 'lv.herrera@outlook.com', '318 765 4321', 'propietario'),
                ('Pedro Guardia', '80.999.111', 'guardia1@torreadmin.co', '311 000 0001', 'portero')
            """)

            # Zonas comunes
            cur.execute("""
                INSERT INTO zonas_comunes (edificio_id, nombre, descripcion, capacidad, icono, duracion_min_horas, duracion_max_horas) VALUES
                (1, 'Gimnasio', 'Equipado con máquinas cardiovasculares y pesas libres.', 15, '🏋️', 1, 2),
                (1, 'Piscina', 'Piscina semiolímpica con zona de niños.', 30, '🏊', 1, 3),
                (1, 'Zona BBQ', 'Área de parrilla con mesas y sillas.', 20, '🔥', 2, 6),
                (1, 'Salón de Billar', 'Dos mesas de billar profesional.', 8, '🎱', 1, 2),
                (2, 'Salón Comunal', 'Espacio para eventos y reuniones.', 60, '🏛️', 2, 8),
                (2, 'Cancha de Tenis', 'Cancha en superficie dura con iluminación.', 4, '🎾', 1, 2),
                (3, 'Zona de Juegos Infantiles', 'Área segura con columpios y tobogán.', 20, '🎠', 1, 4)
            """)

            print("✅ Database seeded with demo data")
