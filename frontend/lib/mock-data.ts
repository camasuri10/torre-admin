// ─── Edificios ────────────────────────────────────────────────────────────────
export const edificios = [
  { id: 1, nombre: "Torres del Norte", direccion: "Cra 15 #85-32, Bogotá", unidades: 20, pisos: 8 },
  { id: 2, nombre: "Conjunto Reserva del Parque", direccion: "Av. El Dorado #68-11, Bogotá", unidades: 16, pisos: 6 },
  { id: 3, nombre: "Edificio Palma Real", direccion: "Calle 100 #14-55, Bogotá", unidades: 12, pisos: 5 },
];

// ─── Residentes ───────────────────────────────────────────────────────────────
export type Residente = {
  id: number;
  nombre: string;
  cedula: string;
  tipo: "Propietario" | "Inquilino";
  apto: string;
  edificio: string;
  telefono: string;
  email: string;
  fechaIngreso: string;
  alDia: boolean;
};

export const residentes: Residente[] = [
  { id: 1, nombre: "Carlos Andrés Martínez", cedula: "79.456.123", tipo: "Propietario", apto: "Apto 101", edificio: "Torres del Norte", telefono: "310 456 7890", email: "c.martinez@gmail.com", fechaIngreso: "2019-03-15", alDia: true },
  { id: 2, nombre: "María Fernanda Gómez", cedula: "52.789.456", tipo: "Propietario", apto: "Apto 201", edificio: "Torres del Norte", telefono: "315 234 5678", email: "mfgomez@hotmail.com", fechaIngreso: "2018-07-01", alDia: false },
  { id: 3, nombre: "Jhon Sebastián Rojas", cedula: "1.020.345.678", tipo: "Inquilino", apto: "Apto 301", edificio: "Torres del Norte", telefono: "300 987 6543", email: "jsrojas@gmail.com", fechaIngreso: "2022-01-10", alDia: true },
  { id: 4, nombre: "Luisa Valentina Herrera", cedula: "43.567.890", tipo: "Propietario", apto: "Apto 401", edificio: "Torres del Norte", telefono: "318 765 4321", email: "lv.herrera@outlook.com", fechaIngreso: "2020-05-20", alDia: true },
  { id: 5, nombre: "Andrés Felipe Vargas", cedula: "80.234.567", tipo: "Inquilino", apto: "Apto 501", edificio: "Torres del Norte", telefono: "312 345 6789", email: "afvargas@gmail.com", fechaIngreso: "2023-02-01", alDia: false },
  { id: 6, nombre: "Sandra Milena Ospina", cedula: "41.890.234", tipo: "Propietario", apto: "Apto 102", edificio: "Conjunto Reserva del Parque", telefono: "317 890 1234", email: "smospina@gmail.com", fechaIngreso: "2017-11-30", alDia: true },
  { id: 7, nombre: "Diego Alejandro Ríos", cedula: "1.098.765.432", tipo: "Inquilino", apto: "Apto 202", edificio: "Conjunto Reserva del Parque", telefono: "311 234 5678", email: "darios@yahoo.com", fechaIngreso: "2021-08-15", alDia: true },
  { id: 8, nombre: "Paola Andrea Suárez", cedula: "55.678.901", tipo: "Propietario", apto: "Apto 302", edificio: "Conjunto Reserva del Parque", telefono: "316 789 0123", email: "pasuarez@gmail.com", fechaIngreso: "2019-09-05", alDia: false },
  { id: 9, nombre: "Mauricio Enrique Peña", cedula: "79.012.345", tipo: "Propietario", apto: "Apto 101", edificio: "Edificio Palma Real", telefono: "313 456 7890", email: "mepeña@gmail.com", fechaIngreso: "2020-12-01", alDia: true },
  { id: 10, nombre: "Natalia Cristina López", cedula: "52.345.678", tipo: "Inquilino", apto: "Apto 201", edificio: "Edificio Palma Real", telefono: "319 012 3456", email: "nclopez@hotmail.com", fechaIngreso: "2022-06-20", alDia: false },
  { id: 11, nombre: "Camilo Ernesto Díaz", cedula: "1.030.456.789", tipo: "Propietario", apto: "Apto 301", edificio: "Edificio Palma Real", telefono: "314 567 8901", email: "cediaz@gmail.com", fechaIngreso: "2021-03-10", alDia: true },
  { id: 12, nombre: "Adriana Patricia Moreno", cedula: "46.789.012", tipo: "Inquilino", apto: "Apto 401", edificio: "Torres del Norte", telefono: "320 678 9012", email: "apmoreno@gmail.com", fechaIngreso: "2023-07-01", alDia: false },
];

// ─── Cuotas / Finanzas ────────────────────────────────────────────────────────
export type Cuota = {
  id: number;
  residente: string;
  apto: string;
  edificio: string;
  mes: string;
  monto: number;
  estado: "Pagado" | "Pendiente" | "Vencido";
  fechaVencimiento: string;
  fechaPago?: string;
};

export const cuotas: Cuota[] = [
  { id: 1, residente: "Carlos Andrés Martínez", apto: "Apto 101", edificio: "Torres del Norte", mes: "Julio 2025", monto: 280000, estado: "Pagado", fechaVencimiento: "2025-07-05", fechaPago: "2025-07-03" },
  { id: 2, residente: "María Fernanda Gómez", apto: "Apto 201", edificio: "Torres del Norte", mes: "Julio 2025", monto: 280000, estado: "Vencido", fechaVencimiento: "2025-07-05" },
  { id: 3, residente: "Jhon Sebastián Rojas", apto: "Apto 301", edificio: "Torres del Norte", mes: "Julio 2025", monto: 280000, estado: "Pagado", fechaVencimiento: "2025-07-05", fechaPago: "2025-07-04" },
  { id: 4, residente: "Luisa Valentina Herrera", apto: "Apto 401", edificio: "Torres del Norte", mes: "Julio 2025", monto: 280000, estado: "Pagado", fechaVencimiento: "2025-07-05", fechaPago: "2025-07-01" },
  { id: 5, residente: "Andrés Felipe Vargas", apto: "Apto 501", edificio: "Torres del Norte", mes: "Julio 2025", monto: 280000, estado: "Vencido", fechaVencimiento: "2025-07-05" },
  { id: 6, residente: "Sandra Milena Ospina", apto: "Apto 102", edificio: "Conjunto Reserva del Parque", mes: "Julio 2025", monto: 320000, estado: "Pagado", fechaVencimiento: "2025-07-05", fechaPago: "2025-07-02" },
  { id: 7, residente: "Diego Alejandro Ríos", apto: "Apto 202", edificio: "Conjunto Reserva del Parque", mes: "Julio 2025", monto: 320000, estado: "Pendiente", fechaVencimiento: "2025-07-10" },
  { id: 8, residente: "Paola Andrea Suárez", apto: "Apto 302", edificio: "Conjunto Reserva del Parque", mes: "Julio 2025", monto: 320000, estado: "Vencido", fechaVencimiento: "2025-07-05" },
  { id: 9, residente: "Mauricio Enrique Peña", apto: "Apto 101", edificio: "Edificio Palma Real", mes: "Julio 2025", monto: 250000, estado: "Pagado", fechaVencimiento: "2025-07-05", fechaPago: "2025-07-05" },
  { id: 10, residente: "Natalia Cristina López", apto: "Apto 201", edificio: "Edificio Palma Real", mes: "Julio 2025", monto: 250000, estado: "Vencido", fechaVencimiento: "2025-07-05" },
  { id: 11, residente: "Camilo Ernesto Díaz", apto: "Apto 301", edificio: "Edificio Palma Real", mes: "Julio 2025", monto: 250000, estado: "Pagado", fechaVencimiento: "2025-07-05", fechaPago: "2025-07-03" },
  { id: 12, residente: "Adriana Patricia Moreno", apto: "Apto 401", edificio: "Torres del Norte", mes: "Julio 2025", monto: 280000, estado: "Vencido", fechaVencimiento: "2025-07-05" },
];

// ─── Mantenimiento ────────────────────────────────────────────────────────────
export type SolicitudMantenimiento = {
  id: number;
  titulo: string;
  descripcion: string;
  solicitante: string;
  apto: string;
  edificio: string;
  categoria: "Plomería" | "Electricidad" | "Estructura" | "Ascensor" | "Zonas Comunes" | "Otro";
  prioridad: "Alta" | "Media" | "Baja";
  estado: "Pendiente" | "En Proceso" | "Resuelto" | "Cancelado";
  fechaSolicitud: string;
  fechaResolucion?: string;
};

export const solicitudesMantenimiento: SolicitudMantenimiento[] = [
  { id: 1, titulo: "Fuga de agua en baño principal", descripcion: "Hay una fuga constante en la tubería del baño principal que está mojando el piso.", solicitante: "Carlos Andrés Martínez", apto: "Apto 101", edificio: "Torres del Norte", categoria: "Plomería", prioridad: "Alta", estado: "En Proceso", fechaSolicitud: "2025-07-08" },
  { id: 2, titulo: "Bombillo quemado en pasillo piso 3", descripcion: "El bombillo del pasillo del tercer piso lleva 3 días apagado.", solicitante: "Jhon Sebastián Rojas", apto: "Apto 301", edificio: "Torres del Norte", categoria: "Electricidad", prioridad: "Baja", estado: "Pendiente", fechaSolicitud: "2025-07-09" },
  { id: 3, titulo: "Ascensor con ruido extraño", descripcion: "El ascensor hace un ruido metálico al subir entre el piso 4 y 5.", solicitante: "Luisa Valentina Herrera", apto: "Apto 401", edificio: "Torres del Norte", categoria: "Ascensor", prioridad: "Alta", estado: "Pendiente", fechaSolicitud: "2025-07-10" },
  { id: 4, titulo: "Grieta en pared del parqueadero", descripcion: "Se observa una grieta horizontal en la pared del parqueadero nivel -1.", solicitante: "Administración", apto: "N/A", edificio: "Torres del Norte", categoria: "Estructura", prioridad: "Alta", estado: "En Proceso", fechaSolicitud: "2025-07-05" },
  { id: 5, titulo: "Piscina con agua turbia", descripcion: "El agua de la piscina está turbia, posiblemente falla en el sistema de filtración.", solicitante: "Sandra Milena Ospina", apto: "Apto 102", edificio: "Conjunto Reserva del Parque", categoria: "Zonas Comunes", prioridad: "Media", estado: "Resuelto", fechaSolicitud: "2025-07-01", fechaResolucion: "2025-07-03" },
  { id: 6, titulo: "Puerta del gimnasio no cierra bien", descripcion: "La cerradura de la puerta del gimnasio está dañada y no cierra correctamente.", solicitante: "Diego Alejandro Ríos", apto: "Apto 202", edificio: "Conjunto Reserva del Parque", categoria: "Zonas Comunes", prioridad: "Media", estado: "Pendiente", fechaSolicitud: "2025-07-09" },
  { id: 7, titulo: "Corto circuito en cocina", descripcion: "Se fue la luz de la cocina y el breaker no sube.", solicitante: "Paola Andrea Suárez", apto: "Apto 302", edificio: "Conjunto Reserva del Parque", categoria: "Electricidad", prioridad: "Alta", estado: "Resuelto", fechaSolicitud: "2025-07-06", fechaResolucion: "2025-07-07" },
  { id: 8, titulo: "Goteras en techo zona BBQ", descripcion: "Cuando llueve, el techo de la zona BBQ presenta goteras en dos puntos.", solicitante: "Mauricio Enrique Peña", apto: "Apto 101", edificio: "Edificio Palma Real", categoria: "Estructura", prioridad: "Media", estado: "Pendiente", fechaSolicitud: "2025-07-08" },
  { id: 9, titulo: "Llave del lavadero goteando", descripcion: "La llave del lavadero del patio gotea continuamente.", solicitante: "Natalia Cristina López", apto: "Apto 201", edificio: "Edificio Palma Real", categoria: "Plomería", prioridad: "Baja", estado: "Pendiente", fechaSolicitud: "2025-07-10" },
  { id: 10, titulo: "Daño en citófono", descripcion: "El citófono del apartamento no recibe llamadas desde la portería.", solicitante: "Camilo Ernesto Díaz", apto: "Apto 301", edificio: "Edificio Palma Real", categoria: "Electricidad", prioridad: "Media", estado: "En Proceso", fechaSolicitud: "2025-07-07" },
  { id: 11, titulo: "Jardín necesita mantenimiento", descripcion: "Las plantas del jardín principal llevan más de un mes sin poda.", solicitante: "Administración", apto: "N/A", edificio: "Torres del Norte", categoria: "Zonas Comunes", prioridad: "Baja", estado: "Pendiente", fechaSolicitud: "2025-07-10" },
  { id: 12, titulo: "Humedad en pared habitación", descripcion: "Hay una mancha de humedad en la pared de la habitación principal que va creciendo.", solicitante: "Adriana Patricia Moreno", apto: "Apto 401", edificio: "Torres del Norte", categoria: "Estructura", prioridad: "Media", estado: "Pendiente", fechaSolicitud: "2025-07-09" },
];

// ─── Comunicados ──────────────────────────────────────────────────────────────
export type Comunicado = {
  id: number;
  titulo: string;
  contenido: string;
  autor: string;
  edificio: string | "Todos";
  fecha: string;
  tipo: "Informativo" | "Urgente" | "Convocatoria" | "Recordatorio";
};

export const comunicados: Comunicado[] = [
  { id: 1, titulo: "Asamblea General Ordinaria 2025", contenido: "Se convoca a todos los propietarios a la Asamblea General Ordinaria que se realizará el día sábado 26 de julio de 2025 a las 9:00 a.m. en el salón comunal. Orden del día: aprobación de presupuesto, elección de consejo de administración y varios.", autor: "Administración", edificio: "Todos", fecha: "2025-07-10", tipo: "Convocatoria" },
  { id: 2, titulo: "Suspensión de agua programada", contenido: "Se informa a todos los residentes que el día miércoles 16 de julio de 2025 entre las 8:00 a.m. y las 2:00 p.m. se suspenderá el servicio de agua potable por trabajos de mantenimiento en la red principal. Se recomienda almacenar agua con anticipación.", autor: "Administración", edificio: "Torres del Norte", fecha: "2025-07-11", tipo: "Urgente" },
  { id: 3, titulo: "Recordatorio pago de cuota de administración", contenido: "Se recuerda a todos los residentes que el pago de la cuota de administración del mes de julio vence el día 10 de julio. Quienes no hayan realizado el pago incurrirán en intereses de mora según el reglamento de propiedad horizontal.", autor: "Administración", edificio: "Todos", fecha: "2025-07-08", tipo: "Recordatorio" },
  { id: 4, titulo: "Nuevas normas de uso del gimnasio", contenido: "A partir del 15 de julio de 2025 el gimnasio tendrá nuevo horario: lunes a viernes de 5:00 a.m. a 10:00 p.m., sábados y domingos de 7:00 a.m. a 8:00 p.m. Es obligatorio el uso de toalla y ropa deportiva adecuada.", autor: "Consejo de Administración", edificio: "Conjunto Reserva del Parque", fecha: "2025-07-07", tipo: "Informativo" },
  { id: 5, titulo: "Fumigación de zonas comunes", contenido: "Se realizará fumigación preventiva en todas las zonas comunes el día viernes 18 de julio de 2025 a partir de las 7:00 a.m. Se solicita a los residentes mantener cerradas las ventanas y puertas durante el proceso.", autor: "Administración", edificio: "Edificio Palma Real", fecha: "2025-07-09", tipo: "Informativo" },
  { id: 6, titulo: "Bienvenida a nuevos residentes", contenido: "La administración da la bienvenida a los nuevos residentes que se han incorporado a nuestra comunidad durante el mes de julio. Les recordamos que pueden acercarse a la oficina de administración para recibir el manual de convivencia y resolver cualquier inquietud.", autor: "Administración", edificio: "Todos", fecha: "2025-07-05", tipo: "Informativo" },
  { id: 7, titulo: "Restricción de parqueadero visitantes", contenido: "Se informa que los parqueaderos de visitantes solo podrán ser utilizados por un máximo de 4 horas continuas. Vehículos que excedan este tiempo serán reportados al consejo de administración.", autor: "Portería", edificio: "Torres del Norte", fecha: "2025-07-03", tipo: "Recordatorio" },
];

// ─── Zonas Comunes ────────────────────────────────────────────────────────────
export type ZonaComun = {
  id: number;
  nombre: string;
  descripcion: string;
  capacidad: number;
  edificio: string;
  disponible: boolean;
  icono: string;
};

export const zonasComunes: ZonaComun[] = [
  { id: 1, nombre: "Gimnasio", descripcion: "Equipado con máquinas cardiovasculares, pesas libres y zona de estiramiento.", capacidad: 15, edificio: "Torres del Norte", disponible: true, icono: "🏋️" },
  { id: 2, nombre: "Piscina", descripcion: "Piscina semiolímpica con zona de niños. Requiere reserva previa.", capacidad: 30, edificio: "Torres del Norte", disponible: true, icono: "🏊" },
  { id: 3, nombre: "Zona BBQ", descripcion: "Área de parrilla con mesas, sillas y zona de lavado. Incluye utensilios básicos.", capacidad: 20, edificio: "Torres del Norte", disponible: false, icono: "🔥" },
  { id: 4, nombre: "Salón de Billar", descripcion: "Dos mesas de billar profesional. Disponible para mayores de 14 años.", capacidad: 8, edificio: "Torres del Norte", disponible: true, icono: "🎱" },
  { id: 5, nombre: "Salón Comunal", descripcion: "Espacio para eventos y reuniones. Capacidad para 60 personas sentadas.", capacidad: 60, edificio: "Conjunto Reserva del Parque", disponible: true, icono: "🏛️" },
  { id: 6, nombre: "Cancha de Tenis", descripcion: "Cancha de tenis en superficie dura. Incluye iluminación nocturna.", capacidad: 4, edificio: "Conjunto Reserva del Parque", disponible: true, icono: "🎾" },
  { id: 7, nombre: "Zona de Juegos Infantiles", descripcion: "Área segura con columpios, tobogán y zona de arena para niños.", capacidad: 20, edificio: "Edificio Palma Real", disponible: true, icono: "🎠" },
];

export type Reserva = {
  id: number;
  zona: string;
  residente: string;
  apto: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: "Confirmada" | "Pendiente" | "Cancelada";
};

export const reservas: Reserva[] = [
  { id: 1, zona: "Zona BBQ", residente: "Carlos Andrés Martínez", apto: "Apto 101", fecha: "2025-07-12", horaInicio: "12:00", horaFin: "16:00", estado: "Confirmada" },
  { id: 2, zona: "Salón Comunal", residente: "Sandra Milena Ospina", apto: "Apto 102", fecha: "2025-07-13", horaInicio: "10:00", horaFin: "14:00", estado: "Confirmada" },
  { id: 3, zona: "Piscina", residente: "Luisa Valentina Herrera", apto: "Apto 401", fecha: "2025-07-12", horaInicio: "09:00", horaFin: "11:00", estado: "Pendiente" },
  { id: 4, zona: "Gimnasio", residente: "Diego Alejandro Ríos", apto: "Apto 202", fecha: "2025-07-11", horaInicio: "06:00", horaFin: "07:30", estado: "Confirmada" },
  { id: 5, zona: "Salón de Billar", residente: "Camilo Ernesto Díaz", apto: "Apto 301", fecha: "2025-07-14", horaInicio: "19:00", horaFin: "21:00", estado: "Pendiente" },
  { id: 6, zona: "Cancha de Tenis", residente: "Mauricio Enrique Peña", apto: "Apto 101", fecha: "2025-07-13", horaInicio: "07:00", horaFin: "09:00", estado: "Cancelada" },
];

// ─── Control de Accesos ───────────────────────────────────────────────────────
export type RegistroAcceso = {
  id: number;
  visitante: string;
  documento: string;
  destino: string;
  residenteAnfitrion: string;
  edificio: string;
  fechaEntrada: string;
  horaEntrada: string;
  horaSalida?: string;
  motivo: "Visita" | "Domicilio" | "Servicio técnico" | "Mudanza" | "Otro";
  autorizado: boolean;
};

export const registrosAcceso: RegistroAcceso[] = [
  { id: 1, visitante: "Pedro Antonio Ramírez", documento: "CC 80.567.234", destino: "Apto 101", residenteAnfitrion: "Carlos Andrés Martínez", edificio: "Torres del Norte", fechaEntrada: "2025-07-11", horaEntrada: "14:30", horaSalida: "16:45", motivo: "Visita", autorizado: true },
  { id: 2, visitante: "Domicilios Rappi", documento: "NIT 900.123.456", destino: "Apto 301", residenteAnfitrion: "Jhon Sebastián Rojas", edificio: "Torres del Norte", fechaEntrada: "2025-07-11", horaEntrada: "19:15", horaSalida: "19:20", motivo: "Domicilio", autorizado: true },
  { id: 3, visitante: "Técnico Claro", documento: "CC 79.345.678", destino: "Apto 201", residenteAnfitrion: "María Fernanda Gómez", edificio: "Torres del Norte", fechaEntrada: "2025-07-11", horaEntrada: "10:00", horaSalida: "11:30", motivo: "Servicio técnico", autorizado: true },
  { id: 4, visitante: "Gloria Inés Vargas", documento: "CC 41.234.567", destino: "Apto 401", residenteAnfitrion: "Luisa Valentina Herrera", edificio: "Torres del Norte", fechaEntrada: "2025-07-11", horaEntrada: "16:00", motivo: "Visita", autorizado: true },
  { id: 5, visitante: "Empresa Mudanzas Rápidas", documento: "NIT 800.456.789", destino: "Apto 502", residenteAnfitrion: "Andrés Felipe Vargas", edificio: "Torres del Norte", fechaEntrada: "2025-07-10", horaEntrada: "08:00", horaSalida: "14:00", motivo: "Mudanza", autorizado: true },
  { id: 6, visitante: "Desconocido sin autorización", documento: "Sin documento", destino: "Apto 302", residenteAnfitrion: "Paola Andrea Suárez", edificio: "Conjunto Reserva del Parque", fechaEntrada: "2025-07-10", horaEntrada: "22:30", motivo: "Otro", autorizado: false },
  { id: 7, visitante: "Fontanero Independiente", documento: "CC 80.789.012", destino: "Apto 101", residenteAnfitrion: "Mauricio Enrique Peña", edificio: "Edificio Palma Real", fechaEntrada: "2025-07-11", horaEntrada: "09:00", horaSalida: "10:30", motivo: "Servicio técnico", autorizado: true },
  { id: 8, visitante: "Familia Rodríguez", documento: "CC 52.890.123", destino: "Apto 201", residenteAnfitrion: "Natalia Cristina López", edificio: "Edificio Palma Real", fechaEntrada: "2025-07-11", horaEntrada: "12:00", horaSalida: "18:00", motivo: "Visita", autorizado: true },
  { id: 9, visitante: "Mensajero Servientrega", documento: "CC 1.045.678.901", destino: "Apto 301", residenteAnfitrion: "Camilo Ernesto Díaz", edificio: "Edificio Palma Real", fechaEntrada: "2025-07-11", horaEntrada: "11:45", horaSalida: "11:50", motivo: "Domicilio", autorizado: true },
  { id: 10, visitante: "Electricista Certificado", documento: "CC 79.123.456", destino: "Apto 302", residenteAnfitrion: "Paola Andrea Suárez", edificio: "Conjunto Reserva del Parque", fechaEntrada: "2025-07-09", horaEntrada: "14:00", horaSalida: "15:30", motivo: "Servicio técnico", autorizado: true },
];

// ─── Stats para Dashboard ─────────────────────────────────────────────────────
export const dashboardStats = {
  totalEdificios: 3,
  totalUnidades: 48,
  morosos: 7,
  solicitudesPendientes: 12,
  recaudoMes: 8640000,
  metaRecaudo: 13440000,
};
