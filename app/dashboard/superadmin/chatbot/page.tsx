"use client";

export default function ChatbotInfoPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Asistente IA</h2>
        <p className="text-sm text-gray-500 mt-0.5">Estado del asistente en tu organización</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          <div>
            <p className="font-semibold text-blue-900">Configuración centralizada</p>
            <p className="text-sm text-blue-700">
              El Asistente IA es gestionado por el equipo de Backoffice de la plataforma.
            </p>
          </div>
        </div>
        <p className="text-sm text-blue-700">
          Esta arquitectura permite una sola clave de API compartida entre todos los tenants,
          optimizando costos y facilitando el control de uso de tokens desde un punto central.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">¿Cómo activar el asistente en un conjunto?</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
          <li>Ve a <strong>Conjuntos</strong> y selecciona el conjunto.</li>
          <li>En la sección <strong>Módulos</strong>, activa el módulo <strong>Asistente IA</strong>.</li>
          <li>Los administradores y propietarios verán la burbuja 🤖 en su dashboard.</li>
        </ol>
        <p className="text-xs text-gray-400 mt-2">
          Si el asistente no responde, contacta al equipo de Backoffice para verificar que la API key esté configurada.
        </p>
      </div>
    </div>
  );
}
