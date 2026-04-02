"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface QuotationItem { inventoryId: string; name: string; price: number; qty: number; stock: number; }
interface Quotation { id: string; type: "quotation" | "sale"; clientName: string; clientPhone: string; items: QuotationItem[]; total: number; notes: string; createdAt: string; }

export default function QuotationPrintPage() {
  const params = useParams();
  const id = params.id as string;
  const [doc, setDoc] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => { setBaseUrl(window.location.origin); }, []);
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("quotations") || "[]");
    const found = saved.find((q: Quotation) => q.id === id);
    if (found) setDoc(found);
    setLoading(false);
  }, [id]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16 }}>Cargando documento...</div>;
  if (!doc) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16, color: "#e44" }}>Documento no encontrado: {id}</div>;

  const isQuot = doc.type === "quotation";
  const color = isQuot ? "#d97706" : "#059669";
  const colorLight = isQuot ? "#fef3c7" : "#d1fae5";
  const colorBorder = isQuot ? "#fde68a" : "#6ee7b7";
  const docTitle = isQuot ? "COTIZACIÓN" : "NOTA DE VENTA";
  const docIcon = isQuot ? "📋" : "💰";
  const today = new Date().toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const createdDate = new Date(doc.createdAt).toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const qrUrl = `${baseUrl}/quotations?view=${doc.id}`;
  const qrColor = isQuot ? "d97706" : "059669";
  const qrImg = baseUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}&color=${qrColor}` : "";

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { @page { size: A4; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
        * { margin: 0; padding: 0; box-sizing: border-box; } body { background: #fff; }
      `}</style>

      <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "12px 24px", background: "#111118", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 100 }}>
        <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>{docIcon} {docTitle} — {doc.id}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 20px", background: `linear-gradient(135deg, ${color}, ${isQuot ? "#b45309" : "#047857"})`, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
          <button onClick={() => window.close()} style={{ padding: "8px 20px", background: "#1e1e2e", border: "1px solid #2e2e3e", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✕ Cerrar</button>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "80px 40px 40px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${color}`, paddingBottom: 20, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 20 }}>QR</span></h1>
            <p style={{ fontSize: 11, color: "#666", marginTop: 4 }}>SISTEMA DE GESTIÓN DE REPARACIONES</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "inline-block", padding: "6px 16px", background: color, borderRadius: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "monospace", letterSpacing: "1px" }}>{doc.id}</span>
            </div>
            <p style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Fecha: {today}</p>
          </div>
        </div>

        {/* ═══ TÍTULO ═══ */}
        <div style={{ background: colorLight, padding: "14px 20px", borderRadius: 8, marginBottom: 24, textAlign: "center", border: `2px solid ${colorBorder}` }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "1px" }}>{docIcon} {docTitle}</h2>
          <p style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{isQuot ? "Presupuesto válido por 15 días a partir de la fecha de emisión" : "Documento que acredita la venta de artículos"}</p>
        </div>

        {/* ═══ CLIENTE + QR ═══ */}
        <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
          <div style={{ flex: 1, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: "#f0f0ff", padding: "10px 16px", borderBottom: "1px solid #d5d5ef" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase" }}>👤 Datos del Cliente</h3>
            </div>
            <div style={{ padding: "16px" }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Nombre</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{doc.clientName || "—"}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Celular</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{doc.clientPhone || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Fecha de Emisión</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{createdDate}</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "inline-block", padding: 10, border: `2px solid ${color}`, borderRadius: 12, background: "#fff" }}>
              {qrImg ? <img src={qrImg} alt="QR" width={120} height={120} style={{ display: "block" }} /> : <div style={{ width: 120, height: 120, background: "#f3f4f6" }} />}
            </div>
            <p style={{ fontSize: 9, color, marginTop: 6, fontWeight: 600 }}>QR {docTitle}</p>
            <p style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "monospace", marginTop: 2 }}>{doc.id}</p>
          </div>
        </div>

        {/* ═══ TABLA DE ARTÍCULOS ═══ */}
        <div style={{ marginBottom: 24, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: colorLight, padding: "10px 16px", borderBottom: `1px solid ${colorBorder}` }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase" }}>📦 Detalle de Artículos</h3>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", borderBottom: "2px solid #e5e7eb" }}>#</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", borderBottom: "2px solid #e5e7eb" }}>Artículo</th>
                <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", borderBottom: "2px solid #e5e7eb" }}>Cant.</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", borderBottom: "2px solid #e5e7eb" }}>P. Unitario</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", borderBottom: "2px solid #e5e7eb" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#888", borderBottom: "1px solid #f0f0f0" }}>{idx + 1}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, borderBottom: "1px solid #f0f0f0" }}>📦 {item.name}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, textAlign: "center", borderBottom: "1px solid #f0f0f0" }}>{item.qty}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, textAlign: "right", color: "#555", borderBottom: "1px solid #f0f0f0" }}>Bs. {item.price.toFixed(2)}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, textAlign: "right", color, borderBottom: "1px solid #f0f0f0" }}>Bs. {(item.price * item.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
            <span style={{ fontSize: 11, color: "#888" }}>{doc.items.length} artículo{doc.items.length > 1 ? "s" : ""} · {doc.items.reduce((s, i) => s + i.qty, 0)} unidades</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>TOTAL</div>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>Bs. {doc.total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* ═══ NOTAS ═══ */}
        {doc.notes && (
          <div style={{ marginBottom: 24, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: "#fffbeb", padding: "10px 16px", borderBottom: "1px solid #fde68a" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>📝 Notas / Observaciones</h3>
            </div>
            <div style={{ padding: "12px 16px" }}><p style={{ fontSize: 13, lineHeight: 1.7, color: "#333" }}>{doc.notes}</p></div>
          </div>
        )}

        {/* ═══ CONDICIONES (solo cotización) ═══ */}
        {isQuot && (
          <div style={{ marginBottom: 24, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ background: "#fef3c7", padding: "10px 16px", borderBottom: "1px solid #fde68a" }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>📋 Condiciones de la Cotización</h3>
            </div>
            <div style={{ padding: "12px 16px", fontSize: 11, color: "#666", lineHeight: 1.8 }}>
              <p>1. Esta cotización tiene una validez de <strong>15 días</strong> a partir de su fecha de emisión.</p>
              <p>2. Los precios están sujetos a disponibilidad de stock.</p>
              <p>3. Los precios no incluyen el servicio de instalación salvo que se indique.</p>
              <p>4. Para hacer efectiva la compra, presente este documento o el código <strong>{doc.id}</strong>.</p>
            </div>
          </div>
        )}

        {/* ═══ CONFIRMACIÓN (solo nota de venta) ═══ */}
        {!isQuot && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "#d1fae5", borderRadius: 8, border: "2px solid #6ee7b7" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#047857", textTransform: "uppercase", marginBottom: 8 }}>✅ Confirmación de Venta</h3>
            <p style={{ fontSize: 11, lineHeight: 1.7, color: "#333" }}>
              Se confirma la venta de los artículos detallados al cliente <strong>{doc.clientName}</strong> por un total de <strong>Bs. {doc.total.toFixed(2)}</strong>.
              Los artículos han sido descontados del inventario. Garantía según política de cada producto.
            </p>
          </div>
        )}

        {/* ═══ FIRMAS ═══ */}
        <div style={{ display: "flex", gap: 40, marginBottom: 24, marginTop: 36 }}>
          {[{ label: "Vendedor / Técnico", sub: "Nombre y Firma" }, { label: `Cliente: ${doc.clientName || "________________"}`, sub: "Firma de Conformidad" }].map(f => (
            <div key={f.label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ borderBottom: "2px solid #333", marginBottom: 8, height: 50 }} />
              <p style={{ fontSize: 12, fontWeight: 700 }}>{f.label}</p>
              <p style={{ fontSize: 10, color: "#888" }}>{f.sub}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", paddingTop: 12, borderTop: "1px solid #e2e2e2" }}>
          <p style={{ fontSize: 10, color: "#999" }}>RepairTrackQR — {docTitle} — {today} — {doc.id}</p>
        </div>
      </div>
    </div>
  );
}