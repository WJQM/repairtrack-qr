"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

interface Repair {
  id: string;
  code: string;
  device: string;
  brand: string | null;
  model: string | null;
  issue: string;
  status: string;
  priority: string;
  estimatedCost: number;
  notes: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  qrCode: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b", icon: "⏳", desc: "Tu equipo fue recibido y está en cola de revisión." },
  diagnosed: { label: "Diagnosticado", color: "#8b5cf6", icon: "🔍", desc: "El técnico revisó tu equipo e identificó el problema." },
  waiting_parts: { label: "Esperando Repuestos", color: "#f97316", icon: "📦", desc: "Se solicitaron los repuestos necesarios para la reparación." },
  in_progress: { label: "En Progreso", color: "#3b82f6", icon: "🔧", desc: "Tu equipo está siendo reparado en este momento." },
  completed: { label: "Completado", color: "#10b981", icon: "✅", desc: "¡La reparación fue completada! Puedes pasar a recoger tu equipo." },
  delivered: { label: "Entregado", color: "#6b7280", icon: "📱", desc: "Tu equipo fue entregado. ¡Gracias por confiar en nosotros!" },
};

export default function TrackPage() {
  const params = useParams();
  const code = params.code as string;
  const [repair, setRepair] = useState<Repair | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (code) loadRepair();
  }, [code]);

  const loadRepair = async () => {
    try {
      const res = await fetch(`/api/track/${code}`);
      if (res.ok) setRepair(await res.json());
      else setNotFound(true);
    } catch { setNotFound(true); }
    setLoading(false);
  };

  const handleClose = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050507", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.95); } }`}</style>
        <div style={{ textAlign: "center", animation: "pulse 1.5s ease-in-out infinite" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <p style={{ color: "#8888a0", fontSize: 15, fontWeight: 500 }}>Buscando reparación...</p>
        </div>
      </div>
    );
  }

  if (notFound || !repair) {
    return (
      <div style={{ minHeight: "100vh", background: "#050507", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div style={{
          textAlign: "center", padding: 48, background: "rgba(17,17,24,0.9)", borderRadius: 24,
          border: "1px solid rgba(239,68,68,0.15)", maxWidth: 420, animation: "fadeUp 0.5s ease-out",
          boxShadow: "0 0 60px rgba(239,68,68,0.05)",
        }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>😔</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#eeeef2", marginBottom: 10 }}>No encontrada</h2>
          <p style={{ color: "#8888a0", fontSize: 14, lineHeight: 1.6 }}>
            No existe ninguna reparación con el código:
          </p>
          <div style={{
            fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#ef4444",
            margin: "12px 0", padding: "10px 20px", background: "rgba(239,68,68,0.06)",
            borderRadius: 10, display: "inline-block",
          }}>{code}</div>
          <p style={{ color: "#555568", fontSize: 13, marginTop: 12 }}>Verifica el código e intenta de nuevo</p>
          <button onClick={handleClose} style={{ marginTop: 20, padding: "10px 24px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, color: "#818cf8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← Volver</button>
        </div>
      </div>
    );
  }

  const status = STATUS[repair.status] || STATUS.pending;
  const statusKeys = Object.keys(STATUS);
  const currentIndex = statusKeys.indexOf(repair.status);
  const progress = ((currentIndex + 1) / statusKeys.length) * 100;
  const deviceName = [repair.brand, repair.model || repair.device].filter(Boolean).join(" ");

  return (
    <div style={{
      minHeight: "100vh", background: "#050507",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        @keyframes progressFill { from { width: 0%; } to { width: ${progress}%; } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 20px ${status.color}20; } 50% { box-shadow: 0 0 40px ${status.color}35; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      {/* Background effects */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "10%", left: "50%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, ${status.color}08, transparent 70%)`, transform: "translateX(-50%)", animation: "pulse 5s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.02, backgroundImage: "linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
      </div>

      <div style={{
        width: "100%", maxWidth: 500, position: "relative", zIndex: 1,
        background: "linear-gradient(180deg, rgba(17,17,24,0.95), rgba(8,8,12,0.98))",
        borderRadius: 28, border: `1px solid ${status.color}15`,
        boxShadow: `0 0 80px ${status.color}06, 0 25px 60px rgba(0,0,0,0.5)`,
        overflow: "hidden",
        opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(24px)",
        transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Top glow line */}
        <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: `linear-gradient(90deg, transparent, ${status.color}50, transparent)` }} />

        {/* Header con botón cerrar */}
        <div style={{
          padding: "28px 28px 24px", textAlign: "center",
          background: `linear-gradient(180deg, ${status.color}08, transparent)`,
          position: "relative",
        }}>
          <button onClick={handleClose} style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#8888a0", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px",
            background: "rgba(99,102,241,0.08)", borderRadius: 20, marginBottom: 14,
            border: "1px solid rgba(99,102,241,0.1)",
          }}>
            <span style={{ fontSize: 12 }}>🔧</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>RepairTrackQR</span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.3px", color: "#eeeef2" }}>Seguimiento de Reparación</h1>
        </div>

        {/* Status Banner */}
        <div style={{
          margin: "0 20px", padding: "24px", borderRadius: 18, textAlign: "center",
          background: `linear-gradient(135deg, ${status.color}10, ${status.color}04)`,
          border: `1px solid ${status.color}20`, animation: "glowPulse 3s ease-in-out infinite",
        }}>
          <div style={{ fontSize: 44, marginBottom: 10, animation: "float 3s ease-in-out infinite" }}>{status.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: status.color, letterSpacing: "-0.3px" }}>{status.label}</div>
          <p style={{ fontSize: 13, color: "#8888a0", marginTop: 8, lineHeight: 1.6, maxWidth: 320, margin: "8px auto 0" }}>{status.desc}</p>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: "20px 28px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#555568", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Progreso</span>
            <span style={{ fontSize: 11, color: status.color, fontWeight: 700 }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(30,30,46,0.8)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${status.color}, ${status.color}cc)`, width: `${progress}%`, animation: "progressFill 1s ease-out", boxShadow: `0 0 10px ${status.color}40` }} />
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: "20px 28px" }}>
          {/* Code */}
          <div style={{
            textAlign: "center", padding: "14px", background: "rgba(22,22,31,0.6)",
            borderRadius: 14, marginBottom: 18, border: "1px solid rgba(30,30,46,0.5)",
          }}>
            <div style={{ fontSize: 10, color: "#555568", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, marginBottom: 6 }}>Código de Orden</div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: "#6366f1", letterSpacing: "2px" }}>{repair.code}</div>
          </div>

          {/* Datos del Cliente */}
          {(repair.clientName || repair.clientPhone || repair.clientEmail) && (
            <div style={{
              padding: "14px 16px", background: "rgba(99,102,241,0.04)", borderRadius: 12,
              borderLeft: "3px solid #6366f1", marginBottom: 14,
            }}>
              <div style={{ fontSize: 10, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginBottom: 8 }}>👤 Datos del Cliente</div>
              {repair.clientName && <div style={{ fontSize: 15, fontWeight: 700, color: "#eeeef2", marginBottom: 4 }}>{repair.clientName}</div>}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {repair.clientPhone && <span style={{ fontSize: 12, color: "#8888a0", display: "flex", alignItems: "center", gap: 4 }}>📱 {repair.clientPhone}</span>}
                {repair.clientEmail && <span style={{ fontSize: 12, color: "#8888a0", display: "flex", alignItems: "center", gap: 4 }}>✉️ {repair.clientEmail}</span>}
              </div>
            </div>
          )}

          {/* Info Grid — sin prioridad, con marca y modelo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[
              { label: "Dispositivo", value: repair.device, icon: "💻" },
              { label: "Marca / Modelo", value: deviceName, icon: "🏷️" },
              { label: "Costo Estimado", value: `Bs. ${repair.estimatedCost}`, icon: "💰" },
              { label: "Fecha de Ingreso", value: new Date(repair.createdAt).toLocaleDateString(), icon: "📅" },
            ].map((item) => (
              <div key={item.label} style={{
                padding: "14px", background: "rgba(22,22,31,0.5)", borderRadius: 12,
                border: "1px solid rgba(30,30,46,0.5)",
              }}>
                <div style={{ fontSize: 10, color: "#555568", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginBottom: 6 }}>
                  {item.icon} {item.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#eeeef2" }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Issue */}
          <div style={{
            padding: "14px 16px", background: "rgba(22,22,31,0.5)", borderRadius: 12,
            borderLeft: `3px solid ${status.color}`, marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, color: "#555568", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginBottom: 6 }}>🔧 Problema Reportado</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#8888a0" }}>{repair.issue}</div>
          </div>

          {repair.notes && (
            <div style={{
              padding: "14px 16px", background: "rgba(245,158,11,0.04)", borderRadius: 12,
              borderLeft: "3px solid #f59e0b", marginBottom: 14,
            }}>
              <div style={{ fontSize: 10, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginBottom: 6 }}>📝 Notas del Técnico</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "#8888a0" }}>{repair.notes}</div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "#555568", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginBottom: 14 }}>Estado Detallado</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(STATUS).map(([key, val], i) => {
                const done = i <= currentIndex;
                const current = i === currentIndex;
                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderRadius: 12,
                    background: current ? `${val.color}08` : "transparent",
                    border: current ? `1px solid ${val.color}15` : "1px solid transparent",
                    transition: "all 0.3s",
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, flexShrink: 0,
                      background: done ? `${val.color}15` : "rgba(22,22,31,0.5)",
                      border: `2px solid ${done ? val.color : "rgba(30,30,46,0.5)"}`,
                      boxShadow: current ? `0 0 12px ${val.color}25` : "none",
                      opacity: done ? 1 : 0.3,
                    }}>
                      {done && i < currentIndex ? "✓" : val.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontSize: 13, fontWeight: current ? 700 : 500,
                        color: done ? "#eeeef2" : "#555568",
                      }}>{val.label}</span>
                    </div>
                    {current && (
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%", background: val.color,
                        boxShadow: `0 0 8px ${val.color}60`, animation: "pulse 2s ease-in-out infinite",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* QR pequeño + botón cerrar */}
          <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
            <div style={{
              display: "inline-block", padding: 12, background: "#fff", borderRadius: 12,
              boxShadow: "0 0 30px rgba(99,102,241,0.1)",
            }}>
              <QRCodeSVG value={`https://repairtrack.com/track/${repair.qrCode}`} size={90} level="H" />
            </div>
            <p style={{ fontSize: 11, color: "#555568", marginTop: 10 }}>Escanea para compartir el seguimiento</p>
          </div>

          {/* Botón cerrar */}
          <button onClick={handleClose} style={{
            width: "100%", padding: "14px", marginTop: 10, background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.15)", borderRadius: 14, color: "#818cf8",
            fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
          }}>
            ← Cerrar Seguimiento
          </button>
        </div>

        {/* Bottom glow */}
        <div style={{ position: "absolute", bottom: 0, left: "25%", right: "25%", height: 1, background: `linear-gradient(90deg, transparent, ${status.color}30, transparent)` }} />
      </div>
    </div>
  );
}