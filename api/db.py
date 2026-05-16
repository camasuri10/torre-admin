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
# Top-level hierarchy: Organizacion (tenant) → Conjunto → Edificio → Torre → Unidad
SCHEMA_SQL = """
-- ── Organizaciones (top-level tenants) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizaciones (
    id          SERIAL PRIMARY KEY,
    nombre      TEXT NOT NULL,
    nit         TEXT UNIQUE,
    email       TEXT,
    telefono    TEXT,
    direccion   TEXT,
    ciudad      TEXT,
    pais        TEXT NOT NULL DEFAULT 'Colombia',
    logo_url    TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conjuntos Residenciales (agrupan edificios y/o casas — pertenecen a una organización)
CREATE TABLE IF NOT EXISTS conjuntos (
    id              SERIAL PRIMARY KEY,
    organizacion_id INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    nit             TEXT,
    telefono        TEXT,
    direccion       TEXT,
    ciudad          TEXT,
    pais            TEXT NOT NULL DEFAULT 'Colombia',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Edificios (pertenecen a una organización; pueden estar dentro de un conjunto)
CREATE TABLE IF NOT EXISTS edificios (
    id              SERIAL PRIMARY KEY,
    organizacion_id INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    direccion       TEXT NOT NULL,
    pisos           INTEGER NOT NULL DEFAULT 1,
    conjunto_id     INTEGER REFERENCES conjuntos(id),
    nit             TEXT,
    telefono        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE edificios ADD COLUMN IF NOT EXISTS nit TEXT;
ALTER TABLE edificios ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Torres (bloques físicos dentro de un edificio; todo edificio tiene al menos 1)
CREATE TABLE IF NOT EXISTS torres (
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    numero          TEXT,
    pisos           INTEGER,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unidades privadas (apartamentos, locales, oficinas, casas)
CREATE TABLE IF NOT EXISTS unidades (
    id              SERIAL PRIMARY KEY,
    torre_id        INTEGER REFERENCES torres(id) ON DELETE CASCADE,
    conjunto_id     INTEGER REFERENCES conjuntos(id),
    numero          TEXT NOT NULL,
    piso            INTEGER,
    tipo            TEXT NOT NULL DEFAULT 'apartamento'
                        CHECK (tipo IN ('apartamento','local','oficina','casa','otro','cuarto_util','parqueadero')),
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
-- organizacion_id: NULL para backoffice (platform-level) y superadmin (org via M:M)
CREATE TABLE IF NOT EXISTS usuarios (
    id                  SERIAL PRIMARY KEY,
    organizacion_id     INTEGER REFERENCES organizaciones(id),
    nombre              TEXT NOT NULL,
    cedula              TEXT UNIQUE,
    tipo_documento      TEXT DEFAULT 'CC',
    email               TEXT UNIQUE,
    telefono            TEXT,
    rol                 TEXT NOT NULL CHECK (rol IN (
                            'superadmin','administrador','propietario','inquilino','portero','servicios','backoffice'
                        )),
    password_hash       TEXT,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    notif_sistema       BOOLEAN NOT NULL DEFAULT TRUE,
    notif_email         BOOLEAN NOT NULL DEFAULT FALSE,
    notif_whatsapp      BOOLEAN NOT NULL DEFAULT FALSE,
    eps                 TEXT,
    aseguradora_riesgo  TEXT,
    proveedor_id        INTEGER,
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
    mes                 TEXT NOT NULL,
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

-- Proveedores de servicios (pertenecen a una organización)
CREATE TABLE IF NOT EXISTS proveedores (
    id              SERIAL PRIMARY KEY,
    organizacion_id INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
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
    descripcion     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK diferido: usuarios.proveedor_id → proveedores
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id);

-- Asociación M:M: proveedor ↔ edificio o conjunto
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

-- Contratos de servicio
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
    valor           NUMERIC(15,2),
    moneda          TEXT DEFAULT 'COP',
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS valor NUMERIC(15,2);
ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'COP';

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

CREATE TABLE IF NOT EXISTS mantenimiento_archivos (
    id                  SERIAL PRIMARY KEY,
    mantenimiento_id    INTEGER NOT NULL REFERENCES mantenimientos(id) ON DELETE CASCADE,
    tipo                TEXT NOT NULL CHECK (tipo IN ('foto','factura','otro')),
    url                 TEXT NOT NULL,
    nombre_archivo      TEXT,
    subido_por          INTEGER REFERENCES usuarios(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS inventario_mantenimiento (
    id          SERIAL PRIMARY KEY,
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    nombre      TEXT NOT NULL,
    tipo        TEXT NOT NULL CHECK (tipo IN ('zona','componente')),
    descripcion TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS inventario_id INTEGER REFERENCES inventario_mantenimiento(id);
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS contrato_id INTEGER REFERENCES contratos_servicio(id);
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS fecha_proxima_ejecucion DATE;

-- Comunicados
CREATE TABLE IF NOT EXISTS comunicados (
    id                SERIAL PRIMARY KEY,
    edificio_id       INTEGER REFERENCES edificios(id),
    titulo            TEXT NOT NULL,
    contenido         TEXT NOT NULL,
    tipo              TEXT NOT NULL CHECK (tipo IN ('informativo','urgente','convocatoria','recordatorio')),
    autor_id          INTEGER REFERENCES usuarios(id),
    fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
    canales           TEXT NOT NULL DEFAULT '["sistema"]',
    fecha_programada  TIMESTAMPTZ,
    imagen_url        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comunicado_envios (
    id              SERIAL PRIMARY KEY,
    comunicado_id   INTEGER NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    canal           TEXT NOT NULL CHECK (canal IN ('sistema','email','whatsapp')),
    enviado_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    leido           BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (comunicado_id, usuario_id, canal)
);
CREATE INDEX IF NOT EXISTS idx_comunicado_envios_comunicado ON comunicado_envios(comunicado_id);
CREATE INDEX IF NOT EXISTS idx_comunicado_envios_usuario    ON comunicado_envios(usuario_id);

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
    torre_id                INTEGER REFERENCES torres(id),
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
    capacidad_hora          INTEGER,
    requiere_inventario     BOOLEAN NOT NULL DEFAULT FALSE,
    costo_arriendo          NUMERIC(12,2),
    costo_deposito          NUMERIC(12,2),
    intervalo_reserva       INTEGER DEFAULT 60,
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
                            CHECK (estado IN (
                                'confirmada','pendiente','cancelada','no_usada',
                                'en_revision','lista_espera','pago_pendiente','pagada',
                                'deposito_devuelto','en_curso','finalizada','no_presentado'
                            )),
    notas               TEXT,
    cancelada_por       TEXT,
    motivo_cancelacion  TEXT,
    alerta_enviada      BOOLEAN NOT NULL DEFAULT FALSE,
    inventario_url      TEXT,
    deposito_devuelto   BOOLEAN,
    estado_entrega      TEXT CHECK (estado_entrega IN ('pendiente','inventario_adjunto','completada')),
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
    residente_nombre    VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Admins/staff asociados a edificios
CREATE TABLE IF NOT EXISTS usuario_edificios (
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_inicio DATE,
    fecha_fin    DATE,
    PRIMARY KEY (usuario_id, edificio_id)
);

-- Admins/staff asociados a conjuntos
CREATE TABLE IF NOT EXISTS usuario_conjuntos (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,
    conjunto_id     INTEGER NOT NULL REFERENCES conjuntos(id) ON DELETE CASCADE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_inicio    DATE,
    fecha_fin       DATE,
    UNIQUE(usuario_id, conjunto_id)
);

-- SuperAdmins asignados a organizaciones (M:M)
CREATE TABLE IF NOT EXISTS organizacion_superadmins (
    id               SERIAL PRIMARY KEY,
    organizacion_id  INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organizacion_id, usuario_id)
);

-- Registro de uso de módulos (analytics)
CREATE TABLE IF NOT EXISTS modulos_uso (
    id              SERIAL PRIMARY KEY,
    edificio_id     INTEGER REFERENCES edificios(id),
    modulo_clave    TEXT NOT NULL,
    usuario_id      INTEGER REFERENCES usuarios(id),
    fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Encuestas
CREATE TABLE IF NOT EXISTS encuestas (
    id                SERIAL PRIMARY KEY,
    edificio_id       INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    titulo            TEXT NOT NULL,
    descripcion       TEXT,
    estado            TEXT NOT NULL DEFAULT 'borrador'
                          CHECK (estado IN ('borrador','activa','cerrada')),
    anonima           BOOLEAN NOT NULL DEFAULT FALSE,
    unidades_destino  TEXT DEFAULT NULL,
    fecha_inicio      TIMESTAMPTZ,
    fecha_cierre      TIMESTAMPTZ,
    autor_id          INTEGER REFERENCES usuarios(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encuesta_preguntas (
    id          SERIAL PRIMARY KEY,
    encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    orden       INTEGER NOT NULL DEFAULT 1,
    texto       TEXT NOT NULL,
    tipo        TEXT NOT NULL CHECK (tipo IN ('unica','multiple','escala','texto')),
    requerida   BOOLEAN NOT NULL DEFAULT TRUE,
    escala_max  INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS encuesta_opciones (
    id          SERIAL PRIMARY KEY,
    pregunta_id INTEGER NOT NULL REFERENCES encuesta_preguntas(id) ON DELETE CASCADE,
    orden       INTEGER NOT NULL DEFAULT 1,
    texto       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS encuesta_sesiones (
    id            SERIAL PRIMARY KEY,
    encuesta_id   INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    usuario_id    INTEGER REFERENCES usuarios(id),
    unidad_id     INTEGER REFERENCES unidades(id),
    respondida_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(encuesta_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS encuesta_respuestas (
    id           SERIAL PRIMARY KEY,
    sesion_id    INTEGER NOT NULL REFERENCES encuesta_sesiones(id) ON DELETE CASCADE,
    pregunta_id  INTEGER NOT NULL REFERENCES encuesta_preguntas(id),
    opcion_id    INTEGER REFERENCES encuesta_opciones(id),
    texto_libre  TEXT,
    valor_escala INTEGER
);

-- Procurement
CREATE TABLE IF NOT EXISTS ordenes_compra (
    id                          SERIAL PRIMARY KEY,
    numero_orden                TEXT UNIQUE NOT NULL,
    titulo                      TEXT NOT NULL,
    tipo_orden                  TEXT NOT NULL CHECK (tipo_orden IN (
                                    'compra_bienes','servicio_mantenimiento','servicio_seguridad',
                                    'servicio_aseo','obra_civil','otro')),
    proveedor_id                INTEGER REFERENCES proveedores(id),
    descripcion                 TEXT,
    monto_estimado              NUMERIC(15,2) NOT NULL DEFAULT 0,
    monto_final                 NUMERIC(15,2),
    estado                      TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN (
                                    'borrador','pendiente_aprobacion','aprobada',
                                    'rechazada','en_ejecucion','completada','cancelada')),
    fecha_necesidad             DATE,
    edificio_id                 INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    solicitante_id              INTEGER REFERENCES usuarios(id),
    motivo_cancelacion          TEXT,
    clasificacion               TEXT CHECK (clasificacion IN ('proyecto','mantenimiento_preventivo','mantenimiento_correctivo','actividad')),
    cantidad                    NUMERIC(10,2),
    justificacion               TEXT,
    evidencias                  JSONB DEFAULT '[]',
    requiere_asamblea           BOOLEAN NOT NULL DEFAULT FALSE,
    asamblea_estado             TEXT CHECK (asamblea_estado IN ('pendiente','aprobada','rechazada')),
    asamblea_acta_url           TEXT,
    asamblea_cotizacion_url     TEXT,
    asamblea_fecha              TIMESTAMPTZ,
    asamblea_comentario         TEXT,
    es_individual               BOOLEAN DEFAULT FALSE,
    requiere_aprobacion_consejo BOOLEAN DEFAULT FALSE,
    consejo_estado              TEXT CHECK (consejo_estado IN ('pendiente','aprobada','rechazada')),
    consejo_comentario          TEXT,
    proyecto_id                 INTEGER REFERENCES ordenes_compra(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orden_items (
    id              SERIAL PRIMARY KEY,
    orden_id        INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    descripcion     TEXT NOT NULL,
    cantidad        NUMERIC(10,2) NOT NULL DEFAULT 1,
    unidad_medida   TEXT DEFAULT 'und',
    precio_unitario NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(15,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE TABLE IF NOT EXISTS solicitudes_cotizacion (
    id                          SERIAL PRIMARY KEY,
    titulo                      TEXT NOT NULL,
    tipo                        TEXT NOT NULL CHECK (tipo IN ('RFP','RFQ')),
    descripcion                 TEXT,
    fecha_limite                DATE,
    criterios_evaluacion        TEXT,
    estado                      TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
    edificio_id                 INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    created_by                  INTEGER REFERENCES usuarios(id),
    num_cotizaciones_requeridas INTEGER NOT NULL DEFAULT 1,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cotizaciones (
    id                SERIAL PRIMARY KEY,
    solicitud_id      INTEGER REFERENCES solicitudes_cotizacion(id) ON DELETE SET NULL,
    orden_id          INTEGER REFERENCES ordenes_compra(id) ON DELETE SET NULL,
    proveedor_id      INTEGER NOT NULL REFERENCES proveedores(id),
    numero_cotizacion TEXT,
    fecha_recepcion   DATE NOT NULL DEFAULT CURRENT_DATE,
    monto             NUMERIC(15,2) NOT NULL,
    condiciones_pago  TEXT,
    tiempo_entrega    TEXT,
    vigencia          DATE,
    estado            TEXT NOT NULL DEFAULT 'recibida'
                          CHECK (estado IN ('recibida','ganadora','perdedora')),
    observaciones     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flujos_aprobacion (
    id           SERIAL PRIMARY KEY,
    nombre       TEXT NOT NULL,
    tipo_orden   TEXT DEFAULT NULL,
    monto_minimo NUMERIC(15,2) NOT NULL DEFAULT 0,
    monto_maximo NUMERIC(15,2),
    nivel        INTEGER NOT NULL DEFAULT 1,
    approver_rol TEXT NOT NULL,
    approver_id  INTEGER REFERENCES usuarios(id),
    edificio_id  INTEGER REFERENCES edificios(id) ON DELETE CASCADE,
    activo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orden_aprobaciones (
    id             SERIAL PRIMARY KEY,
    orden_id       INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    approver_id    INTEGER REFERENCES usuarios(id),
    approver_rol   TEXT,
    nivel          INTEGER NOT NULL DEFAULT 1,
    estado         TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente','aprobada','rechazada')),
    comentario     TEXT,
    fecha_decision TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Empleados de proveedores
CREATE TABLE IF NOT EXISTS proveedor_empleados (
    id            SERIAL PRIMARY KEY,
    proveedor_id  INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    nombre        TEXT NOT NULL,
    cedula        TEXT,
    cargo         TEXT,
    fecha_ingreso DATE,
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empleado_documentos (
    id                SERIAL PRIMARY KEY,
    empleado_id       INTEGER NOT NULL REFERENCES proveedor_empleados(id) ON DELETE CASCADE,
    tipo              TEXT NOT NULL CHECK (tipo IN ('salud','pension','arl','otro')),
    url_documento     TEXT NOT NULL,
    fecha_vencimiento DATE,
    descripcion       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contrato_tareas (
    id               SERIAL PRIMARY KEY,
    contrato_id      INTEGER NOT NULL REFERENCES contratos_servicio(id) ON DELETE CASCADE,
    titulo           TEXT NOT NULL,
    descripcion      TEXT,
    fecha_programada DATE,
    fecha_completada DATE,
    estado           TEXT NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','en_progreso','completada','vencida')),
    tipo             TEXT NOT NULL DEFAULT 'personalizado'
                         CHECK (tipo IN ('predefinido','personalizado')),
    orden            INTEGER DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contrato_comentarios (
    id          SERIAL PRIMARY KEY,
    contrato_id INTEGER NOT NULL REFERENCES contratos_servicio(id) ON DELETE CASCADE,
    tarea_id    INTEGER REFERENCES contrato_tareas(id) ON DELETE SET NULL,
    comentario  TEXT NOT NULL,
    autor_id    INTEGER REFERENCES usuarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contrato_pagos (
    id               SERIAL PRIMARY KEY,
    contrato_id      INTEGER NOT NULL REFERENCES contratos_servicio(id) ON DELETE CASCADE,
    tipo_pago        TEXT NOT NULL CHECK (tipo_pago IN ('anticipo','finiquito','parcial')),
    monto            NUMERIC(15,2) NOT NULL,
    fecha_pago       DATE NOT NULL,
    descripcion      TEXT,
    url_comprobante  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bitácora de mantenimientos
CREATE TABLE IF NOT EXISTS mantenimiento_bitacora (
    id                  SERIAL PRIMARY KEY,
    mantenimiento_id    INTEGER NOT NULL REFERENCES mantenimientos(id) ON DELETE CASCADE,
    evento              VARCHAR(100) NOT NULL,
    descripcion         TEXT,
    estado_anterior     VARCHAR(50),
    estado_nuevo        VARCHAR(50),
    usuario_id          INTEGER REFERENCES usuarios(id),
    usuario_nombre      VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bitácora de reservas
CREATE TABLE IF NOT EXISTS reserva_bitacora (
    id              SERIAL PRIMARY KEY,
    reserva_id      INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(50),
    estado_nuevo    VARCHAR(50),
    observacion     TEXT,
    archivos        JSONB NOT NULL DEFAULT '[]',
    usuario_id      INTEGER REFERENCES usuarios(id),
    usuario_nombre  VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reserva_archivos (
    id          SERIAL PRIMARY KEY,
    reserva_id  INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    nombre      VARCHAR(255),
    subido_por  INTEGER REFERENCES usuarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consejo de administración
CREATE TABLE IF NOT EXISTS consejo_miembros (
    id          SERIAL PRIMARY KEY,
    edificio_id INTEGER NOT NULL REFERENCES edificios(id) ON DELETE CASCADE,
    nombre      VARCHAR(255) NOT NULL,
    cargo       VARCHAR(100) NOT NULL,
    tipo        VARCHAR(20) NOT NULL DEFAULT 'activo',
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    unidad_id   INTEGER REFERENCES unidades(id),
    residente_id INTEGER REFERENCES usuarios(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chatbot IA (configuración global, gestionada por Backoffice)
CREATE TABLE IF NOT EXISTS chatbot_config (
    id              SERIAL PRIMARY KEY,
    organizacion_id INTEGER REFERENCES organizaciones(id) ON DELETE CASCADE,
    nombre          VARCHAR(100) NOT NULL DEFAULT 'Principal',
    proveedor       VARCHAR(50)  NOT NULL DEFAULT 'claude',
    api_key         TEXT,
    modelo          VARCHAR(100),
    base_url        TEXT,
    temperatura     FLOAT        NOT NULL DEFAULT 0.3,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_organizaciones_activo        ON organizaciones(activo);
CREATE INDEX IF NOT EXISTS idx_conjuntos_organizacion       ON conjuntos(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_edificios_organizacion       ON edificios(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_edificios_conjunto           ON edificios(conjunto_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion        ON usuarios(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_organizacion     ON proveedores(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_org_superadmins_org         ON organizacion_superadmins(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_org_superadmins_user        ON organizacion_superadmins(usuario_id);
CREATE INDEX IF NOT EXISTS idx_torres_edificio             ON torres(edificio_id);
CREATE INDEX IF NOT EXISTS idx_unidades_torre              ON unidades(torre_id);
CREATE INDEX IF NOT EXISTS idx_unidades_conjunto           ON unidades(conjunto_id);
CREATE INDEX IF NOT EXISTS idx_ocupaciones_unidad          ON ocupaciones(unidad_id);
CREATE INDEX IF NOT EXISTS idx_ocupaciones_usuario         ON ocupaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_unidad               ON cuotas(unidad_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado               ON cuotas(estado);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_edificio     ON mantenimientos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_estado       ON mantenimientos(estado);
CREATE INDEX IF NOT EXISTS idx_accesos_edificio            ON accesos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_accesos_fecha               ON accesos(fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_paquetes_unidad             ON paquetes(unidad_id);
CREATE INDEX IF NOT EXISTS idx_paquetes_estado             ON paquetes(estado);
CREATE INDEX IF NOT EXISTS idx_chat_edificio               ON chat_mensajes(edificio_id);
CREATE INDEX IF NOT EXISTS idx_turnos_guardia              ON turnos(guardia_id);
CREATE INDEX IF NOT EXISTS idx_reservas_zona               ON reservas(zona_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha              ON reservas(fecha);
CREATE INDEX IF NOT EXISTS idx_edificio_modulos            ON edificio_modulos(edificio_id);
CREATE INDEX IF NOT EXISTS idx_usuario_edificios           ON usuario_edificios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vehiculos_usuario           ON vehiculos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mascotas_usuario            ON mascotas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_creado_por      ON proveedores(creado_por);
CREATE INDEX IF NOT EXISTS idx_contratos_proveedor         ON contratos_servicio(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_usuario_conjuntos           ON usuario_conjuntos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_modulos_uso_edificio        ON modulos_uso(edificio_id);
CREATE INDEX IF NOT EXISTS idx_modulos_uso_fecha           ON modulos_uso(fecha);
CREATE INDEX IF NOT EXISTS idx_encuestas_edificio          ON encuestas(edificio_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_preguntas          ON encuesta_preguntas(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_sesiones           ON encuesta_sesiones(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_encuesta_respuestas         ON encuesta_respuestas(sesion_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_edificio            ON ordenes_compra(edificio_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado              ON ordenes_compra(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_proveedor           ON ordenes_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_proyecto            ON ordenes_compra(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_orden_items                 ON orden_items(orden_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_sol            ON cotizaciones(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_orden          ON cotizaciones(orden_id);
CREATE INDEX IF NOT EXISTS idx_orden_aprob                 ON orden_aprobaciones(orden_id);
CREATE INDEX IF NOT EXISTS idx_flujos_edificio             ON flujos_aprobacion(edificio_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_edificio        ON solicitudes_cotizacion(edificio_id);
CREATE INDEX IF NOT EXISTS idx_prov_empleados              ON proveedor_empleados(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_empleado_docs               ON empleado_documentos(empleado_id);
CREATE INDEX IF NOT EXISTS idx_contrato_tareas             ON contrato_tareas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_comentarios        ON contrato_comentarios(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_pagos              ON contrato_pagos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_mant_bitacora               ON mantenimiento_bitacora(mantenimiento_id);
CREATE INDEX IF NOT EXISTS idx_reserva_bitacora            ON reserva_bitacora(reserva_id);
CREATE INDEX IF NOT EXISTS idx_reserva_archivos            ON reserva_archivos(reserva_id);
CREATE INDEX IF NOT EXISTS idx_consejo_edificio            ON consejo_miembros(edificio_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_config_org          ON chatbot_config(organizacion_id);
"""


# Incremental migrations for existing databases (safety net)
MIGRATION_SQL = """
-- v15.0 — tipo_documento para usuarios, chatbot_config global (sin NOT NULL en org)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tipo_documento TEXT DEFAULT 'CC';

-- v14.0 — Organizaciones (multi-tenancy top-level entity)
ALTER TABLE conjuntos ADD COLUMN IF NOT EXISTS organizacion_id INTEGER REFERENCES organizaciones(id);
ALTER TABLE edificios  ADD COLUMN IF NOT EXISTS organizacion_id INTEGER REFERENCES organizaciones(id);
ALTER TABLE usuarios   ADD COLUMN IF NOT EXISTS organizacion_id INTEGER REFERENCES organizaciones(id);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS organizacion_id INTEGER REFERENCES organizaciones(id);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS descripcion TEXT;

CREATE TABLE IF NOT EXISTS organizacion_superadmins (
    id               SERIAL PRIMARY KEY,
    organizacion_id  INTEGER NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organizacion_id, usuario_id)
);

ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS organizacion_id INTEGER REFERENCES organizaciones(id);
ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);
UPDATE chatbot_config SET nombre = 'Principal' WHERE nombre IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_superadmins_org  ON organizacion_superadmins(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_org_superadmins_user ON organizacion_superadmins(usuario_id);
CREATE INDEX IF NOT EXISTS idx_conjuntos_organizacion ON conjuntos(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_edificios_organizacion ON edificios(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion  ON usuarios(organizacion_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_organizacion ON proveedores(organizacion_id);

-- Reserve/zones extension (idempotent)
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS inventario_url TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS deposito_devuelto BOOLEAN;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS estado_entrega TEXT CHECK (estado_entrega IN ('pendiente','inventario_adjunto','completada'));
ALTER TABLE zonas_comunes ADD COLUMN IF NOT EXISTS requiere_inventario BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE zonas_comunes ADD COLUMN IF NOT EXISTS costo_arriendo NUMERIC(12,2);
ALTER TABLE zonas_comunes ADD COLUMN IF NOT EXISTS costo_deposito NUMERIC(12,2);
ALTER TABLE zonas_comunes ADD COLUMN IF NOT EXISTS intervalo_reserva INTEGER DEFAULT 60;
ALTER TABLE paquetes ADD COLUMN IF NOT EXISTS residente_nombre VARCHAR(255);
ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS valor NUMERIC(15,2);
ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'COP';
ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS fecha_auditoria DATE;
ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS orden_compra_id INTEGER REFERENCES ordenes_compra(id);
ALTER TABLE contratos_servicio ADD COLUMN IF NOT EXISTS aprobacion_asamblea_url TEXT;
ALTER TABLE solicitudes_cotizacion ADD COLUMN IF NOT EXISTS num_cotizaciones_requeridas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS padre_id INTEGER REFERENCES mantenimientos(id);
ALTER TABLE consejo_miembros ADD COLUMN IF NOT EXISTS unidad_id    INTEGER REFERENCES unidades(id);
ALTER TABLE consejo_miembros ADD COLUMN IF NOT EXISTS residente_id INTEGER REFERENCES usuarios(id);

INSERT INTO modulos (clave, nombre, icono)
VALUES ('chatbot', 'Asistente IA', '🤖')
ON CONFLICT (clave) DO NOTHING;
"""


def init_db():
    """Create all tables if they don't exist. Called on startup."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
            cur.execute(MIGRATION_SQL)
    print("✅ Database schema initialized")


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
                _ensure_base_data(cur)
                print("ℹ️  Database already seeded, skipping.")
                return

            # ── Módulos ───────────────────────────────────────────────────────
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
                ("procurement",   "Procurement",       "🛒"),
                ("chatbot",       "Asistente IA",      "🤖"),
            ]
            cur.executemany(
                "INSERT INTO modulos (clave, nombre, icono) VALUES (%s,%s,%s) ON CONFLICT (clave) DO NOTHING",
                modulos,
            )

            # ── Organizaciones ────────────────────────────────────────────────
            cur.execute(
                """INSERT INTO organizaciones (nombre, nit, email, telefono, direccion, ciudad)
                   VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                ("Propiedades Norte Ltda", "900.123.456-7",
                 "contacto@propiedadesnorte.co", "601 300 1111",
                 "Cra 15 #85-32", "Bogotá"),
            )
            org1_id = cur.fetchone()["id"]

            cur.execute(
                """INSERT INTO organizaciones (nombre, nit, email, telefono, direccion, ciudad)
                   VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
                ("Inmobiliaria Sur SAS", "900.789.012-3",
                 "info@inmobiliariasur.co", "601 400 2222",
                 "Calle 100 #14-55", "Bogotá"),
            )
            org2_id = cur.fetchone()["id"]

            # ── Backoffice (platform-level, no org) ───────────────────────────
            bo_hash = pwd_context.hash("Back123!") if pwd_context else None
            cur.execute(
                """INSERT INTO usuarios (nombre,cedula,email,telefono,rol,password_hash,organizacion_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                ("Admin Backoffice", "00.000.002", "backoffice@torreadmin.co",
                 "300 000 0002", "backoffice", bo_hash, None),
            )

            # ── SuperAdmin 1 (both orgs) ──────────────────────────────────────
            sa_hash = pwd_context.hash("Super123!") if pwd_context else None
            cur.execute(
                """INSERT INTO usuarios (nombre,cedula,email,telefono,rol,password_hash,organizacion_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                ("Super Admin", "00.000.001", "superadmin@torreadmin.co",
                 "300 000 0000", "superadmin", sa_hash, None),
            )
            sa1_id = cur.fetchone()["id"]

            # ── SuperAdmin 2 (org 2 only) ─────────────────────────────────────
            cur.execute(
                """INSERT INTO usuarios (nombre,cedula,email,telefono,rol,password_hash,organizacion_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                ("Super Admin Sur", "00.000.003", "superadmin2@torreadmin.co",
                 "300 000 0003", "superadmin", sa_hash, None),
            )
            sa2_id = cur.fetchone()["id"]

            # Assign SA1 → org1 + org2; SA2 → org2
            cur.execute(
                "INSERT INTO organizacion_superadmins (organizacion_id, usuario_id) VALUES (%s,%s),(%s,%s)",
                (org1_id, sa1_id, org2_id, sa1_id),
            )
            cur.execute(
                "INSERT INTO organizacion_superadmins (organizacion_id, usuario_id) VALUES (%s,%s)",
                (org2_id, sa2_id),
            )

            # ── ORG 1 — Conjunto Nórdico (Propiedades Norte) ─────────────────
            cur.execute(
                "INSERT INTO conjuntos (organizacion_id, nombre, direccion, ciudad) VALUES (%s,%s,%s,%s) RETURNING id",
                (org1_id, "Conjunto Nórdico", "Cra 15 #85-32, Bogotá", "Bogotá"),
            )
            conjunto_id = cur.fetchone()["id"]

            # Edificio 1: Torres del Norte
            cur.execute(
                "INSERT INTO edificios (organizacion_id, nombre, direccion, pisos, conjunto_id) VALUES (%s,%s,%s,%s,%s) RETURNING id",
                (org1_id, "Torres del Norte", "Cra 15 #85-32, Bogotá", 8, conjunto_id),
            )
            edificio_tdn_id = cur.fetchone()["id"]

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

            for piso in range(1, 9):
                for apt in range(1, 4):
                    cur.execute(
                        "INSERT INTO unidades (torre_id, numero, piso, tipo, coeficiente) VALUES (%s,%s,%s,%s,%s)",
                        (torre_a_id, f"Apto {piso}0{apt}A", piso, "apartamento", round(1/24, 4)),
                    )
            for piso in range(1, 5):
                for apt in range(1, 3):
                    cur.execute(
                        "INSERT INTO unidades (torre_id, numero, piso, tipo, coeficiente) VALUES (%s,%s,%s,%s,%s)",
                        (torre_b_id, f"Apto {piso}0{apt}B", piso, "apartamento", round(1/8, 4)),
                    )

            # Edificio 2: Reserva del Parque (org 1, no conjunto)
            cur.execute(
                "INSERT INTO edificios (organizacion_id, nombre, direccion, pisos) VALUES (%s,%s,%s,%s) RETURNING id",
                (org1_id, "Reserva del Parque", "Av. El Dorado #68-11, Bogotá", 6),
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

            # ── ORG 2 — Palma Real (Inmobiliaria Sur) ────────────────────────
            cur.execute(
                "INSERT INTO edificios (organizacion_id, nombre, direccion, pisos) VALUES (%s,%s,%s,%s) RETURNING id",
                (org2_id, "Edificio Palma Real", "Calle 100 #14-55, Bogotá", 5),
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

            # ── Usuarios demo (Org 1) ─────────────────────────────────────────
            admin_hash   = pwd_context.hash("Admin123!")   if pwd_context else None
            prop_hash    = pwd_context.hash("Prop123!")    if pwd_context else None
            torre_hash   = pwd_context.hash("Torre123!")   if pwd_context else None
            guardia_hash = pwd_context.hash("Guardia123!") if pwd_context else None

            demo_users = [
                ("Juan Rodríguez",         "79.111.222",    "admin@torreadmin.co",    "310 000 0001", "administrador", admin_hash,   None, None,       org1_id),
                ("Carlos Andrés Martínez", "79.456.123",    "c.martinez@gmail.com",   "310 456 7890", "propietario",   prop_hash,    "Compensar", "ARL Sura", org1_id),
                ("María Fernanda Gómez",   "52.789.456",    "mfgomez@hotmail.com",    "315 234 5678", "propietario",   torre_hash,   None, None,       org1_id),
                ("Jhon Sebastián Rojas",   "1.020.345.678", "jsrojas@gmail.com",      "300 987 6543", "inquilino",     torre_hash,   None, None,       org1_id),
                ("Luisa Valentina Herrera","43.567.890",    "lv.herrera@outlook.com", "318 765 4321", "propietario",   torre_hash,   None, None,       org1_id),
                ("Pedro Guardia",          "80.999.111",    "guardia1@torreadmin.co", "311 000 0001", "portero",       guardia_hash, None, None,       org1_id),
            ]
            user_ids = {}
            for nombre, cedula, email, telefono, rol, ph, eps, aseg, org_id in demo_users:
                cur.execute(
                    """INSERT INTO usuarios (organizacion_id,nombre,cedula,email,telefono,rol,password_hash,eps,aseguradora_riesgo)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                    (org_id, nombre, cedula, email, telefono, rol, ph, eps, aseg),
                )
                user_ids[email] = cur.fetchone()["id"]

            admin_id    = user_ids["admin@torreadmin.co"]
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

            # ── Ocupaciones demo ──────────────────────────────────────────────
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

            # ── Zonas comunes ─────────────────────────────────────────────────
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

            # ── Proveedores demo (Org 1) ──────────────────────────────────────
            cur.execute(
                """INSERT INTO proveedores (organizacion_id,nombre,contacto,telefono,email,especialidad,nit,creado_por) VALUES
                (%s,'Elevadores Técnicos S.A.S','Carlos Mora','601 234 5678','contacto@elevtec.co','Ascensores','900.123.456-1',%s),
                (%s,'AquaServ Colombia','Luz Marina Pérez','314 567 8901','info@aquaserv.co','Piscinas y sistemas hidráulicos','900.234.567-2',%s),
                (%s,'Electrored Mantenimientos','Fabio Torres','315 678 9012','fabio@electrored.co','Electricidad','900.345.678-3',%s)""",
                (org1_id, sa1_id, org1_id, sa1_id, org1_id, sa1_id),
            )

            # ── Activar todos los módulos ─────────────────────────────────────
            cur.execute("SELECT id FROM modulos")
            modulo_ids = [r["id"] for r in cur.fetchall()]
            for eid in [edificio_tdn_id, edificio_rp_id, edificio_pr_id]:
                for mid in modulo_ids:
                    cur.execute(
                        "INSERT INTO edificio_modulos (edificio_id, modulo_id, activo) VALUES (%s,%s,TRUE) ON CONFLICT DO NOTHING",
                        (eid, mid),
                    )

            # ── Cuotas demo ───────────────────────────────────────────────────
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

            print("✅ Database seeded with demo data (v14 — organizaciones multi-tenant)")


def _ensure_passwords(cur, pwd_context):
    """Update password_hash for seeded users that don't have one yet."""
    demo_passwords = {
        "admin@torreadmin.co":        "Admin123!",
        "superadmin@torreadmin.co":   "Super123!",
        "superadmin2@torreadmin.co":  "Super123!",
        "backoffice@torreadmin.co":   "Back123!",
        "guardia1@torreadmin.co":     "Guardia123!",
        "c.martinez@gmail.com":       "Prop123!",
        "mfgomez@hotmail.com":        "Torre123!",
        "jsrojas@gmail.com":          "Torre123!",
        "lv.herrera@outlook.com":     "Torre123!",
    }
    for email, pw in demo_passwords.items():
        cur.execute(
            "UPDATE usuarios SET password_hash = %s WHERE email = %s AND password_hash IS NULL",
            (pwd_context.hash(pw), email),
        )
    print("✅ Demo passwords set")


def _ensure_base_data(cur):
    """Ensure modules and basic assignments exist for demo data."""
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
        ("procurement",   "Procurement",       "🛒"),
        ("chatbot",       "Asistente IA",      "🤖"),
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

    print("✅ Base data ensured")
