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


# ─── Schema SQL ───────────────────────────────────────────────────────────────
SCHEMA_SQL = """
-- Conjuntos (agrupan varias torres/edificios, ej: "Benedictine Park")
CREATE TABLE IF NOT EXISTS conjuntos (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    direccion   TEXT,
    ciudad      TEXT,
    pais        TEXT NOT NULL DEFAULT 'Colombia',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Edificios / Torres
CREATE TABLE IF NOT EXISTS edificios (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    direccion       TEXT NOT NULL,
    unidades        INTEGER NOT NULL DEFAULT 0,
    pisos           INTEGER NOT NULL DEFAULT 1,
    conjunto_id     INTEGER REFERENCES conjuntos(id),
    numero_torre    TEXT,               -- '1', '2', 'A', 'B'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    rol             TEXT NOT NULL CHECK (rol IN ('superadmin','administrador','propietario','inquilino','portero','servicios')),
    password_hash   TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    notif_sistema   BOOLEAN NOT NULL DEFAULT TRUE,
    notif_email     BOOLEAN NOT NULL DEFAULT FALSE,
    notif_whatsapp  BOOLEAN NOT NULL DEFAULT FALSE,
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

-- Proveedores de mantenimiento
CREATE TABLE IF NOT EXISTS proveedores (
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    contacto        TEXT,
    telefono        TEXT,
    email           TEXT,
    especialidad    TEXT,
    nit             TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solicitudes de mantenimiento
CREATE TABLE IF NOT EXISTS mantenimientos (
    id                  SERIAL PRIMARY KEY,
    edificio_id         INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    unidad_id           INTEGER REFERENCES unidades(id),
    titulo              TEXT NOT NULL,
    descripcion         TEXT,
    categoria           TEXT NOT NULL CHECK (categoria IN ('plomeria','electricidad','estructura','ascensor','zonas_comunes','piscina','otro')),
    prioridad           TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
    estado              TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','resuelto','cancelado')),
    solicitante_id      INTEGER REFERENCES usuarios(id),
    asignado_a          INTEGER REFERENCES usuarios(id),
    fecha_solicitud     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_resolucion    TIMESTAMPTZ,
    costo               NUMERIC(12,2),
    -- Campos nuevos
    es_programado       BOOLEAN NOT NULL DEFAULT FALSE,
    periodicidad        TEXT CHECK (periodicidad IN ('diario','semanal','mensual','trimestral','anual')),
    proveedor_id        INTEGER REFERENCES proveedores(id),
    contrato_url        TEXT,
    fecha_vencimiento   DATE,
    presupuesto         NUMERIC(12,2),
    torre_id            INTEGER REFERENCES edificios(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    torre_id        INTEGER REFERENCES edificios(id),   -- NULL = aplica a todo el edificio
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    capacidad       INTEGER,
    icono           TEXT,
    disponible      BOOLEAN NOT NULL DEFAULT TRUE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
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
    id                  SERIAL PRIMARY KEY,
    zona_id             INTEGER NOT NULL REFERENCES zonas_comunes(id) ON DELETE CASCADE,
    usuario_id          INTEGER NOT NULL REFERENCES usuarios(id),
    registrado_por_id   INTEGER REFERENCES usuarios(id),   -- quien hizo la reserva (admin vs residente)
    unidad_id           INTEGER REFERENCES unidades(id),
    fecha               DATE NOT NULL,
    hora_inicio         TIME NOT NULL,
    hora_fin            TIME NOT NULL,
    estado              TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('confirmada','pendiente','cancelada','no_usada')),
    notas               TEXT,
    cancelada_por       TEXT,           -- 'residente', 'admin'
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

-- Módulos disponibles en el sistema
CREATE TABLE IF NOT EXISTS modulos (
    id          SERIAL PRIMARY KEY,
    clave       TEXT UNIQUE NOT NULL,
    nombre      TEXT NOT NULL,
    icono       TEXT
);

-- Módulos activos por edificio
CREATE TABLE IF NOT EXISTS edificio_modulos (
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    modulo_id   INTEGER NOT NULL REFERENCES modulos(id)   ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (edificio_id, modulo_id)
);

-- Admins/superadmins/staff asociados a edificios
CREATE TABLE IF NOT EXISTS usuario_edificios (
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (usuario_id, edificio_id)
);

-- Registro de uso de módulos (analytics)
CREATE TABLE IF NOT EXISTS modulos_uso (
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER REFERENCES edificios(id),
    modulo_clave    TEXT NOT NULL,
    usuario_id      INTEGER REFERENCES usuarios(id),
    fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_edificio_modulos_edificio ON edificio_modulos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_usuario_edificios_usuario ON usuario_edificios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_usuario ON vehiculos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_usuario ON mascotas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_edificio ON proveedores(edificio_id);
CREATE INDEX IF NOT EXISTS idx_modulos_uso_edificio ON modulos_uso(edificio_id);
CREATE INDEX IF NOT EXISTS idx_modulos_uso_fecha ON modulos_uso(fecha);
"""


MIGRATION_SQL = """
-- Actualizar constraint de rol para incluir 'servicios'
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
    CHECK (rol IN ('superadmin','administrador','propietario','inquilino','portero','servicios'));

-- Nuevas columnas en edificios
ALTER TABLE edificios ADD COLUMN IF NOT EXISTS conjunto_id INTEGER REFERENCES conjuntos(id);
ALTER TABLE edificios ADD COLUMN IF NOT EXISTS numero_torre TEXT;
CREATE INDEX IF NOT EXISTS idx_edificios_conjunto ON edificios(conjunto_id);

-- Preferencias de notificación en usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_sistema BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_email BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notif_whatsapp BOOLEAN NOT NULL DEFAULT FALSE;

-- Nuevos campos en mantenimientos
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS es_programado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS periodicidad TEXT
    CHECK (periodicidad IN ('diario','semanal','mensual','trimestral','anual'));
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id);
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS contrato_url TEXT;
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS presupuesto NUMERIC(12,2);
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS torre_id INTEGER REFERENCES edificios(id);

-- Actualizar constraint de categoría en mantenimientos para incluir 'piscina'
ALTER TABLE mantenimientos DROP CONSTRAINT IF EXISTS mantenimientos_categoria_check;
ALTER TABLE mantenimientos ADD CONSTRAINT mantenimientos_categoria_check
    CHECK (categoria IN ('plomeria','electricidad','estructura','ascensor','zonas_comunes','piscina','otro'));

-- Nuevas columnas en zonas_comunes
ALTER TABLE zonas_comunes ADD COLUMN IF NOT EXISTS torre_id INTEGER REFERENCES edificios(id);
ALTER TABLE zonas_comunes ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Nuevas columnas en reservas
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS registrado_por_id INTEGER REFERENCES usuarios(id);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS cancelada_por TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS alerta_enviada BOOLEAN NOT NULL DEFAULT FALSE;

-- Actualizar constraint de estado en reservas para incluir 'no_usada'
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
        "admin@torreadmin.co":         "Admin123!",
        "superadmin@torreadmin.co":    "Super123!",
        "guardia1@torreadmin.co":      "Guardia123!",
        "c.martinez@gmail.com":        "Prop123!",
        "mfgomez@hotmail.com":         "Torre123!",
        "jsrojas@gmail.com":           "Torre123!",
        "lv.herrera@outlook.com":      "Torre123!",
    }
    for email, pw in demo_passwords.items():
        cur.execute(
            "UPDATE usuarios SET password_hash = %s WHERE email = %s AND password_hash IS NULL",
            (pwd_context.hash(pw), email),
        )
    print("✅ Demo passwords set")


def _ensure_edificio_assignments(cur):
    """Insert missing guardias, ocupaciones and usuario_edificios for demo users."""
    # Guardia → Torres del Norte
    cur.execute("SELECT id FROM usuarios WHERE email = 'guardia1@torreadmin.co'")
    guardia_user = cur.fetchone()
    if guardia_user:
        cur.execute(
            """INSERT INTO guardias (usuario_id, edificio_id, activo)
               VALUES (%s, 1, TRUE)
               ON CONFLICT DO NOTHING""",
            (guardia_user["id"],),
        )

    # Admin → Torres del Norte (usuario_edificios)
    cur.execute("SELECT id FROM usuarios WHERE email = 'admin@torreadmin.co'")
    admin_user = cur.fetchone()
    if admin_user:
        cur.execute(
            """INSERT INTO usuario_edificios (usuario_id, edificio_id, activo)
               VALUES (%s, 1, TRUE)
               ON CONFLICT DO NOTHING""",
            (admin_user["id"],),
        )

    # Propietarios/inquilinos → ocupaciones en Torres del Norte
    ocupaciones_demo = [
        ("c.martinez@gmail.com",   "Apto 101", "propietario"),
        ("mfgomez@hotmail.com",    "Apto 201", "propietario"),
        ("lv.herrera@outlook.com", "Apto 301", "propietario"),
        ("jsrojas@gmail.com",      "Apto 102", "inquilino"),
    ]
    for email, apto, tipo in ocupaciones_demo:
        cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
        u = cur.fetchone()
        cur.execute("SELECT id FROM unidades WHERE edificio_id = 1 AND numero = %s", (apto,))
        un = cur.fetchone()
        if u and un:
            cur.execute(
                """INSERT INTO ocupaciones (unidad_id, usuario_id, tipo, fecha_inicio, activo)
                   VALUES (%s, %s, %s, CURRENT_DATE, TRUE)
                   ON CONFLICT DO NOTHING""",
                (un["id"], u["id"], tipo),
            )

    # Módulos: insertar si faltan
    modulos = [
        ("finanzas",      "Finanzas",            "💰"),
        ("mantenimiento", "Mantenimiento",        "🔧"),
        ("comunicados",   "Comunicados",          "📢"),
        ("zonas_comunes", "Zonas Comunes",        "🏊"),
        ("accesos",       "Control de Acceso",    "🔐"),
        ("paquetes",      "Paquetería",           "📦"),
        ("chat",          "Chat Seguridad",       "💬"),
        ("guardias",      "Guardias y Turnos",    "👮"),
        ("reportes",      "Reportes",             "📈"),
    ]
    for clave, nombre, icono in modulos:
        cur.execute(
            "INSERT INTO modulos (clave, nombre, icono) VALUES (%s,%s,%s) ON CONFLICT (clave) DO NOTHING",
            (clave, nombre, icono),
        )

    # Activar todos los módulos en los edificios existentes
    cur.execute("SELECT id FROM edificios")
    edificio_ids = [r["id"] for r in cur.fetchall()]
    cur.execute("SELECT id FROM modulos")
    modulo_ids = [r["id"] for r in cur.fetchall()]
    for eid in edificio_ids:
        for mid in modulo_ids:
            cur.execute(
                """INSERT INTO edificio_modulos (edificio_id, modulo_id, activo)
                   VALUES (%s, %s, TRUE)
                   ON CONFLICT DO NOTHING""",
                (eid, mid),
            )

    # Superadmin: insertar si no existe
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
            count = cur.fetchone()["count"]
            if count > 0:
                # Already seeded — patch any missing data from this release
                if pwd_context:
                    _ensure_passwords(cur, pwd_context)
                _ensure_edificio_assignments(cur)
                print("ℹ️  Database already seeded, skipping.")
                return

            # ── Conjuntos demo ───────────────────────────────────────────────
            cur.execute("""
                INSERT INTO conjuntos (nombre, direccion, ciudad) VALUES
                ('Conjunto Nórdico', 'Cra 15 #85-32, Bogotá', 'Bogotá')
                RETURNING id
            """)
            conjunto_id = cur.fetchone()["id"]

            # ── Edificios ────────────────────────────────────────────────────
            cur.execute("""
                INSERT INTO edificios (nombre, direccion, unidades, pisos, conjunto_id, numero_torre) VALUES
                ('Torres del Norte', 'Cra 15 #85-32, Bogotá', 20, 8, %s, '1'),
                ('Torres del Norte', 'Cra 15 #85-32, Bogotá', 16, 8, %s, '2'),
                ('Conjunto Reserva del Parque', 'Av. El Dorado #68-11, Bogotá', 16, 6, NULL, NULL),
                ('Edificio Palma Real', 'Calle 100 #14-55, Bogotá', 12, 5, NULL, NULL)
                RETURNING id
            """, (conjunto_id, conjunto_id))

            # ── Unidades para Torres del Norte Torre 1 (id=1) ────────────────
            for piso in range(1, 9):
                for apt in range(1, 4):
                    cur.execute(
                        "INSERT INTO unidades (edificio_id, numero, piso, coeficiente) VALUES (%s, %s, %s, %s)",
                        (1, f"Apto {piso}0{apt}", piso, round(1/24, 4))
                    )

            # ── Usuarios demo con passwords ──────────────────────────────────
            demo_users = [
                ("Juan Rodríguez",        "79.111.222",      "admin@torreadmin.co",    "310 000 0001", "administrador", "Admin123!"),
                ("Carlos Andrés Martínez","79.456.123",      "c.martinez@gmail.com",   "310 456 7890", "propietario",   "Prop123!"),
                ("María Fernanda Gómez",  "52.789.456",      "mfgomez@hotmail.com",    "315 234 5678", "propietario",   "Torre123!"),
                ("Jhon Sebastián Rojas",  "1.020.345.678",   "jsrojas@gmail.com",      "300 987 6543", "inquilino",     "Torre123!"),
                ("Luisa Valentina Herrera","43.567.890",     "lv.herrera@outlook.com", "318 765 4321", "propietario",   "Torre123!"),
                ("Pedro Guardia",         "80.999.111",      "guardia1@torreadmin.co", "311 000 0001", "portero",       "Guardia123!"),
            ]
            for nombre, cedula, email, telefono, rol, pw in demo_users:
                ph = pwd_context.hash(pw) if pwd_context else None
                cur.execute(
                    "INSERT INTO usuarios (nombre, cedula, email, telefono, rol, password_hash) VALUES (%s,%s,%s,%s,%s,%s)",
                    (nombre, cedula, email, telefono, rol, ph),
                )

            # ── Zonas comunes ────────────────────────────────────────────────
            cur.execute("""
                INSERT INTO zonas_comunes (edificio_id, nombre, descripcion, capacidad, icono, duracion_min_horas, duracion_max_horas) VALUES
                (1, 'Gimnasio', 'Equipado con máquinas cardiovasculares y pesas libres.', 15, '🏋️', 1, 2),
                (1, 'Piscina', 'Piscina semiolímpica con zona de niños.', 30, '🏊', 1, 3),
                (1, 'Zona BBQ', 'Área de parrilla con mesas y sillas.', 20, '🔥', 2, 6),
                (1, 'Salón de Billar', 'Dos mesas de billar profesional.', 8, '🎱', 1, 2),
                (3, 'Salón Comunal', 'Espacio para eventos y reuniones.', 60, '🏛️', 2, 8),
                (3, 'Cancha de Tenis', 'Cancha en superficie dura con iluminación.', 4, '🎾', 1, 2),
                (4, 'Zona de Juegos Infantiles', 'Área segura con columpios y tobogán.', 20, '🎠', 1, 4)
            """)

            # ── Proveedores demo ─────────────────────────────────────────────
            cur.execute("""
                INSERT INTO proveedores (edificio_id, nombre, contacto, telefono, email, especialidad, nit) VALUES
                (1, 'Elevadores Técnicos S.A.S', 'Carlos Mora', '601 234 5678', 'contacto@elevtec.co', 'Ascensores', '900.123.456-1'),
                (1, 'AquaServ Colombia', 'Luz Marina Pérez', '314 567 8901', 'info@aquaserv.co', 'Piscinas y sistemas hidráulicos', '900.234.567-2'),
                (1, 'Electrored Mantenimientos', 'Fabio Torres', '315 678 9012', 'fabio@electrored.co', 'Electricidad', '900.345.678-3')
            """)

            # ── Super Admin ──────────────────────────────────────────────────
            sa_hash = pwd_context.hash("Super123!") if pwd_context else None
            cur.execute(
                "INSERT INTO usuarios (nombre, cedula, email, telefono, rol, password_hash) VALUES (%s,%s,%s,%s,%s,%s)",
                ("Super Admin", "00.000.001", "superadmin@torreadmin.co", "300 000 0000", "superadmin", sa_hash),
            )

            # ── Módulos ──────────────────────────────────────────────────────
            modulos = [
                ("finanzas",      "Finanzas",            "💰"),
                ("mantenimiento", "Mantenimiento",        "🔧"),
                ("comunicados",   "Comunicados",          "📢"),
                ("zonas_comunes", "Zonas Comunes",        "🏊"),
                ("accesos",       "Control de Acceso",    "🔐"),
                ("paquetes",      "Paquetería",           "📦"),
                ("chat",          "Chat Seguridad",       "💬"),
                ("guardias",      "Guardias y Turnos",    "👮"),
                ("reportes",      "Reportes",             "📈"),
            ]
            cur.executemany(
                "INSERT INTO modulos (clave, nombre, icono) VALUES (%s, %s, %s)",
                modulos,
            )

            # ── Activar todos los módulos en todos los edificios demo ─────────
            cur.execute("SELECT id FROM modulos")
            modulo_ids = [r["id"] for r in cur.fetchall()]
            for edificio_id in [1, 2, 3, 4]:
                for modulo_id in modulo_ids:
                    cur.execute(
                        "INSERT INTO edificio_modulos (edificio_id, modulo_id, activo) VALUES (%s, %s, TRUE)",
                        (edificio_id, modulo_id),
                    )

            # ── Admin demo → Torres del Norte Torre 1 ────────────────────────
            cur.execute("SELECT id FROM usuarios WHERE email = 'admin@torreadmin.co'")
            admin = cur.fetchone()
            if admin:
                cur.execute(
                    "INSERT INTO usuario_edificios (usuario_id, edificio_id) VALUES (%s, 1)",
                    (admin["id"],),
                )

            # ── Guardia → Torres del Norte ───────────────────────────────────
            cur.execute("SELECT id FROM usuarios WHERE email = 'guardia1@torreadmin.co'")
            guardia_user = cur.fetchone()
            if guardia_user:
                cur.execute(
                    "INSERT INTO guardias (usuario_id, edificio_id, activo) VALUES (%s, 1, TRUE)",
                    (guardia_user["id"],),
                )

            # ── Ocupaciones demo ─────────────────────────────────────────────
            ocupaciones_demo = [
                ("c.martinez@gmail.com",   "Apto 101", "propietario"),
                ("mfgomez@hotmail.com",    "Apto 201", "propietario"),
                ("lv.herrera@outlook.com", "Apto 301", "propietario"),
                ("jsrojas@gmail.com",      "Apto 102", "inquilino"),
            ]
            for email, apto, tipo in ocupaciones_demo:
                cur.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
                u = cur.fetchone()
                cur.execute("SELECT id FROM unidades WHERE edificio_id = 1 AND numero = %s", (apto,))
                un = cur.fetchone()
                if u and un:
                    cur.execute(
                        "INSERT INTO ocupaciones (unidad_id, usuario_id, tipo, fecha_inicio, activo) VALUES (%s,%s,%s,CURRENT_DATE,TRUE)",
                        (un["id"], u["id"], tipo),
                    )

            print("✅ Database seeded with demo data")
