"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Repair {
  id: string;
  code: string;
  device: string;
  issue: string;
  status: string;
  priority: string;
  estimatedCost: number;
  qrCode: string;
  createdAt: string;
}

const STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b", icon: "⏳" },
  diagnosed: { label: "Diagnosticado", color: "#8b5cf6", icon: "🔍" },
  waiting_parts: { label: "Esperando Repuestos", color: "#f97316", icon: "📦" },
  in_progress: { label: "En Progreso", color: "#3b82f6", icon: "🔧" },
  completed: { label: "Completado", color: "#10b981", icon: "✅" },
  delivered: { label: "Entregado", color: "#6b7280", icon: "📱" },
};

export default function ScannerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<Repair | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "qr-reader";

  useEffect(() => {
    const userData = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    setUser(JSON.parse(userData));
    return () => { stopScanner(); };
  }, []);

  const startScanner = async () => {
    setError(""); setResult(null); setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let code = decodedText;
          if (decodedText.includes("/track/")) code = decodedText.split("/track/").pop() || decodedText;
          stopScanner(); searchRepair(code);
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

  const searchRepair = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`/api/track/${code.trim()}`);
      if (res.ok) setResult(await res.json());
      else setError(`No se encontró ninguna reparación con el código: ${code}`);
    } catch { setError("Error al buscar la reparación"); }
    setLoading(false);
  };

  const handleManualSearch = (e: React.FormEvent) => { e.preventDefault(); searchRepair(manualCode); };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes scanLine { 0% { top: 0; } 100% { top: calc(100% - 3px); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.1); } 50% { box-shadow: 0 0 40px rgba(99,102,241,0.25); } }
      `}</style>

      {/* Header */}
      <header style={{
        padding: "0 28px", height: 64, background: "rgba(12,12,18,0.8)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 0 20px rgba(99,102,241,0.2)" }}>🔧</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 13 }}>QR</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { label: "📋 Dashboard", path: "/dashboard", active: false },
            { label: "💬 Mensajes", path: "/messages", active: false },
            { label: "📷 Escáner", path: "/scanner", active: true },
          ].map((btn) => (
            <button key={btn.path} onClick={() => router.push(btn.path)} style={{
              padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: btn.active ? "rgba(99,102,241,0.12)" : "transparent",
              color: btn.active ? "#818cf8" : "var(--text-muted)",
            }}>{btn.label}</button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>📷 Escáner QR</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>Escanea un código QR o busca manualmente por código de orden</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Camera */}
          <div style={{
            padding: 28, background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)",
            textAlign: "center", animation: "fadeIn 0.4s ease-out",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 22 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📷</div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Cámara</h3>
            </div>

            <div style={{
              width: "100%", aspectRatio: "1", maxWidth: 280, margin: "0 auto 22px", borderRadius: 16,
              background: "var(--bg-primary)", border: "2px solid var(--border)", position: "relative", overflow: "hidden",
            }}>
              <div id={scannerContainerId} style={{ width: "100%", height: "100%", display: scanning ? "block" : "none" }} />

              {!scanning && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {[{ top: 16, left: 16 }, { top: 16, right: 16 }, { bottom: 16, left: 16 }, { bottom: 16, right: 16 }].map((pos, i) => (
                    <div key={i} style={{
                      position: "absolute", width: 28, height: 28, ...pos,
                      borderTop: "top" in pos ? "3px solid #6366f1" : "none",
                      borderBottom: "bottom" in pos ? "3px solid #6366f1" : "none",
                      borderLeft: "left" in pos ? "3px solid #6366f1" : "none",
                      borderRight: "right" in pos ? "3px solid #6366f1" : "none",
                      borderRadius: 4, opacity: 0.6,
                    } as React.CSSProperties} />
                  ))}
                  <div style={{ fontSize: 36, opacity: 0.3 }}>📷</div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Listo para escanear</p>
                </div>
              )}

              {scanning && (
                <div style={{
                  position: "absolute", left: "10%", right: "10%", height: 3, borderRadius: 2,
                  background: "linear-gradient(90deg, transparent, #6366f1, transparent)",
                  boxShadow: "0 0 15px #6366f1", animation: "scanLine 2s ease-in-out infinite", top: 0,
                }} />
              )}
            </div>

            {!scanning ? (
              <button onClick={startScanner} style={{
                width: "100%", padding: 14, background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                border: "none", borderRadius: 14, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
              }}>📷 Iniciar Escáner</button>
            ) : (
              <button onClick={stopScanner} style={{
                width: "100%", padding: 14, background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, color: "#ef4444",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>⏹ Detener Cámara</button>
            )}

            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>
              Apunta la cámara al código QR. Se detectará automáticamente.
            </p>
          </div>

          {/* Manual Search */}
          <div style={{
            padding: 28, background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)",
            animation: "fadeIn 0.4s ease-out 0.1s both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🔍</div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Búsqueda Manual</h3>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 18, lineHeight: 1.6 }}>
              Ingresa el código de la orden para consultar su estado actual.
            </p>

            <form onSubmit={handleManualSearch} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", background: "var(--bg-tertiary)",
                borderRadius: 12, border: "1px solid var(--border)", padding: "0 14px",
              }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13, marginRight: 8 }}>🔍</span>
                <input value={manualCode} onChange={(e) => setManualCode(e.target.value)}
                  placeholder="REP-2026-XXXX"
                  style={{ flex: 1, border: "none", background: "none", padding: "13px 0", color: "var(--text-primary)", fontSize: 14, outline: "none", fontFamily: "monospace", fontWeight: 600 }}
                />
              </div>
              <button type="submit" disabled={loading} style={{
                padding: "13px 22px", background: "linear-gradient(135deg, #10b981, #059669)",
                border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: loading ? "wait" : "pointer",
                boxShadow: "0 4px 12px rgba(16,185,129,0.25)",
              }}>{loading ? "..." : "Buscar"}</button>
            </form>

            {error && (
              <div style={{
                padding: 16, background: "rgba(239,68,68,0.06)", borderRadius: 14,
                border: "1px solid rgba(239,68,68,0.12)", marginBottom: 16, animation: "fadeScale 0.3s ease-out",
              }}>
                <p style={{ fontSize: 13, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>⚠️</span> {error}
                </p>
              </div>
            )}

            {result && (
              <div style={{
                padding: 22, background: "var(--bg-tertiary)", borderRadius: 16,
                border: `1px solid ${(STATUS[result.status] || STATUS.pending).color}25`,
                animation: "fadeScale 0.3s ease-out",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>✓</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981" }}>Orden encontrada</span>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{result.device}</div>
                  <div style={{ fontSize: 12, color: "#6366f1", fontFamily: "monospace", fontWeight: 600 }}>{result.code}</div>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>{result.issue}</p>

                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 12,
                  fontSize: 13, fontWeight: 700, marginBottom: 16,
                  color: (STATUS[result.status] || STATUS.pending).color,
                  background: `${(STATUS[result.status] || STATUS.pending).color}10`,
                  border: `1px solid ${(STATUS[result.status] || STATUS.pending).color}20`,
                }}>
                  {(STATUS[result.status] || STATUS.pending).icon} {(STATUS[result.status] || STATUS.pending).label}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  <div style={{ padding: 10, background: "var(--bg-card)", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Prioridad</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{result.priority}</div>
                  </div>
                  <div style={{ padding: 10, background: "var(--bg-card)", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>Costo</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>Bs. {result.estimatedCost}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => router.push(`/track/${result.code}`)} style={{
                    flex: 1, padding: 12, background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                    border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
                  }}>🔗 Ver Seguimiento</button>
                  <button onClick={() => router.push("/dashboard")} style={{
                    padding: "12px 18px", background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: 12, color: "var(--text-secondary)", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}>📋</button>
                </div>
              </div>
            )}

            {!result && !error && (
              <div style={{
                padding: 20, background: "rgba(99,102,241,0.04)", borderRadius: 14,
                border: "1px solid rgba(99,102,241,0.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>💡</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>Consejo</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  El código tiene el formato <span style={{ fontFamily: "monospace", color: "#6366f1", fontWeight: 600 }}>REP-2026-XXXX</span> y se encuentra en el comprobante o debajo del código QR.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}