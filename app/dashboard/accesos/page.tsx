import { registrosAcceso } from "@/lib/mock-data";

const motivoBadge: Record<string, string> = {
  Visita: "bg-blue-100 text-blue-700",
  Domicilio: "bg-purple-100 text-purple-700",
  "Servicio técnico": "bg-indigo-100 text-indigo-700",
  Mudanza: "bg-orange-100 text-orange-700",
  Otro: "bg-gray-100 text-gray-600",
};

export default function AccesosPage() {
  const autorizados = registrosAcceso.filter((r) => r.autorizado).length;
  const noAutorizados = registrosAcceso.filter((r) => !r.autorizado).length;
  const activos = registrosAcceso.filter((r) => !r.horaSalida).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Ingresos hoy", value: registrosAcceso.length, color: "text-primary", bg: "bg-blue-50" },
          { label: "Actualmente dentro", value: activos, color: "text-green-600", bg: "bg-green-50" },
          { label: "Accesos no autorizados", value: noAutorizados, color: "text-red-600", bg: "bg-red-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Register visitor CTA */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-xl p-6 text-white flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Registrar nuevo visitante</h3>
          <p className="text-blue-200 text-sm mt-1">Ingresa los datos del visitante para autorizar su acceso al conjunto.</p>
        </div>
        <button className="bg-white text-primary px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors flex-shrink-0">
          + Registrar ingreso
        </button>
      </div>

      {/* Access log table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Registro de accesos</h2>
          <div className="flex gap-2">
            <button className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50">
              Exportar
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Visitante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Destino</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Anfitrión</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Motivo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entrada</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Salida</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {registrosAcceso.map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-50 transition-colors ${!r.autorizado ? "bg-red-50/50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        r.autorizado ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600"
                      }`}>
                        {r.visitante.split(" ")[0][0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{r.visitante}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">{r.documento}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">{r.destino}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {r.residenteAnfitrion.split(" ").slice(0, 2).join(" ")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${motivoBadge[r.motivo]}`}>
                      {r.motivo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{r.fechaEntrada}</div>
                    <div className="text-xs text-gray-400">{r.horaEntrada}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {r.horaSalida ? (
                      <span>{r.horaSalida}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        Dentro
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.autorizado ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        ✓ Autorizado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        ✗ No autorizado
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {registrosAcceso.length} registros · {autorizados} autorizados · {noAutorizados} no autorizados
          </span>
        </div>
      </div>
    </div>
  );
}
