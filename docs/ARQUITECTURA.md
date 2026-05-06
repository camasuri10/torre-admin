# TorreAdmin - Documentación Técnica del Proyecto

## 1. Visión General del Proyecto

TorreAdmin es una plataforma SaaS integral para la administración de propiedad horizontal (edificios residenciales, conjuntos residenciales y condominos). La aplicación permite gestionar Residents, finanzas, mantenimiento, seguridad, reservas de zonas comunes y comunicación entre administradores, Residents y personal de seguridad.

### 1.1 Propósito del Sistema

El sistema está diseñado para resolver las necesidades operativas de administración de propiedad horizontal, incluyendo:

- **Gestión de Residents**: Registro, asignación de unidades y seguimiento de ocupaciones
- **Administración financiera**: Generación de cuotas, seguimiento de pagos y morosidad
- **Mantenimiento**: Solicitudes de mantenimiento preventivo y correctivo
- **Seguridad**: Control de accesos, paquetería, guardias y chat de seguridad
- **Comunicación**: Comunicados y announcements a los Residents
- **Zonas comunes**: Reservas de áreas comunitarias (piscina, gym, salón social, etc.)

---

## 2. Arquitectura del Sistema

### 2.1 Stack Tecnológico

El proyecto utiliza una arquitectura full-stack moderna con las siguientes tecnologías:

| Capa | Tecnología | Versión |
|------|------------|---------|
| Frontend | Next.js (App Router) | 14.2.5 |
| Lenguaje Frontend | TypeScript | 5.x |
| Framework UI | React | 18.x |
| Estilos | Tailwind CSS | 3.4.1 |
| Gráficos | Recharts | 3.8.1 |
| Backend | FastAPI (Python) | - |
| Base de datos | PostgreSQL (Supabase) | - |
| Autenticación | JWT (python-jose) | - |
| Hash de contraseñas | bcrypt | - |
| Despliegue | Vercel | - |

### 2.2 Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐  │
│  │   NEXT.JS FRONTEND   │    │   FASTAPI SERVERLESS API     │  │
│  │   (Port 3000)        │    │   (Vercel Serverless)        │  │
│  │   /dashboard/*       │    │   /api/*                     │  │
│  │   /login/*           │    │   /api/auth/*                │  │
│  └──────────────────────┘    │   /api/edificios/*           │  │
│                              │   /api/usuarios/*            │  │
│                              │   ...                        │  │
│                              └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                        ┌────────────────────────┐
                        │   SUPABASE (PostgreSQL)│
                        │   Base de datos        │
                        └────────────────────────┘
```

### 2.3 Estructura del Proyecto

```
torre-admin/
├── app/                          # Next.js 14 App Router
│   ├── page.tsx                  # Landing page pública
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Estilos globales
│   ├── login/
│   │   ├── page.tsx              # Formulario de login
│   │   └── seleccionar-edificio/ # Selección de edificio (multi-edificio)
│   └── dashboard/
│       ├── layout.tsx            # Layout principal (sidebar + topbar)
│       ├── page.tsx              # Dashboard home (KPIs)
│       ├── residentes/           # Gestión de Residents
│       ├── finanzas/             # Finanzas y cuotas
│       ├── mantenimiento/        # Solicitudes de mantenimiento
│       ├── comunicados/         # Announcements y comunicados
│       ├── zonas-comunes/        # Reservas de zonas comunes
│       ├── accesos/              # Control de accesos y visitantes
│       ├── paquetes/             # Gestión de paquetería
│       ├── chat/                 # Chat de seguridad
│       ├── guardias/             # Guardias y turnos
│       ├── reportes/             # Reportes y analytics
│       ├── perfil/               # Perfil del usuario
│       ├── proveedores/          # Proveedores de servicios
│       ├── backoffice/           # Panel de backoffice
│       ├── superadmin/           # Panel de super administrador
│       └── backoffice/
│           └── usuarios/         # Gestión de usuarios global
│
├── api/                          # FastAPI Backend
│   ├── index.py                  # Punto de entrada FastAPI
│   ├── db.py                     # Conexión a BD y esquema
│   ├── requirements.txt          # Dependencias Python
│   └── routers/                  # Endpoints de la API
│       ├── auth.py               # Autenticación (JWT)
│       ├── usuarios.py           # Gestión de usuarios
│       ├── edificios.py          # Edificios y torres
│       ├── cuotas.py             # Cuotas administrativas
│       ├── mantenimientos.py     # Solicitudes de mantenimiento
│       ├── comunicados.py       # Announcements
│       ├── zonas_comunes.py      # Zonas comunes y reservas
│       ├── accesos.py            # Control de accesos
│       ├── paquetes.py           # Paquetería
│       ├── guardias.py           # Guardias y turnos
│       ├── chat.py               # Chat de seguridad
│       ├── reportes.py           # Reportes y analytics
│       ├── superadmin.py         # Endpoints super admin
│       ├── backoffice.py         # Endpoints backoffice
│       ├── conjuntos.py          # Conjuntos residenciales
│       ├── vehiculos.py          # Vehículos de Residents
│       ├── mascotas.py           # Mascotas de Residents
│       └── proveedores.py        # Proveedores
│
├── lib/                          # Utilidades del frontend
│   ├── api.ts                    # Cliente API centralizado
│   ├── auth.ts                   # Helpers de autenticación
│   └── mock-data.ts              # Datos de prueba
│
├── middleware.ts                 # Protección de rutas Next.js
├── package.json                  # Dependencias npm
├── tsconfig.json                 # Configuración TypeScript
├── tailwind.config.ts            # Configuración Tailwind
├── next.config.js                # Configuración Next.js
└── vercel.json                   # Configuración de despliegue
```

### 2.4 Flujo de Datos

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Browser    │───▶│  Next.js     │───▶│   FastAPI    │
│   (React)    │◀───│  Frontend    │◀───│   Backend    │
└──────────────┘    └──────────���───┘    └──────────────┘
       │                                         │
       │  localStorage                           │
       │  - torre_auth_token                     ▼
       │  - torre_edificios_disponibles    ┌──────────────┐
       │  - torre_user_temp                  │  PostgreSQL  │
       │                                     │  (Supabase)  │
       │  Cookies                             └──────────────┘
       │  - auth_token (24h)
```

---

## 3. Autenticación y Autorización

### 3.1 Flujo de Autenticación

El sistema utiliza JWT (JSON Web Tokens) para la autenticación. El flujo completo es:

```
1. Usuario ingresa email y contraseña
2. Frontend → POST /api/auth/login
3. Backend valida credenciales (bcrypt)
4. Backend genera JWT con:
   - sub: user ID
   - email
   - nombre
   - rol: rol del usuario
   - edificio_id: edificio seleccionado (si aplica)
   - exp: fecha de expiración
5. Frontend almacena token en localStorage y cookie
6. Redirect a /dashboard o /login/seleccionar-edificio
```

### 3.2 Selección de Edificio

Para usuarios con acceso a múltiples edificios:

```
1. Login exitoso → Si tiene >1 edificio → Redirect a /login/seleccionar-edificio
2. Usuario selecciona edificio
3. Frontend → POST /api/auth/seleccionar-edificio
4. Backend emite nuevo JWT con edificio_id
5. Redirect a /dashboard
```

### 3.3 Protección de Rutas

El archivo `middleware.ts` de Next.js protege las rutas:

- `/dashboard/*` → Requiere token válido (redirect a /login si no)
- `/login` → Redirect a /dashboard si ya está autenticado

---

## 4. Base de Datos

### 4.1 Esquema Jerárquico

La base de datos sigue una estructura jerárquica:

```
Conjunto (opcional)
├── Edificio
│   ├── Torre
│   │   └── Unidad (apartamento, local, oficina)
│   │       └── Ocupación (propietario/inquilino)
│   └── [Servicios: mantenimiento, guardias, etc.]
└── Unidad (casa, tipo='casa')
```

### 4.2 Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `conjuntos` | Conjuntos residenciales (agrupan edificios) |
| `edificios` | Edificios individuales |
| `torres` | Torres/bloques dentro de un edificio |
| `unidades` | Apartamentos, locales, oficinas, casas |
| `usuarios` | Todos los usuarios del sistema (7 roles) |
| `ocupaciones` | Relación usuario-unidad (propietario/inquilino) |
| `cuotas` | Cuotas administrativas mensuales |
| `vehiculos` | Vehículos de los Residents |
| `mascotas` | Mascotas de los Residents |
| `proveedores` | Proveedores de servicios |
| `contratos_servicio` | Contratos con proveedores |
| `mantenimientos` | Solicitudes de mantenimiento |
| `mantenimiento_archivos` | Fotos y documentos de mantenimiento |
| `mantenimiento_alertas` | Alertas de mantenimiento preventivo |
| `comunicados` | Announcements a Residents |
| `comunicado_envios` | Tracking de entrega de comunicados |
| `chat_mensajes` | Mensajes del chat de seguridad |
| `zonas_comunes` | Zonas comunes (piscina, gym, etc.) |
| `reservas` | Reservas de zonas comunes |
| `accesos` | Registro de accesos de visitantes |
| `paquetes` | Tracking de paquetes |
| `guardias` | Personal de seguridad |
| `turnos` | Turnos de vigilancia |
| `guardia_eventos` | Incidentes y notas de guardias |
| `modulos` | Módulos del sistema |
| `edificio_modulos` | Módulos activos por edificio |
| `usuario_edificios` | Asignación admins a edificios |
| `usuario_conjuntos` | Asignación admins a conjuntos |

---

## 5. Módulos del Sistema

### 5.1 Módulos Disponibles

El sistema cuenta con los siguientes módulos que pueden habilitarse/deshabilitarse por edificio:

| Módulo | Clave | Descripción |
|--------|-------|-------------|
| Finanzas | `finanzas` | Cuotas, pagos y morosidad |
| Mantenimiento | `mantenimiento` | Solicitudes de mantenimiento |
| Comunicados | `comunicados` | Announcements a Residents |
| Zonas Comunes | `zonas_comunes` | Reservas de áreas comunitarias |
| Accesos | `accesos` | Control de accesos y visitantes |
| Paquetes | `paquetes` | Gestión de paquetería |
| Chat | `chat` | Chat de seguridad |
| Guardias | `guardias` | Gestión de turnos de vigilancia |
| Reportes | `reportes` | Reportes y analytics |

### 5.2 Habilitación por Edificio

El super administrador puede habilitar o deshabilitar módulos específicos para cada edificio mediante la API `/api/superadmin/edificios/{id}/modulos`.

---

## 6. Endpoints de la API

### 6.1 Estructura General

- **Base URL**: `process.env.NEXT_PUBLIC_API_URL`
- **Prefijo**: `/api/`
- **Formato**: JSON
- **Autenticación**: Bearer Token en header

### 6.2 Endpoints por Módulo

#### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Inicio de sesión |
| GET | `/api/auth/me` | Obtener usuario actual |
| GET | `/api/auth/mis-edificios` | Edificios disponibles |
| POST | `/api/auth/seleccionar-edificio` | Seleccionar edificio |
| POST | `/api/auth/seleccionar-todos` | Seleccionar todos los edificios |

#### Edificios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/edificios/` | Listar edificios |
| GET | `/api/edificios/{id}` | Obtener edificio |
| GET | `/api/edificios/{id}/torres` | Torres del edificio |
| GET | `/api/edificios/{id}/unidades` | Unidades del edificio |

#### Usuarios
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/usuarios/` | Listar usuarios |
| GET | `/api/usuarios/{id}` | Obtener usuario |
| POST | `/api/usuarios/` | Crear usuario |
| PUT | `/api/usuarios/{id}` | Actualizar usuario |
| GET | `/api/usuarios/ocupaciones` | Listar ocupaciones |

#### Finanzas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/cuotas/` | Listar cuotas |
| POST | `/api/cuotas/` | Crear cuota |
| POST | `/api/cuotas/generar-mes` | Generar cuotas del mes |
| POST | `/api/cuotas/{id}/pagar` | Registrar pago |

#### Mantenimiento
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/mantenimientos/` | Listar solicitudes |
| POST | `/api/mantenimientos/` | Crear solicitud |
| PUT | `/api/mantenimientos/{id}` | Actualizar solicitud |
| GET | `/api/mantenimientos/alertas/` | Alertas preventivas |

#### Comunicados
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/comunicados/` | Listar comunicados |
| POST | `/api/comunicados/` | Crear comunicado |
| GET | `/api/comunicados/{id}/envios` | Tracking de envíos |

#### Zonas Comunes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/zonas-comunes/` | Listar zonas |
| POST | `/api/zonas-comunes/` | Crear zona |
| GET | `/api/zonas-comunes/reservas` | Listar reservas |
| POST | `/api/zonas-comunes/reservas` | Crear reserva |

#### Accesos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/accesos/` | Listar accesos |
| POST | `/api/accesos/` | Registrar acceso |
| POST | `/api/accesos/{id}/salida` | Registrar salida |

#### Paquetes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/paquetes/` | Listar paquetes |
| POST | `/api/paquetes/` | Registrar paquete |
| POST | `/api/paquetes/{id}/entregar` | Entregar paquete |

#### Guardias
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/guardias/` | Listar guardias |
| GET | `/api/guardias/turnos` | Listar turnos |
| POST | `/api/guardias/turnos/{id}/eventos` | Registrar evento |

#### Chat
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/chat/{edificio_id}` | Obtener mensajes |
| POST | `/api/chat/` | Enviar mensaje |

#### Reportes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/reportes/dashboard/{edificio_id}` | KPIs del edificio |
| GET | `/api/reportes/finanzas/` | Reporte financiero |

#### Super Admin
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/superadmin/stats` | Estadísticas globales |
| GET | `/api/superadmin/edificios` | Listar edificios |
| POST | `/api/superadmin/edificios` | Crear edificio |
| PUT | `/api/superadmin/edificios/{id}` | Actualizar edificio |
| GET | `/api/superadmin/admins` | Listar administradores |
| POST | `/api/superadmin/admins` | Crear administrador |

#### Backoffice
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/backoffice/stats` | Estadísticas |
| GET | `/api/backoffice/usuarios` | Gestión de usuarios |

---

## 7. Variables de Entorno

### 7.1 Frontend

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL base de la API | `http://localhost:8000` |

### 7.2 Backend

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión a PostgreSQL (Supabase) | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | Clave secreta para JWT | Valor por defecto para desarrollo |

---

## 8. Desarrollo Local

### 8.1 Requisitos Previos

- Node.js 18+
- Python 3.12+
- PostgreSQL (o cuenta de Supabase)

### 8.2 Configuración

```bash
# Frontend
cd torre-admin
npm install

# Backend
cd api
pip install -r requirements.txt
```

### 8.3 Ejecución

```bash
# Frontend (puerto 3000)
npm run dev

# Backend (puerto 8000)
cd api
uvicorn index:app --reload --port 8000
```

### 8.4 Credenciales de Demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Super Admin | superadmin@torreadmin.co | Super123! |
| Administrador | admin@torreadmin.co | Admin123! |
| Propietario | c.martinez@gmail.com | Prop123! |
| Portero | guardia1@torreadmin.co | Guardia123! |

---

## 9. Despliegue

### 9.1 Vercel

El proyecto está configurado para desplegarse en Vercel:

1. **Frontend**: Se despliega automáticamente desde la rama principal
2. **API**: Se despliega como Vercel Serverless Functions (vía `api/index.py`)
3. **Base de datos**: Supabase PostgreSQL

### 9.2 Inicialización de Base de Datos

La base de datos se inicializa automáticamente en el primer request:

1. El módulo `db.py` ejecuta el esquema SQL definido en `SCHEMA_SQL`
2. La función `seed_db()` inserta datos de prueba
3. Endpoint `/api/setup` permite activación manual

---

## 10. Consideraciones de Seguridad

- Las contraseñas se almacenan con hash bcrypt
- Los tokens JWT expiran después de 24 horas
- Las rutas del dashboard están protegidas por middleware
- Los endpoints de API validan el token y el rol del usuario
- CORS permite todos los orígenes (configuración de desarrollo)

---

*Documento generado automáticamente para TorreAdmin v0.2.0*