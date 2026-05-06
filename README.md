# TorreAdmin 🏢

**Plataforma SaaS integral para la administración de propiedad horizontal** (edificios residenciales, conjuntos residenciales y condominos) en Latinoamérica.

Administra Residents, finanzas, mantenimiento, seguridad, reservas de zonas comunes y comunicación entre administradores, Residents y personal de seguridad.

---

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Frontend | Next.js (App Router) | 14.2.5 |
| Lenguaje | TypeScript | 5.x |
| Framework UI | React | 18.x |
| Estilos | Tailwind CSS | 3.4.1 |
| Gráficos | Recharts | 3.8.1 |
| Backend | FastAPI (Python) | - |
| Base de datos | PostgreSQL (Supabase) | - |
| Autenticación | JWT (python-jose) | - |
| Hash de contraseñas | bcrypt | - |
| Despliegue | Vercel | - |

---

## 🚀 Inicio Rápido Local

### Requisitos Previos

- Node.js 18+
- Python 3.12+
- PostgreSQL (cuenta de Supabase recomendada)

### 1. Clonar e Instalar Dependencias

```bash
git clone https://github.com/tu-usuario/torreadmin.git
cd torreadmin

# Frontend
npm install

# Backend Python
cd api
pip install -r requirements.txt
cd ..
```

### 2. Configurar Variables de Entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tu configuración:

```env
# Backend
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Iniciar la API (Puerto 8000)

```bash
cd api
uvicorn index:app --reload --port 8000
```

La API inicializa el schema de la base de datos automáticamente. Documentación interactiva disponible en: http://localhost:8000/docs

### 4. Iniciar el Frontend (Puerto 3000)

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## ☁️ Despliegue en Vercel + Supabase

### Paso 1: Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**
2. Anota el **Connection string** (Settings → Database → Connection string → URI)
3. Formato: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

### Paso 2: Configurar Secretos en Vercel

```bash
# Instalar CLI de Vercel
npm install -g vercel
vercel login

# Agregar secreto de base de datos
vercel env add DATABASE_URL production
# Pega el connection string de Supabase

# Opcional: URL y key de Supabase para Storage
vercel env add NEXT_PUBLIC_API_URL production
```

O desde el dashboard de Vercel:
1. Proyecto → **Settings** → **Environment Variables**
2. Agrega `DATABASE_URL` con el connection string de Supabase
3. Marca **Production** (y Preview si deseas)

### Paso 3: Desplegar

```bash
# Primera vez
vercel

# Producción
vercel --prod
```

O conecta tu repositorio de GitHub en [vercel.com](https://vercel.com) → **Add New Project**.

> **Nota:** El schema se crea automáticamente en el primer request a la API (`/api/health`). No necesitas migraciones manuales.

---

## 📁 Estructura del Proyecto

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
│       ├── comunicados/          # Anuncios y comunicados
│       ├── zonas-comunes/        # Reservas de zonas comunes
│       ├── accesos/              # Control de accesos y visitantes
│       ├── paquetes/             # Gestión de paquetería
│       ├── chat/                 # Chat de seguridad
│       ├── guardias/             # Guardias y turnos
│       ├── reportes/             # Reportes y analytics
│       ├── perfil/               # Perfil del usuario
│       ├── proveedores/          # Proveedores de servicios
│       ├── backoffice/           # Panel de backoffice
│       └── superadmin/           # Panel de super administrador
│           ├── admins/
│           ├── conjuntos/
│           └── edificios/
│
├── api/                          # FastAPI Backend
│   ├── index.py                  # Punto de entrada (Vercel Serverless)
│   ├── db.py                     # Conexión BD + schema SQL + seed
│   ├── requirements.txt          # Dependencias Python
│   └── routers/                  # Endpoints por dominio
│       ├── auth.py               # Autenticación JWT
│       ├── usuarios.py           # Gestión de usuarios
│       ├── edificios.py          # Edificios y torres
│       ├── cuotas.py             # Cuotas administrativas
│       ├── mantenimientos.py     # Solicitudes de mantenimiento
│       ├── comunicados.py        # Anuncios
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
│   └── mock-data.ts              # Datos de prueba (fallback)
│
├── docs/                         # Documentación
│   ├── ARQUITECTURA.md           # Arquitectura completa
│   └── ROLES.md                  # Roles y permisos
│
├── middleware.ts                 # Protección de rutas Next.js
├── package.json                  # Dependencias npm
├── tsconfig.json                 # Configuración TypeScript
├── tailwind.config.ts            # Configuración Tailwind
├── next.config.js                # Configuración Next.js
└── vercel.json                   # Configuración de despliegue
```

---

## 🗄️ Base de Datos (Supabase / PostgreSQL)

El schema se crea automáticamente. Estructura jerárquica:

```
Conjunto (opcional)
├── Edificio
│   ├── Torre
│   │   └── Unidad (apartamento, local, oficina)
│   │       └── Ocupación (propietario/inquilino)
│   └── [Servicios: mantenimiento, guardias, etc.]
└── Unidad (casa, tipo='casa')
```

### Tablas Principales

| Tabla | Descripción |
|-------|-------------|
| `conjuntos` | Conjuntos residenciales (agrupan edificios) |
| `edificios` | Edificios individuales |
| `torres` | Torres/bloques dentro de un edificio |
| `unidades` | Apartamentos, locales, oficinas, casas |
| `usuarios` | Todos los usuarios del sistema (7 roles) |
| `ocupaciones` | Relación usuario-unidad |
| `cuotas` | Cuotas administrativas mensuales |
| `vehiculos` | Vehículos de los Residents |
| `mascotas` | Mascotas de los Residents |
| `proveedores` | Proveedores de servicios |
| `contratos_servicio` | Contratos con proveedores |
| `mantenimientos` | Solicitudes de mantenimiento |
| `mantenimiento_archivos` | Fotos y documentos adjuntos |
| `mantenimiento_alertas` | Alertas preventivas programadas |
| `comunicados` | Anuncios a Residents |
| `comunicado_envios` | Tracking de entrega |
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

## 📋 Módulos del Sistema

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Dashboard | ✅ | KPIs en tiempo real con fallback a mock data |
| Residentes | ✅ | Propietarios e inquilinos con vehículos y mascotas |
| Finanzas | ✅ | Cuotas, pagos, morosidad |
| Mantenimiento | ✅ | Solicitudes + alertas preventivas + fotos/facturas |
| Comunicados | ✅ | Anuncios por edificio o global con tracking |
| Zonas Comunes | ✅ | Reservas con configuración de tiempo |
| Control de Accesos | ✅ | Registro de visitantes con entrada/salida |
| Paquetería | ✅ | Recepción, notificación y entrega |
| Chat Seguridad | ✅ | Chat en tiempo real con alertas |
| Guardias / Turnos | ✅ | Cuadro de turnos + novedades + eventos |
| Reportes | ✅ | Reportería completa por módulo |
| Proveedores | ✅ | Gestión de proveedores y contratos |
| Perfil | ✅ | Perfil del usuario con configuración |
| Backoffice | ✅ | Panel de gestión de usuarios |
| Super Admin | ✅ | Panel de administración global |

### Módulos Habilitables por Edificio

El super administrador puede habilitar/deshabilitar módulos específicos por edificio:
- Finanzas, Mantenimiento, Comunicados, Zonas Comunes
- Accesos, Paquetes, Chat, Guardias, Reportes

---

## 🔐 Autenticación y Autorización

### Flujo de Autenticación JWT

1. Usuario ingresa email y contraseña
2. Frontend → POST `/api/auth/login`
3. Backend valida credenciales (bcrypt)
4. Backend genera JWT con: user ID, email, nombre, rol, edificio_id, exp
5. Frontend almacena token en localStorage y cookie (24h)
6. Redirect a `/dashboard` o `/login/seleccionar-edificio`

### Selección de Edificio (Multi-edificio)

1. Login exitoso → Si tiene >1 edificio → Redirect a `/login/seleccionar-edificio`
2. Usuario selecciona edificio
3. Frontend → POST `/api/auth/seleccionar-edificio`
4. Backend emite nuevo JWT con edificio_id
5. Redirect a `/dashboard`

### Protección de Rutas

- `/dashboard/*` → Requiere token válido (redirect a `/login` si no)
- `/login` → Redirect a `/dashboard` si ya está autenticado

---

## 🔌 Endpoints de la API

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Inicio de sesión |
| GET | `/api/auth/me` | Obtener usuario actual |
| GET | `/api/auth/mis-edificios` | Edificios disponibles |
| POST | `/api/auth/seleccionar-edificio` | Seleccionar edificio |
| POST | `/api/auth/seleccionar-todos` | Seleccionar todos los edificios |

### Edificios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/edificios/` | Listar edificios |
| GET | `/api/edificios/{id}` | Obtener edificio |
| GET | `/api/edificios/{id}/torres` | Torres del edificio |
| GET | `/api/edificios/{id}/unidades` | Unidades del edificio |

### Usuarios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/usuarios/` | Listar usuarios |
| GET | `/api/usuarios/{id}` | Obtener usuario |
| POST | `/api/usuarios/` | Crear usuario |
| PUT | `/api/usuarios/{id}` | Actualizar usuario |
| GET | `/api/usuarios/ocupaciones` | Listar ocupaciones |

### Finanzas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/cuotas/` | Listar cuotas |
| POST | `/api/cuotas/` | Crear cuota |
| POST | `/api/cuotas/generar-mes` | Generar cuotas del mes |
| POST | `/api/cuotas/{id}/pagar` | Registrar pago |

### Mantenimiento

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/mantenimientos/` | Listar solicitudes |
| POST | `/api/mantenimientos/` | Crear solicitud |
| PUT | `/api/mantenimientos/{id}` | Actualizar solicitud |
| GET | `/api/mantenimientos/alertas/` | Alertas preventivas |

### Comunicados

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/comunicados/` | Listar comunicados |
| POST | `/api/comunicados/` | Crear comunicado |
| GET | `/api/comunicados/{id}/envios` | Tracking de envíos |

### Zonas Comunes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/zonas-comunes/` | Listar zonas |
| POST | `/api/zonas-comunes/` | Crear zona |
| GET | `/api/zonas-comunes/reservas` | Listar reservas |
| POST | `/api/zonas-comunes/reservas` | Crear reserva |

### Accesos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/accesos/` | Listar accesos |
| POST | `/api/accesos/` | Registrar acceso |
| POST | `/api/accesos/{id}/salida` | Registrar salida |

### Paquetes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/paquetes/` | Listar paquetes |
| POST | `/api/paquetes/` | Registrar paquete |
| POST | `/api/paquetes/{id}/entregar` | Entregar paquete |

### Guardias

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/guardias/` | Listar guardias |
| GET | `/api/guardias/turnos` | Listar turnos |
| POST | `/api/guardias/turnos/{id}/eventos` | Registrar evento |

### Chat

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/chat/{edificio_id}` | Obtener mensajes |
| POST | `/api/chat/` | Enviar mensaje |

### Reportes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/reportes/dashboard/{edificio_id}` | KPIs del edificio |
| GET | `/api/reportes/finanzas/` | Reporte financiero |

### Super Admin

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/superadmin/stats` | Estadísticas globales |
| GET | `/api/superadmin/edificios` | Listar edificios |
| POST | `/api/superadmin/edificios` | Crear edificio |
| PUT | `/api/superadmin/edificios/{id}` | Actualizar edificio |
| GET | `/api/superadmin/admins` | Listar administradores |
| POST | `/api/superadmin/admins` | Crear administrador |

### Backoffice

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/backoffice/stats` | Estadísticas |
| GET | `/api/backoffice/usuarios` | Gestión de usuarios |

---

## 🎨 Paleta de Colores

| Color | Hex | Uso |
|-------|-----|-----|
| Azul primario | `#1a5276` | Sidebar, botones principales |
| Azul secundario | `#2e86c1` | Acentos |
| Verde acento | `#1e8449` | Estados positivos |

---

## 🔑 Credenciales de Demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Super Admin | superadmin@torreadmin.co | Super123! |
| Administrador | admin@torreadmin.co | Admin123! |
| Propietario | c.martinez@gmail.com | Prop123! |
| Portero | guardia1@torreadmin.co | Guardia123! |

---

## 📚 Documentación Técnica

Consulta la documentación detallada en la carpeta `docs/`:

| Documento | Descripción |
|-----------|-------------|
| [ARQUITECTURA.md](docs/ARQUITECTURA.md) | Arquitectura completa del sistema, stack tecnológico, estructura de archivos, flujo de datos, base de datos, endpoints de API, variables de entorno e instrucciones de desarrollo |
| [ROLES.md](docs/ROLES.md) | Roles y permisos del sistema, matriz de acceso a módulos, permisos detallados por rol y navegación |

---

## ⚙️ Variables de Entorno

### Frontend

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL base de la API | `http://localhost:8000` |

### Backend

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión a PostgreSQL (Supabase) | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | Clave secreta para JWT | Valor por defecto para desarrollo |

---

## 🔒 Consideraciones de Seguridad

- Contraseñas almacenadas con hash bcrypt
- Tokens JWT expiran después de 24 horas
- Rutas del dashboard protegidas por middleware
- Endpoints validan token y rol del usuario
- CORS configurado para desarrollo (abierto)

---

## 📄 Licencia

MIT © 2026 TorreAdmin