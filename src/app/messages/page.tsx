"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Repair {
  id: string;
  code: string;
  device: string;
  issue: string;
  status: string;
}

interface Message {
  id: string;
  text: string;
  read: boolean;
  createdAt: string;
  user: { id: string; name: string; role: string };
}

const STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b", icon: "⏳" },
  diagnosed: { label: "Diagnosticado", color: "#8b5cf6", icon: "🔍" },
  waiting_parts: { label: "Esperando Repuestos", color: "#f97316", icon: "📦" },
  in_progress: { label: "En Progreso", color: "#3b82f6", icon: "🔧" },
  completed: { label: "Completado", color: "#10b981", icon: "✅" },
  delivered: { label: "Entregado", color: "#6b7280", icon: "📱" },
};

const DEVICE_ICON: Record<string, string> = {
  iPhone: "📱", Mac: "💻", iPad: "📱", Samsung: "📱", Dell: "💻", HP: "💻", Lenovo: "💻",
};

function getDeviceIcon(device: string) {
  for (const key in DEVICE_ICON) {
    if (device.includes(key)) return DEVICE_ICON[key];
  }
  return "🖥️";
}

export default function MessagesPage() {
  const router = useRouter();
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedRepair) return;
    const interval = setInterval(() => loadMessages(selectedRepair.id), 3000);
    return () => clearInterval(interval);
  }, [selectedRepair]);

  const loadRepairs = async (token: string) => {
    try {
      const res = await fetch("/api/repairs", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setRepairs(await res.json());
    } catch {}
  };

  const loadMessages = async (repairId: string) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/messages?repairId=${repairId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMessages(await res.json());
    } catch {}
  };

  const selectRepair = async (repair: Repair) => {
    setSelectedRepair(repair);
    setLoadingMessages(true);
    await loadMessages(repair.id);
    setLoadingMessages(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRepair) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ repairId: selectedRepair.id, text: newMessage.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages([...messages, msg]);
        setNewMessage("");
      }
    } catch {}
  };

  const filteredRepairs = repairs.filter((r) =>
    searchConvo === "" || r.device.toLowerCase().includes(searchConvo.toLowerCase()) || r.code.toLowerCase().includes(searchConvo.toLowerCase())
  );

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes msgIn { from { opacity: 0; transform: scale(0.95) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes typing { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "0 28px", height: 64, background: "rgba(12,12,18,0.8)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
            boxShadow: "0 0 20px rgba(99,102,241,0.2)",
          }}>🔧</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>
            Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 13 }}>QR</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { label: "📋 Dashboard", path: "/dashboard", active: false },
            { label: "💬 Mensajes", path: "/messages", active: true },
            { label: "📷 Escáner", path: "/scanner", active: false },
          ].map((btn) => (
            <button key={btn.path} onClick={() => router.push(btn.path)} style={{
              padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: btn.active ? "rgba(99,102,241,0.12)" : "transparent",
              color: btn.active ? "#818cf8" : "var(--text-muted)",
            }}>{btn.label}</button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "340px 1fr", height: "calc(100vh - 112px)",
          background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)",
          overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        }}>
          {/* Left: Conversations */}
          <div style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            {/* Search */}
            <div style={{ padding: "18px 18px 14px" }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>💬 Mensajes</h2>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)",
                borderRadius: 10, padding: "0 12px", border: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>🔍</span>
                <input value={searchConvo} onChange={(e) => setSearchConvo(e.target.value)}
                  placeholder="Buscar conversación..."
                  style={{ flex: 1, border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {filteredRepairs.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No hay conversaciones
                </div>
              ) : filteredRepairs.map((repair, i) => {
                const isSelected = selectedRepair?.id === repair.id;
                const st = STATUS[repair.status] || STATUS.pending;
                return (
                  <div key={repair.id} onClick={() => selectRepair(repair)} style={{
                    padding: "16px 18px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start",
                    background: isSelected ? "rgba(99,102,241,0.06)" : "transparent",
                    borderLeft: isSelected ? "3px solid #6366f1" : "3px solid transparent",
                    borderBottom: "1px solid var(--border-light)", transition: "all 0.15s",
                    animation: `fadeIn 0.3s ease-out ${i * 0.03}s both`,
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, background: st.bg || "var(--bg-tertiary)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                      border: `1px solid ${st.color}15`, flexShrink: 0,
                    }}>{getDeviceIcon(repair.device)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? "#818cf8" : "var(--text-primary)" }}>{repair.device}</span>
                        <span style={{ fontSize: 10, color: st.color, background: `${st.color}12`, padding: "2px 7px", borderRadius: 8, fontWeight: 600 }}>{st.icon}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#6366f1", fontFamily: "monospace", marginBottom: 3 }}>{repair.code}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{repair.issue}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Chat */}
          <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
            {selectedRepair ? (
              <>
                {/* Chat Header */}
                <div style={{
                  padding: "16px 24px", background: "rgba(12,12,18,0.6)", backdropFilter: "blur(10px)",
                  borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: `${(STATUS[selectedRepair.status] || STATUS.pending).color}10`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                      border: `1px solid ${(STATUS[selectedRepair.status] || STATUS.pending).color}20`,
                    }}>{getDeviceIcon(selectedRepair.device)}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedRepair.device}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "monospace" }}>{selectedRepair.code}</span>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-muted)" }} />
                        <span style={{ color: (STATUS[selectedRepair.status] || STATUS.pending).color }}>
                          {(STATUS[selectedRepair.status] || STATUS.pending).label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => router.push(`/track/${selectedRepair.code}`)} style={{
                    padding: "7px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)",
                    borderRadius: 8, color: "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>🔗 Ver tracking</button>
                </div>

                {/* Messages Area */}
                <div style={{ flex: 1, overflow: "auto", padding: "24px 24px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {loadingMessages ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 24, animation: "typing 1s infinite" }}>💬</div>
                        <p style={{ fontSize: 13, marginTop: 8 }}>Cargando mensajes...</p>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ textAlign: "center", color: "var(--text-muted)", maxWidth: 280 }}>
                        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>💬</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>Sin mensajes</h3>
                        <p style={{ fontSize: 13, lineHeight: 1.5 }}>Envía el primer mensaje sobre esta reparación</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Date separator */}
                      <div style={{ textAlign: "center", margin: "8px 0 16px" }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-card)", padding: "4px 14px", borderRadius: 10 }}>
                          {new Date(messages[0]?.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {messages.map((msg, i) => {
                        const isOwn = msg.user.id === user?.id;
                        return (
                          <div key={msg.id} style={{
                            display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start",
                            animation: `msgIn 0.3s ease-out ${i * 0.02}s both`,
                          }}>
                            <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                              {!isOwn && (
                                <div style={{ fontSize: 11, fontWeight: 600, color: "#818cf8", marginBottom: 4, marginLeft: 12, display: "flex", alignItems: "center", gap: 4 }}>
                                  {msg.user.name}
                                  <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 400 }}>
                                    {msg.user.role === "tech" ? "· Técnico" : "· Cliente"}
                                  </span>
                                </div>
                              )}
                              <div style={{
                                padding: "12px 18px",
                                background: isOwn ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "var(--bg-card)",
                                borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                color: isOwn ? "#fff" : "var(--text-primary)",
                                border: isOwn ? "none" : "1px solid var(--border)",
                                boxShadow: isOwn ? "0 4px 12px rgba(99,102,241,0.2)" : "none",
                              }}>
                                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{msg.text}</div>
                              </div>
                              <div style={{
                                fontSize: 10, color: "var(--text-muted)", marginTop: 4,
                                marginRight: isOwn ? 4 : 0, marginLeft: isOwn ? 0 : 4,
                              }}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{
                  padding: "16px 24px", borderTop: "1px solid var(--border)",
                  background: "rgba(12,12,18,0.6)", backdropFilter: "blur(10px)",
                }}>
                  <div style={{
                    display: "flex", gap: 10, alignItems: "flex-end",
                    background: "var(--bg-card)", borderRadius: 16, padding: "6px 6px 6px 18px",
                    border: "1px solid var(--border)",
                  }}>
                    <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Escribe un mensaje..."
                      style={{ flex: 1, border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                    />
                    <button onClick={sendMessage} style={{
                      width: 42, height: 42, borderRadius: 12, border: "none", cursor: "pointer",
                      background: newMessage.trim() ? "linear-gradient(135deg, #6366f1, #7c3aed)" : "var(--bg-tertiary)",
                      color: newMessage.trim() ? "#fff" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                      boxShadow: newMessage.trim() ? "0 4px 12px rgba(99,102,241,0.25)" : "none",
                      transition: "all 0.2s",
                    }}>➤</button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "var(--text-muted)", maxWidth: 300 }}>
                  <div style={{ fontSize: 56, marginBottom: 20, opacity: 0.4 }}>💬</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8 }}>Mensajería</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}>Selecciona una reparación de la lista para enviar o ver mensajes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}