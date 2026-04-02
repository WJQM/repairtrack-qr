"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Repair {
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string; status: string; estimatedCost: number; notes: string | null;
  image: string | null; accessories: string | null;
  clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  qrCode: string; createdAt: string; updatedAt: string;
}

const ACCESSORIES_ALL = ["Cargador", "Batería", "Disco Duro", "Memoria RAM", "Cable de Poder", "Pantalla", "Tornillos", "Maletín/Bolsa", "Otros"];

function parseAccWithDetail(raw: string): { name: string; detail: string } { const match = raw.match(/^(.+?)\s*\((.+)\)$/); if (match) return { name: match[1].trim(), detail: match[2].trim() }; return { name: raw.trim(), detail: "" }; }
function parseNotesAll(n: string | null): { notes: string; services: string[]; software: string[]; repuestos: string[]; deliveryNotes: string } {
  if (!n) return { notes: "", services: [], software: [], repuestos: [], deliveryNotes: "" };
  const parts = n.split(" | ");
  const svc = parts.find(p => p.startsWith("Servicios: ")); const sw = parts.find(p => p.startsWith("Software: ")); const rep = parts.find(p => p.startsWith("Repuestos: ")); const del = parts.find(p => p.startsWith("Entrega: "));
  const rest = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Software: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: "));
  return {
    notes: rest.join(" | "),
    services: svc ? svc.replace("Servicios: ", "").split(", ").filter(Boolean) : [],
    software: sw ? sw.replace("Software: ", "").split(", ").filter(Boolean) : [],
    repuestos: rep ? rep.replace("Repuestos: ", "").split(", ").filter(Boolean) : [],
    deliveryNotes: del ? del.replace("Entrega: ", "") : "",
  };
}

// Convierte OT-1 → CE-1
function otToCe(otCode: string): string {
  const num = otCode.replace(/^OT-/i, "");
  return `CE-${num}`;
}

export default function DeliveryPage() {
  const params = useParams();
  const code = params.code as string;
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => { setBaseUrl(window.location.origin); }, []);
  useEffect(() => { if (code) { fetch(`/api/track/${code}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setRepair(d); setLoading(false); }).catch(() => setLoading(false)); } }, [code]);

  if (loading) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16 }}>Cargando orden...</div>;
  if (!repair) return <div style={{ padding: 60, textAlign: "center", fontFamily: "Arial", fontSize: 16, color: "#e44" }}>Orden no encontrada: {code}</div>;

  const today = new Date().toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const createdDate = new Date(repair.createdAt).toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
  const deliveredDate = new Date(repair.updatedAt).toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const checkedAcc: string[] = (() => { try { return JSON.parse(repair.accessories || "[]"); } catch { return []; } })();
  const deviceName = [repair.brand, repair.model || repair.device].filter(Boolean).join(" ");
  const parsed = parseNotesAll(repair.notes);
  const ceCode = otToCe(repair.code);
  // QR apunta a /delivery/OT-# para que el escáner lo detecte como acta de entrega
  const deliveryUrl = `${baseUrl}/delivery/${repair.code}`;
  const qrImg = baseUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(deliveryUrl)}&color=10b981` : "";

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { @page { size: A4; margin: 14mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
        * { margin: 0; padding: 0; box-sizing: border-box; } body { background: #fff; }
      `}</style>

      <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "12px 24px", background: "#111118", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 100 }}>
        <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>📄 Acta de Entrega — {ceCode} (Orden {repair.code})</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "linear-gradient(135deg, #6b7280, #4b5563)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
          <button onClick={() => window.close()} style={{ padding: "8px 20px", background: "#1e1e2e", border: "1px solid #2e2e3e", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✕ Cerrar</button>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "70px 36px 36px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 16, marginBottom: 20, borderBottom: "3px solid #6b7280" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 18 }}>QR</span></h1>
            <p style={{ fontSize: 10, color: "#888", marginTop: 3 }}>SISTEMA DE GESTIÓN DE REPARACIONES</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "inline-block", padding: "6px 16px", background: "#10b981", borderRadius: 6, marginBottom: 4 }}><span style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "monospace", letterSpacing: "1px" }}>{ceCode}</span></div>
            <p style={{ fontSize: 10, color: "#888" }}>Orden: {repair.code}</p>
            <p style={{ fontSize: 10, color: "#888" }}>{today}</p>
          </div>
        </div>

        {/* ═══ TÍTULO ═══ */}
        <div style={{ background: "#f3f4f6", padding: "14px 20px", borderRadius: 8, marginBottom: 24, textAlign: "center", border: "2px solid #6b7280" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "1px" }}>📄 ACTA DE ENTREGA DE EQUIPO</h2>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Documento que certifica la entrega del equipo reparado al cliente</p>
        </div>

        {/* ═══ CLIENTE + EQUIPO ═══ */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
            <SectionHead title="👤 Datos del Cliente" color="#6366f1" bg="#f0f0ff" />
            <div style={{ padding: "12px 16px" }}>
              {[{ l: "Nombre", v: repair.clientName || "—" }, { l: "Celular", v: repair.clientPhone || "—" }].map(r => (
                <div key={r.l} style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{r.l}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{r.v}</div></div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
            <SectionHead title="💻 Equipo Entregado" color="#b45309" bg="#fffbeb" />
            <div style={{ padding: "12px 16px" }}>
              {[{ l: "Equipo", v: deviceName }, { l: "Tipo", v: repair.device }, { l: "Ingreso", v: createdDate }, { l: "Entrega", v: deliveredDate, c: "#10b981" }, { l: "Costo", v: `Bs. ${repair.estimatedCost}`, c: "#6366f1" }].map(r => (
                <div key={r.l} style={{ display: "flex", marginBottom: 3 }}><span style={{ width: 65, fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", flexShrink: 0 }}>{r.l}</span><span style={{ fontSize: 12, fontWeight: 600, color: (r as any).c || "#111" }}>{r.v}</span></div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ TRABAJO ═══ */}
        <Section title="🔧 Trabajo Realizado">
          <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Problema Original</div><p style={{ fontSize: 12, lineHeight: 1.6, color: "#333" }}>{repair.issue}</p></div>
          {parsed.notes && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Observaciones</div><p style={{ fontSize: 12, lineHeight: 1.6, color: "#333" }}>{parsed.notes}</p></div>}
          {parsed.deliveryNotes && <div><div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Notas de Entrega</div><p style={{ fontSize: 12, lineHeight: 1.6, color: "#333" }}>{parsed.deliveryNotes}</p></div>}
        </Section>

        {parsed.services.length > 0 && <Section title="🛠️ Servicios Realizados"><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{parsed.services.map(n => <Chip key={n} icon="🛠️" label={n} color="#7c3aed" bg="#faf5ff" border="#e9d5ff" />)}</div></Section>}
        {parsed.software.length > 0 && <Section title="🎮 Software Instalado"><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{parsed.software.map(n => <Chip key={n} icon="🎮" label={n} color="#6d28d9" bg="#f5f3ff" border="#ddd6fe" />)}</div></Section>}
        {parsed.repuestos.length > 0 && <Section title="📦 Repuestos Utilizados"><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{parsed.repuestos.map(n => <Chip key={n} icon="📦" label={n} color="#b45309" bg="#fffbeb" border="#fde68a" />)}</div></Section>}

        {/* ═══ ACCESORIOS ═══ */}
        <div style={{ marginBottom: 16, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <SectionHead title="🎒 Accesorios Devueltos al Cliente" color="#16a34a" bg="#f0fdf4" />
          <div style={{ padding: "10px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {ACCESSORIES_ALL.map(acc => {
                const matched = checkedAcc.find(a => parseAccWithDetail(a).name === acc);
                const checked = !!matched; const detail = matched ? parseAccWithDetail(matched).detail : "";
                return (
                  <div key={acc} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: checked ? "#f0fdf4" : "#fafafa", border: `1px solid ${checked ? "#86efac" : "#e8e8e8"}` }}>
                    <span style={{ width: 15, height: 15, borderRadius: 3, border: checked ? "none" : "1.5px solid #ccc", background: checked ? "#16a34a" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{checked ? "✓" : ""}</span>
                    <span style={{ fontSize: 10, fontWeight: checked ? 600 : 400, color: checked ? "#111" : "#aaa" }}>{acc}{detail && <span style={{ color: "#16a34a" }}> ({detail})</span>}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ COSTOS ═══ */}
        <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <SectionHead title="💰 Resumen de Costos" color="#6366f1" bg="#f0f0ff" />
          <div style={{ padding: "12px 16px" }}>
            {["Mano de Obra", "Repuestos", "Otros"].map(r => <div key={r} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 11, color: "#555", borderBottom: "1px dashed #e8e8e8" }}><span>{r}</span><span>Bs.</span></div>)}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>TOTAL COBRADO</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#6366f1" }}>Bs. {repair.estimatedCost}</span>
            </div>
          </div>
        </div>

        {/* ═══ CONFORMIDAD ═══ */}
        <div style={{ marginBottom: 20, padding: "16px 20px", background: "#f0fdf4", borderRadius: 8, border: "2px solid #86efac" }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 8 }}>✅ Declaración de Conformidad</h3>
          <p style={{ fontSize: 11, lineHeight: 1.7, color: "#333" }}>
            El cliente declara haber recibido el equipo <strong>{deviceName}</strong> ({repair.code}) en condiciones de funcionamiento satisfactorio,
            junto con todos los accesorios listados arriba. Acepta que la garantía de reparación es de <strong>30 días</strong> a partir de esta fecha
            y cubre únicamente el trabajo realizado descrito en este documento.
          </p>
        </div>

        {/* ═══ QR + FIRMAS ═══ */}
        <div style={{ display: "flex", gap: 30, marginBottom: 24, marginTop: 30 }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ display: "inline-block", padding: 8, border: "2px solid #10b981", borderRadius: 12, background: "#fff" }}>
              {qrImg ? <img src={qrImg} alt="QR" width={100} height={100} style={{ display: "block" }} /> : <div style={{ width: 100, height: 100, background: "#f3f4f6" }} />}
            </div>
            <p style={{ fontSize: 8, color: "#10b981", marginTop: 4, fontWeight: 600 }}>QR ACTA DE ENTREGA</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#10b981", fontFamily: "monospace" }}>{ceCode}</p>
            <p style={{ fontSize: 8, color: "#999", marginTop: 1 }}>Orden: {repair.code}</p>
          </div>
          <div style={{ flex: 1, display: "flex", gap: 30 }}>
            {[{ label: "Técnico Responsable", sub: "Nombre y Firma" }, { label: `Cliente: ${repair.clientName || "________________"}`, sub: "Firma de Conformidad" }].map(f => (
              <div key={f.label} style={{ flex: 1, textAlign: "center" }}><div style={{ borderBottom: "2px solid #333", marginBottom: 6, height: 50 }} /><p style={{ fontSize: 11, fontWeight: 700 }}>{f.label}</p><p style={{ fontSize: 9, color: "#888" }}>{f.sub}</p></div>
            ))}
          </div>
        </div>

        <div style={{ padding: "10px 14px", background: "#f9f9f9", borderRadius: 6, border: "1px solid #e8e8e8", marginBottom: 16 }}>
          <p style={{ fontSize: 8, color: "#aaa", lineHeight: 1.7 }}>Este documento certifica la entrega del equipo reparado. La garantía de 30 días cubre exclusivamente el trabajo descrito. Daños por mal uso, caídas, líquidos o manipulación por terceros anulan la garantía. Conserve este documento como comprobante. Para consultar el estado escanee el QR o use el código <strong>{ceCode}</strong> en el escáner.</p>
        </div>
        <div style={{ textAlign: "center", paddingTop: 8, borderTop: "1px solid #e2e2e2" }}><p style={{ fontSize: 9, color: "#bbb" }}>RepairTrackQR — Acta de Entrega — {today} — {ceCode} — Orden {repair.code}</p></div>
      </div>
    </div>
  );
}

function SectionHead({ title, color, bg }: { title: string; color: string; bg: string }) {
  return <div style={{ background: bg, padding: "10px 16px", borderBottom: "1px solid #e2e2e2" }}><h3 style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase" }}>{title}</h3></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 16, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}><div style={{ background: "#f7f7f8", padding: "10px 16px", borderBottom: "1px solid #e2e2e2" }}><h3 style={{ fontSize: 12, fontWeight: 700, color: "#555", textTransform: "uppercase" }}>{title}</h3></div><div style={{ padding: "12px 16px" }}>{children}</div></div>;
}
function Chip({ icon, label, color, bg, border }: { icon: string; label: string; color: string; bg: string; border: string }) {
  return <span style={{ padding: "5px 12px", background: bg, border: `1px solid ${border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color }}>{icon} {label}</span>;
}