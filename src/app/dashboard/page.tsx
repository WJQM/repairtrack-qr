"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface User { id: string; name: string; email: string; role: string; }
interface Repair { id: string; code: string; device: string; brand: string | null; model: string | null; issue: string; status: string; priority: string; estimatedCost: number; notes: string | null; image: string | null; accessories: string | null; clientName: string | null; clientPhone: string | null; clientEmail: string | null; qrCode: string; createdAt: string; updatedAt: string; }
interface Notification { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; }
interface ServiceItem { id: string; name: string; price: number; icon: string; }

const STATUS: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b", icon: "⏳", bg: "rgba(245,158,11,0.08)" },
  diagnosed: { label: "Diagnosticado", color: "#8b5cf6", icon: "🔍", bg: "rgba(139,92,246,0.08)" },
  waiting_parts: { label: "Esperando Repuestos", color: "#f97316", icon: "📦", bg: "rgba(249,115,22,0.08)" },
  in_progress: { label: "En Progreso", color: "#3b82f6", icon: "🔧", bg: "rgba(59,130,246,0.08)" },
  completed: { label: "Completado", color: "#10b981", icon: "✅", bg: "rgba(16,185,129,0.08)" },
  delivered: { label: "Entregado", color: "#6b7280", icon: "📱", bg: "rgba(107,114,128,0.08)" },
};

const NOTIF_ICONS: Record<string, string> = { status_change: "🔄", new_repair: "🆕", message: "💬", system: "🔐" };

const ACCESSORIES_LIST = ["Cargador", "Batería", "Disco Duro", "Memoria RAM", "Cable de Poder", "Pantalla", "Tornillos", "Maletín/Bolsa", "Otros"];

const ACCESSORIES_HINTS: Record<string, string> = {
  "Cargador": "Ej: 65W, USB-C, modelo...", "Batería": "Ej: 6 celdas, modelo...",
  "Disco Duro": "Ej: 500GB SSD, 1TB HDD...", "Memoria RAM": "Ej: 8GB DDR4, 16GB DDR5...",
  "Cable de Poder": "Ej: 3 pines, tipo...", "Pantalla": "Ej: 15.6\", táctil...",
  "Tornillos": "Ej: completo, incompleto, cantidad...", "Maletín/Bolsa": "Ej: color, tamaño...",
  "Otros": "Especificar qué accesorios...",
};

function parseAccWithDetail(raw: string): { name: string; detail: string } { const match = raw.match(/^(.+?)\s*\((.+)\)$/); if (match) return { name: match[1].trim(), detail: match[2].trim() }; return { name: raw.trim(), detail: "" }; }
function parseAccessoriesFull(json: string | null): { names: string[]; details: Record<string, string> } { if (!json) return { names: [], details: {} }; try { const arr: string[] = JSON.parse(json); const names: string[] = []; const details: Record<string, string> = {}; arr.forEach(raw => { const { name, detail } = parseAccWithDetail(raw); names.push(name); if (detail) details[name] = detail; }); return { names, details }; } catch { return { names: [], details: {} }; } }
function parseAccessoriesDisplay(json: string | null): string[] { if (!json) return []; try { return JSON.parse(json); } catch { return []; } }
function parseImages(imageField: string | null): string[] { if (!imageField) return []; try { const parsed = JSON.parse(imageField); if (Array.isArray(parsed)) return parsed.filter((u: any) => typeof u === "string" && u.length > 0); } catch {} return imageField.trim().length > 0 ? [imageField] : []; }

function parseNotesAndServices(notesField: string | null, svcList: ServiceItem[]): { notes: string; services: string[] } {
  if (!notesField) return { notes: "", services: [] };
  const parts = notesField.split(" | ");
  const svcPart = parts.find(p => p.startsWith("Servicios: "));
  const notesParts = parts.filter(p => !p.startsWith("Servicios: "));
  const services: string[] = [];
  if (svcPart) { svcPart.replace("Servicios: ", "").split(", ").forEach(name => { if (svcList.find(s => s.name === name)) services.push(name); }); }
  return { notes: notesParts.join(" | "), services };
}

function getGreeting(): string { const h = new Date().getHours(); if (h < 12) return "Buenos días"; if (h < 18) return "Buenas tardes"; return "Buenas noches"; }
function formatClock(date: Date): { time: string; period: string } { const h = date.getHours(); const m = String(date.getMinutes()).padStart(2, "0"); const s = String(date.getSeconds()).padStart(2, "0"); const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return { time: `${String(h12).padStart(2, "0")}:${m}:${s}`, period: h >= 12 ? "PM" : "AM" }; }
function formatDate(date: Date): string { return date.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);

  const [editingRepair, setEditingRepair] = useState<Repair | null>(null);
  const [editDevice, setEditDevice] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editIssue, setEditIssue] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editSelectedAccessories, setEditSelectedAccessories] = useState<string[]>([]);
  const [editAccessoryDetails, setEditAccessoryDetails] = useState<Record<string, string>>({});
  const [editSelectedServices, setEditSelectedServices] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState("");
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const toggleEditAcc = (acc: string) => { setEditSelectedAccessories(prev => { if (prev.includes(acc)) { setEditAccessoryDetails(d => { const copy = { ...d }; delete copy[acc]; return copy; }); return prev.filter(a => a !== acc); } return [...prev, acc]; }); };
  const updateEditDetail = (acc: string, detail: string) => { setEditAccessoryDetails(prev => ({ ...prev, [acc]: detail })); };
  const buildEditAccessoriesArray = (): string[] => { return editSelectedAccessories.map(acc => { const detail = editAccessoryDetails[acc]?.trim(); return detail ? `${acc} (${detail})` : acc; }); };
  const toggleEditService = (serviceName: string) => { setEditSelectedServices(prev => { const next = prev.includes(serviceName) ? prev.filter(s => s !== serviceName) : [...prev, serviceName]; const total = next.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0); setEditCost(String(total)); return next; }); };

  const loadRepairs = async (token: string) => { try { const res = await fetch("/api/repairs", { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setRepairs(await res.json()); } catch {} setLoading(false); };
  const loadNotifications = async (token: string) => { try { const res = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setNotifications(await res.json()); } catch {} };
  const markNotificationRead = async (notifId: string) => { const token = localStorage.getItem("token"); if (!token) return; try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ notificationId: notifId }) }); setNotifications(notifications.map((n) => (n.id === notifId ? { ...n, read: true } : n))); } catch {} };
  const markAllRead = async () => { const token = localStorage.getItem("token"); if (!token) return; try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ markAll: true }) }); setNotifications(notifications.map((n) => ({ ...n, read: true }))); } catch {} };
  const clearAllNotifications = async () => { if (!confirm("¿Eliminar todas las notificaciones?")) return; const token = localStorage.getItem("token"); if (!token) return; try { const res = await fetch("/api/notifications", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { setNotifications([]); setShowNotifications(false); showToast("🧹 Notificaciones limpiadas"); } } catch {} };

  useEffect(() => {
    const userData = localStorage.getItem("user"); const token = localStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    setUser(JSON.parse(userData)); loadRepairs(token); loadNotifications(token);

    // Cargar servicios desde API
    fetch("/api/services").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setServicesList(data); }).catch(() => {});

    const savedEdit = sessionStorage.getItem("editFormData");
    if (savedEdit) { try { const data = JSON.parse(savedEdit); setEditingRepair(data.repair); setEditDevice(data.editDevice || ""); setEditBrand(data.editBrand || ""); setEditModel(data.editModel || ""); setEditIssue(data.editIssue || ""); setEditCost(data.editCost || ""); setEditNotes(data.editNotes || ""); setEditClientName(data.editClientName || ""); setEditClientPhone(data.editClientPhone || ""); setEditClientEmail(data.editClientEmail || ""); setEditSelectedAccessories(data.editSelectedAccessories || []); setEditAccessoryDetails(data.editAccessoryDetails || {}); setEditSelectedServices(data.editSelectedServices || []); setEditStatus(data.editStatus || ""); setEditImageUrls(data.editImageUrls || []); setEditImagePreviews(data.editImagePreviews || []); } catch {} sessionStorage.removeItem("editFormData"); }
    const capturedData = sessionStorage.getItem("capturedImage");
    if (capturedData) { try { const { url, preview } = JSON.parse(capturedData); setEditImageUrls(prev => [...prev, url]); setEditImagePreviews(prev => [...prev, preview]); setTimeout(() => showToast("📸 Foto capturada"), 500); } catch {} sessionStorage.removeItem("capturedImage"); }
  }, []);

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { const token = localStorage.getItem("token"); if (!token) return; const interval = setInterval(() => { loadNotifications(token); loadRepairs(token); }, 10000); return () => clearInterval(interval); }, []);
  useEffect(() => { function handleClick(e: MouseEvent) { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false); } document.addEventListener("mousedown", handleClick); return () => document.removeEventListener("mousedown", handleClick); }, []);

  const uploadEditFiles = async (files: FileList) => { setUploading(true); for (let i = 0; i < files.length; i++) { const file = files[i]; const reader = new FileReader(); reader.onload = (ev) => setEditImagePreviews(prev => [...prev, ev.target?.result as string]); reader.readAsDataURL(file); const formData = new FormData(); formData.append("file", file); try { const res = await fetch("/api/upload", { method: "POST", body: formData }); if (res.ok) { const data = await res.json(); setEditImageUrls(prev => [...prev, data.url]); } } catch {} } showToast(`📷 ${files.length} imagen${files.length > 1 ? "es subidas" : " subida"}`); setUploading(false); };
  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files || files.length === 0) return; await uploadEditFiles(files); e.target.value = ""; };
  const handleEditTakePhoto = () => { sessionStorage.setItem("editFormData", JSON.stringify({ repair: editingRepair, editDevice, editBrand, editModel, editIssue, editCost, editNotes, editClientName, editClientPhone, editClientEmail, editSelectedAccessories, editAccessoryDetails, editSelectedServices, editStatus, editImageUrls, editImagePreviews })); sessionStorage.setItem("cameraReturnUrl", "/dashboard"); window.location.href = "/camera.html"; };
  const removeEditImage = (index: number) => { setEditImageUrls(prev => prev.filter((_, i) => i !== index)); setEditImagePreviews(prev => prev.filter((_, i) => i !== index)); };
  const deleteRepair = async (repairId: string) => { const token = localStorage.getItem("token"); try { const res = await fetch(`/api/repairs/${repairId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { setExpandedId(null); showToast("🗑️ Orden eliminada"); if (token) { await loadRepairs(token); loadNotifications(token); } } } catch {} };
  const updateStatus = async (repairId: string, newStatus: string) => { const token = localStorage.getItem("token"); try { const res = await fetch(`/api/repairs/${repairId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) }); if (res.ok) { showToast(`🔄 Estado: ${STATUS[newStatus]?.label}`); if (token) { await loadRepairs(token); loadNotifications(token); } } } catch {} };

  const openEditForm = (repair: Repair) => {
    setEditingRepair(repair); setEditDevice(repair.device); setEditBrand(repair.brand || ""); setEditModel(repair.model || "");
    setEditIssue(repair.issue); setEditCost(String(repair.estimatedCost));
    setEditClientName(repair.clientName || ""); setEditClientPhone(repair.clientPhone || ""); setEditClientEmail(repair.clientEmail || "");
    const { names, details } = parseAccessoriesFull(repair.accessories); setEditSelectedAccessories(names); setEditAccessoryDetails(details);
    const { notes: parsedNotes, services: parsedServices } = parseNotesAndServices(repair.notes, servicesList); setEditNotes(parsedNotes); setEditSelectedServices(parsedServices);
    setEditStatus(repair.status); const imgs = parseImages(repair.image); setEditImageUrls(imgs); setEditImagePreviews(imgs);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingRepair) return; const token = localStorage.getItem("token");
    try {
      const imageData = editImageUrls.length > 0 ? JSON.stringify(editImageUrls) : null; const accArray = buildEditAccessoriesArray();
      const servicesNote = editSelectedServices.length > 0 ? `Servicios: ${editSelectedServices.join(", ")}` : "";
      const finalNotes = [editNotes, servicesNote].filter(Boolean).join(" | ");
      const res = await fetch(`/api/repairs/${editingRepair.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ device: editDevice, brand: editBrand, model: editModel, issue: editIssue, estimatedCost: parseFloat(editCost) || 0, notes: finalNotes || null, clientName: editClientName, clientPhone: editClientPhone, clientEmail: editClientEmail, image: imageData, accessories: accArray.length > 0 ? JSON.stringify(accArray) : null, status: editStatus }) });
      if (res.ok) { setEditingRepair(null); showToast(`✏️ Orden ${editingRepair.code} actualizada`); if (token) { await loadRepairs(token); loadNotifications(token); } }
    } catch {}
  };

  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/"); };
  const filteredRepairs = repairs.filter((r) => { const q = searchQuery.toLowerCase(); const matchSearch = q === "" || r.code.toLowerCase().includes(q) || r.device.toLowerCase().includes(q) || (r.clientName || "").toLowerCase().includes(q) || (r.brand || "").toLowerCase().includes(q); const matchStatus = filterStatus === "all" || r.status === filterStatus; return matchSearch && matchStatus; });
  const stats = { total: repairs.length, pending: repairs.filter((r) => ["pending", "diagnosed", "waiting_parts"].includes(r.status)).length, inProgress: repairs.filter((r) => r.status === "in_progress").length, completed: repairs.filter((r) => ["completed", "delivered"].includes(r.status)).length, revenue: repairs.filter((r) => r.status === "delivered").reduce((sum, r) => sum + r.estimatedCost, 0) };

  if (!user) return null;
  const btnAction: React.CSSProperties = { padding: "9px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
  const clock = formatClock(now);

  const InfoBox = ({ label, value, icon, color = "var(--text-muted)", bg = "var(--bg-tertiary)", span = false }: { label: string; value: string; icon: string; color?: string; bg?: string; span?: boolean }) => (
    <div style={{ padding: "8px 10px", background: bg, borderRadius: 8, ...(span ? { gridColumn: "1 / -1" } : {}) }}>
      <div style={{ fontSize: 9, color, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{icon} {value}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }} suppressHydrationWarning>
      {toast && <div style={{ position: "fixed", top: 24, right: 24, padding: "14px 24px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(16,185,129,0.3)", zIndex: 100, animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>{toast}</div>}
      {viewImage && (<div onClick={() => setViewImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, cursor: "pointer" }}><div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }}><img src={viewImage} alt="Equipo" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} /><button onClick={() => setViewImage(null)} style={{ position: "absolute", top: -16, right: -16, width: 36, height: 36, borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button></div></div>)}

      {/* ═══ MODAL EDITAR ═══ */}
      {editingRepair && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 820, maxHeight: "90vh", overflow: "auto", background: "var(--bg-card)", borderRadius: 20, border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeScale 0.3s ease-out" }}>
            <form onSubmit={saveEdit} style={{ padding: 28, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✏️</div><h3 style={{ fontSize: 16, fontWeight: 700 }}>Editar Orden <span style={{ color: "#6366f1", fontFamily: "monospace" }}>{editingRepair.code}</span></h3></div>
                <button type="button" onClick={() => setEditingRepair(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>

              {/* FOTOS */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>📷 Fotos del equipo</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {editImagePreviews.map((preview, idx) => (<div key={idx} style={{ width: 100, height: 100, borderRadius: 10, overflow: "hidden", position: "relative", border: "2px solid #6366f1", flexShrink: 0 }}><img src={preview} alt={`Foto ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /><button type="button" onClick={() => removeEditImage(idx)} style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>{uploading && idx === editImagePreviews.length - 1 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#fff", fontSize: 10, fontWeight: 600 }}>...</div></div>}</div>))}
                  <div onClick={() => editFileInputRef.current?.click()} style={{ width: 100, height: 100, borderRadius: 10, border: "2px dashed var(--border)", background: "var(--bg-tertiary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}><span style={{ fontSize: 22 }}>＋</span><span style={{ fontSize: 9, color: "var(--text-muted)" }}>Subir foto</span></div>
                  <div onClick={handleEditTakePhoto} style={{ width: 100, height: 100, borderRadius: 10, border: "2px dashed rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.04)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}><span style={{ fontSize: 22 }}>📸</span><span style={{ fontSize: 9, color: "#10b981" }}>Cámara</span></div>
                  <input ref={editFileInputRef} type="file" accept="image/*" multiple onChange={handleEditImageSelect} style={{ display: "none" }} />
                </div>
                {editImagePreviews.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>📷 {editImagePreviews.length} foto{editImagePreviews.length > 1 ? "s" : ""}</div>}
              </div>

              {/* CLIENTE */}
              <div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(99,102,241,0.04)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>👤 Datos del Cliente</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}><FormField label="Nombre" value={editClientName} onChange={setEditClientName} placeholder="Juan Pérez" /><FormField label="Celular" value={editClientPhone} onChange={setEditClientPhone} placeholder="70012345" /><FormField label="Correo" value={editClientEmail} onChange={setEditClientEmail} placeholder="cliente@email.com" /></div>
              </div>

              {/* EQUIPO */}
              <div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(245,158,11,0.04)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>💻 Datos del Equipo</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}><FormField label="Tipo" value={editDevice} onChange={setEditDevice} placeholder="Laptop, PC, Tablet..." /><FormField label="Marca" value={editBrand} onChange={setEditBrand} placeholder="HP, Dell, Lenovo..." /><FormField label="Modelo" value={editModel} onChange={setEditModel} placeholder="Pavilion 15, ThinkPad..." /></div>
              </div>

              {/* ACCESORIOS */}
              <div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(16,185,129,0.04)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>🎒 Accesorios</div>
                <div translate="no" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {ACCESSORIES_LIST.map((acc) => { const checked = editSelectedAccessories.includes(acc); const hint = ACCESSORIES_HINTS[acc]; const hasExtra = !!hint; const detail = editAccessoryDetails[acc] || ""; return (
                    <div key={acc} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      <div onClick={() => toggleEditAcc(acc)} style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderTop: `2px solid ${checked ? "#10b981" : "var(--border)"}`, borderLeft: `2px solid ${checked ? "#10b981" : "var(--border)"}`, borderRight: `2px solid ${checked ? "#10b981" : "var(--border)"}`, borderBottom: checked && hasExtra ? "1px solid rgba(16,185,129,0.2)" : `2px solid ${checked ? "#10b981" : "var(--border)"}`, borderRadius: checked && hasExtra ? "10px 10px 0 0" : 10, background: checked ? "rgba(16,185,129,0.1)" : "var(--bg-tertiary)", userSelect: "none", transition: "all 0.15s" }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: checked ? "none" : "2px solid var(--border)", background: checked ? "#10b981" : "transparent", color: "#fff", fontSize: 11, fontWeight: 800 }}>{checked ? "✓" : ""}</div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: checked ? "#10b981" : "var(--text-muted)" }}>{acc}</span>
                      </div>
                      {checked && hint && (<div style={{ borderRadius: "0 0 10px 10px", borderLeft: "2px solid #10b981", borderRight: "2px solid #10b981", borderBottom: "2px solid #10b981", background: "rgba(16,185,129,0.05)", padding: "6px 8px" }}><input value={detail} onChange={(e) => updateEditDetail(acc, e.target.value)} placeholder={hint} onClick={(e) => e.stopPropagation()} style={{ width: "100%", padding: "5px 7px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 5, color: "var(--text-primary)", fontSize: 10, outline: "none" }} /></div>)}
                    </div>
                  ); })}
                </div>
                {editSelectedAccessories.length > 0 && (<div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>{editSelectedAccessories.map(acc => { const detail = editAccessoryDetails[acc]?.trim(); return <span key={acc} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>{acc}{detail ? ` (${detail})` : ""}</span>; })}</div>)}
              </div>

              {/* PROBLEMA + OBSERVACIONES */}
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={labelStyle}>🔧 Problema reportado</label><textarea value={editIssue} onChange={(e) => setEditIssue(e.target.value)} placeholder="Describe el problema..." rows={4} style={{ ...fieldStyle, resize: "vertical" }} /></div>
                <div><label style={labelStyle}>📋 Observaciones del equipo</label><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Estado físico, detalles visibles..." rows={4} style={{ ...fieldStyle, resize: "vertical" }} /></div>
              </div>

              {/* SERVICIOS (dinámico) */}
              {servicesList.length > 0 && (
                <div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(168,85,247,0.04)", borderRadius: 12, border: "1px solid rgba(168,85,247,0.08)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#a855f7", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>🛠️ Servicios y Costos</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {servicesList.map((svc) => { const active = editSelectedServices.includes(svc.name); return (
                      <div key={svc.id} onClick={() => toggleEditService(svc.name)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none", transition: "all 0.15s", borderTop: `2px solid ${active ? "#a855f7" : "var(--border)"}`, borderLeft: `2px solid ${active ? "#a855f7" : "var(--border)"}`, borderRight: `2px solid ${active ? "#a855f7" : "var(--border)"}`, borderBottom: `2px solid ${active ? "#a855f7" : "var(--border)"}`, background: active ? "rgba(168,85,247,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: active ? "none" : "2px solid var(--border)", background: active ? "#a855f7" : "transparent", color: "#fff", fontSize: 9, fontWeight: 800 }}>{active ? "✓" : ""}</div>
                        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: active ? "#a855f7" : "var(--text-muted)", lineHeight: 1.2 }}>{svc.icon} {svc.name}</div><div style={{ fontSize: 10, fontWeight: 800, color: active ? "#c084fc" : "var(--text-muted)" }}>Bs. {svc.price}</div></div>
                      </div>
                    ); })}
                  </div>
                </div>
              )}

              {/* COSTO + ESTADO + SERVICIOS SELECCIONADOS */}
              <FormField label="Costo Estimado (Bs.)" value={editCost} onChange={setEditCost} placeholder="0.00" type="number" />
              <div><label style={labelStyle}>Estado</label><select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ ...fieldStyle, cursor: "pointer" }}>{Object.entries(STATUS).map(([key, val]) => (<option key={key} value={key}>{val.icon} {val.label}</option>))}</select></div>
              <div>
                <label style={labelStyle}>🛠️ Servicios seleccionados</label>
                {editSelectedServices.length === 0 ? (<div style={{ padding: "10px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>{servicesList.length > 0 ? "Selecciona servicios arriba" : "Agrega servicios en el catálogo"}</div>
                ) : (<div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{editSelectedServices.map(name => { const svc = servicesList.find(s => s.name === name); return (<div key={name} style={{ padding: "4px 8px", background: "rgba(168,85,247,0.06)", borderRadius: 5, border: "1px solid rgba(168,85,247,0.1)" }}><span style={{ fontSize: 10, fontWeight: 600, color: "#a855f7" }}>{svc?.icon} {name}</span></div>); })}</div>)}
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setEditingRepair(null)} style={{ padding: "12px 24px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                <button type="submit" disabled={uploading} style={{ padding: "12px 28px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: uploading ? "wait" : "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>💾 Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <header style={{ padding: "0 28px", height: 64, background: "rgba(12,12,18,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 0 20px rgba(99,102,241,0.2)" }}>🔧</div><span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 13 }}>QR</span></span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[{ label: "📋 Panel Principal", path: "/dashboard", active: true }, { label: "🛠️ Servicios", path: "/services" }, { label: "📦 Inventario", path: "/inventory" }, { label: "💬 Mensajes", path: "/messages" }, { label: "📷 Escáner", path: "/scanner" }].map((btn) => (<button key={btn.path} onClick={() => router.push(btn.path)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: (btn as any).active ? "rgba(99,102,241,0.12)" : "transparent", color: (btn as any).active ? "#818cf8" : "var(--text-muted)" }}>{btn.label}</button>))}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: showNotifications ? "rgba(99,102,241,0.1)" : "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, position: "relative" }}>🔔{unreadCount > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 17, height: 17, background: "#ef4444", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", border: "2px solid var(--bg-secondary)" }}>{unreadCount}</span>}</button>
            {showNotifications && (<div style={{ position: "absolute", top: 46, right: 0, width: 380, maxHeight: 460, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 12px 48px rgba(0,0,0,0.5)", overflow: "hidden", zIndex: 50, animation: "fadeScale 0.2s ease-out" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 700, fontSize: 14 }}>Notificaciones {unreadCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", background: "rgba(239,68,68,0.12)", color: "#ef4444", borderRadius: 10, fontWeight: 600 }}>{unreadCount}</span>}</span><div style={{ display: "flex", gap: 10 }}>{unreadCount > 0 && <button onClick={markAllRead} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>✓ Leídas</button>}{notifications.length > 0 && <button onClick={clearAllNotifications} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>🗑️ Limpiar</button>}</div></div><div style={{ maxHeight: 400, overflow: "auto" }}>{notifications.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}><div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>🔔</div><p style={{ fontSize: 13 }}>Sin notificaciones</p></div> : notifications.map((notif, i) => (<div key={notif.id} onClick={() => markNotificationRead(notif.id)} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", background: notif.read ? "transparent" : "rgba(99,102,241,0.03)", display: "flex", gap: 12, alignItems: "flex-start", animation: `fadeIn 0.2s ease-out ${i * 0.03}s both` }}><span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{NOTIF_ICONS[notif.type] || "📋"}</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: notif.read ? 400 : 600, color: notif.read ? "var(--text-secondary)" : "var(--text-primary)" }}>{notif.title}</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{notif.message}</div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{new Date(notif.createdAt).toLocaleString()}</div></div>{!notif.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", flexShrink: 0, marginTop: 6 }} />}</div>))}</div></div>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 4, padding: "6px 12px 6px 8px", borderRadius: 10, background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}><div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{user?.role === "tech" ? "🔧" : "👤"}</div><span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{user?.name}</span></div>
          <button onClick={logout} style={{ padding: "7px 14px", background: "transparent", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Salir</button>
        </div>
      </header>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }} suppressHydrationWarning>{getGreeting()}, {user?.name?.split(" ")[0]} 👋</h1><p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Aquí está el resumen de tu taller</p></div>
          <div suppressHydrationWarning style={{ textAlign: "center", padding: "10px 18px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "pulse 1s ease-in-out infinite", flexShrink: 0 }} /><span style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: "#6366f1", letterSpacing: "0.5px" }}>{clock.time}</span><span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", padding: "2px 6px", background: "rgba(99,102,241,0.1)", borderRadius: 4 }}>{clock.period}</span></div><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3, textTransform: "capitalize" }}>{formatDate(now)}</div><div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}><span style={{ color: "#6366f1" }}>📍</span> La Paz, Bolivia</div></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 28 }}>
          {[{ label: "Total Órdenes", value: stats.total, icon: "📋", color: "#6366f1", gradient: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))" }, { label: "Pendientes", value: stats.pending, icon: "⏳", color: "#f59e0b", gradient: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))" }, { label: "En Progreso", value: stats.inProgress, icon: "🔧", color: "#3b82f6", gradient: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.02))" }, { label: "Completadas", value: stats.completed, icon: "✅", color: "#10b981", gradient: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))" }, { label: "Ingresos", value: `Bs.${stats.revenue}`, icon: "💰", color: "#a855f7", gradient: "linear-gradient(135deg, rgba(168,85,247,0.1), rgba(168,85,247,0.02))" }].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: s.gradient, borderRadius: 16, border: `1px solid ${s.color}15`, animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06 }}>{s.icon}</div><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>{s.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 8, letterSpacing: "-0.5px" }}>{s.value}</div></div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, maxWidth: 380, display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)", borderRadius: 12, padding: "0 16px", border: "1px solid var(--border)" }}><span style={{ color: "var(--text-muted)", fontSize: 14 }}>🔍</span><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por código, dispositivo, cliente..." style={{ flex: 1, border: "none", background: "none", padding: "12px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }} /></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ key: "all", label: "Todas", icon: "📋", color: "#6366f1" }, ...Object.entries(STATUS).map(([key, val]) => ({ key, label: val.label, icon: val.icon, color: val.color }))].map((f) => { const isActive = filterStatus === f.key; const count = f.key === "all" ? repairs.length : repairs.filter(r => r.status === f.key).length; return (<button key={f.key} onClick={() => setFilterStatus(f.key)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", background: isActive ? `${f.color}15` : "var(--bg-card)", border: isActive ? `1.5px solid ${f.color}40` : "1.5px solid var(--border)", color: isActive ? f.color : "var(--text-muted)" }}><span style={{ fontSize: 13 }}>{f.icon}</span>{f.label}{count > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6, minWidth: 18, textAlign: "center", background: isActive ? `${f.color}20` : "var(--bg-tertiary)", color: isActive ? f.color : "var(--text-muted)" }}>{count}</span>}</button>); })}
          </div>
          <button onClick={() => router.push("/new-order")} style={{ padding: "10px 20px", marginLeft: "auto", background: "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>＋ Nueva Orden</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700 }}>Reparaciones</h2><span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "3px 10px", borderRadius: 10 }}>{filteredRepairs.length}</span></div>

        {loading ? (<div style={{ padding: 60, textAlign: "center" }}><p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p></div>
        ) : filteredRepairs.length === 0 ? (<div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 18, border: "1px solid var(--border)" }}><div style={{ fontSize: 48, marginBottom: 16 }}>📋</div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay reparaciones</h3><p style={{ color: "var(--text-muted)", fontSize: 13 }}>Crea tu primera orden</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredRepairs.map((repair, i) => {
              const st = STATUS[repair.status] || STATUS.pending; const isExpanded = expandedId === repair.id; const statusKeys = Object.keys(STATUS); const currentIndex = statusKeys.indexOf(repair.status); const nextStatus = statusKeys[currentIndex + 1];
              const repairAcc = parseAccessoriesDisplay(repair.accessories); const repairImages = parseImages(repair.image); const firstImage = repairImages[0] || null;
              const { notes: repairNotes, services: repairServices } = parseNotesAndServices(repair.notes, servicesList);
              return (
                <div key={repair.id} onClick={() => setExpandedId(isExpanded ? null : repair.id)} style={{ background: "var(--bg-card)", borderRadius: 16, border: `1px solid ${isExpanded ? st.color + "30" : "var(--border)"}`, cursor: "pointer", transition: "all 0.25s", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, overflow: "hidden" }}>
                  {!isExpanded && (
                    <div style={{ display: "flex", alignItems: "stretch" }}>
                      {firstImage ? (<div onClick={(e) => { e.stopPropagation(); setViewImage(firstImage); }} style={{ width: 120, minHeight: 120, flexShrink: 0, cursor: "pointer", position: "relative" }}><img src={firstImage} alt={repair.device} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />{repairImages.length > 1 && <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "2px 6px", fontSize: 10, color: "#fff", fontWeight: 700 }}>+{repairImages.length - 1}</div>}</div>) : (<div style={{ width: 120, minHeight: 120, flexShrink: 0, background: st.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, borderRight: "1px solid var(--border)" }}>{st.icon}</div>)}
                      <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "monospace", fontSize: 12, color: "#6366f1", fontWeight: 700, background: "rgba(99,102,241,0.08)", padding: "2px 8px", borderRadius: 6 }}>{repair.code}</span><span style={{ fontSize: 14, fontWeight: 700 }}>{[repair.device, repair.brand, repair.model].filter(Boolean).join(" ")}</span></div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{repair.clientName && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-secondary)" }}>👤 {repair.clientName}</span>}{repair.clientPhone && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-muted)" }}>📱 {repair.clientPhone}</span>}{repair.clientEmail && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-muted)" }}>✉️ {repair.clientEmail}</span>}</div>
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>🔧 {repair.issue}</p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", flexShrink: 0 }}><div style={{ textAlign: "right" }}><span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.color}20`, display: "inline-block" }}>{st.icon} {st.label}</span><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>Bs. {repair.estimatedCost}</div></div><span style={{ fontSize: 14, color: "var(--text-muted)" }}>▾</span></div>
                    </div>
                  )}
                  {isExpanded && (
                    <div style={{ padding: 22, animation: "fadeIn 0.3s ease-out" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {firstImage ? (<div onClick={(e) => { e.stopPropagation(); setViewImage(firstImage); }} style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: `2px solid ${st.color}30`, cursor: "pointer" }}><img src={firstImage} alt={repair.device} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>) : (<div style={{ width: 44, height: 44, borderRadius: 10, background: st.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: `2px solid ${st.color}20`, flexShrink: 0 }}>{st.icon}</div>)}
                          <div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontFamily: "monospace", fontSize: 13, color: "#6366f1", fontWeight: 700 }}>{repair.code}</span><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.color}20` }}>{st.icon} {st.label}</span></div><span style={{ fontSize: 15, fontWeight: 700, marginTop: 2, display: "block" }}>{[repair.device, repair.brand, repair.model].filter(Boolean).join(" ")}</span></div>
                        </div>
                        <span onClick={(e) => { e.stopPropagation(); setExpandedId(null); }} style={{ fontSize: 14, color: "var(--text-muted)", transform: "rotate(180deg)", cursor: "pointer", padding: 4 }}>▾</span>
                      </div>
                      {repairImages.length > 0 && (<div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginBottom: 10 }}>📷 Fotos ({repairImages.length})</div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{repairImages.map((img, idx) => (<div key={idx} onClick={(e) => { e.stopPropagation(); setViewImage(img); }} style={{ width: repairImages.length === 1 ? "100%" : 180, height: repairImages.length === 1 ? 220 : 140, borderRadius: 12, overflow: "hidden", cursor: "pointer", border: "1px solid var(--border)", flexShrink: 0, position: "relative" }}><img src={img} alt={`Foto ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /><div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 10px", background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}><span style={{ fontSize: 10, color: "#fff" }}>📷 {idx + 1}/{repairImages.length}</span></div></div>))}</div></div>)}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {(repair.clientName || repair.clientPhone || repair.clientEmail) && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{repair.clientName && <InfoBox label="Nombre" value={repair.clientName} icon="👤" color="#818cf8" bg="rgba(99,102,241,0.04)" span={true} />}{repair.clientPhone && <InfoBox label="Celular" value={repair.clientPhone} icon="📱" color="#818cf8" bg="rgba(99,102,241,0.04)" />}{repair.clientEmail && <InfoBox label="Correo" value={repair.clientEmail} icon="✉️" color="#818cf8" bg="rgba(99,102,241,0.04)" />}</div>)}
                          <div style={{ padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: 10, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 4 }}>Problema</div><div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{repair.issue}</div></div>
                          {repairNotes && (<div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.05)", borderRadius: 10, borderLeft: "3px solid #f59e0b" }}><div style={{ fontSize: 9, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 4 }}>Observaciones</div><div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{repairNotes}</div></div>)}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><InfoBox label="Dispositivo" value={repair.device} icon="💻" /><InfoBox label="Marca" value={repair.brand || "—"} icon="🏷️" /><InfoBox label="Modelo" value={repair.model || "—"} icon="📋" /><InfoBox label="Costo Est." value={`Bs. ${repair.estimatedCost}`} icon="💰" /></div>
                          {repairAcc.length > 0 && (<div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.04)", borderRadius: 10, borderLeft: "3px solid #10b981" }}><div style={{ fontSize: 9, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 6 }}>Accesorios</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{repairAcc.map((a) => (<span key={a} style={{ padding: "3px 8px", background: "rgba(16,185,129,0.1)", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#10b981" }}>✓ {a}</span>))}</div></div>)}
                          {repairServices.length > 0 && (<div style={{ padding: "10px 14px", background: "rgba(168,85,247,0.04)", borderRadius: 10, borderLeft: "3px solid #a855f7" }}><div style={{ fontSize: 9, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 6 }}>Servicios</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{repairServices.map((name) => { const svc = servicesList.find(s => s.name === name); return (<span key={name} style={{ padding: "3px 8px", background: "rgba(168,85,247,0.1)", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#a855f7" }}>{svc?.icon} {name}</span>); })}</div></div>)}
                        </div>
                      </div>
                      <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 0 }}>{Object.entries(STATUS).map(([key, val], idx) => { const done = idx <= currentIndex; const current = idx === currentIndex; return (<div key={key} style={{ display: "flex", alignItems: "center", flex: idx < statusKeys.length - 1 ? 1 : "none" }}><div title={val.label} style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: done ? val.color : "var(--bg-primary)", border: `2px solid ${done ? val.color : "var(--border)"}`, boxShadow: current ? `0 0 10px ${val.color}40` : "none", opacity: done ? 1 : 0.25, flexShrink: 0 }}>{val.icon}</div>{idx < statusKeys.length - 1 && <div style={{ flex: 1, height: 2, borderRadius: 2, margin: "0 3px", background: idx < currentIndex ? val.color : "var(--border)" }} />}</div>); })}</div></div>
                      <div translate="no" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {nextStatus && <button onClick={(e) => { e.stopPropagation(); updateStatus(repair.id, nextStatus); }} style={{ ...btnAction, background: `${STATUS[nextStatus].color}10`, border: `1px solid ${STATUS[nextStatus].color}25`, color: STATUS[nextStatus].color, fontWeight: 700 }}>{STATUS[nextStatus].icon} {STATUS[nextStatus].label}</button>}
                        <button onClick={(e) => { e.stopPropagation(); openEditForm(repair); }} style={{ ...btnAction, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: "#6366f1" }}>✏️ Editar</button>
                        <button onClick={(e) => { e.stopPropagation(); router.push("/messages"); }} style={btnAction}>💬 Chat</button>
                        <button onClick={(e) => { e.stopPropagation(); window.open(`/print/${repair.code}`, "_blank"); }} style={btnAction}>🖨️ Imprimir</button>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar ${repair.code}?`)) deleteRepair(repair.id); }} style={{ ...btnAction, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", marginLeft: "auto" }}>🗑️</button>
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

function FormField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (<div><label style={labelStyle}>{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={fieldStyle} /></div>);
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" };
const fieldStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none" };