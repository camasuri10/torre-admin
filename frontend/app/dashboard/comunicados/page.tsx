import { comunicados } from "@/lib/mock-data";

const tipoBadge: Record<string, string> = {
  Informativo: "bg-blue-100 text-blue-700",
  Urgente: "bg-red-100 text-red-700",
  Convocatoria: "bg-purple-100 text-purple-700",
  Recordatorio: "bg-amber-100 text-amber-700",
};

const tipoIcono: Record<string, string> = {
  Informativo: "ℹ️",
  Urgente: "🚨",
  Convocatoria: "📋",
  Recordatorio: "🔔",
};

export default function ComunicadosPage() {
  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{comunicados.length} comunicados publicados</p>
        </div>
        <button className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary-dark transition-colors">
          + Nuevo comunicado
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {["Todos", "Informativo", "Urgente", "Convocatoria", "Recordatorio"].map((tipo) => (
          <button
            key={tipo}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              tipo === "Todos"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
            }`}
          >
            {tipo}
          </button>
        ))}
      </div>

      {/* Comunicados list */}
      <div className="space-y-4">
        {comunicados.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="text-3xl flex-shrink-0">{tipoIcono[c.tipo]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <h3 className="font-semibold text-gray-900 text-base">{c.titulo}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoBadge[c.tipo]}`}>
                      {c.tipo}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{c.contenido}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>📅 {c.fecha}</span>
                    <span>✍️ {c.autor}</span>
                    <span>🏢 {c.edificio}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="text-xs text-primary hover:underline font-medium">Editar</button>
                <span className="text-gray-200">|</span>
                <button className="text-xs text-red-500 hover:underline">Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
