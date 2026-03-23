"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

interface Repair {
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string; status: string; priority: string; estimatedCost: number;
  notes: string | null; image: string | null; accessories: string | null;
  clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  qrCode: string; createdAt: string; updatedAt: string;
}

const STATUS: Record<string, string> = { pending: "Pendiente", diagnosed: "Diagnosticado", waiting_parts: "Esperando Repuestos", in_progress: "En Progreso", completed: "Completado", delivered: "Entregado" };

const ACCESSORIES_ALL = [
  "Cargador", "Batería", "Disco Duro", "Memoria RAM",
  "Cable de Poder", "Mouse", "Teclado", "Pantalla",
  "Tornillos", "Tapa Trasera", "Maletín/Bolsa", "Otros",
];

export default function PrintPage() {
  const params = useParams();
  const code = params.code as string;
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (code) loadRepair(); }, [code]);
  useEffect(() => { if (repair) setTimeout(() => window.print(), 800); }, [repair]);

  const loadRepair = async () => {
    try { const res = await fetch(`/api/track/${code}`); if (res.ok) setRepair(await res.json()); } catch {}
    setLoading(false);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", fontFamily: "Arial" }}>Cargando...</div>;
  if (!repair) return <div style={{ padding: 40, textAlign: "center", fontFamily: "Arial" }}>Orden no encontrada: {code}</div>;

  const today = new Date().toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const createdDate = new Date(repair.createdAt).toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const checkedAcc: string[] = (() => { try { return JSON.parse(repair.accessories || "[]"); } catch { return []; } })();

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { @page { size: A4; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
        * { margin: 0; padding: 0; box-sizing: border-box; } body { background: #fff; }
      `}</style>

      <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "12px 24px", background: "#111118", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 100 }}>
        <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>🖨️ Orden — {repair.code}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
          <button onClick={() => window.close()} style={{ padding: "8px 20px", background: "#1e1e2e", border: "1px solid #2e2e3e", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✕ Cerrar</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 40px 40px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #6366f1", paddingBottom: 20, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 20 }}>QR</span></h1>
            <p style={{ fontSize: 11, color: "#666", marginTop: 4 }}>SISTEMA DE SEGUIMIENTO DE REPARACIONES</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#6366f1", fontFamily: "monospace" }}>{repair.code}</div>
            <p style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Fecha: {today}</p>
          </div>
        </div>

        {/* Title */}
        <div style={{ background: "#6366f1", color: "#fff", padding: "14px 20px", borderRadius: 8, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>ORDEN DE TRABAJO</h2>
          <span style={{ fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.2)", padding: "4px 14px", borderRadius: 20 }}>{STATUS[repair.status] || repair.status}</span>
        </div>

        {/* Cliente */}
        <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#f0f0ff", padding: "10px 16px", borderBottom: "1px solid #d5d5ef" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase" }}>👤 Datos del Cliente</h3>
          </div>
          <div style={{ padding: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={tdLabel}>Nombre</td><td style={tdValue}>{repair.clientName || "—"}</td>
                  <td style={{ ...tdLabel, paddingLeft: 20 }}>Celular</td><td style={tdValue}>{repair.clientPhone || "—"}</td>
                </tr>
                <tr>
                  <td style={tdLabel}>Correo</td><td colSpan={3} style={tdValue}>{repair.clientEmail || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* QR + Equipo */}
        <div style={{ display: "flex", gap: 24, marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, padding: 20 }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ padding: 10, border: "2px solid #6366f1", borderRadius: 10, display: "inline-block" }}>
              <QRCodeSVG value={`https://repairtrack.com/track/${repair.qrCode}`} size={120} level="H" />
            </div>
            <p style={{ fontSize: 10, color: "#666", marginTop: 6 }}>Escanear para seguimiento</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", fontFamily: "monospace", marginTop: 2 }}>{repair.qrCode}</p>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 16 }}>
              {repair.image && (
                <div style={{ width: 110, height: 110, borderRadius: 8, overflow: "hidden", border: "1px solid #ddd", flexShrink: 0 }}>
                  <img src={repair.image} alt={repair.device} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 6, borderBottom: "1px solid #eee", paddingBottom: 4 }}>💻 Datos del Equipo</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      { label: "Tipo", value: repair.device },
                      { label: "Marca", value: repair.brand || "—" },
                      { label: "Modelo", value: repair.model || "—" },
                      { label: "Costo Estimado", value: `Bs. ${repair.estimatedCost}` },
                      { label: "Fecha Ingreso", value: createdDate },
                    ].map((row) => (
                      <tr key={row.label}>
                        <td style={{ padding: "3px 10px 3px 0", fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", width: 110 }}>{row.label}</td>
                        <td style={{ padding: "3px 0", fontSize: 12, fontWeight: 600, color: "#111" }}>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Accesorios */}
        <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#f0fdf4", padding: "10px 16px", borderBottom: "1px solid #bbf7d0" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>🎒 Accesorios Entregados por el Cliente</h3>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {ACCESSORIES_ALL.map((acc) => {
                const checked = checkedAcc.includes(acc);
                return (
                  <div key={acc} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: checked ? "#f0fdf4" : "#fafafa", border: `1px solid ${checked ? "#86efac" : "#e5e5e5"}` }}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, border: checked ? "none" : "2px solid #ccc", background: checked ? "#16a34a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{checked ? "✓" : ""}</span>
                    <span style={{ fontSize: 11, fontWeight: checked ? 600 : 400, color: checked ? "#111" : "#999" }}>{acc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Problema */}
        <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#f7f7f8", padding: "10px 16px", borderBottom: "1px solid #e2e2e2" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase" }}>🔧 Problema Reportado</h3>
          </div>
          <div style={{ padding: 16 }}><p style={{ fontSize: 14, lineHeight: 1.7, color: "#333" }}>{repair.issue}</p></div>
        </div>

        {/* Notas */}
        {repair.notes && (
          <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: "#fff8ee", padding: "10px 16px", borderBottom: "1px solid #f0d9a8" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>📝 Notas del Técnico</h3>
            </div>
            <div style={{ padding: 16 }}><p style={{ fontSize: 14, lineHeight: 1.7, color: "#333" }}>{repair.notes}</p></div>
          </div>
        )}

        {/* Diagnóstico */}
        <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#f7f7f8", padding: "10px 16px", borderBottom: "1px solid #e2e2e2" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase" }}>Diagnóstico y Trabajos Realizados</h3>
          </div>
          <div style={{ padding: 16, minHeight: 80 }}>
            {[1, 2, 3, 4].map((n) => <div key={n} style={{ borderBottom: "1px dashed #ddd", marginBottom: 16, paddingBottom: 4 }} />)}
          </div>
        </div>

        {/* Repuestos */}
        <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#f7f7f8", padding: "10px 16px", borderBottom: "1px solid #e2e2e2" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase" }}>Repuestos Utilizados</h3>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                {["Nº", "Descripción", "Cant.", "P.Unit.(Bs.)", "Subtotal(Bs.)"].map((h, i) => (
                  <th key={i} style={{ padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", textAlign: i > 1 ? "center" : "left", borderBottom: "1px solid #e2e2e2" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((n) => (
                <tr key={n}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f0f0f0", fontSize: 12, color: "#999", width: 30 }}>{n}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f0f0f0" }} />
                  <td style={{ padding: "10px", borderBottom: "1px solid #f0f0f0", textAlign: "center", width: 50 }} />
                  <td style={{ padding: "10px", borderBottom: "1px solid #f0f0f0", textAlign: "center", width: 90 }} />
                  <td style={{ padding: "10px", borderBottom: "1px solid #f0f0f0", textAlign: "center", width: 90 }} />
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={{ padding: "10px", textAlign: "right", fontWeight: 700, fontSize: 12 }}>TOTAL:</td>
                <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, fontSize: 13, borderTop: "2px solid #333" }}>Bs.</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Costos */}
        <div style={{ marginBottom: 24, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#f0f0ff", padding: "10px 16px", borderBottom: "1px solid #d5d5ef" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase" }}>Resumen de Costos</h3>
          </div>
          <div style={{ padding: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {["Mano de Obra", "Repuestos", "Otros"].map((r) => (
                  <tr key={r}><td style={{ padding: "6px 0", fontSize: 12, color: "#555" }}>{r}</td><td style={{ padding: "6px 0", fontSize: 12, textAlign: "right", width: 100, borderBottom: "1px dashed #ddd" }}>Bs.</td></tr>
                ))}
                <tr>
                  <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 800 }}>TOTAL A PAGAR</td>
                  <td style={{ padding: "10px 0", fontSize: 16, fontWeight: 800, textAlign: "right", color: "#6366f1" }}>Bs. {repair.estimatedCost}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Firmas */}
        <div style={{ display: "flex", gap: 40, marginBottom: 24, marginTop: 40 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ borderBottom: "2px solid #333", marginBottom: 8, height: 50 }} />
            <p style={{ fontSize: 12, fontWeight: 700 }}>Técnico Responsable</p>
            <p style={{ fontSize: 10, color: "#888" }}>Nombre y Firma</p>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ borderBottom: "2px solid #333", marginBottom: 8, height: 50 }} />
            <p style={{ fontSize: 12, fontWeight: 700 }}>Cliente: {repair.clientName || "________________"}</p>
            <p style={{ fontSize: 10, color: "#888" }}>Firma de Conformidad</p>
          </div>
        </div>

        {/* Términos */}
        <div style={{ padding: 14, background: "#f9f9f9", borderRadius: 8, border: "1px solid #e8e8e8", marginBottom: 20 }}>
          <h4 style={{ fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", marginBottom: 6 }}>Términos y Condiciones</h4>
          <div style={{ fontSize: 9, color: "#888", lineHeight: 1.7 }}>
            <p>1. El equipo será reparado según el diagnóstico aprobado por el cliente.</p>
            <p>2. El costo final puede variar si se encuentran daños adicionales.</p>
            <p>3. Garantía de 30 días a partir de la fecha de entrega.</p>
            <p>4. Equipos no reclamados en 90 días serán considerados abandonados.</p>
            <p>5. No nos hacemos responsables por datos perdidos durante la reparación.</p>
            <p>6. Consulte el estado escaneando el código QR de este documento.</p>
          </div>
        </div>

        <div style={{ textAlign: "center", paddingTop: 12, borderTop: "1px solid #e2e2e2" }}>
          <p style={{ fontSize: 10, color: "#999" }}>RepairTrackQR — {today} — {repair.code}</p>
        </div>
      </div>
    </div>
  );
}

const tdLabel: React.CSSProperties = { padding: "6px 10px 6px 0", fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", width: 100 };
const tdValue: React.CSSProperties = { padding: "6px 0", fontSize: 14, fontWeight: 600, color: "#111" };