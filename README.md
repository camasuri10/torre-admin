# TorreAdmin 🏢

**Plataforma SaaS para la gestión de propiedad horizontal en Latinoamérica.**

Stack: **Next.js 14** (frontend) + **FastAPI / Python** (API) + **Supabase** (PostgreSQL).

---

## 🚀 Inicio rápido local

### Requisitos
- Node.js 18.17+
- Python 3.12+
- Una cuenta en [Supabase](https://supabase.com) (gratis)

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/tu-usuario/torreadmin.git
cd torreadmin

# Frontend
npm install

# API Python
cd api
pip install -r requirements.txt
cd ..
```

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con tu string de conexión de Supabase:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Iniciar la API Python

```bash
cd api
uvicorn index:app --reload --port 8000
```

La API inicializa el schema de la base de datos automáticamente al arrancar.
Documentación interactiva disponible en: http://localhost:8000/docs

### 4. Iniciar el frontend

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## ☁️ Despliegue en Vercel + Supabase

### Paso 1: Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**
2. Anota el **Connection string** (Settings → Database → Connection string → URI)
3. Formato: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

### Paso 2: Configurar secreto en Vercel

```bash
# Instala la CLI de Vercel
npm install -g vercel
vercel login

# Agrega el secreto de la base de datos
vercel env add DATABASE_URL production
# Pega el connection string de Supabase cuando lo pida

# Opcional: URL de Supabase para Storage
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_KEY production
```

O desde el dashboard de Vercel:
1. Ve a tu proyecto → **Settings** → **Environment Variables**
2. Agrega `DATABASE_URL` con el valor del connection string de Supabase
3. Marca el entorno: **Production** (y Preview si quieres)

### Paso 3: Desplegar

```bash
# Primera vez
vercel

# Producción
vercel --prod
```

O conecta tu repositorio de GitHub en [vercel.com](https://vercel.com) → **Add New Project**.

> **Nota:** El schema de la base de datos se crea automáticamente en el primer request a la API (`/api/health`). No necesitas correr migraciones manualmente.

---

## 📁 Estructura del proyecto

```
TorreAdmin/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page
│   └── dashboard/
│       ├── layout.tsx            # Sidebar + topbar
│       ├── page.tsx              # Dashboard principal
│       ├── residentes/           # Gestión de propietarios/inquilinos
│       ├── finanzas/             # Cuotas y pagos
│       ├── mantenimiento/        # Solicitudes + alertas + archivos
│       ├── comunicados/          # Anuncios
│       ├── zonas-comunes/        # Reservas con configuración de tiempo
│       ├── accesos/              # Control de visitantes
│       ├── paquetes/             # Recepción y tracking de paquetes
│       ├── chat/                 # Chat de seguridad en tiempo real
│       ├── guardias/             # Turnos y novedades de guardias
│       └── reportes/             # Reportería completa
├── api/                          # FastAPI (Python)
│   ├── index.py                  # Entry point (Vercel Serverless)
│   ├── db.py                     # Conexión + schema SQL + seed
│   ├── requirements.txt
│   └── routers/
│       ├── edificios.py
│       ├── usuarios.py
│       ├── cuotas.py
│       ├── mantenimientos.py     # Incluye upload de fotos/facturas
│       ├── comunicados.py
│       ├── zonas_comunes.py      # Incluye config de tiempo de reservas
│       ├── accesos.py
│       ├── paquetes.py           # Con notificaciones automáticas
│       ├── guardias.py           # Turnos + cuadro + eventos
│       ├── chat.py               # Chat de seguridad
│       └── reportes.py           # Reportería por módulo
└── lib/
    ├── api.ts                    # Cliente API centralizado
    └── mock-data.ts              # Datos de fallback (sin API)
```

---

## 🗄️ Base de datos (Supabase / PostgreSQL)

El schema se crea automáticamente. Tablas principales:

| Tabla | Descripción |
|---|---|
| `edificios` | Conjuntos residenciales |
| `unidades` | Apartamentos/unidades |
| `usuarios` | Administradores, propietarios, inquilinos, porteros |
| `ocupaciones` | Quién vive en qué unidad |
| `cuotas` | Cuotas de administración y pagos |
| `mantenimientos` | Solicitudes correctivas |
| `mantenimiento_archivos` | Fotos y facturas adjuntas |
| `mantenimiento_alertas` | Alertas preventivas programadas |
| `comunicados` | Anuncios y convocatorias |
| `chat_mensajes` | Chat de seguridad |
| `zonas_comunes` | Áreas comunes con config de reservas |
| `reservas` | Reservas de zonas comunes |
| `accesos` | Registro de visitantes |
| `paquetes` | Control de paquetería |
| `paquete_notificaciones` | Notificaciones de paquetes |
| `guardias` | Personal de seguridad |
| `turnos` | Programación de turnos |
| `guardia_eventos` | Novedades durante el turno |

---

## 📋 Módulos implementados

| Módulo | Estado | Descripción |
|---|---|---|
| Dashboard | ✅ | KPIs en tiempo real con fallback a mock data |
| Residentes | ✅ | Propietarios e inquilinos |
| Finanzas | ✅ | Cuotas, pagos, morosidad |
| Mantenimiento | ✅ | Solicitudes + alertas + fotos/facturas |
| Comunicados | ✅ | Anuncios por edificio o global |
| Zonas Comunes | ✅ | Reservas con configuración de tiempo |
| Control de Accesos | ✅ | Registro de visitantes |
| Paquetería | ✅ | Recepción, notificación y entrega |
| Chat Seguridad | ✅ | Chat en tiempo real con alertas |
| Guardias / Turnos | ✅ | Cuadro de turnos + novedades |
| Reportes | ✅ | Reportería completa por módulo |

---

## 🎨 Paleta de colores

| Color | Hex | Uso |
|---|---|---|
| Azul primario | `#1a5276` | Sidebar, botones principales |
| Azul secundario | `#2e86c1` | Acentos |
| Verde acento | `#1e8449` | Estados positivos |

---

## 📄 Licencia

MIT © 2026 TorreAdmin
