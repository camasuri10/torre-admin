import { residentes } from "@/lib/mock-data";

export default function ResidentesPage() {
  const propietarios = residentes.filter((r) => r.tipo === "Propietario").length;
  const inquilinos = residentes.filter((r) => r.tipo === "Inquilino").length;
  const alDia = residentes.filter((r) => r.alDia).length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total residentes", value: residentes.length, color: "text-primary", bg: "bg-blue-50" },
          { label: "Propietarios", value: propietarios, color: "text-indigo-700", bg: "bg-indigo-50" },
          { label: "Inquilinos", value: inquilinos, color: "text-purple-700", bg: "bg-purple-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Listado de residentes</h2>
          <button className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary-dark transition-colors">
            + Nuevo residente
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cédula</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Edificio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Teléfono</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {residentes.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-primary text-xs font-bold">
                          {r.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{r.nombre}</div>
                        <div className="text-xs text-gray-400">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.cedula}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      r.tipo === "Propietario"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{r.apto}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.edificio}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.telefono}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      r.alDia
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {r.alDia ? "✓ Al día" : "⚠ Moroso"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="text-xs text-primary hover:underline font-medium">Ver</button>
                      <span className="text-gray-300">|</span>
                      <button className="text-xs text-gray-500 hover:underline">Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">Mostrando {residentes.length} residentes</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Anterior</button>
            <button className="px-3 py-1 text-sm bg-primary text-white rounded-lg">1</button>
            <button className="px-3 py-1 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}
