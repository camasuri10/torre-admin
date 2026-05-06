# TorreAdmin - Roles y Permisos

## 1. Roles del Sistema

El sistema TorreAdmin define 7 roles de usuario, cada uno con acceso diferenciado a las funcionalidades de la plataforma.

### 1.1 Listado de Roles

| Rol | Nombre Display | Descripción |
|-----|----------------|-------------|
| `superadmin` | Super Administrador | Acceso total a todos los edificios y funcionalidades del sistema |
| `administrador` | Administrador | Gestión completa de uno o más edificios asignados |
| `propietario` | Propietario | Dueño de una o más unidades en el edificio |
| `inquilino` | Inquilino | Residente que alquila una unidad |
| `portero` | Portero / Seguridad | Personal de seguridad y control de accesos |
| `servicios` | Servicios Generales | Personal de mantenimiento y servicios |
| `backoffice` | Backoffice | Gestión global de usuarios y analytics |

---

## 2. Matriz de Permisos

### 2.1 Acceso a Módulos

| Módulo | superadmin | administrador | propietario | inquilino | portero | servicios | backoffice |
|--------|------------|---------------|-------------|-----------|---------|-----------|------------|
| Dashboard (Resumen) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Backoffice | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Super Admin | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Residentes | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Finanzas | ✅ | ✅ | 🔒 | 🔒 | ❌ | ❌ | ✅ |
| Mantenimiento | ✅ | ✅ | 🔒 | 🔒 | ❌ | ✅ | ✅ |
| Proveedores | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Comunicados | ✅ | ✅ | 📢 | 📢 | ❌ | ❌ | ✅ |
| Zonas Comunes | ✅ | ✅ | 🔒 | 🔒 | ❌ | ❌ | ✅ |
| Control de Accesos | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Paquetería | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Chat Seguridad | ✅ | ✅ | 📢 | ❌ | ✅ | ❌ | ✅ |
| Guardias / Turnos | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Reportes | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Mi Perfil | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Leyenda:**
- ✅ Acceso completo
- 🔒 Acceso limitado (solo melihat dati propio)
- 📢 Recibir información (solo lectura/recepción)
- ❌ Sin acceso

### 2.2 Permisos Detallados por Rol

#### Super Administrador (superadmin)

**Acceso:**
- Todos los conjuntos, edificios y unidades del sistema
- Panel de Super Admin completo
- Gestión de administradores
- Configuración de módulos por edificio

**Permisos:**
- Crear, editar, eliminar conjuntos residenciales
- Crear, editar, eliminar edificios
- Crear, editar, eliminar torres y unidades
- Asignar administradores a edificios/conjuntos
- Habilitar/deshabilitar módulos por edificio
- Ver estadísticas globales de todos los edificios
- Gestionar usuarios administradores

---

#### Administrador (administrador)

**Acceso:**
- Edificios asignados por el super admin
- Dashboard del edificio
- Todas las funcionalidades de gestión del edificio

**Permisos:**
- Gestionar residentes (propietarios e inquilinos)
- Generar y gestionar cuotas de administración
- Registrar pagos y seguimiento de morosidad
- Crear y gestionar solicitudes de mantenimiento
- Publicar comunicados a los Residents
- Gestionar zonas comunes y reservas
- Control de accesos de visitantes
- Gestión de paquetería
- Chat de seguridad
- Gestionar turnos de guardias
- Ver reportes y analytics del edificio
- Gestionar proveedores de servicios

---

#### Propietario (propietario)

**Acceso:**
- Unidades de su propiedad
- Dashboard personal

**Permisos:**
- Ver sus cuotas y historial de pagos
- Realizar pagos de cuotas
- Solicitar mantenimiento para su unidad
- Reservar zonas comunes
- Recibir comunicados del administrador
- Participar en chat de seguridad
- Ver información de su unidad

---

#### Inquilino (inquilino)

**Acceso:**
- Unidad que alquila
- Dashboard personal

**Permisos:**
- Ver sus cuotas (si aplica)
- Solicitar mantenimiento para su unidad
- Reservar zonas comunes
- Recibir comunicados del administrador

**Nota:** El inquilino tiene permisos similares al propietario, pero puede tener restricciones adicionales definidas por el administrador.

---

#### Portero / Seguridad (portero)

**Acceso:**
- Edificio asignado
- Dashboard de seguridad

**Permisos:**
- Registrar ingresos y salidas de visitantes
- Gestionar paquetería recibida
- Registrar eventos/incidentes durante su turno
- Participar en chat de seguridad
- Ver el cuadro de turnos
- Actualizar estado de turnos

---

#### Servicios Generales (servicios)

**Acceso:**
- Edificio asignado

**Permisos:**
- Ver solicitudes de mantenimiento asignadas
- Actualizar estado de solicitudes de mantenimiento
- Registrar eventos relacionados con servicios

---

#### Backoffice (backoffice)

**Acceso:**
- Todos los edificios del sistema
- Panel de Backoffice

**Permisos:**
- Ver dashboard global con estadísticas de todos los edificios
- Gestionar usuarios (crear, editar, desactivar)
- Ver información de todos los edificios
- Acceso a herramientas de análisis global

---

## 3. Navegación por Rol

### 3.1 Sidebar Principal

El menú lateral se filtra automáticamente según el rol del usuario:

```typescript
// Ejemplo de configuración de navegación
const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Resumen", roles: ["administrador", "propietario", "inquilino", "portero"] },
    ],
  },
  {
    label: "Backoffice",
    items: [
      { href: "/dashboard/backoffice", label: "Dashboard Global", roles: ["backoffice"] },
      { href: "/dashboard/backoffice/usuarios", label: "Gestión de Usuarios", roles: ["backoffice"] },
    ],
  },
  {
    label: "Super Admin",
    items: [
      { href: "/dashboard/superadmin", label: "Panel SA", roles: ["superadmin"] },
      { href: "/dashboard/superadmin/conjuntos", label: "Conjuntos", roles: ["superadmin"] },
      { href: "/dashboard/superadmin/edificios", label: "Edificios", roles: ["superadmin"] },
      { href: "/dashboard/superadmin/admins", label: "Usuarios", roles: ["superadmin"] },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/dashboard/residentes", label: "Residentes", roles: ["administrador"] },
      { href: "/dashboard/finanzas", label: "Finanzas", roles: ["administrador", "propietario", "inquilino"] },
      { href: "/dashboard/mantenimiento", label: "Mantenimiento", roles: ["administrador", "propietario", "inquilino", "servicios"] },
      { href: "/dashboard/proveedores", label: "Proveedores", roles: ["administrador", "superadmin"] },
      { href: "/dashboard/comunicados", label: "Comunicados", roles: ["administrador", "propietario", "inquilino"] },
      { href: "/dashboard/zonas-comunes", label: "Zonas Comunes", roles: ["administrador", "propietario", "inquilino"] },
    ],
  },
  {
    label: "Seguridad",
    items: [
      { href: "/dashboard/accesos", label: "Control de Accesos", roles: ["administrador", "portero"] },
      { href: "/dashboard/paquetes", label: "Paquetería", roles: ["administrador", "portero"] },
      { href: "/dashboard/chat", label: "Chat Seguridad", roles: ["administrador", "propietario", "portero"] },
      { href: "/dashboard/guardias", label: "Guardias / Turnos", roles: ["administrador", "portero"] },
    ],
  },
  {
    label: "Análisis",
    items: [
      { href: "/dashboard/reportes", label: "Reportes", roles: ["administrador"] },
    ],
  },
];
```

---

## 4. Módulos del Sistema

### 4.1 Definición de Módulos

Los módulos permiten habilitar o deshabilitar funcionalidades específicas por edificio:

| Módulo | Clave | Descripción |
|--------|-------|-------------|
| Finanzas | `finanzas` | Gestión de cuotas, pagos y morosidad |
| Mantenimiento | `mantenimiento` | Solicitudes y seguimiento de mantenimiento |
| Comunicados | `comunicados` | Envío de announcements a Residents |
| Zonas Comunes | `zonas_comunes` | Reservas de áreas comunitarias |
| Accesos | `accesos` | Control de ingresos de visitantes |
| Paquetes | `paquetes` | Gestión de recepción de paquetes |
| Chat | `chat` | Sistema de chat de seguridad |
| Guardias | `guardias` | Programación de turnos de vigilancia |
| Reportes | `reportes` | Dashboard de analytics y reportes |

### 4.2 Control de Módulos

- **Super Admin**: Puede configurar qué módulos están activos para cada edificio
- **Administrador**: Ve los módulos habilitados para su edificio
- **Residents**: Solo ven los módulos relevantes para su unidad

---

## 5. Asignaciones Multi-Edificio

### 5.1 Administradores con Múltiples Edificios

Un administrador puede tener acceso a múltiples edificios. El sistema maneja esto mediante:

1. **Selección de Edificio**: Al iniciar sesión, si el usuario tiene varios edificios, debe seleccionar uno
2. **Contexto de Edificio**: El token JWT incluye `edificio_id` para indicar el edificio activo
3. **Cambio de Edificio**: El usuario puede cambiar entre edificios desde el sidebar

### 5.2 Flujo de Selección de Edificio

```
1. Login exitoso
2. API retorna lista de edificios disponibles
3. Si > 1 edificio → Redirect a /login/seleccionar-edificio
4. Usuario selecciona edificio
5. API emite nuevo token con edificio_id
6. Redirect a /dashboard
```

---

## 6. Permisos a Nivel de Datos

### 6.1 Filtrado por Edificio

Todos los queries a la base de datos filtran automáticamente por `edificio_id` del usuario autenticado:

```python
# Ejemplo de filtro en endpoint
@router.get("/cuotas/")
def list_cuotas(current_user: User = Depends(get_current_user)):
    query = "SELECT * FROM cuotas WHERE edificio_id = %s"
    # El edificio_id se toma del token JWT
```

### 6.2 Super Admin y Backoffice

Los usuarios con rol `superadmin` o `backoffice` pueden ver datos de todos los edificios, con la opción de filtrar por edificio específico.

---

## 7. Acceso a Funcionalidades Específicas

### 7.1 Residentes (propietario/inquilino)

| Funcionalidad | Descripción |
|---------------|-------------|
| Ver mis cuotas | Listado de cuotas asociadas a mis unidades |
| Solicitar mantenimiento | Crear nueva solicitud de mantenimiento |
| Mis reservas | Ver reservas de zonas comunes realizadas |
| Comunicados | Ver announcements publicados |
| Chat | Participar en chat de seguridad |

### 7.2 Administrador

| Funcionalidad | Descripción |
|---------------|-------------|
| Gestión de Residents | CRUD de usuarios y ocupaciones |
| Finanzas | Generar cuotas, registrar pagos, ver morosos |
| Mantenimiento | Crear, asignar y cerrar solicitudes |
| Comunicados | Crear y enviar announcements |
| Zonas Comunes | CRUD de zonas y reservas |
| Accesos | Ver registro de visitantes |
| Paquetes | Registrar y entregar paquetes |
| Guardias | Programar turnos y registrar eventos |
| Reportes | Ver analytics del edificio |

### 7.3 Portero

| Funcionalidad | Descripción |
|---------------|-------------|
| Registro de accesos | Registrar entrada/salida de visitantes |
| Paquetes | Registrar paquetes recibidos |
| Turnos | Ver y trabajar en turnos asignados |
| Eventos | Registrar incidentes durante el turno |
| Chat | Participar en chat de seguridad |

---

*Documento de roles y permisos para TorreAdmin v0.2.0*