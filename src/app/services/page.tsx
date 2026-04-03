"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Service { id: string; name: string; price: number; icon: string; active: boolean; createdAt: string; }

const ICON_OPTIONS = ["🔧", "🔍", "🧹", "💿", "🌡️", "💾", "🧠", "🖥️", "💧", "⌨️", "🔋", "📂", "🛠️", "⚡", "🖨️", "📡", "🔌", "💻", "📱", "🎮"];

export default function ServicesPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("🔧");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadServices = async () => {
    try { const res = await fetch("/api/services"); if (res.ok) setServices(await res.json()); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (!token || !userData) { router.push("/"); return; }
    setUser(JSON.parse(userData));
    loadServices();
  }, []);

  const resetForm = () => { setName(""); setPrice(""); setIcon("🔧"); setEditingId(null); setShowForm(false); };

  const saveService = async () => {
    const token = localStorage.getItem("token"); if (!token) return;
    if (!name.trim() || !price.trim()) { showToast("❌ Nombre y precio son requeridos"); return; }
    try {
      if (editingId) {
        const res = await fetch("/api/services", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: editingId, name, price, icon }) });
        if (res.ok) { showToast("✅ Servicio actualizado"); resetForm(); loadServices(); }
      } else {
        const res = await fetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name, price, icon }) });
        if (res.ok) { showToast("✅ Servicio creado"); resetForm(); loadServices(); }
      }
    } catch { showToast("❌ Error de conexión"); }
  };

  const editService = (svc: Service) => {
    setEditingId(svc.id); setName(svc.name); setPrice(String(svc.price)); setIcon(svc.icon); setShowForm(true);
  };

  const deleteService = async (id: string) => {
    if (!confirm("¿Eliminar este servicio?")) return;
    const token = localStorage.getItem("token"); if (!token) return;
    try {
      const res = await fetch("/api/services", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      if (res.ok) { showToast("🗑️ Servicio eliminado"); loadServices(); }
    } catch {}
  };

  const totalRevenue = services.reduce((sum, s) => sum + s.price, 0);

  if (!user) return null;
  if (user.role !== "admin") { router.push("/dashboard"); return null; }

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 200, paddingTop: 0 }}>
      {toast && <div style={{ position: "fixed", top: 24, right: 24, padding: "14px 24px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(16,185,129,0.3)", zIndex: 100, animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>{toast}</div>}
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--text-muted); transition: all 0.15s; text-align: left; }
        .sidebar-btn:hover { background: rgba(99,102,241,0.06); color: var(--text-secondary); }
        .sidebar-btn.active { background: rgba(99,102,241,0.12); color: #818cf8; }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
      
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

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`sidebar-desktop${menuOpen ? " open" : ""}`} style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 200, transition: "transform 0.3s ease", background: "rgba(12,12,18,0.95)", backdropFilter: "blur(20px)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", zIndex: 45, padding: "0 10px" }}>
        <div style={{ padding: "18px 14px 20px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 0 20px rgba(99,102,241,0.2)", flexShrink: 0 }}>🔧</div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px" }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 12 }}>QR</span></span>
          </div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "auto", padding: "4px 0" }}>
          {[{ label: "Panel Principal", path: "/dashboard", icon: "📋", r: "all" }, { label: "Servicios", path: "/services", icon: "🛠️", r: "admin", active: true }, { label: "Inventario", path: "/inventory", icon: "📦", r: "admin" }, { label: "Software", path: "/software", icon: "🎮", r: "admin" }, { label: "Mensajes", path: "/messages", icon: "💬", r: "all" }, { label: "Escáner", path: "/scanner", icon: "📷", r: "all" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾", r: "all" }, { label: "Extracto", path: "/extracto", icon: "📊", r: "admin" }].filter((item: any) => item.r === "all" || user?.role === "admin").map((item) => (
            <button key={item.path} className={`sidebar-btn${(item as any).active ? " active" : ""}`} onClick={() => { setMenuOpen(false); router.push(item.path); }}>
              <div className="sidebar-icon" style={{ background: (item as any).active ? "rgba(99,102,241,0.15)" : "transparent" }}>{item.icon}</div>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 6px" }}>
          <div style={{ padding: "14px 10px", marginBottom: 8, background: "rgba(99,102,241,0.04)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.08)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 auto 8px", boxShadow: "0 4px 14px rgba(99,102,241,0.3)", letterSpacing: "-0.5px" }}>
              {user?.name ? user.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase() : "?"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, wordBreak: "break-word", marginBottom: 6 }}>{user?.name}</div>
            <div style={{ display: "inline-block", fontSize: 9, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", padding: "3px 10px", borderRadius: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.15)" }}>{user?.role === "tech" ? "🔧 Técnico" : "👤 Admin"}</div>
          </div>
          <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/"); }} style={{ width: "100%", padding: "9px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>🚪 Cerrar Sesión</button>
        </div>
      </aside>


      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(1, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Servicios", value: services.length, icon: "🛠️", color: "#a855f7" },

          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: `linear-gradient(135deg, ${s.color}10, ${s.color}02)`, borderRadius: 16, border: `1px solid ${s.color}15`, animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 8, letterSpacing: "-0.5px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>🛠️ Catálogo de Servicios</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Los servicios aparecerán automáticamente en las órdenes de trabajo</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #a855f7, #7c3aed)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(168,85,247,0.3)" }}>＋ Nuevo Servicio</button>
        </div>

        {showForm && (
          <div style={{ padding: 24, background: "var(--bg-card)", borderRadius: 16, border: "1px solid rgba(168,85,247,0.2)", marginBottom: 24, animation: "fadeScale 0.3s ease-out" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#a855f7" }}>{editingId ? "✏️ Editar Servicio" : "＋ Nuevo Servicio"}</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Selecciona un icono</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ICON_OPTIONS.map(ic => (
                  <div key={ic} onClick={() => setIcon(ic)} style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", border: icon === ic ? "2px solid #a855f7" : "2px solid var(--border)", background: icon === ic ? "rgba(168,85,247,0.15)" : "var(--bg-tertiary)", transition: "all 0.15s" }}>{ic}</div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 14, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Nombre del servicio *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Mantenimiento General" style={{ width: "100%", padding: "12px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Precio (Bs.) *</label>
                <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" type="number" style={{ width: "100%", padding: "12px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveService} style={{ padding: "12px 24px", background: "linear-gradient(135deg, #a855f7, #7c3aed)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 12px rgba(168,85,247,0.3)" }}>{editingId ? "💾 Guardar" : "＋ Crear"}</button>
                <button onClick={resetForm} style={{ padding: "12px 16px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>
        ) : services.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 18, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛠️</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay servicios</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Crea tu primer servicio para el catálogo</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #a855f7, #7c3aed)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Crear Servicio</button>
          </div>
        ) : (
          <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {services.map((svc, i) => (
              <div key={svc.id} style={{ padding: 20, background: "var(--bg-card)", borderRadius: 16, border: "1px solid rgba(168,85,247,0.1)", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, display: "flex", flexDirection: "column", gap: 12, transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(168,85,247,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{svc.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{svc.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#a855f7", marginTop: 2 }}>Bs. {svc.price}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => editService(svc)} style={{ flex: 1, padding: "9px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, color: "#6366f1", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>✏️ Editar</button>
                  <button onClick={() => deleteService(svc.id)} style={{ flex: 1, padding: "9px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>🗑️ Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}