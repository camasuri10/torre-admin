"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const EDIFICIO_ID = 1;

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style:                 "currency",
    currency:              "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

const ESTADO_BADGE: Record<string, string> = {
  pagado:    "bg-green-100 text-green-700",
  pendiente: "bg-amber-100 text-amber-700",
  vencido:   "bg-red-100 text-red-700",
};

const ESTADO_LABEL: Record<string, string> = {
  pagado:    "Pagado",
  pendiente: "Pendiente",
  vencido:   "Vencido",
};

type Cuota = {
  id: number;
  mes: string;
  monto: number;
  fecha_vencimiento: string;
  estado: string;
  fecha_pago: string | null;
  residente_nombre: string | null;
  unidad_numero: string | null;
  edificio_nombre: string | null;
};

type Resumen = {
  pagadas: number;
  pendientes: number;
  vencidas: number;
  total_recaudado: number;
  total_pendiente: number;
  total_meta: number;
};

export default function FinanzasPage() {
  const [cuotas, setCuotas]     = useState<Cuota[]>([]);
  const [resumen, setResumen]   = useState<Resumen | null>(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState<number | null>(null);

  async function load() {
    try {
      const [data, r] = await Promise.all([
        api.cuotas.list({ edificio_id: EDIFICIO_ID }),
        api.cuotas.resumen(EDIFICIO_ID),
      ]);
      setCuotas(data);
      setResumen(r);
    } catch (err) {
      console.error("Error cargando finanzas", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handlePagar(id: number) {
    setPaying(id);
    try {
      const today = new Date().toISOString().split("T")[0];
      await api.cuotas.pagar(id, { fecha_pago: today, metodo_pago: "efectivo" });
      await load();
    } catch (err) {
      console.error("Error registrando pago", err);
    } finally {
      setPaying(null);
    }
  }

  const totalRecaudado = resumen?.total_recaudado ?? 0;
  const totalMeta      = resumen?.total_meta ?? 0;
  const pct            = totalMeta > 0 ? Math.min((totalRecaudado / totalMeta) * 100, 100) : 0;

  const mesActual = new Date().toLocaleString("es-CO", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Recaudado</div>
          <div className="text-2xl font-bold text-accent">{loading ? "—" : formatCOP(totalRecaudado)}</div>
          <div className="text-xs text-gray-400 mt-1">{resumen?.pagadas ?? 0} cuotas pagadas</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pendiente</div>
          <div className="text-2xl font-bold text-amber-600">{loading ? "—" : formatCOP(resumen?.total_pendiente ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">{resumen?.pendientes ?? 0} cuotas por vencer</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vencido</div>
          <div className="text-2xl font-bold text-red-600">{loading ? "—" : formatCOP(resumen?.total_pendiente ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">{resumen?.vencidas ?? 0} cuotas vencidas</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Meta del mes</div>
          <div className="text-2xl font-bold text-primary">{loading ? "—" : formatCOP(totalMeta)}</div>
          <div className="text-xs text-gray-400 mt-1">{Math.round(pct)}% alcanzado</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 capitalize">Progreso de recaudo – {mesActual}</h2>
          <span className="text-sm text-gray-500">
            {formatCOP(totalRecaudado)} / {formatCOP(totalMeta)}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-accent to-secondary transition-all duration-700"
            style={{ width: `${pct}%` }}
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
          <h2 className="font-semibold text-gray-900 capitalize">Estado de cuotas – {mesActual}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Residente", "Unidad", "Edificio", "Mes", "Monto", "Vencimiento", "Estado", "Fecha pago", "Acción"].map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h === "Monto" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</td></tr>
              ) : cuotas.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">Sin cuotas registradas.</td></tr>
              ) : cuotas.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {c.residente_nombre ? c.residente_nombre.split(" ").slice(0, 2).join(" ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.unidad_numero ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate">{c.edificio_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.mes}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCOP(c.monto)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.fecha_vencimiento?.split("T")[0] ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[c.estado] ?? "bg-gray-100 text-gray-600"}`}>
                      {ESTADO_LABEL[c.estado] ?? c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {c.fecha_pago ? c.fecha_pago.split("T")[0] : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.estado !== "pagado" && (
                      <button
                        onClick={() => handlePagar(c.id)}
                        disabled={paying === c.id}
                        className="text-xs text-primary font-medium hover:underline disabled:opacity-50"
                      >
                        {paying === c.id ? "…" : "Registrar pago"}
                      </button>
                    )}
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
