"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User { id: string; name: string; email: string; role: string; }
interface Repair {
  id: string; code: string; device: string; brand: string | null; model: string | null;
  issue: string; status: string; priority: string; estimatedCost: number;
  notes: string | null; image: string | null; accessories: string | null;
  clientName: string | null; clientPhone: string | null; clientEmail: string | null;
  qrCode: string; createdAt: string; updatedAt: string;
}

const STATUS: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b", icon: "⏳" },
  diagnosed: { label: "Diagnosticado", color: "#8b5cf6", icon: "🔍" },
  waiting_parts: { label: "Esperando Repuestos", color: "#f97316", icon: "📦" },
  in_progress: { label: "En Progreso", color: "#3b82f6", icon: "🔧" },
  completed: { label: "Completado", color: "#10b981", icon: "✅" },
  delivered: { label: "Entregado", color: "#6b7280", icon: "📱" },
};

function parseImages(img: string | null): string[] {
  if (!img) return [];
  try { const p = JSON.parse(img); if (Array.isArray(p)) return p.filter((u: any) => typeof u === "string" && u.length > 0); } catch {}
  return img.trim().length > 0 ? [img] : [];
}

export default function ExtractoPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);

  // Modal de detalle de cliente
  const [viewClient, setViewClient] = useState<{ name: string; phone: string; email: string; repairs: Repair[] } | null>(null);

  // Modal selector de cliente
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    setUser(JSON.parse(userData));
    fetch("/api/repairs", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setRepairs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Filtrar reparaciones
  const filteredRepairs = repairs.filter(r => {
    if (filterStatus === "active" && r.status === "delivered") return false;
    if (filterStatus === "delivered" && r.status !== "delivered") return false;
    return true;
  });

  // Ordenar por número de OT
  const sortedRepairs = [...filteredRepairs].sort((a, b) => {
    const numA = parseInt(a.code.replace(/^OT-/i, ""), 10) || 0;
    const numB = parseInt(b.code.replace(/^OT-/i, ""), 10) || 0;
    return numA - numB;
  });

  // Buscar
  const displayRepairs = sortedRepairs.filter(r => {
    if (searchQuery === "") return true;
    const q = searchQuery.toLowerCase();
    return r.code.toLowerCase().includes(q) || (r.clientName || "").toLowerCase().includes(q) ||
      r.device.toLowerCase().includes(q) || (r.brand || "").toLowerCase().includes(q) ||
      (r.clientPhone || "").includes(q);
  });

  const totalDevices = filteredRepairs.length;
  const totalClients = new Set(filteredRepairs.map(r => (r.clientName || "").toLowerCase())).size;
  const activeDevices = filteredRepairs.filter(r => r.status !== "delivered").length;

  // Lista única de clientes para el picker
  const uniqueClients = (() => {
    const map = new Map<string, { name: string; phone: string; count: number; active: number }>();
    repairs.forEach(r => {
      const key = (r.clientName || "Sin nombre").trim().toLowerCase();
      if (!map.has(key)) map.set(key, { name: r.clientName || "Sin nombre", phone: "", count: 0, active: 0 });
      const c = map.get(key)!;
      c.count++;
      if (r.status !== "delivered") c.active++;
      if (!c.phone && r.clientPhone) c.phone = r.clientPhone;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  })();

  const filteredPickerClients = uniqueClients.filter(c => {
    if (clientSearch === "") return true;
    const q = clientSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  // Ver detalle de un cliente
  const openClientDetail = (clientName: string) => {
    const name = clientName.toLowerCase();
    const clientRepairs = repairs.filter(r => (r.clientName || "").toLowerCase() === name);
    if (clientRepairs.length === 0) return;
    setViewClient({
      name: clientRepairs[0].clientName || "Sin nombre",
      phone: clientRepairs.find(r => r.clientPhone)?.clientPhone || "",
      email: clientRepairs.find(r => r.clientEmail)?.clientEmail || "",
      repairs: clientRepairs.sort((a, b) => {
        const numA = parseInt(a.code.replace(/^OT-/i, ""), 10) || 0;
        const numB = parseInt(b.code.replace(/^OT-/i, ""), 10) || 0;
        return numA - numB;
      }),
    });
  };

  // ═══ IMPRIMIR EXTRACTO DE UN CLIENTE ═══
  const printClientExtracto = (clientName: string) => {
    const name = clientName.toLowerCase();
    const clientRepairs = repairs.filter(r => (r.clientName || "").toLowerCase() === name)
      .sort((a, b) => { const nA = parseInt(a.code.replace(/^OT-/i, ""), 10) || 0; const nB = parseInt(b.code.replace(/^OT-/i, ""), 10) || 0; return nA - nB; });
    if (clientRepairs.length === 0) return;
    const client = clientRepairs[0];
    const today = new Date().toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
    const time = new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });

    const rows = clientRepairs.map((r, idx) => {
      const st = STATUS[r.status] || { label: r.status, color: "#666", icon: "❓" };
      const devName = [r.device, r.brand, r.model].filter(Boolean).join(" ");
      const dateStr = new Date(r.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
      return `<tr style="background:${idx % 2 === 0 ? "#fff" : "#fafafa"}">
        <td style="padding:10px 14px;font-size:11px;border-bottom:1px solid #f0f0f0;color:#888;font-weight:600;text-align:center">${idx + 1}</td>
        <td style="padding:10px 12px;font-size:12px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-weight:700;color:#6366f1">${r.code}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;font-weight:600">${devName}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;color:#555">${r.issue}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;text-align:center"><span style="padding:2px 8px;border-radius:12px;font-size:9px;font-weight:600;color:${st.color};background:${st.color}15">${st.icon} ${st.label}</span></td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;text-align:center;color:#666">${dateStr}</td>
      </tr>`;
    }).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Extracto — ${client.clientName}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111}@media print{@page{size:A4;margin:12mm}.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body>
  <div class="no-print" style="position:fixed;top:0;left:0;right:0;padding:12px 24px;background:#111118;display:flex;justify-content:space-between;align-items:center;z-index:100">
    <span style="color:#eee;font-size:14px;font-weight:600">📋 Extracto — ${client.clientName}</span>
    <div style="display:flex;gap:10px"><button onclick="window.print()" style="padding:8px 20px;background:linear-gradient(135deg,#6366f1,#7c3aed);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">🖨️ Imprimir</button><button onclick="window.close()" style="padding:8px 20px;background:#1e1e2e;border:1px solid #2e2e3e;border-radius:8px;color:#888;font-size:13px;font-weight:600;cursor:pointer">✕ Cerrar</button></div>
  </div>
  <div style="max-width:800px;margin:0 auto;padding:80px 40px 40px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6366f1;padding-bottom:20px;margin-bottom:24px">
      <div><h1 style="font-size:28px;font-weight:800">Repair<span style="color:#6366f1">Track</span><span style="color:#818cf8;font-size:20px">QR</span></h1><p style="font-size:11px;color:#666;margin-top:4px">EXTRACTO DE CLIENTE</p></div>
      <div style="text-align:right"><p style="font-size:11px;color:#666">Fecha: ${today}</p><p style="font-size:11px;color:#666">Hora: ${time}</p></div>
    </div>
    <div style="background:#6366f1;color:#fff;padding:14px 20px;border-radius:8px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
      <h2 style="font-size:16px;font-weight:700">📋 EXTRACTO DE CLIENTE</h2>
      <span style="font-size:12px;font-weight:600;background:rgba(255,255,255,0.2);padding:4px 14px;border-radius:20px">${clientRepairs.length} equipo${clientRepairs.length !== 1 ? "s" : ""}</span>
    </div>
    <div style="border:1px solid #e2e2e2;border-radius:10px;overflow:hidden;margin-bottom:24px">
      <div style="background:linear-gradient(135deg,#f0f0ff,#f8f7ff);padding:14px 20px;border-bottom:1px solid #d5d5ef">
        <div style="font-size:16px;font-weight:800;color:#111">👤 ${client.clientName || "—"}</div>
        <div style="font-size:12px;color:#666;margin-top:4px">${client.clientPhone ? "📱 " + client.clientPhone : ""}${client.clientEmail ? " · ✉️ " + client.clientEmail : ""}</div>
      </div>
    </div>
    <div style="border:1px solid #e2e2e2;border-radius:10px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f9fafb">
          <th style="padding:10px 14px;text-align:center;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb;width:40px">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">OT</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Equipo</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Problema</th>
          <th style="padding:10px 12px;text-align:center;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Estado</th>
          <th style="padding:10px 12px;text-align:center;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Fecha</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="text-align:center;padding-top:16px;border-top:1px solid #e2e2e2;margin-top:20px"><p style="font-size:10px;color:#999">RepairTrackQR — Extracto de ${client.clientName} — ${today} ${time}</p></div>
  </div>
</body></html>`);
    w.document.close();
  };

  // ═══ IMPRIMIR EXTRACTO GENERAL ═══
  const printExtractoGeneral = () => {
    const today = new Date().toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
    const time = new Date().toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
    const allRepairs = displayRepairs;

    const rows = allRepairs.map((r, idx) => {
      const st = STATUS[r.status] || { label: r.status, color: "#666", icon: "❓" };
      const devName = [r.device, r.brand, r.model].filter(Boolean).join(" ");
      const dateStr = new Date(r.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" });
      return `<tr style="background:${idx % 2 === 0 ? "#fff" : "#fafafa"}">
        <td style="padding:10px 14px;font-size:11px;border-bottom:1px solid #f0f0f0;color:#888;font-weight:600;text-align:center">${idx + 1}</td>
        <td style="padding:10px 12px;font-size:12px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-weight:700;color:#6366f1">${r.code}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;font-weight:600">${devName}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;font-weight:600">${r.clientName || "—"}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;color:#555">${r.clientPhone || "—"}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;color:#555">${r.issue}</td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;text-align:center"><span style="padding:2px 8px;border-radius:12px;font-size:9px;font-weight:600;color:${st.color};background:${st.color}15">${st.icon} ${st.label}</span></td>
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid #f0f0f0;text-align:center;color:#666">${dateStr}</td>
      </tr>`;
    }).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Extracto General</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111}@media print{@page{size:A4 landscape;margin:10mm}.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body>
  <div class="no-print" style="position:fixed;top:0;left:0;right:0;padding:12px 24px;background:#111118;display:flex;justify-content:space-between;align-items:center;z-index:100">
    <span style="color:#eee;font-size:14px;font-weight:600">📊 Extracto General</span>
    <div style="display:flex;gap:10px"><button onclick="window.print()" style="padding:8px 20px;background:linear-gradient(135deg,#6366f1,#7c3aed);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">🖨️ Imprimir</button><button onclick="window.close()" style="padding:8px 20px;background:#1e1e2e;border:1px solid #2e2e3e;border-radius:8px;color:#888;font-size:13px;font-weight:600;cursor:pointer">✕ Cerrar</button></div>
  </div>
  <div style="max-width:1100px;margin:0 auto;padding:80px 30px 40px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6366f1;padding-bottom:20px;margin-bottom:24px">
      <div><h1 style="font-size:28px;font-weight:800">Repair<span style="color:#6366f1">Track</span><span style="color:#818cf8;font-size:20px">QR</span></h1><p style="font-size:11px;color:#666;margin-top:4px">EXTRACTO GENERAL DE EQUIPOS</p></div>
      <div style="text-align:right"><p style="font-size:11px;color:#666">Fecha: ${today}</p><p style="font-size:11px;color:#666">Hora: ${time}</p></div>
    </div>
    <div style="background:#6366f1;color:#fff;padding:14px 20px;border-radius:8px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
      <h2 style="font-size:16px;font-weight:700">📊 LISTADO GENERAL DE EQUIPOS</h2>
      <span style="font-size:12px;font-weight:600;background:rgba(255,255,255,0.2);padding:4px 14px;border-radius:20px">${allRepairs.length} equipo${allRepairs.length !== 1 ? "s" : ""} · ${allRepairs.filter(r => r.status !== "delivered").length} en taller</span>
    </div>
    <div style="border:1px solid #e2e2e2;border-radius:10px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f9fafb">
          <th style="padding:10px 14px;text-align:center;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb;width:40px">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">OT</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Equipo</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Cliente</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Celular</th>
          <th style="padding:10px 12px;text-align:left;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Problema</th>
          <th style="padding:10px 12px;text-align:center;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Estado</th>
          <th style="padding:10px 12px;text-align:center;font-size:9px;font-weight:700;color:#888;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Fecha</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="text-align:center;padding-top:16px;border-top:1px solid #e2e2e2;margin-top:20px"><p style="font-size:10px;color:#999">RepairTrackQR — Extracto General — ${today} ${time}</p></div>
  </div>
</body></html>`);
    w.document.close();
  };

  if (!user) return null;
  if (user.role !== "admin") { router.push("/dashboard"); return null; }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 200 }}>
      {toast && <div style={{ position: "fixed", top: 24, right: 24, padding: "14px 24px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(16,185,129,0.3)", zIndex: 200, animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>{toast}</div>}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .sidebar-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; color: var(--text-muted); transition: all 0.15s; text-align: left; }
        .sidebar-btn:hover { background: rgba(99,102,241,0.06); color: var(--text-secondary); }
        .sidebar-btn.active { background: rgba(99,102,241,0.12); color: #818cf8; }
        .sidebar-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .row-hover:hover { background: rgba(99,102,241,0.03) !important; }
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
          {[{ label: "Panel Principal", path: "/dashboard", icon: "📋", r: "all" }, { label: "Servicios", path: "/services", icon: "🛠️", r: "admin" }, { label: "Inventario", path: "/inventory", icon: "📦", r: "admin" }, { label: "Software", path: "/software", icon: "🎮", r: "admin" }, { label: "Mensajes", path: "/messages", icon: "💬", r: "all" }, { label: "Escáner", path: "/scanner", icon: "📷", r: "all" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾", r: "all" }, { label: "Extracto", path: "/extracto", icon: "📊", r: "admin", active: true }].filter((item: any) => item.r === "all" || user?.role === "admin").map((item) => (
            <button key={item.path} className={`sidebar-btn${(item as any).active ? " active" : ""}`} onClick={() => router.push(item.path)}>
              <div className="sidebar-icon" style={{ background: (item as any).active ? "rgba(99,102,241,0.15)" : "transparent" }}>{item.icon}</div>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 6px" }}>
          <div style={{ padding: "14px 10px", marginBottom: 8, background: "rgba(99,102,241,0.04)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.08)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 auto 8px", boxShadow: "0 4px 14px rgba(99,102,241,0.3)", letterSpacing: "-0.5px" }}>
              {user?.name ? user.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() : "?"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, wordBreak: "break-word", marginBottom: 6 }}>{user?.name}</div>
            <div style={{ display: "inline-block", fontSize: 9, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", padding: "3px 10px", borderRadius: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.15)" }}>{user?.role === "tech" ? "🔧 Técnico" : "👤 Admin"}</div>
          </div>
          <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/"); }} style={{ width: "100%", padding: "9px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>🚪 Cerrar Sesión</button>
        </div>
      </aside>

      {/* ═══ MODAL: SELECCIONAR CLIENTE ═══ */}
      {showClientPicker && (
        <div onClick={() => { setShowClientPicker(false); setClientSearch(""); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "80vh", background: "var(--bg-card)", borderRadius: 20, border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeScale 0.3s ease-out", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>👤</div>
                  <div><h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Buscar Cliente</h3><p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>Selecciona para ver e imprimir su extracto</p></div>
                </div>
                <button onClick={() => { setShowClientPicker(false); setClientSearch(""); }} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)", borderRadius: 10, padding: "0 14px", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>🔍</span>
                <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..." autoFocus style={{ flex: 1, border: "none", background: "none", padding: "11px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
                {clientSearch && <span onClick={() => setClientSearch("")} style={{ cursor: "pointer", fontSize: 11, color: "var(--text-muted)" }}>✕</span>}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
              {filteredPickerClients.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No se encontraron clientes</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filteredPickerClients.map((c, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-tertiary)", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.background = "rgba(16,185,129,0.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-tertiary)"; }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>👤</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{c.phone && `📱 ${c.phone} · `}💻 {c.count} equipo{c.count > 1 ? "s" : ""}{c.active > 0 ? ` · 🔧 ${c.active} en taller` : ""}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={(e) => { e.stopPropagation(); openClientDetail(c.name); setShowClientPicker(false); setClientSearch(""); }} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", color: "#6366f1", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>📋 Ver</button>
                        <button onClick={(e) => { e.stopPropagation(); printClientExtracto(c.name); setShowClientPicker(false); setClientSearch(""); }} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", color: "#10b981", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>🖨️ Imprimir</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: DETALLE DE CLIENTE ═══ */}
      {viewClient && (
        <div onClick={() => setViewClient(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 700, maxHeight: "85vh", background: "var(--bg-card)", borderRadius: 20, border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeScale 0.3s ease-out", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "rgba(99,102,241,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{viewClient.name}</h3>
                      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.08)" }}>{viewClient.repairs.length} equipo{viewClient.repairs.length > 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                      {viewClient.phone && <span>📱 {viewClient.phone}</span>}
                      {viewClient.email && <span>✉️ {viewClient.email}</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => setViewClient(null)} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
                {[
                  { label: "Total", value: viewClient.repairs.length, color: "#6366f1", bg: "rgba(99,102,241,0.06)" },
                  { label: "En taller", value: viewClient.repairs.filter(r => !["completed", "delivered"].includes(r.status)).length, color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
                  { label: "Completados", value: viewClient.repairs.filter(r => r.status === "completed").length, color: "#10b981", bg: "rgba(16,185,129,0.06)" },
                  { label: "Entregados", value: viewClient.repairs.filter(r => r.status === "delivered").length, color: "#6b7280", bg: "rgba(107,114,128,0.06)" },
                ].map((s, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: s.bg, border: `1px solid ${s.color}15`, textAlign: "center" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: s.color, textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {viewClient.repairs.map((r, ri) => {
                  const st = STATUS[r.status] || { label: r.status, color: "#666", icon: "❓" };
                  const devName = [r.device, r.brand, r.model].filter(Boolean).join(" ");
                  const firstImage = parseImages(r.image)[0] || null;
                  const dateStr = new Date(r.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" });
                  return (
                    <div key={r.id} style={{ padding: "14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-tertiary)", animation: `fadeIn 0.25s ease-out ${ri * 0.04}s both` }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        {firstImage ? (
                          <div style={{ width: 50, height: 50, borderRadius: 10, overflow: "hidden", border: `2px solid ${st.color}30`, flexShrink: 0 }}><img src={firstImage} alt={r.device} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                        ) : (
                          <div style={{ width: 50, height: 50, borderRadius: 10, background: `${st.color}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: `2px solid ${st.color}20`, flexShrink: 0 }}>💻</div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.08)", padding: "2px 8px", borderRadius: 6 }}>{r.code}</span>
                            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, color: st.color, background: `${st.color}12`, border: `1px solid ${st.color}20` }}>{st.icon} {st.label}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>💻 {devName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>🔧 {r.issue}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>📅 {dateStr}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>📊 Extracto General de Equipos</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Listado completo de todos los equipos ordenados por OT</p>
        </div>

        {/* ═══ ESTADÍSTICAS ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Clientes", value: totalClients, icon: "👤", color: "#6366f1", gradient: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))" },
            { label: "Equipos Total", value: totalDevices, icon: "💻", color: "#10b981", gradient: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))" },
            { label: "En Taller", value: activeDevices, icon: "🔧", color: "#f59e0b", gradient: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: s.gradient, borderRadius: 16, border: `1px solid ${s.color}15`, position: "relative", overflow: "hidden", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both` }}>
              <div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 8 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ═══ FILTROS ═══ */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 340, display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)", borderRadius: 12, padding: "0 16px", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por OT, cliente, equipo..." style={{ flex: 1, border: "none", background: "none", padding: "12px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
            {searchQuery && <span onClick={() => setSearchQuery("")} style={{ cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>✕</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { key: "all", label: "Todos", icon: "📄", color: "#6366f1" },
              { key: "active", label: "En Taller", icon: "🔧", color: "#f59e0b" },
              { key: "delivered", label: "Entregados", icon: "📱", color: "#6b7280" },
            ].map(f => {
              const isActive = filterStatus === f.key;
              return (<button key={f.key} onClick={() => setFilterStatus(f.key)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: isActive ? `${f.color}15` : "var(--bg-card)", border: isActive ? `1.5px solid ${f.color}40` : "1.5px solid var(--border)", color: isActive ? f.color : "var(--text-muted)" }}><span style={{ fontSize: 13 }}>{f.icon}</span>{f.label}</button>);
            })}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button onClick={() => setShowClientPicker(true)} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.3)", display: "flex", alignItems: "center", gap: 6 }}>👤 Buscar Cliente</button>
            <button onClick={printExtractoGeneral} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.3)", display: "flex", alignItems: "center", gap: 6 }}>🖨️ Imprimir Extracto</button>
          </div>
        </div>

        {/* ═══ TABLA PLANA POR OT ═══ */}
        {loading ? (
          <div style={{ padding: 60, textAlign: "center" }}><p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando datos...</p></div>
        ) : displayRepairs.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 18, border: "1px solid var(--border)" }}><div style={{ fontSize: 48, marginBottom: 16 }}>📊</div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Sin resultados</h3><p style={{ color: "var(--text-muted)", fontSize: 13 }}>No se encontraron equipos con los filtros actuales</p></div>
        ) : (
          <div style={{ background: "var(--bg-card)", borderRadius: 18, border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-tertiary)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", width: 50 }}>#</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>OT</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Equipo</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Cliente</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Celular</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Problema</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Estado</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {displayRepairs.map((r, idx) => {
                  const st = STATUS[r.status] || { label: r.status, color: "#666", icon: "❓" };
                  const devName = [r.device, r.brand, r.model].filter(Boolean).join(" ");
                  return (
                    <tr key={r.id} className="row-hover" style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s", cursor: "pointer" }} onClick={() => openClientDetail(r.clientName || "")}>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#6366f1", background: "rgba(99,102,241,0.08)", padding: "3px 10px", borderRadius: 6 }}>{r.code}</span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600 }}>💻 {devName}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600 }}>👤 {r.clientName || "—"}</td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-muted)" }}>{r.clientPhone || "—"}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🔧 {r.issue}</div>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 600, color: st.color, background: `${st.color}12`, border: `1px solid ${st.color}20` }}>{st.icon} {st.label}</span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(r.createdAt).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
