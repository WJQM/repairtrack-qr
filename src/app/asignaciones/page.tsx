"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User { id: string; name: string; email: string; role: string; }
interface Repair { id: string; code: string; device: string; brand: string | null; model: string | null; issue: string; status: string; priority: string; estimatedCost: number; notes: string | null; image: string | null; accessories: string | null; clientName: string | null; clientPhone: string | null; clientEmail: string | null; qrCode: string; createdAt: string; updatedAt: string; technicianId: string | null; technician?: { id: string; name: string } | null; }
interface ServiceItem { id: string; name: string; price: number; icon: string; }

const STATUS: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b", icon: "⏳", bg: "rgba(245,158,11,0.08)" },
  diagnosed: { label: "Diagnosticado", color: "#8b5cf6", icon: "🔍", bg: "rgba(139,92,246,0.08)" },
  waiting_parts: { label: "Esperando Repuestos", color: "#f97316", icon: "📦", bg: "rgba(249,115,22,0.08)" },
  in_progress: { label: "En Progreso", color: "#3b82f6", icon: "🔧", bg: "rgba(59,130,246,0.08)" },
  completed: { label: "Completado", color: "#10b981", icon: "✅", bg: "rgba(16,185,129,0.08)" },
  delivered: { label: "Entregado", color: "#6b7280", icon: "📱", bg: "rgba(107,114,128,0.08)" },
};
const STEPS = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed"];

function parseImages(img: string | null): string[] { if (!img) return []; try { const p = JSON.parse(img); if (Array.isArray(p)) return p.filter((u: any) => typeof u === "string" && u.length > 0); } catch {} return img.trim().length > 0 ? [img] : []; }
function parseAcc(json: string | null): string[] { if (!json) return []; try { return JSON.parse(json); } catch { return []; } }
function parseNotes(n: string | null, svcList: ServiceItem[]): { notes: string; services: string[]; software: string[]; repuestos: string[]; deliveryNotes: string } {
  if (!n) return { notes: "", services: [], software: [], repuestos: [], deliveryNotes: "" };
  const parts = n.split(" | "); const sP = parts.find(p => p.startsWith("Servicios: ")); const swP = parts.find(p => p.startsWith("Software: ")); const rP = parts.find(p => p.startsWith("Repuestos: ")); const dP = parts.find(p => p.startsWith("Entrega: "));
  const rest = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Software: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: "));
  const services: string[] = []; const software: string[] = []; const repuestos: string[] = [];
  if (sP) sP.replace("Servicios: ", "").split(", ").forEach(nm => { if (svcList.find(s => s.name === nm)) services.push(nm); });
  if (swP) swP.replace("Software: ", "").split(", ").forEach(nm => { if (nm.trim()) software.push(nm.trim()); });
  if (rP) rP.replace("Repuestos: ", "").split(", ").forEach(nm => { if (nm.trim()) repuestos.push(nm.trim()); });
  return { notes: rest.join(" | "), services, software, repuestos, deliveryNotes: dP ? dP.replace("Entrega: ", "") : "" };
}
function greet(): string { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches"; }

export default function AsignacionesPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewImg, setViewImg] = useState<string | null>(null);
  const [svcList, setSvcList] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState("");

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const load = async (token: string) => { try { const r = await fetch("/api/repairs", { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) setRepairs(await r.json()); } catch {} };

  useEffect(() => {
    const ud = localStorage.getItem("user"); const tk = localStorage.getItem("token");
    if (!ud || !tk) { router.push("/"); return; }
    const p = JSON.parse(ud);
    if (p.role === "admin") { router.push("/dashboard"); return; }
    setUser(p); load(tk);
    fetch("/api/services").then(r => r.json()).then(d => { if (Array.isArray(d)) setSvcList(d); }).catch(() => {});
    setLoading(false);
  }, []);
  useEffect(() => { const tk = localStorage.getItem("token"); if (!tk) return; const iv = setInterval(() => load(tk), 10000); return () => clearInterval(iv); }, []);

  const advance = async (id: string, next: string) => {
    const tk = localStorage.getItem("token"); if (!tk) return;
    try { const r = await fetch(`/api/repairs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify({ status: next }) });
      if (r.ok) { flash(`✅ ${STATUS[next]?.label}`); await load(tk); } else flash("❌ Error");
    } catch { flash("❌ Sin conexión"); }
  };

  const list = repairs.filter(r => {
    const ms = filter === "all" || (filter === "active" ? !["completed", "delivered"].includes(r.status) : r.status === filter);
    const mq = search === "" || r.code.toLowerCase().includes(search.toLowerCase()) || (r.clientName || "").toLowerCase().includes(search.toLowerCase()) || r.device.toLowerCase().includes(search.toLowerCase());
    return ms && mq;
  });

  const st = { total: repairs.length, pend: repairs.filter(r => ["pending", "diagnosed", "waiting_parts"].includes(r.status)).length, prog: repairs.filter(r => r.status === "in_progress").length, done: repairs.filter(r => r.status === "completed").length };

  if (!user) return null;

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 200, paddingTop: 0 }}>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, padding: "12px 22px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 6px 24px rgba(16,185,129,0.3)", zIndex: 200, animation: "slideIn .3s ease-out" }}>{toast}</div>}
      {viewImg && <div onClick={() => setViewImg(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, cursor: "pointer" }}><img src={viewImg} style={{ maxWidth: "90%", maxHeight: "90vh", borderRadius: 12 }} /></div>}

      <style>{`
        @keyframes slideIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeScale{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        .sb{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--text-muted);transition:.15s;text-align:left}
        .sb:hover{background:rgba(99,102,241,.06);color:var(--text-secondary)}.sb.on{background:rgba(99,102,241,.12);color:#818cf8}
        .sbi{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .chip{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;border-radius:6px;font-size:10px;font-weight:600}
        .abtn{transition:.15s}.abtn:hover{filter:brightness(1.15);transform:scale(1.02)}
      
        @media(max-width:768px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
          .form-grid,.info-grid,.detail-grid{grid-template-columns:1fr!important}
          .filter-wrap{flex-direction:column;align-items:stretch!important}
          .filter-btns{overflow-x:auto;flex-wrap:nowrap!important;padding-bottom:4px}
          .msg-layout{grid-template-columns:1fr!important}
          .hide-mobile{display:none!important}
          .data-grid-5{grid-template-columns:repeat(2,1fr)!important}
        }
      `}</style>

      
      {/* MOBILE HEADER */}
      <div className="mobile-header" style={{ display: "none", position: "fixed", top: 0, left: 0, right: 0, height: 56, background: "rgba(12,12,18,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", alignItems: "center", padding: "0 16px", zIndex: 50, gap: 12 }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", color: "#818cf8" }}>{menuOpen ? "✕" : "☰"}</button>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 12 }}>QR</span></span>
      </div>
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 44 }} />}

      {/* SIDEBAR */}
      <aside className={`sidebar-desktop${menuOpen ? " open" : ""}`} style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 200, transition: "transform 0.3s ease", background: "rgba(12,12,18,.95)", backdropFilter: "blur(20px)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", zIndex: 45, padding: "0 10px" }}>
        <div style={{ padding: "18px 14px 20px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 0 20px rgba(99,102,241,.2)", flexShrink: 0 }}>🔧</div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-.3px" }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 12 }}>QR</span></span>
          </div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "auto", padding: "4px 0" }}>
          {[{ l: "Mis Asignaciones", p: "/asignaciones", i: "📋", on: true }, { l: "Mensajes", p: "/messages", i: "💬" }, { l: "Escáner", p: "/scanner", i: "📷" }, { l: "Cotizaciones", p: "/quotations", i: "🧾" }].map(x => (
            <button key={x.p} className={`sb${(x as any).on ? " on" : ""}`} onClick={() => { setMenuOpen(false); router.push(x.p); }}>
              <div className="sbi" style={{ background: (x as any).on ? "rgba(99,102,241,.15)" : "transparent" }}>{x.i}</div>{x.l}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 6px" }}>
          <div style={{ padding: "14px 10px", marginBottom: 8, background: "rgba(99,102,241,.04)", borderRadius: 12, border: "1px solid rgba(99,102,241,.08)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#6366f1,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 auto 8px", boxShadow: "0 4px 14px rgba(99,102,241,.3)" }}>
              {user?.name ? user.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() : "?"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, wordBreak: "break-word", marginBottom: 6 }}>{user?.name}</div>
            <div style={{ display: "inline-block", fontSize: 9, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: ".5px", padding: "3px 10px", borderRadius: 8, background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.15)" }}>🔧 Técnico</div>
          </div>
          <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/"); }} style={{ width: "100%", padding: "9px 14px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.12)", borderRadius: 10, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>🚪 Cerrar Sesión</button>
        </div>
      </aside>

      {/* CONTENIDO */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.5px" }}>{greet()}, {user?.name?.split(" ")[0]} 👋</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 3 }}>Tus órdenes de trabajo asignadas</p>
        </div>

        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[{ l: "Asignadas", v: st.total, i: "📋", c: "#6366f1" }, { l: "Pendientes", v: st.pend, i: "⏳", c: "#f59e0b" }, { l: "En Progreso", v: st.prog, i: "🔧", c: "#3b82f6" }, { l: "Completadas", v: st.done, i: "✅", c: "#10b981" }].map((s, i) => (
            <div key={i} style={{ padding: "16px", background: `linear-gradient(135deg,${s.c}10,${s.c}03)`, borderRadius: 14, border: `1px solid ${s.c}15`, position: "relative", overflow: "hidden", animation: `fadeIn .4s ease-out ${i * .06}s both` }}>
              <div style={{ position: "absolute", top: -8, right: -8, fontSize: 40, opacity: .06 }}>{s.i}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".7px", fontWeight: 600 }}>{s.l}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.c, marginTop: 6 }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180, maxWidth: 320, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 10, padding: "0 14px", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ flex: 1, border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
          </div>
          <div className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ k: "all", l: "Todas", i: "📋", c: "#6366f1" }, ...Object.entries(STATUS).filter(([k]) => k !== "delivered").map(([k, v]) => ({ k, l: v.label, i: v.icon, c: v.color }))].map(f => {
              const on = filter === f.k; const n = f.k === "all" ? repairs.length : repairs.filter(r => r.status === f.k).length;
              return <button key={f.k} onClick={() => setFilter(f.k)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 10, fontWeight: on ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, background: on ? `${f.c}15` : "var(--bg-card)", border: on ? `1.5px solid ${f.c}40` : "1.5px solid var(--border)", color: on ? f.c : "var(--text-muted)" }}><span style={{ fontSize: 11 }}>{f.i}</span>{f.l}{n > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: "0 5px", borderRadius: 5, background: on ? `${f.c}20` : "var(--bg-tertiary)", color: on ? f.c : "var(--text-muted)" }}>{n}</span>}</button>;
            })}
          </div>
        </div>

        {loading ? <div style={{ padding: 50, textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>
        : list.length === 0 ? <div style={{ padding: 50, textAlign: "center", background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)" }}><div style={{ fontSize: 40, marginBottom: 12 }}>📋</div><h3 style={{ fontSize: 15, fontWeight: 700 }}>Sin asignaciones</h3></div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((r, i) => {
              const s = STATUS[r.status] || { label: r.status, color: "#666", icon: "❓", bg: "rgba(100,100,100,.08)" };
              const isOpen = expanded === r.id;
              const isDone = r.status === "delivered";
              const ci = isDone ? STEPS.length - 1 : STEPS.indexOf(r.status);
              const next = !isDone && ci >= 0 && ci < STEPS.length - 1 ? STEPS[ci + 1] : undefined;
              const imgs = parseImages(r.image);
              const acc = parseAcc(r.accessories);
              const p = parseNotes(r.notes, svcList);
              const dev = [r.device, r.brand, r.model].filter(Boolean).join(" ");
              const hasTags = acc.length > 0 || p.services.length > 0 || p.software.length > 0 || p.repuestos.length > 0;

              return (
                <div key={r.id} onClick={() => setExpanded(isOpen ? null : r.id)} style={{ background: "var(--bg-card)", borderRadius: 14, border: `1px solid ${isOpen ? s.color + "30" : "var(--border)"}`, cursor: "pointer", transition: ".25s", animation: `fadeIn .3s ease-out ${i * .03}s both`, overflow: "hidden" }}>
                  {/* FILA COMPACTA */}
                  <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: `1px solid ${s.color}15` }}>
                      {imgs[0] ? <img src={imgs[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : s.icon}
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,.07)", padding: "2px 7px", borderRadius: 5, flexShrink: 0 }}>{r.code}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dev}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>👤 {r.clientName || "—"}</span>
                    {next ? (
                      <button className="abtn" onClick={e => { e.stopPropagation(); advance(r.id, next); }} style={{ padding: "7px 14px", background: `linear-gradient(135deg,${STATUS[next].color},${STATUS[next].color}bb)`, border: "none", borderRadius: 8, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", boxShadow: `0 3px 12px ${STATUS[next].color}25`, whiteSpace: "nowrap" }}>{STATUS[next].icon} {STATUS[next].label} ▸</button>
                    ) : r.status === "completed" ? (
                      <span style={{ padding: "7px 14px", background: "rgba(16,185,129,.07)", borderRadius: 8, border: "1px solid rgba(16,185,129,.15)", color: "#10b981", fontSize: 10, fontWeight: 700 }}>✅ Listo</span>
                    ) : null}
                    <span style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, flexShrink: 0 }}>{s.icon} {s.label}</span>
                    <span style={{ fontSize: 14, color: "var(--text-muted)", transform: isOpen ? "rotate(90deg)" : "none", transition: ".2s", flexShrink: 0 }}>▸</span>
                  </div>
                  {/* Barra mini */}
                  <div style={{ height: 2, background: "var(--bg-tertiary)" }}><div style={{ height: "100%", width: `${((ci + 1) / STEPS.length) * 100}%`, background: s.color, transition: "width .4s", borderRadius: 1 }} /></div>

                  {/* EXPANDIDO */}
                  {isOpen && (
                    <div style={{ padding: "16px 18px", borderTop: "1px solid var(--border)", animation: "fadeScale .2s ease-out" }}>
                      {/* Fotos en fila chica */}
                      {imgs.length > 0 && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
                          {imgs.map((img, idx) => (
                            <div key={idx} onClick={e => { e.stopPropagation(); setViewImg(img); }} style={{ width: 110, height: 80, borderRadius: 10, overflow: "hidden", cursor: "pointer", border: "1px solid var(--border)", flexShrink: 0, position: "relative" }}>
                              <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "3px 6px", background: "linear-gradient(transparent,rgba(0,0,0,.7))" }}><span style={{ fontSize: 8, color: "#fff" }}>{idx + 1}/{imgs.length}</span></div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Grid datos 5 columnas */}
                      <div className="data-grid-5" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
                        {[
                          { l: "Cliente", v: r.clientName || "—", i: "👤", c: "#818cf8" },
                          { l: "Celular", v: r.clientPhone || "—", i: "📱", c: "#818cf8" },
                          { l: "Dispositivo", v: `${r.device} ${r.brand || ""}`, i: "💻", c: "#f59e0b" },
                          { l: "Modelo", v: r.model || "—", i: "📋", c: "#f59e0b" },
                          { l: "Costo", v: `Bs. ${r.estimatedCost}`, i: "💰", c: "#10b981" },
                        ].map((d, idx) => (
                          <div key={idx} style={{ padding: "8px 10px", background: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 8, color: d.c, textTransform: "uppercase", fontWeight: 700, letterSpacing: ".4px" }}>{d.l}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 3 }}>{d.i} {d.v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Problema + Observaciones en 2 col */}
                      <div style={{ display: "grid", gridTemplateColumns: p.notes ? "1fr 1fr" : "1fr", gap: 8, marginBottom: hasTags ? 14 : 0 }}>
                        <div style={{ padding: "10px 12px", borderRadius: 10, background: `${s.color}06`, borderLeft: `3px solid ${s.color}` }}>
                          <div style={{ fontSize: 8, color: s.color, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Problema</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{r.issue}</div>
                        </div>
                        {p.notes && (
                          <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(245,158,11,.04)", borderLeft: "3px solid #f59e0b" }}>
                            <div style={{ fontSize: 8, color: "#f59e0b", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Observaciones</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{p.notes}</div>
                          </div>
                        )}
                      </div>
                      {p.deliveryNotes && <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(107,114,128,.04)", borderLeft: "3px solid #6b7280", marginBottom: 14, marginTop: p.notes ? 0 : 14 }}><div style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Entrega</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.deliveryNotes}</div></div>}

                      {/* Tags compactos en una sola zona */}
                      {hasTags && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                          {acc.map(a => <span key={a} className="chip" style={{ background: "rgba(16,185,129,.07)", color: "#10b981", border: "1px solid rgba(16,185,129,.12)" }}>🎒 {a}</span>)}
                          {p.services.map(n => { const sv = svcList.find(s => s.name === n); return <span key={n} className="chip" style={{ background: "rgba(168,85,247,.07)", color: "#a855f7", border: "1px solid rgba(168,85,247,.12)" }}>{sv?.icon} {n}</span>; })}
                          {p.software.map(n => <span key={n} className="chip" style={{ background: "rgba(139,92,246,.07)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,.12)" }}>🎮 {n}</span>)}
                          {p.repuestos.map(n => <span key={n} className="chip" style={{ background: "rgba(245,158,11,.07)", color: "#f59e0b", border: "1px solid rgba(245,158,11,.12)" }}>📦 {n}</span>)}
                        </div>
                      )}

                      {/* Stepper compacto */}
                      <div style={{ display: "flex", alignItems: "center", padding: "10px 0", marginBottom: 12 }}>
                        {STEPS.map((k, idx) => {
                          const v = STATUS[k]; const done = isDone || idx <= ci; const cur = !isDone && idx === ci;
                          return (
                            <div key={k} style={{ display: "flex", alignItems: "center", flex: idx < STEPS.length - 1 ? 1 : "none" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                                <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, background: done ? v.color : "var(--bg-tertiary)", border: done ? "none" : "2px solid var(--border)", color: done ? "#fff" : "var(--text-muted)", boxShadow: cur ? `0 0 10px ${v.color}50` : "none", transition: ".3s" }}>{done ? "✓" : idx + 1}</div>
                                <span style={{ fontSize: 7, fontWeight: 700, color: cur ? v.color : done ? "var(--text-secondary)" : "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{v.label}</span>
                              </div>
                              {idx < STEPS.length - 1 && <div style={{ flex: 1, height: 2, margin: "0 4px", marginBottom: 14, background: (isDone || idx < ci) ? v.color : "var(--border)", transition: ".3s", borderRadius: 1 }} />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Acciones */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {next && <button className="abtn" onClick={e => { e.stopPropagation(); advance(r.id, next); }} style={{ padding: "8px 16px", background: `linear-gradient(135deg,${STATUS[next].color},${STATUS[next].color}bb)`, border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: `0 3px 12px ${STATUS[next].color}25` }}>▸ {STATUS[next].icon} {STATUS[next].label}</button>}
                        {r.status === "completed" && <span style={{ padding: "8px 16px", background: "rgba(16,185,129,.06)", borderRadius: 8, border: "1px solid rgba(16,185,129,.15)", color: "#10b981", fontSize: 11, fontWeight: 700 }}>✅ Esperando entrega</span>}
                        <button onClick={e => { e.stopPropagation(); router.push("/messages"); }} style={{ padding: "8px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>💬 Chat</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
