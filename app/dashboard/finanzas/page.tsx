import { cuotas, dashboardStats } from "@/lib/mock-data";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const estadoBadge: Record<string, string> = {
  Pagado: "bg-green-100 text-green-700",
  Pendiente: "bg-amber-100 text-amber-700",
  Vencido: "bg-red-100 text-red-700",
};

export default function FinanzasPage() {
  const pagados = cuotas.filter((c) => c.estado === "Pagado");
  const pendientes = cuotas.filter((c) => c.estado === "Pendiente");
  const vencidos = cuotas.filter((c) => c.estado === "Vencido");

  const totalRecaudado = pagados.reduce((sum, c) => sum + c.monto, 0);
  const totalPendiente = pendientes.reduce((sum, c) => sum + c.monto, 0);
  const totalVencido = vencidos.reduce((sum, c) => sum + c.monto, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Recaudado</div>
          <div className="text-2xl font-bold text-accent">{formatCOP(totalRecaudado)}</div>
          <div className="text-xs text-gray-400 mt-1">{pagados.length} cuotas pagadas</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pendiente</div>
          <div className="text-2xl font-bold text-amber-600">{formatCOP(totalPendiente)}</div>
          <div className="text-xs text-gray-400 mt-1">{pendientes.length} cuotas por vencer</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vencido</div>
          <div className="text-2xl font-bold text-red-600">{formatCOP(totalVencido)}</div>
          <div className="text-xs text-gray-400 mt-1">{vencidos.length} cuotas vencidas</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Meta del mes</div>
          <div className="text-2xl font-bold text-primary">{formatCOP(dashboardStats.metaRecaudo)}</div>
          <div className="text-xs text-gray-400 mt-1">
            {Math.round((totalRecaudado / dashboardStats.metaRecaudo) * 100)}% alcanzado
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Progreso de recaudo – Julio 2025</h2>
          <span className="text-sm text-gray-500">
            {formatCOP(totalRecaudado)} / {formatCOP(dashboardStats.metaRecaudo)}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-accent to-secondary transition-all duration-700"
            style={{ width: `${Math.min((totalRecaudado / dashboardStats.metaRecaudo) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent inline-block" /> Pagado</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Pendiente</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Vencido</span>
        </div>
      </div>

      {/* Cuotas table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Estado de cuotas – Julio 2025</h2>
          <div className="flex gap-2">
            <button className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50">
              Exportar
            </button>
            <button className="bg-primary text-white text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-primary-dark transition-colors">
              + Registrar pago
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Residente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Edificio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vencimiento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cuotas.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {c.residente.split(" ").slice(0, 2).join(" ")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.apto}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate">{c.edificio}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.mes}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                    {formatCOP(c.monto)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.fechaVencimiento}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoBadge[c.estado]}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.fechaPago ?? <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">Total: {cuotas.length} registros</span>
        </div>
      </div>
    </div>
  );
}
