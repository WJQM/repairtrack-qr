"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

interface Repair {
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string; status: string; estimatedCost: number; notes: string | null;
  image: string | null; accessories: string | null;
  clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  qrCode: string; createdAt: string; updatedAt: string;
}

const ACCESSORIES_ALL = [
  "Cargador", "Batería", "Disco Duro", "Memoria RAM",
  "Cable de Poder", "Mouse", "Teclado", "Pantalla",
  "Tornillos", "Tapa Trasera", "Maletín/Bolsa", "Otros",
];

export default function DeliveryPage() {
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
  const createdDate = new Date(repair.createdAt).toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const checkedAcc: string[] = (() => { try { return JSON.parse(repair.accessories || "[]"); } catch { return []; } })();
  const deviceName = [repair.brand, repair.model || repair.device].filter(Boolean).join(" ");

  const sectionHeader = (title: string, color: string, bg: string, borderColor: string) => ({
    background: bg, padding: "8px 16px" as const, borderBottom: `1px solid ${borderColor}`, fontSize: 11, fontWeight: 700 as const, color, textTransform: "uppercase" as const, letterSpacing: "0.5px",
  });

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { @page { size: A4; margin: 14mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
        * { margin: 0; padding: 0; box-sizing: border-box; } body { background: #fff; }
      `}</style>

      <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "12px 24px", background: "#111118", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 100 }}>
        <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>📄 Acta de Entrega — {repair.code}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "linear-gradient(135deg, #6b7280, #4b5563)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
          <button onClick={() => window.close()} style={{ padding: "8px 20px", background: "#1e1e2e", border: "1px solid #2e2e3e", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✕ Cerrar</button>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "70px 36px 36px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 16, marginBottom: 20, borderBottom: "3px solid #6b7280" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 18 }}>QR</span></h1>
            <p style={{ fontSize: 10, color: "#888", marginTop: 3 }}>SISTEMA DE GESTIÓN DE REPARACIONES</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "inline-block", padding: "6px 16px", background: "#6b7280", borderRadius: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "monospace", letterSpacing: "1px" }}>{repair.code}</span>
            </div>
            <p style={{ fontSize: 10, color: "#888" }}>{today}</p>
          </div>
        </div>

        {/* Título */}
        <div style={{ background: "#f3f4f6", padding: "14px 20px", borderRadius: 8, marginBottom: 24, textAlign: "center", border: "2px solid #6b7280" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "1px" }}>📄 ACTA DE ENTREGA DE EQUIPO</h2>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Documento que certifica la entrega del equipo reparado al cliente</p>
        </div>

        {/* Info en 2 columnas */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          {/* Cliente */}
          <div style={{ flex: 1, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
            <div style={sectionHeader("👤 Datos del Cliente", "#6366f1", "#f0f0ff", "#d5d5ef")}>👤 Datos del Cliente</div>
            <div style={{ padding: "12px 16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr><td style={tdLabel}>Nombre</td><td style={tdValue}>{repair.clientName || "—"}</td></tr>
                  <tr><td style={tdLabel}>Celular</td><td style={tdValue}>{repair.clientPhone || "—"}</td></tr>
                  <tr><td style={tdLabel}>Correo</td><td style={tdValue}>{repair.clientEmail || "—"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Equipo */}
          <div style={{ flex: 1, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
            <div style={sectionHeader("💻 Equipo Entregado", "#b45309", "#fffbeb", "#fde68a")}>💻 Equipo Entregado</div>
            <div style={{ padding: "12px 16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr><td style={tdLabel}>Tipo</td><td style={tdValue}>{repair.device}</td></tr>
                  <tr><td style={tdLabel}>Marca</td><td style={tdValue}>{repair.brand || "—"}</td></tr>
                  <tr><td style={tdLabel}>Modelo</td><td style={tdValue}>{repair.model || "—"}</td></tr>
                  <tr><td style={tdLabel}>Ingreso</td><td style={tdValue}>{createdDate}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Trabajo realizado */}
        <div style={{ marginBottom: 16, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={sectionHeader("🔧 Trabajo", "#555", "#f7f7f8", "#e2e2e2")}>🔧 Trabajo Realizado</div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Problema Original</div>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: "#333" }}>{repair.issue}</p>
            </div>
            {repair.notes && (
              <div>
                <div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Diagnóstico / Reparación</div>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: "#333" }}>{repair.notes}</p>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Observaciones adicionales</div>
              {[1, 2].map((n) => <div key={n} style={{ borderBottom: "1px dashed #ddd", marginBottom: 12, paddingBottom: 3 }} />)}
            </div>
          </div>
        </div>

        {/* Accesorios devueltos */}
        <div style={{ marginBottom: 16, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={sectionHeader("🎒 Accesorios", "#16a34a", "#f0fdf4", "#bbf7d0")}>🎒 Accesorios Devueltos al Cliente</div>
          <div style={{ padding: "10px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {ACCESSORIES_ALL.map((acc) => {
                const checked = checkedAcc.includes(acc);
                return (
                  <div key={acc} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 6px", borderRadius: 5, background: checked ? "#f0fdf4" : "#fafafa", border: `1px solid ${checked ? "#86efac" : "#e8e8e8"}` }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, border: checked ? "none" : "1.5px solid #ccc", background: checked ? "#16a34a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{checked ? "✓" : ""}</span>
                    <span style={{ fontSize: 10, fontWeight: checked ? 600 : 400, color: checked ? "#111" : "#999" }}>{acc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Costos */}
        <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={sectionHeader("💰 Costos", "#6366f1", "#f0f0ff", "#d5d5ef")}>💰 Resumen de Costos</div>
          <div style={{ padding: "12px 16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {["Mano de Obra", "Repuestos", "Otros"].map((r) => (
                  <tr key={r}><td style={{ padding: "5px 0", fontSize: 11, color: "#555" }}>{r}</td><td style={{ padding: "5px 0", fontSize: 11, textAlign: "right", width: 100, borderBottom: "1px dashed #ddd" }}>Bs.</td></tr>
                ))}
                <tr>
                  <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 800 }}>TOTAL COBRADO</td>
                  <td style={{ padding: "10px 0", fontSize: 16, fontWeight: 800, textAlign: "right", color: "#6366f1" }}>Bs. {repair.estimatedCost}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Conformidad */}
        <div style={{ marginBottom: 20, padding: "16px 20px", background: "#f0fdf4", borderRadius: 8, border: "2px solid #86efac" }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 8 }}>✅ Declaración de Conformidad</h3>
          <p style={{ fontSize: 11, lineHeight: 1.7, color: "#333" }}>
            El cliente declara haber recibido el equipo <strong>{deviceName}</strong> ({repair.code}) en condiciones de funcionamiento satisfactorio,
            junto con todos los accesorios listados arriba. Acepta que la garantía de reparación es de <strong>30 días</strong> a partir de esta fecha
            y cubre únicamente el trabajo realizado descrito en este documento.
          </p>
        </div>

        {/* QR + Firmas */}
        <div style={{ display: "flex", gap: 30, marginBottom: 24, marginTop: 30 }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ display: "inline-block", padding: 8, border: "2px solid #6b7280", borderRadius: 10 }}>
              <QRCodeSVG value={`https://repairtrack.com/delivery/${repair.qrCode}`} size={90} level="H" />
            </div>
            <p style={{ fontSize: 8, color: "#888", marginTop: 4 }}>QR Entrega</p>
          </div>
          <div style={{ flex: 1, display: "flex", gap: 30 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ borderBottom: "2px solid #333", marginBottom: 6, height: 50 }} />
              <p style={{ fontSize: 11, fontWeight: 700 }}>Técnico Responsable</p>
              <p style={{ fontSize: 9, color: "#888" }}>Nombre y Firma</p>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ borderBottom: "2px solid #333", marginBottom: 6, height: 50 }} />
              <p style={{ fontSize: 11, fontWeight: 700 }}>Cliente: {repair.clientName || "________________"}</p>
              <p style={{ fontSize: 9, color: "#888" }}>Firma de Conformidad</p>
            </div>
          </div>
        </div>

        {/* Nota */}
        <div style={{ padding: "10px 14px", background: "#f9f9f9", borderRadius: 6, border: "1px solid #e8e8e8", marginBottom: 16 }}>
          <p style={{ fontSize: 8, color: "#aaa", lineHeight: 1.7 }}>
            Este documento certifica la entrega del equipo reparado. La garantía de 30 días cubre exclusivamente el trabajo descrito.
            Daños por mal uso, caídas, líquidos o manipulación por terceros anulan la garantía. Conserve este documento como comprobante.
          </p>
        </div>

        <div style={{ textAlign: "center", paddingTop: 8, borderTop: "1px solid #e2e2e2" }}>
          <p style={{ fontSize: 9, color: "#bbb" }}>RepairTrackQR — Acta de Entrega — {today} — {repair.code}</p>
        </div>
      </div>
    </div>
  );
}

const tdLabel: React.CSSProperties = { padding: "5px 8px 5px 0", fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", width: 70 };
const tdValue: React.CSSProperties = { padding: "5px 0", fontSize: 13, fontWeight: 600, color: "#111" };