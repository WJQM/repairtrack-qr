"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Repair {
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string; status: string; priority: string; estimatedCost: number;
  notes: string | null; image: string | null; accessories: string | null;
  clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  qrCode: string; createdAt: string; updatedAt: string;
}

const STATUS: Record<string, string> = { pending: "Pendiente", diagnosed: "Diagnosticado", waiting_parts: "Esperando Repuestos", in_progress: "En Progreso", completed: "Completado", delivered: "Entregado" };
const ACCESSORIES_ALL = ["Cargador", "Batería", "Disco Duro", "Memoria RAM", "Cable de Poder", "Pantalla", "Tornillos", "Maletín/Bolsa", "Otros"];

function parseAccWithDetail(raw: string): { name: string; detail: string } { const match = raw.match(/^(.+?)\s*\((.+)\)$/); if (match) return { name: match[1].trim(), detail: match[2].trim() }; return { name: raw.trim(), detail: "" }; }
function parseImages(img: string | null): string[] { if (!img) return []; try { const p = JSON.parse(img); if (Array.isArray(p)) return p.filter((u: any) => typeof u === "string" && u.length > 0); } catch {} return img.trim().length > 0 ? [img] : []; }
function parseNotesAll(n: string | null): { notes: string; services: string[]; software: string[]; repuestos: string[] } {
  if (!n) return { notes: "", services: [], software: [], repuestos: [] };
  const parts = n.split(" | ");
  const svc = parts.find(p => p.startsWith("Servicios: ")); const sw = parts.find(p => p.startsWith("Software: ")); const rep = parts.find(p => p.startsWith("Repuestos: "));
  const rest = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Software: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: "));
  return {
    notes: rest.join(" | "),
    services: svc ? svc.replace("Servicios: ", "").split(", ").filter(Boolean) : [],
    software: sw ? sw.replace("Software: ", "").split(", ").filter(Boolean) : [],
    repuestos: rep ? rep.replace("Repuestos: ", "").split(", ").filter(Boolean) : [],
  };
}

export default function PrintPage() {
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
  const createdDate = new Date(repair.createdAt).toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const checkedAcc: string[] = (() => { try { return JSON.parse(repair.accessories || "[]"); } catch { return []; } })();
  const firstImage = parseImages(repair.image)[0] || null;
  const parsed = parseNotesAll(repair.notes);
  // QR apunta a /track/OT-# para que el escáner lo detecte como seguimiento
  const trackUrl = `${baseUrl}/track/${repair.code}`;
  const qrImg = baseUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackUrl)}&color=3b82f6` : "";

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style>{`
        @media print { @page { size: A4; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
        * { margin: 0; padding: 0; box-sizing: border-box; } body { background: #fff; }
      `}</style>

      <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "12px 24px", background: "#111118", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 100 }}>
        <span style={{ color: "#eee", fontSize: 14, fontWeight: 600 }}>🖨️ Recepción — {repair.code}</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.print()} style={{ padding: "8px 20px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
          <button onClick={() => window.close()} style={{ padding: "8px 20px", background: "#1e1e2e", border: "1px solid #2e2e3e", borderRadius: 8, color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>✕ Cerrar</button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 40px 40px", fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111" }}>

        {/* ═══ HEADER ═══ */}
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

        {/* ═══ TÍTULO ═══ */}
        <div style={{ background: "#6366f1", color: "#fff", padding: "14px 20px", borderRadius: 8, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>ORDEN DE TRABAJO — RECEPCIÓN</h2>
          <span style={{ fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.2)", padding: "4px 14px", borderRadius: 20 }}>{STATUS[repair.status] || repair.status}</span>
        </div>

        {/* ═══ CLIENTE ═══ */}
        <div style={{ marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#f0f0ff", padding: "10px 16px", borderBottom: "1px solid #d5d5ef" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textTransform: "uppercase" }}>👤 Datos del Cliente</h3>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", gap: 40 }}>
            <div><div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Nombre</div><div style={{ fontSize: 15, fontWeight: 700 }}>{repair.clientName || "—"}</div></div>
            <div><div style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Celular</div><div style={{ fontSize: 15, fontWeight: 700 }}>{repair.clientPhone || "—"}</div></div>
          </div>
        </div>

        {/* ═══ QR + EQUIPO ═══ */}
        <div style={{ display: "flex", gap: 24, marginBottom: 20, border: "1px solid #e2e2e2", borderRadius: 8, padding: 20 }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ padding: 10, border: "2px solid #3b82f6", borderRadius: 12, display: "inline-block", background: "#fff" }}>
              {qrImg ? <img src={qrImg} alt="QR" width={130} height={130} style={{ display: "block" }} /> : <div style={{ width: 130, height: 130, background: "#f3f4f6" }} />}
            </div>
            <p style={{ fontSize: 9, color: "#3b82f6", marginTop: 6, fontWeight: 600 }}>QR DE SEGUIMIENTO</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#3b82f6", fontFamily: "monospace", marginTop: 2 }}>{repair.code}</p>
            <p style={{ fontSize: 8, color: "#999", marginTop: 2 }}>Escanear con código: {repair.code}</p>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 16 }}>
              {firstImage && <div style={{ width: 100, height: 100, borderRadius: 8, overflow: "hidden", border: "1px solid #ddd", flexShrink: 0 }}><img src={firstImage} alt={repair.device} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", marginBottom: 8, borderBottom: "1px solid #eee", paddingBottom: 4 }}>💻 Datos del Equipo</div>
                {[{ l: "Tipo", v: repair.device }, { l: "Marca", v: repair.brand || "—" }, { l: "Modelo", v: repair.model || "—" }, { l: "Costo Estimado", v: `Bs. ${repair.estimatedCost}` }, { l: "Fecha Ingreso", v: createdDate }].map(r => (
                  <div key={r.l} style={{ display: "flex", marginBottom: 3 }}><span style={{ width: 110, fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", flexShrink: 0 }}>{r.l}</span><span style={{ fontSize: 12, fontWeight: 600 }}>{r.v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ ACCESORIOS ═══ */}
        <SectionBox title="🎒 Accesorios Recibidos" color="#16a34a" bg="#f0fdf4" border="#bbf7d0">
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
        </SectionBox>

        {/* ═══ PROBLEMA ═══ */}
        <SectionBox title="🔧 Problema Reportado" color="#555" bg="#f7f7f8" border="#e2e2e2">
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "#333" }}>{repair.issue}</p>
        </SectionBox>

        {parsed.notes && <SectionBox title="📝 Observaciones" color="#b45309" bg="#fffbeb" border="#fde68a"><p style={{ fontSize: 13, lineHeight: 1.7, color: "#333" }}>{parsed.notes}</p></SectionBox>}
        {parsed.services.length > 0 && <SectionBox title="🛠️ Servicios Asignados" color="#7c3aed" bg="#faf5ff" border="#e9d5ff"><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{parsed.services.map(n => <Chip key={n} icon="🛠️" label={n} color="#7c3aed" bg="#faf5ff" border="#e9d5ff" />)}</div></SectionBox>}
        {parsed.software.length > 0 && <SectionBox title="🎮 Software a Instalar" color="#6d28d9" bg="#f5f3ff" border="#ddd6fe"><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{parsed.software.map(n => <Chip key={n} icon="🎮" label={n} color="#6d28d9" bg="#f5f3ff" border="#ddd6fe" />)}</div></SectionBox>}
        {parsed.repuestos.length > 0 && <SectionBox title="📦 Repuestos Utilizados" color="#b45309" bg="#fffbeb" border="#fde68a"><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{parsed.repuestos.map(n => <Chip key={n} icon="📦" label={n} color="#b45309" bg="#fffbeb" border="#fde68a" />)}</div></SectionBox>}

        {/* ═══ COSTOS ═══ */}
        <SectionBox title="💰 Resumen de Costos" color="#6366f1" bg="#f0f0ff" border="#d5d5ef">
          {["Mano de Obra", "Repuestos", "Otros"].map(r => <div key={r} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "#555", borderBottom: "1px dashed #e8e8e8" }}><span>{r}</span><span>Bs.</span></div>)}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>TOTAL ESTIMADO</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#6366f1" }}>Bs. {repair.estimatedCost}</span>
          </div>
        </SectionBox>

        {/* ═══ FIRMAS ═══ */}
        <div style={{ display: "flex", gap: 40, marginBottom: 24, marginTop: 40 }}>
          {[{ label: "Técnico Responsable", sub: "Nombre y Firma" }, { label: `Cliente: ${repair.clientName || "________________"}`, sub: "Firma de Conformidad" }].map(f => (
            <div key={f.label} style={{ flex: 1, textAlign: "center" }}><div style={{ borderBottom: "2px solid #333", marginBottom: 8, height: 50 }} /><p style={{ fontSize: 12, fontWeight: 700 }}>{f.label}</p><p style={{ fontSize: 10, color: "#888" }}>{f.sub}</p></div>
          ))}
        </div>

        <div style={{ padding: 14, background: "#f9f9f9", borderRadius: 8, border: "1px solid #e8e8e8", marginBottom: 20 }}>
          <h4 style={{ fontSize: 10, fontWeight: 700, color: "#666", textTransform: "uppercase", marginBottom: 6 }}>Términos y Condiciones</h4>
          <div style={{ fontSize: 9, color: "#888", lineHeight: 1.7 }}>
            <p>1. El equipo será reparado según el diagnóstico aprobado por el cliente.</p>
            <p>2. El costo final puede variar si se encuentran daños adicionales.</p>
            <p>3. Garantía de 30 días a partir de la fecha de entrega.</p>
            <p>4. Equipos no reclamados en 90 días serán considerados abandonados.</p>
            <p>5. No nos hacemos responsables por datos perdidos durante la reparación.</p>
            <p>6. Consulte el estado escaneando el código QR con código <strong>{repair.code}</strong>.</p>
          </div>
        </div>

        <div style={{ textAlign: "center", paddingTop: 12, borderTop: "1px solid #e2e2e2" }}>
          <p style={{ fontSize: 10, color: "#999" }}>RepairTrackQR — Recepción — {today} — {repair.code}</p>
        </div>
      </div>
    </div>
  );
}

function SectionBox({ title, color, bg, border, children }: { title: string; color: string; bg: string; border: string; children: React.ReactNode }) {
  return (<div style={{ marginBottom: 18, border: "1px solid #e2e2e2", borderRadius: 8, overflow: "hidden" }}><div style={{ background: bg, padding: "10px 16px", borderBottom: `1px solid ${border}` }}><h3 style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase" }}>{title}</h3></div><div style={{ padding: "12px 16px" }}>{children}</div></div>);
}
function Chip({ icon, label, color, bg, border }: { icon: string; label: string; color: string; bg: string; border: string }) {
  return <span style={{ padding: "5px 12px", background: bg, border: `1px solid ${border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, color }}>{icon} {label}</span>;
}