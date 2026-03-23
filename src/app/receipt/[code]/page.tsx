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

const ACCESSORIES_ALL = [
  "Cargador", "Batería", "Disco Duro", "Memoria RAM",
  "Cable de Poder", "Mouse", "Teclado", "Pantalla",
  "Tornillos", "Tapa Trasera", "Maletín/Bolsa", "Otros",
];

function parseImages(imageField: string | null): string[] {
  if (!imageField) return [];
  try { const parsed = JSON.parse(imageField); if (Array.isArray(parsed)) return parsed.filter((u: any) => typeof u === "string" && u.length > 0); } catch {}
  return imageField.trim().length > 0 ? [imageField] : [];
}

export default function ReceiptPage() {
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
  const images = parseImages(repair.image);

  const tdLabel: React.CSSProperties = { padding: "6px 10px 6px 0", fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", width: 110 };
  const tdValue: React.CSSProperties = { padding: "6px 0", fontSize: 13, fontWeight: 600, color: "#111" };

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { @page { size: A4; margin: 12mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
        * { margin: 0; padding: 0; box-sizing: border-box; } body { background: #fff; }
      `}</style>

      {/* Toolbar (no se imprime) */}
      <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "12px 24px", background: "#111118", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 100 }}>
        <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>📋 Recepción — {repair.code}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
          <button onClick={() => window.close()} style={{ padding: "8px 20px", background: "#1e1e2e", border: "1px solid #2e2e3e", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✕ Cerrar</button>
        </div>
      </div>

      {/* ═══ COPIA TALLER + COPIA CLIENTE (se imprimen las 2 en 1 hoja) ═══ */}
      {["COPIA TALLER", "COPIA CLIENTE"].map((copyType, copyIdx) => (
        <div key={copyType} style={{ maxWidth: 800, margin: "0 auto", padding: copyIdx === 0 ? "70px 36px 20px" : "20px 36px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111" }}>

          {/* Línea de corte entre copias */}
          {copyIdx === 1 && (
            <div style={{ borderTop: "2px dashed #ccc", margin: "10px 0 20px", position: "relative" }}>
              <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "0 12px", fontSize: 10, color: "#aaa" }}>✂ CORTAR AQUÍ</span>
            </div>
          )}

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #10b981", paddingBottom: 14, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 16 }}>QR</span></h1>
              <p style={{ fontSize: 10, color: "#666", marginTop: 2 }}>COMPROBANTE DE RECEPCIÓN DE EQUIPO</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#999", fontWeight: 600 }}>{copyType}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#6366f1", fontFamily: "monospace", marginTop: 2 }}>{repair.code}</div>
              <p style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{createdDate}</p>
            </div>
          </div>

          {/* Cuerpo: 2 columnas */}
          <div style={{ display: "flex", gap: 16 }}>
            {/* Columna izquierda: info */}
            <div style={{ flex: 1 }}>

              {/* Cliente */}
              <div style={{ marginBottom: 12, border: "1px solid #e2e2e2", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ background: "#f0f0ff", padding: "6px 12px", borderBottom: "1px solid #d5d5ef" }}>
                  <h3 style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase" }}>👤 Cliente</h3>
                </div>
                <div style={{ padding: "8px 12px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{repair.clientName || "—"}</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {repair.clientPhone && <span style={{ fontSize: 11, color: "#555" }}>📱 {repair.clientPhone}</span>}
                    {repair.clientEmail && <span style={{ fontSize: 11, color: "#555" }}>✉️ {repair.clientEmail}</span>}
                  </div>
                </div>
              </div>

              {/* Equipo */}
              <div style={{ marginBottom: 12, border: "1px solid #e2e2e2", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ background: "#fffbeb", padding: "6px 12px", borderBottom: "1px solid #fde68a" }}>
                  <h3 style={{ fontSize: 10, fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>💻 Equipo Recibido</h3>
                </div>
                <div style={{ padding: "8px 12px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {[
                        { label: "Tipo", value: repair.device },
                        { label: "Marca", value: repair.brand || "—" },
                        { label: "Modelo", value: repair.model || "—" },
                        { label: "Costo Est.", value: `Bs. ${repair.estimatedCost}` },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td style={{ padding: "2px 8px 2px 0", fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", width: 80 }}>{row.label}</td>
                          <td style={{ padding: "2px 0", fontSize: 12, fontWeight: 600, color: "#111" }}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Problema */}
              <div style={{ marginBottom: 12, padding: "8px 12px", border: "1px solid #e2e2e2", borderRadius: 6, borderLeft: "3px solid #6366f1" }}>
                <div style={{ fontSize: 10, color: "#888", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>🔧 Problema Reportado</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "#333" }}>{repair.issue}</div>
              </div>

              {/* Accesorios compacto */}
              <div style={{ marginBottom: 12, border: "1px solid #e2e2e2", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ background: "#f0fdf4", padding: "6px 12px", borderBottom: "1px solid #bbf7d0" }}>
                  <h3 style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>🎒 Accesorios Entregados</h3>
                </div>
                <div style={{ padding: "8px 12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                    {ACCESSORIES_ALL.map((acc) => {
                      const checked = checkedAcc.includes(acc);
                      return (
                        <div key={acc} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 0" }}>
                          <span style={{ width: 14, height: 14, borderRadius: 3, border: checked ? "none" : "1.5px solid #ccc", background: checked ? "#16a34a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{checked ? "✓" : ""}</span>
                          <span style={{ fontSize: 10, fontWeight: checked ? 600 : 400, color: checked ? "#111" : "#aaa" }}>{acc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Columna derecha: QR + foto + firmas */}
            <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* QR Seguimiento */}
              <div style={{ textAlign: "center", padding: 10, border: "1px solid #e2e2e2", borderRadius: 6 }}>
                <div style={{ fontSize: 9, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>QR Seguimiento</div>
                <div style={{ display: "inline-block", padding: 6, border: "2px solid #6366f1", borderRadius: 8 }}>
                  <QRCodeSVG value={`https://repairtrack.com/track/${repair.qrCode}`} size={80} level="H" />
                </div>
                <div style={{ fontSize: 9, color: "#6366f1", fontFamily: "monospace", fontWeight: 700, marginTop: 4 }}>{repair.qrCode}</div>
              </div>

              {/* QR Recepción */}
              <div style={{ textAlign: "center", padding: 10, border: "1px solid #e2e2e2", borderRadius: 6 }}>
                <div style={{ fontSize: 9, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>QR Recepción</div>
                <div style={{ display: "inline-block", padding: 6, border: "2px solid #10b981", borderRadius: 8 }}>
                  <QRCodeSVG value={`https://repairtrack.com/receipt/${repair.qrCode}`} size={80} level="H" />
                </div>
                <div style={{ fontSize: 9, color: "#10b981", fontFamily: "monospace", fontWeight: 700, marginTop: 4 }}>RECEPCIÓN</div>
              </div>

              {/* Foto del equipo */}
              {images.length > 0 && (
                <div style={{ border: "1px solid #e2e2e2", borderRadius: 6, overflow: "hidden" }}>
                  <img src={images[0]} alt={repair.device} style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                  <div style={{ fontSize: 9, color: "#888", textAlign: "center", padding: 4 }}>📷 Foto del equipo</div>
                </div>
              )}

              {/* Firmas compactas */}
              <div style={{ marginTop: "auto" }}>
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <div style={{ borderBottom: "1.5px solid #333", height: 30 }} />
                  <p style={{ fontSize: 9, fontWeight: 700, marginTop: 3 }}>Técnico Responsable</p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ borderBottom: "1.5px solid #333", height: 30 }} />
                  <p style={{ fontSize: 9, fontWeight: 700, marginTop: 3 }}>Cliente: {repair.clientName || "________"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Nota legal compacta */}
          <div style={{ marginTop: 10, padding: "6px 10px", background: "#f9f9f9", borderRadius: 4, border: "1px solid #eee" }}>
            <p style={{ fontSize: 8, color: "#aaa", lineHeight: 1.6 }}>
              Al firmar, el cliente confirma la entrega del equipo y accesorios listados. Garantía de 30 días desde la entrega.
              Equipos no reclamados en 90 días se consideran abandonados. No nos responsabilizamos por pérdida de datos.
              Consulte el estado escaneando el QR de seguimiento.
            </p>
          </div>

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <p style={{ fontSize: 9, color: "#bbb" }}>RepairTrackQR — {today} — {repair.code}</p>
          </div>
        </div>
      ))}
    </div>
  );
}