"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function mesLabel(mesAno: string) {
  const [y, m] = mesAno.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("es-CO", { month: "long", year: "numeric" });
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
  const user = getUser();
  const edificioId = user?.edificio_id ?? 1;
  const userId = user ? parseInt(user.sub) : null;
  const isAdmin = ["administrador", "superadmin"].includes(user?.rol ?? "");
  const isResidente = ["propietario", "inquilino"].includes(user?.rol ?? "");

  const now = new Date();
  const [mesAno, setMesAno] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [cuotas, setCuotas]     = useState<Cuota[]>([]);
  const [resumen, setResumen]   = useState<Resumen | null>(null);
  const [loading, setLoading]   = useState(true);
  const [paying, setPaying]     = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [showGenerar, setShowGenerar] = useState(false);
  const [generarForm, setGenerarForm] = useState({ monto: "", fecha_vencimiento: "" });
  const [generando, setGenerando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { edificio_id: edificioId, mes: mesAno };
      if (isResidente && userId) params.usuario_id = userId;
      if (filtroEstado) params.estado = filtroEstado;

      const [data, r] = await Promise.all([
        api.cuotas.list(params),
        api.cuotas.resumen(edificioId, mesAno),
      ]);
      setCuotas(data);
      setResumen(r);
    } catch (err) {
      console.error("Error cargando finanzas", err);
    } finally {
      setLoading(false);
    }
  }, [edificioId, mesAno, isResidente, userId, filtroEstado]);

  useEffect(() => { load(); }, [load]);

  function prevMes() {
    const [y, m] = mesAno.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMesAno(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMes() {
    const [y, m] = mesAno.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMesAno(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

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

  async function handleMarcarVencido(id: number) {
    setUpdating(id);
    try {
      await api.cuotas.marcarVencido(id);
      await load();
    } finally {
      setUpdating(null);
    }
  }

  async function handleGenerar(e: React.FormEvent) {
    e.preventDefault();
    if (!generarForm.monto || !generarForm.fecha_vencimiento) return;
    setGenerando(true);
    try {
      const result = await api.cuotas.generarMes({
        edificio_id: edificioId,
        mes: mesAno,
        monto: Number(generarForm.monto),
        fecha_vencimiento: generarForm.fecha_vencimiento,
      });
      setShowGenerar(false);
      setGenerarForm({ monto: "", fecha_vencimiento: "" });
      await load();
      alert(`Cuotas generadas: ${result.creadas} nuevas, ${result.omitidas} ya existían.`);
    } catch (err: any) {
      alert("Error: " + (err?.message ?? "Intenta de nuevo"));
    } finally {
      setGenerando(false);
    }
  }

  const totalRecaudado = resumen?.total_recaudado ?? 0;
  const totalMeta      = resumen?.total_meta ?? 0;
  const pct            = totalMeta > 0 ? Math.min((totalRecaudado / totalMeta) * 100, 100) : 0;
  const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMes}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors text-sm">
            ‹
          </button>
          <span className="font-semibold text-gray-900 capitalize min-w-[180px] text-center">
            {mesLabel(mesAno)}
          </span>
          <button onClick={nextMes}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors text-sm">
            ›
          </button>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowGenerar(true)}
            className="bg-primary text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-primary/90">
            + Generar cuotas del mes
          </button>
        )}
      </div>

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
          <h2 className="font-semibold text-gray-900 capitalize">Progreso de recaudo</h2>
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
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-gray-900 capitalize">Estado de cuotas — {mesLabel(mesAno)}</h2>
          <div className="flex gap-2 flex-wrap">
            {["", "pendiente", "vencido", "pagado"].map((e) => (
              <button key={e} onClick={() => setFiltroEstado(e)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filtroEstado === e ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {e === "" ? "Todos" : ESTADO_LABEL[e]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {(isAdmin
                  ? ["Residente", "Unidad", "Edificio", "Monto", "Vencimiento", "Estado", "Fecha pago", "Acciones"]
                  : ["Unidad", "Monto", "Vencimiento", "Estado", "Fecha pago"]
                ).map((h) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h === "Monto" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={isAdmin ? 8 : 5} className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</td></tr>
              ) : cuotas.length === 0 ? (
                <tr><td colSpan={isAdmin ? 8 : 5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin cuotas para este mes.{isAdmin && " Usa 'Generar cuotas del mes' para crearlas."}
                </td></tr>
              ) : cuotas.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  {isAdmin && (
                    <>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {c.residente_nombre ? c.residente_nombre.split(" ").slice(0, 2).join(" ") : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.unidad_numero ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate">{c.edificio_nombre ?? "—"}</td>
                    </>
                  )}
                  {!isAdmin && (
                    <td className="px-4 py-3 text-sm text-gray-600">{c.unidad_numero ?? "—"}</td>
                  )}
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
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {c.estado === "pendiente" && (
                          <button
                            onClick={() => handleMarcarVencido(c.id)}
                            disabled={updating === c.id}
                            className="text-xs text-orange-600 font-medium hover:underline disabled:opacity-50">
                            {updating === c.id ? "…" : "Marcar vencido"}
                          </button>
                        )}
                        {c.estado !== "pagado" && (
                          <button
                            onClick={() => handlePagar(c.id)}
                            disabled={paying === c.id}
                            className="text-xs text-primary font-medium hover:underline disabled:opacity-50">
                            {paying === c.id ? "…" : "Registrar pago"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">Total: {cuotas.length} registros</span>
        </div>
      </div>

      {/* Generar cuotas modal */}
      {showGenerar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Generar cuotas del mes</h3>
            <p className="text-sm text-gray-500 mb-4">
              Crea una cuota para cada unidad del edificio para <strong className="capitalize">{mesLabel(mesAno)}</strong>.
              Si la cuota ya existe para una unidad, se omite.
            </p>
            <form onSubmit={handleGenerar} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto por unidad *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Ej: 250000"
                  value={generarForm.monto}
                  onChange={(e) => setGenerarForm({ ...generarForm, monto: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento *</label>
                <input
                  required
                  type="date"
                  value={generarForm.fecha_vencimiento}
                  onChange={(e) => setGenerarForm({ ...generarForm, fecha_vencimiento: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button"
                  onClick={() => { setShowGenerar(false); setGenerarForm({ monto: "", fecha_vencimiento: "" }); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={generando}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60">
                  {generando ? "Generando…" : "Generar cuotas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
