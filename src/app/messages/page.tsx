"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface User { id: string; name: string; email: string; role: string; }
interface Repair { id: string; code: string; device: string; brand: string | null; model: string | null; issue: string; status: string; clientName: string | null; clientPhone: string | null; estimatedCost: number; createdAt: string; }
interface Message { id: string; text: string; read: boolean; createdAt: string; user: { id: string; name: string; role: string }; }

const STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b", icon: "⏳" },
  diagnosed: { label: "Diagnosticado", color: "#8b5cf6", icon: "🔍" },
  waiting_parts: { label: "Esperando Repuestos", color: "#f97316", icon: "📦" },
  in_progress: { label: "En Progreso", color: "#3b82f6", icon: "🔧" },
  completed: { label: "Completado", color: "#10b981", icon: "✅" },
  delivered: { label: "Entregado", color: "#6b7280", icon: "📱" },
};

export default function MessagesPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchConvo, setSearchConvo] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    setUser(JSON.parse(userData));
    loadRepairs(token);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (!selectedRepair) return; const interval = setInterval(() => loadMessages(selectedRepair.id), 3000); return () => clearInterval(interval); }, [selectedRepair]);

  const loadRepairs = async (token: string) => { try { const res = await fetch("/api/repairs", { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setRepairs(await res.json()); } catch {} };
  const loadMessages = async (repairId: string) => { const token = localStorage.getItem("token"); try { const res = await fetch(`/api/messages?repairId=${repairId}`, { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setMessages(await res.json()); } catch {} };
  const selectRepair = async (repair: Repair) => { setSelectedRepair(repair); setLoadingMessages(true); await loadMessages(repair.id); setLoadingMessages(false); };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRepair) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ repairId: selectedRepair.id, text: newMessage.trim() }) });
      if (res.ok) { const msg = await res.json(); setMessages([...messages, msg]); setNewMessage(""); }
    } catch {}
  };

  const filteredRepairs = repairs.filter((r) =>
    searchConvo === "" || r.device.toLowerCase().includes(searchConvo.toLowerCase()) || r.code.toLowerCase().includes(searchConvo.toLowerCase()) || (r.clientName || "").toLowerCase().includes(searchConvo.toLowerCase()) || (r.brand || "").toLowerCase().includes(searchConvo.toLowerCase())
  );

  if (!user) return null;

  const selectedSt = selectedRepair ? (STATUS[selectedRepair.status] || STATUS.pending) : null;
  const selectedDeviceName = selectedRepair ? [selectedRepair.device, selectedRepair.brand, selectedRepair.model].filter(Boolean).join(" ") : "";

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 200, paddingTop: 0 }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes msgIn { from { opacity: 0; transform: scale(0.95) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--text-muted); transition: all 0.15s; text-align: left; }
        .sidebar-btn:hover { background: rgba(99,102,241,0.06); color: var(--text-secondary); }
        .sidebar-btn.active { background: rgba(99,102,241,0.12); color: #818cf8; }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
      
        @media(max-width:1024px){
          .sidebar-desktop{transform:translateX(-100%)!important}
          .sidebar-desktop.open{transform:translateX(0)!important}
          .main-content{padding-left:0!important;margin-left:0!important;padding-top:56px!important}
          .mobile-header{display:flex!important}
          .sidebar-overlay{display:block!important}
          [style*="grid-template-columns"]{grid-template-columns:1fr!important}
          .stats-grid{grid-template-columns:repeat(2,1fr)!important}
          .card-compact{flex-direction:column!important}
          .card-img{width:100%!important;min-height:160px!important;max-height:200px!important}
          .card-compact p{max-width:100%!important}
          .msg-layout{grid-template-columns:1fr!important}
          .filter-btns{overflow-x:auto;-webkit-overflow-scrolling:touch}
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
          {[...(user?.role === "tech" ? [{ label: "Mis Asignaciones", path: "/asignaciones", icon: "📋" }, { label: "Mensajes", path: "/messages", icon: "💬" }, { label: "Escáner", path: "/scanner", icon: "📷" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾" }] : [{ label: "Panel Principal", path: "/dashboard", icon: "📋" }, { label: "Servicios", path: "/services", icon: "🛠️" }, { label: "Inventario", path: "/inventory", icon: "📦" }, { label: "Software", path: "/software", icon: "🎮" }, { label: "Mensajes", path: "/messages", icon: "💬" }, { label: "Escáner", path: "/scanner", icon: "📷" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾" }, { label: "Extracto", path: "/extracto", icon: "📊" }])].map(item => ({ ...item, active: item.path === "/messages" })).map((item) => (
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


      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px" }}>
        <div className="msg-layout" style={{ display: "grid", gridTemplateColumns: "360px 1fr", height: "calc(100vh - 112px)", background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>

          {/* Left: Conversations */}
          <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 18px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>💬 Mensajes</h2>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 10, background: "rgba(99,102,241,0.1)", color: "#818cf8", fontWeight: 700 }}>{repairs.length}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)", borderRadius: 10, padding: "0 12px", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>🔍</span>
                <input value={searchConvo} onChange={(e) => setSearchConvo(e.target.value)} placeholder="Buscar por cliente, código, equipo..." style={{ flex: 1, border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
                {searchConvo && <span onClick={() => setSearchConvo("")} style={{ cursor: "pointer", fontSize: 11, color: "var(--text-muted)" }}>✕</span>}
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto" }}>
              {filteredRepairs.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No hay conversaciones</div>
              ) : filteredRepairs.map((repair, i) => {
                const isSelected = selectedRepair?.id === repair.id;
                const st = STATUS[repair.status] || STATUS.pending;
                const devName = [repair.device, repair.brand, repair.model].filter(Boolean).join(" ");
                return (
                  <div key={repair.id} onClick={() => selectRepair(repair)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start", background: isSelected ? "rgba(99,102,241,0.06)" : "transparent", borderLeft: isSelected ? "3px solid #6366f1" : "3px solid transparent", borderBottom: "1px solid var(--border-light)", transition: "all 0.15s", animation: `fadeIn 0.3s ease-out ${i * 0.03}s both` }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${st.color}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: `1px solid ${st.color}20`, flexShrink: 0 }}>
                      {st.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#818cf8" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {repair.clientName || "Sin nombre"}
                        </span>
                        <span style={{ fontSize: 9, color: st.color, background: `${st.color}12`, padding: "2px 7px", borderRadius: 8, fontWeight: 600, flexShrink: 0 }}>{st.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: "#6366f1", fontFamily: "monospace", fontWeight: 700, background: "rgba(99,102,241,0.08)", padding: "1px 6px", borderRadius: 4 }}>{repair.code}</span>
                        {repair.clientPhone && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>📱 {repair.clientPhone}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💻 {devName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Chat */}
          <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
            {selectedRepair && selectedSt ? (
              <>
                {/* Chat Header */}
                <div style={{ padding: "14px 24px", background: "rgba(12,12,18,0.6)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${selectedSt.color}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: `1px solid ${selectedSt.color}20` }}>{selectedSt.icon}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedRepair.clientName || "Sin nombre"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <span style={{ fontFamily: "monospace", color: "#6366f1", fontWeight: 600 }}>{selectedRepair.code}</span>
                          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-muted)" }} />
                          <span style={{ color: selectedSt.color }}>{selectedSt.label}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => router.push(`/track/${selectedRepair.code}`)} style={{ padding: "7px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🔗 Ver OT</button>
                  </div>
                  {/* Info bar */}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-secondary)", fontWeight: 600 }}>💻 {selectedDeviceName}</span>
                    {selectedRepair.clientPhone && <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-muted)", fontWeight: 600 }}>📱 {selectedRepair.clientPhone}</span>}
                    <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-muted)", fontWeight: 600 }}>💰 Bs. {selectedRepair.estimatedCost}</span>
                  </div>
                </div>

                {/* Messages Area */}
                <div style={{ flex: 1, overflow: "auto", padding: "24px 24px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {loadingMessages ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ textAlign: "center", color: "var(--text-muted)" }}><div style={{ fontSize: 24, animation: "typing 1s infinite" }}>💬</div><p style={{ fontSize: 13, marginTop: 8 }}>Cargando mensajes...</p></div></div>
                  ) : messages.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ textAlign: "center", color: "var(--text-muted)", maxWidth: 300 }}>
                        <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>💬</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>Sin mensajes</h3>
                        <p style={{ fontSize: 13, lineHeight: 1.5 }}>Envía el primer mensaje sobre la orden <span style={{ color: "#6366f1", fontFamily: "monospace", fontWeight: 700 }}>{selectedRepair.code}</span></p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ textAlign: "center", margin: "8px 0 16px" }}><span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-card)", padding: "4px 14px", borderRadius: 10 }}>{new Date(messages[0]?.createdAt).toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" })}</span></div>
                      {messages.map((msg, i) => {
                        const isOwn = msg.user.id === user?.id;
                        return (
                          <div key={msg.id} style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", animation: `msgIn 0.3s ease-out ${i * 0.02}s both` }}>
                            <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                              {!isOwn && <div style={{ fontSize: 11, fontWeight: 600, color: "#818cf8", marginBottom: 4, marginLeft: 12, display: "flex", alignItems: "center", gap: 4 }}>{msg.user.name}<span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 400 }}>{msg.user.role === "tech" ? "· Técnico" : msg.user.role === "admin" ? "· Admin" : "· Cliente"}</span></div>}
                              <div style={{ padding: "12px 18px", background: isOwn ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "var(--bg-card)", borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px", color: isOwn ? "#fff" : "var(--text-primary)", border: isOwn ? "none" : "1px solid var(--border)", boxShadow: isOwn ? "0 4px 12px rgba(99,102,241,0.2)" : "none" }}>
                                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{msg.text}</div>
                              </div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, marginRight: isOwn ? 4 : 0, marginLeft: isOwn ? 0 : 4 }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", background: "rgba(12,12,18,0.6)", backdropFilter: "blur(10px)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "var(--bg-card)", borderRadius: 16, padding: "6px 6px 6px 18px", border: "1px solid var(--border)" }}>
                    <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} placeholder="Escribe un mensaje..." style={{ flex: 1, border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
                    <button onClick={sendMessage} style={{ width: 42, height: 42, borderRadius: 12, border: "none", cursor: "pointer", background: newMessage.trim() ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "var(--bg-tertiary)", color: newMessage.trim() ? "#fff" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: newMessage.trim() ? "0 4px 12px rgba(99,102,241,0.25)" : "none", transition: "all 0.2s" }}>➤</button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "var(--text-muted)", maxWidth: 320 }}>
                  <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.3 }}>💬</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8 }}>Mensajería</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>Selecciona una orden de la lista para enviar o ver mensajes</p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, padding: "4px 10px", borderRadius: 8, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-muted)" }}>💡 Busca por cliente o código</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}