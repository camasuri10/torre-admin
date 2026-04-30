import Link from "next/link";

const features = [
  {
    icon: "👥",
    title: "Gestión de Residentes",
    description:
      "Administra propietarios e inquilinos, sus unidades y datos de contacto en un solo lugar.",
  },
  {
    icon: "💰",
    title: "Finanzas y Cuotas",
    description:
      "Controla el recaudo de cuotas de administración, genera reportes de morosidad y lleva la contabilidad del conjunto.",
  },
  {
    icon: "🔧",
    title: "Mantenimiento",
    description:
      "Gestiona solicitudes correctivas y preventivas con seguimiento en tiempo real del estado de cada tarea.",
  },
  {
    icon: "📢",
    title: "Comunicados",
    description:
      "Envía anuncios, convocatorias y recordatorios a todos los residentes de forma rápida y organizada.",
  },
  {
    icon: "🏊",
    title: "Zonas Comunes",
    description:
      "Permite a los residentes reservar el gimnasio, piscina, zona BBQ y demás áreas comunes sin conflictos.",
  },
  {
    icon: "🔐",
    title: "Control de Accesos",
    description:
      "Registra el ingreso y salida de visitantes, domicilios y personal de servicio con trazabilidad completa.",
  },
];

const plans = [
  {
    name: "Básico",
    price: "$ 89.000",
    period: "/ mes",
    description: "Ideal para edificios pequeños",
    features: [
      "Hasta 20 unidades",
      "1 edificio",
      "Módulos de residentes y finanzas",
      "Soporte por email",
    ],
    highlighted: false,
  },
  {
    name: "Profesional",
    price: "$ 189.000",
    period: "/ mes",
    description: "Para conjuntos medianos",
    features: [
      "Hasta 80 unidades",
      "Hasta 3 edificios",
      "Todos los módulos",
      "Soporte prioritario",
      "Reportes avanzados",
    ],
    highlighted: true,
  },
  {
    name: "Empresarial",
    price: "A medida",
    period: "",
    description: "Para grandes conjuntos",
    features: [
      "Unidades ilimitadas",
      "Edificios ilimitados",
      "API personalizada",
      "Gerente de cuenta dedicado",
      "SLA garantizado",
    ],
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="text-xl font-bold text-primary">TorreAdmin</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#caracteristicas" className="text-gray-600 hover:text-primary transition-colors text-sm font-medium">
                Características
              </a>
              <a href="#precios" className="text-gray-600 hover:text-primary transition-colors text-sm font-medium">
                Precios
              </a>
              <a href="#contacto" className="text-gray-600 hover:text-primary transition-colors text-sm font-medium">
                Contacto
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-primary font-medium text-sm hover:underline"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/dashboard"
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors"
              >
                Solicitar Demo
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-primary via-primary-light to-secondary text-white py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <span className="inline-block bg-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            🏢 La plataforma #1 para propiedad horizontal en Colombia
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Administra tu conjunto
            <br />
            <span className="text-yellow-300">sin complicaciones</span>
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
            TorreAdmin centraliza la gestión de residentes, finanzas, mantenimiento y
            comunicaciones de tu edificio o conjunto residencial en una sola plataforma.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg"
            >
              Ver Demo en Vivo →
            </Link>
            <a
              href="#caracteristicas"
              className="border-2 border-white/50 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-colors"
            >
              Conocer más
            </a>
          </div>
          <p className="mt-6 text-blue-200 text-sm">
            Sin tarjeta de crédito · Prueba gratuita 30 días · Cancela cuando quieras
          </p>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="bg-primary-dark text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "+500", label: "Conjuntos activos" },
              { value: "+25.000", label: "Unidades gestionadas" },
              { value: "98%", label: "Satisfacción de clientes" },
              { value: "5 países", label: "Presencia en Latam" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-extrabold text-yellow-300">{stat.value}</div>
                <div className="text-blue-200 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="caracteristicas" className="py-24 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Módulos diseñados específicamente para las necesidades de la propiedad
              horizontal en Latinoamérica.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Empieza en minutos
            </h2>
            <p className="text-gray-500 text-lg">Tres pasos simples para transformar tu gestión</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Crea tu cuenta", desc: "Registra tu conjunto o edificio con los datos básicos. Sin instalaciones ni configuraciones complejas." },
              { step: "02", title: "Importa tus residentes", desc: "Carga la información de propietarios e inquilinos desde Excel o ingrésalos manualmente." },
              { step: "03", title: "Gestiona todo", desc: "Accede a todos los módulos desde cualquier dispositivo. Tu equipo y residentes también pueden ingresar." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-primary font-extrabold text-xl">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="precios" className="py-24 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Planes y precios
            </h2>
            <p className="text-gray-500 text-lg">Precios en pesos colombianos. Sin costos ocultos.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 border-2 ${
                  plan.highlighted
                    ? "bg-primary border-primary text-white shadow-2xl scale-105"
                    : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                {plan.highlighted && (
                  <span className="inline-block bg-yellow-400 text-primary text-xs font-bold px-3 py-1 rounded-full mb-4">
                    MÁS POPULAR
                  </span>
                )}
                <h3 className={`text-xl font-bold mb-1 ${plan.highlighted ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.highlighted ? "text-blue-200" : "text-gray-500"}`}>
                  {plan.description}
                </p>
                <div className="mb-6">
                  <span className={`text-4xl font-extrabold ${plan.highlighted ? "text-white" : "text-primary"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlighted ? "text-blue-200" : "text-gray-500"}`}>
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <span className={plan.highlighted ? "text-yellow-300" : "text-accent"}>✓</span>
                      <span className={plan.highlighted ? "text-blue-100" : "text-gray-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`block text-center py-3 rounded-xl font-semibold transition-colors ${
                    plan.highlighted
                      ? "bg-white text-primary hover:bg-blue-50"
                      : "bg-primary text-white hover:bg-primary-dark"
                  }`}
                >
                  {plan.name === "Empresarial" ? "Contáctanos" : "Comenzar ahora"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 bg-primary text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            ¿Listo para modernizar tu administración?
          </h2>
          <p className="text-blue-200 text-lg mb-10">
            Únete a más de 500 conjuntos que ya confían en TorreAdmin para gestionar su
            propiedad horizontal de forma eficiente.
          </p>
          <Link
            href="/dashboard"
            className="bg-yellow-400 text-primary px-10 py-4 rounded-xl font-bold text-lg hover:bg-yellow-300 transition-colors shadow-lg inline-block"
          >
            Solicitar Demo Gratuita
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contacto" className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
                <span className="text-white font-bold text-lg">TorreAdmin</span>
              </div>
              <p className="text-sm leading-relaxed">
                La plataforma líder para la gestión de propiedad horizontal en Latinoamérica.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#caracteristicas" className="hover:text-white transition-colors">Características</a></li>
                <li><a href="#precios" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integraciones</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Sobre nosotros</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Trabaja con nosotros</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contacto</h4>
              <ul className="space-y-2 text-sm">
                <li>📧 hola@torreadmin.co</li>
                <li>📞 +57 (1) 234 5678</li>
                <li>📍 Bogotá, Colombia</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">© 2025 TorreAdmin. Todos los derechos reservados.</p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Términos de uso</a>
              <a href="#" className="hover:text-white transition-colors">Política de privacidad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
