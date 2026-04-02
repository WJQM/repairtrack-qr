"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

type QRType = "track" | "delivery" | "quotation" | "sale" | "code";

function detectQR(text: string): { type: QRType; code: string } {
  const t = text.trim();
  // URLs directas
  if (t.includes("/delivery/")) return { type: "delivery", code: t.split("/delivery/").pop()?.split("?")[0] || t };
  if (t.includes("/track/")) return { type: "track", code: t.split("/track/").pop()?.split("?")[0] || t };
  if (t.includes("/quotations?view=")) { const id = t.split("view=").pop()?.split("&")[0] || t; return { type: id.startsWith("NV") ? "sale" : "quotation", code: id }; }

  const upper = t.toUpperCase();
  // Códigos directos
  if (upper.startsWith("CE-")) return { type: "delivery", code: `OT-${upper.replace("CE-", "")}` };
  if (upper.startsWith("AE-")) return { type: "delivery", code: `OT-${upper.replace("AE-", "")}` }; // compatibilidad
  if (upper.startsWith("COT-")) return { type: "quotation", code: t };
  if (upper.startsWith("NV-")) return { type: "sale", code: t };
  // Por defecto es seguimiento OT
  return { type: "track", code: t };
}

export default function ScannerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "qr-reader";

  useEffect(() => {
    const userData = localStorage.getItem("user"); const token = localStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    setUser(JSON.parse(userData));
    return () => { stopScanner(); };
  }, []);

  const startScanner = async () => {
    setError(""); setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const detected = detectQR(decodedText);
          stopScanner();
          setScanCount(prev => prev + 1);
          navigateTo(detected);
        }, () => {});
    } catch (err: any) {
      setScanning(false);
      if (err?.toString().includes("NotAllowedError")) setError("Permiso de cámara denegado. Permite el acceso en tu navegador.");
      else if (err?.toString().includes("NotFoundError")) setError("No se encontró una cámara. Usa la búsqueda manual.");
      else setError("Error al iniciar la cámara. Intenta con la búsqueda manual.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) { try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {} scannerRef.current = null; }
    setScanning(false);
  };

  const navigateTo = async (detected: { type: QRType; code: string }) => {
    setLoading(true); setError("");

    // COT y NV están en localStorage
    if (detected.type === "quotation" || detected.type === "sale") {
      const quotations = JSON.parse(localStorage.getItem("quotations") || "[]");
      const found = quotations.find((q: any) => q.id === detected.code);
      if (!found) { setError(`No se encontró el documento: ${detected.code}`); setLoading(false); return; }
      setLoading(false);
      window.open(`/quotations/print/${detected.code}`, "_blank");
      return;
    }

    // OT y CE necesitan validar en API
    try {
      const res = await fetch(`/api/track/${detected.code}`);
      if (!res.ok) { setError(`No se encontró ninguna orden con el código: ${detected.code}`); setLoading(false); return; }
    } catch { setError("Error al buscar la orden"); setLoading(false); return; }
    setLoading(false);
    switch (detected.type) {
      case "delivery": window.open(`/delivery/${detected.code}`, "_blank"); break;
      case "track":
      case "code": router.push(`/track/${detected.code}`); break;
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    navigateTo(detectQR(manualCode.trim()));
  };

  if (!user) return null;

  const DOC_TYPES = [
    { prefix: "OT-#", label: "Orden de Trabajo", desc: "Abre la página de seguimiento del equipo", color: "#6366f1", bg: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.1)", icon: "📋" },
    { prefix: "CE-#", label: "Comprobante de Entrega", desc: "Abre el comprobante de entrega al cliente", color: "#10b981", bg: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.1)", icon: "📄" },
    { prefix: "COT-#", label: "Cotización", desc: "Abre el detalle de la cotización", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.1)", icon: "🧾" },
    { prefix: "NV-#", label: "Nota de Venta", desc: "Abre el detalle de la nota de venta", color: "#a855f7", bg: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.1)", icon: "💰" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 200 }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes scanLine { 0% { top: 0; } 100% { top: calc(100% - 3px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        #${scannerContainerId} video { width: 100% !important; height: 100% !important; object-fit: cover !important; border-radius: 12px; }
        #${scannerContainerId} img[alt="Info icon"] { display: none !important; }
        #${scannerContainerId} { position: relative; overflow: hidden; border-radius: 12px; }
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--text-muted); transition: all 0.15s; text-align: left; }
        .sidebar-btn:hover { background: rgba(99,102,241,0.06); color: var(--text-secondary); }
        .sidebar-btn.active { background: rgba(99,102,241,0.12); color: #818cf8; }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
      `}</style>

      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 200, background: "rgba(12,12,18,0.95)", backdropFilter: "blur(20px)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", zIndex: 45, padding: "0 10px" }}>
        <div style={{ padding: "18px 14px 20px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 0 20px rgba(99,102,241,0.2)", flexShrink: 0 }}>🔧</div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.3px" }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 12 }}>QR</span></span>
          </div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflow: "auto", padding: "4px 0" }}>
          {[...(user?.role === "tech" ? [{ label: "Mis Asignaciones", path: "/asignaciones", icon: "📋" }, { label: "Mensajes", path: "/messages", icon: "💬" }, { label: "Escáner", path: "/scanner", icon: "📷" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾" }] : [{ label: "Panel Principal", path: "/dashboard", icon: "📋" }, { label: "Servicios", path: "/services", icon: "🛠️" }, { label: "Inventario", path: "/inventory", icon: "📦" }, { label: "Software", path: "/software", icon: "🎮" }, { label: "Mensajes", path: "/messages", icon: "💬" }, { label: "Escáner", path: "/scanner", icon: "📷" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾" }, { label: "Extracto", path: "/extracto", icon: "📊" }])].map(item => ({ ...item, active: item.path === "/scanner" })).map((item) => (
            <button key={item.path} className={`sidebar-btn${(item as any).active ? " active" : ""}`} onClick={() => router.push(item.path)}>
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


      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>📷 Escáner QR</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Escanea un código QR o busca manualmente por código de documento</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* ═══ CÁMARA ═══ */}
          <div style={{ padding: 28, background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)", animation: "fadeIn 0.4s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📷</div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Cámara</h3>
              {scanCount > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "#10b981", fontWeight: 700 }}>{scanCount} escaneos</span>}
            </div>
            <div style={{ width: "100%", aspectRatio: "1", maxWidth: 280, margin: "0 auto 22px", borderRadius: 16, background: "#000", border: "2px solid var(--border)", position: "relative", overflow: "hidden" }}>
              <div id={scannerContainerId} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, display: scanning ? "block" : "none" }} />
              {!scanning && (<div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--bg-primary)" }}>{[{ top: 16, left: 16 }, { top: 16, right: 16 }, { bottom: 16, left: 16 }, { bottom: 16, right: 16 }].map((pos, i) => (<div key={i} style={{ position: "absolute", width: 28, height: 28, ...pos, borderTop: "top" in pos ? "3px solid #6366f1" : "none", borderBottom: "bottom" in pos ? "3px solid #6366f1" : "none", borderLeft: "left" in pos ? "3px solid #6366f1" : "none", borderRight: "right" in pos ? "3px solid #6366f1" : "none", borderRadius: 4, opacity: 0.6 } as React.CSSProperties} />))}<div style={{ fontSize: 36, opacity: 0.3 }}>📷</div><p style={{ fontSize: 12, color: "var(--text-muted)" }}>Listo para escanear</p></div>)}
              {scanning && (<div style={{ position: "absolute", left: "10%", right: "10%", height: 3, borderRadius: 2, background: "linear-gradient(90deg, transparent, #6366f1, transparent)", boxShadow: "0 0 15px #6366f1", animation: "scanLine 2s ease-in-out infinite", top: 0, zIndex: 10 }} />)}
            </div>
            {!scanning ? (<button onClick={startScanner} style={{ width: "100%", padding: 14, background: "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>📷 Iniciar Escáner</button>) : (<button onClick={stopScanner} style={{ width: "100%", padding: 14, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, color: "#ef4444", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>⏹ Detener</button>)}
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>Apunta la cámara al código QR. Se detecta automáticamente el tipo de documento.</p>
          </div>

          {/* ═══ BÚSQUEDA MANUAL ═══ */}
          <div style={{ padding: 28, background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)", animation: "fadeIn 0.4s ease-out 0.1s both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🔍</div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Búsqueda Manual</h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18, lineHeight: 1.6 }}>Ingresa el código según el documento que necesitas consultar.</p>
            <form onSubmit={handleManualSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", background: "var(--bg-tertiary)", borderRadius: 12, border: "1px solid var(--border)", padding: "0 14px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13, marginRight: 8 }}>🔍</span>
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="OT-1, CE-1, COT-1, NV-1..." style={{ flex: 1, border: "none", background: "none", padding: "13px 0", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "monospace", fontWeight: 600 }} />
              </div>
              <button type="submit" disabled={loading} style={{ padding: "13px 22px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.25)" }}>{loading ? "..." : "Buscar"}</button>
            </form>

            {error && (<div style={{ padding: 16, background: "rgba(239,68,68,0.06)", borderRadius: 14, border: "1px solid rgba(239,68,68,0.12)", marginBottom: 16, animation: "fadeScale 0.3s ease-out" }}><p style={{ fontSize: 13, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>⚠️ {error}</p></div>)}
            {loading && (<div style={{ padding: 20, textAlign: "center" }}><div style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: "pulse 0.8s ease-in-out infinite" }} /><p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Verificando documento...</p></div>)}

            {!error && !loading && (
              <div>
                <div style={{ padding: "16px 18px", background: "var(--bg-tertiary)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>📋 Códigos de Documentos</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {DOC_TYPES.map((doc) => (
                      <div key={doc.prefix} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, border: `1px solid ${doc.borderColor}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: doc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{doc.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: doc.color, background: `${doc.color}12`, padding: "2px 10px", borderRadius: 6 }}>{doc.prefix}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{doc.label}</span>
                          </div>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{doc.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "12px 16px", background: "rgba(99,102,241,0.04)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><span style={{ fontSize: 13 }}>💡</span><span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8" }}>Ejemplo para la orden #1</span></div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      { code: "OT-1", label: "Seguimiento", color: "#6366f1" },
                      { code: "CE-1", label: "Entrega", color: "#10b981" },
                    ].map((ex) => (
                      <span key={ex.code} style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: `${ex.color}12`, color: ex.color, border: `1px solid ${ex.color}20` }}>{ex.code} → {ex.label}</span>
                    ))}
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