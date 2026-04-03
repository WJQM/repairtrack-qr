"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface User { id: string; name: string; email: string; role: string; }
interface Repair { id: string; code: string; device: string; brand: string | null; model: string | null; issue: string; status: string; priority: string; estimatedCost: number; notes: string | null; image: string | null; accessories: string | null; clientName: string | null; clientPhone: string | null; clientEmail: string | null; qrCode: string; createdAt: string; updatedAt: string; technicianId: string | null; technician?: { id: string; name: string } | null; }
interface Notification { id: string; type: string; title: string; message: string; read: boolean; createdAt: string; }
interface ServiceItem { id: string; name: string; price: number; icon: string; }
interface SoftwareItem { id: string; name: string; category: string | null; }
interface InventoryItemData { id: string; name: string; category: string | null; quantity: number; price: number; minStock: number; image: string | null; }

const STATUS: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  pending: { label: "Pendiente", color: "#f59e0b", icon: "⏳", bg: "rgba(245,158,11,0.08)" },
  diagnosed: { label: "Diagnosticado", color: "#8b5cf6", icon: "🔍", bg: "rgba(139,92,246,0.08)" },
  waiting_parts: { label: "Esperando Repuestos", color: "#f97316", icon: "📦", bg: "rgba(249,115,22,0.08)" },
  in_progress: { label: "En Progreso", color: "#3b82f6", icon: "🔧", bg: "rgba(59,130,246,0.08)" },
  completed: { label: "Completado", color: "#10b981", icon: "✅", bg: "rgba(16,185,129,0.08)" },
  delivered: { label: "Entregado", color: "#6b7280", icon: "📱", bg: "rgba(107,114,128,0.08)" },
};
const TRACKING_KEYS = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed"];
const ALL_STATUS_KEYS = ["pending", "diagnosed", "waiting_parts", "in_progress", "completed", "delivered"];
const NOTIF_ICONS: Record<string, string> = { status_change: "🔄", new_repair: "🆕", message: "💬", system: "🔐" };
const ACCESSORIES_LIST = ["Cargador", "Batería", "Disco Duro", "Memoria RAM", "Cable de Poder", "Pantalla", "Tornillos", "Maletín/Bolsa", "Otros"];
const ACCESSORIES_HINTS: Record<string, string> = { "Cargador": "Ej: 65W, USB-C, modelo...", "Batería": "Ej: 6 celdas, modelo...", "Disco Duro": "Ej: 500GB SSD, 1TB HDD...", "Memoria RAM": "Ej: 8GB DDR4, 16GB DDR5...", "Cable de Poder": "Ej: 3 pines, tipo...", "Pantalla": "Ej: 15.6\", táctil...", "Tornillos": "Ej: completo, incompleto, cantidad...", "Maletín/Bolsa": "Ej: color, tamaño...", "Otros": "Especificar qué accesorios..." };

function parseAccWithDetail(raw: string): { name: string; detail: string } { const match = raw.match(/^(.+?)\s*\((.+)\)$/); if (match) return { name: match[1].trim(), detail: match[2].trim() }; return { name: raw.trim(), detail: "" }; }
function parseAccessoriesFull(json: string | null): { names: string[]; details: Record<string, string> } { if (!json) return { names: [], details: {} }; try { const arr: string[] = JSON.parse(json); const names: string[] = []; const details: Record<string, string> = {}; arr.forEach(raw => { const { name, detail } = parseAccWithDetail(raw); names.push(name); if (detail) details[name] = detail; }); return { names, details }; } catch { return { names: [], details: {} }; } }
function parseAccessoriesDisplay(json: string | null): string[] { if (!json) return []; try { return JSON.parse(json); } catch { return []; } }
function parseImages(imageField: string | null): string[] { if (!imageField) return []; try { const parsed = JSON.parse(imageField); if (Array.isArray(parsed)) return parsed.filter((u: any) => typeof u === "string" && u.length > 0); } catch {} return imageField.trim().length > 0 ? [imageField] : []; }

function parseNotesAll(notesField: string | null, svcList: ServiceItem[]): { notes: string; services: string[]; software: string[]; repuestos: string[]; deliveryNotes: string } {
  if (!notesField) return { notes: "", services: [], software: [], repuestos: [], deliveryNotes: "" };
  const parts = notesField.split(" | ");
  const svcPart = parts.find(p => p.startsWith("Servicios: "));
  const swPart = parts.find(p => p.startsWith("Software: "));
  const repPart = parts.find(p => p.startsWith("Repuestos: "));
  const delPart = parts.find(p => p.startsWith("Entrega: "));
  const notesParts = parts.filter(p => !p.startsWith("Servicios: ") && !p.startsWith("Software: ") && !p.startsWith("Repuestos: ") && !p.startsWith("Entrega: "));
  const services: string[] = []; const software: string[] = []; const repuestos: string[] = [];
  if (svcPart) { svcPart.replace("Servicios: ", "").split(", ").forEach(name => { if (svcList.find(s => s.name === name)) services.push(name); }); }
  if (swPart) { swPart.replace("Software: ", "").split(", ").forEach(name => { if (name.trim()) software.push(name.trim()); }); }
  if (repPart) { repPart.replace("Repuestos: ", "").split(", ").forEach(name => { if (name.trim()) repuestos.push(name.trim()); }); }
  const deliveryNotes = delPart ? delPart.replace("Entrega: ", "") : "";
  return { notes: notesParts.join(" | "), services, software, repuestos, deliveryNotes };
}

function buildNotesString(obs: string, services: string[], software: string[], repuestos: string[], deliveryNotes: string): string {
  const parts: string[] = [];
  if (obs.trim()) parts.push(obs.trim());
  if (services.length > 0) parts.push(`Servicios: ${services.join(", ")}`);
  if (software.length > 0) parts.push(`Software: ${software.join(", ")}`);
  if (repuestos.length > 0) parts.push(`Repuestos: ${repuestos.join(", ")}`);
  if (deliveryNotes.trim()) parts.push(`Entrega: ${deliveryNotes.trim()}`);
  return parts.join(" | ");
}

function getGreeting(): string { const h = new Date().getHours(); if (h < 12) return "Buenos días"; if (h < 18) return "Buenas tardes"; return "Buenas noches"; }
function formatClock(date: Date): { time: string; period: string } { const h = date.getHours(); const m = String(date.getMinutes()).padStart(2, "0"); const s = String(date.getSeconds()).padStart(2, "0"); const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return { time: `${String(h12).padStart(2, "0")}:${m}:${s}`, period: h >= 12 ? "PM" : "AM" }; }
function formatDate(date: Date): string { return date.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }

export default function DashboardPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [printModal, setPrintModal] = useState<{ code: string; type: "reception" | "delivery" } | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);
  const [softwareList, setSoftwareList] = useState<SoftwareItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItemData[]>([]);

  const [editingRepair, setEditingRepair] = useState<Repair | null>(null);
  const [editDevice, setEditDevice] = useState(""); const [editBrand, setEditBrand] = useState(""); const [editModel, setEditModel] = useState("");
  const [editIssue, setEditIssue] = useState(""); const [editCost, setEditCost] = useState(""); const [editNotes, setEditNotes] = useState("");
  const [editClientName, setEditClientName] = useState(""); const [editClientPhone, setEditClientPhone] = useState(""); const [editClientEmail, setEditClientEmail] = useState("");
  const [editSelectedAccessories, setEditSelectedAccessories] = useState<string[]>([]); const [editAccessoryDetails, setEditAccessoryDetails] = useState<Record<string, string>>({});
  const [editSelectedServices, setEditSelectedServices] = useState<string[]>([]);
  const [editSelectedSoftware, setEditSelectedSoftware] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState("");
  const [editTechnicianId, setEditTechnicianId] = useState("");
  const [techniciansList, setTechniciansList] = useState<{ id: string; name: string }[]>([]);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]); const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]); const [uploading, setUploading] = useState(false);
  const [showEditServices, setShowEditServices] = useState(false); const [showEditSoftware, setShowEditSoftware] = useState(false);
  const [searchEditServices, setSearchEditServices] = useState(""); const [searchEditSoftware, setSearchEditSoftware] = useState("");
  const [editSelectedInventory, setEditSelectedInventory] = useState<string[]>([]);
  const [editOriginalInventory, setEditOriginalInventory] = useState<string[]>([]);
  const [showEditInventory, setShowEditInventory] = useState(false);
  const [searchEditInventory, setSearchEditInventory] = useState("");
  const filteredEditServices = servicesList.filter(s => searchEditServices === "" || s.name.toLowerCase().includes(searchEditServices.toLowerCase()));
  const filteredEditSoftware = softwareList.filter(s => searchEditSoftware === "" || s.name.toLowerCase().includes(searchEditSoftware.toLowerCase()) || (s.category || "").toLowerCase().includes(searchEditSoftware.toLowerCase()));
  const filteredEditInventory = inventoryList.filter(item => (item.quantity > 0 || editSelectedInventory.includes(item.id)) && (searchEditInventory === "" || item.name.toLowerCase().includes(searchEditInventory.toLowerCase()) || (item.category || "").toLowerCase().includes(searchEditInventory.toLowerCase())));

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliverySelectedRepair, setDeliverySelectedRepair] = useState<Repair | null>(null);
  const [deliveryAccChecked, setDeliveryAccChecked] = useState<Record<string, boolean>>({});
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliverySelectedServices, setDeliverySelectedServices] = useState<string[]>([]);
  const [deliverySelectedSoftware, setDeliverySelectedSoftware] = useState<string[]>([]);
  const [showDeliveryServices, setShowDeliveryServices] = useState(false);
  const [showDeliverySoftware, setShowDeliverySoftware] = useState(false);
  const [searchDeliveryServices, setSearchDeliveryServices] = useState("");
  const [searchDeliverySoftware, setSearchDeliverySoftware] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const filteredDeliveryServices = servicesList.filter(s => searchDeliveryServices === "" || s.name.toLowerCase().includes(searchDeliveryServices.toLowerCase()));
  const filteredDeliverySoftware = softwareList.filter(s => searchDeliverySoftware === "" || s.name.toLowerCase().includes(searchDeliverySoftware.toLowerCase()) || (s.category || "").toLowerCase().includes(searchDeliverySoftware.toLowerCase()));
  const completedRepairs = repairs.filter(r => r.status === "completed");

  const [deliverySelectedInventory, setDeliverySelectedInventory] = useState<string[]>([]);
  const [showDeliveryInventory, setShowDeliveryInventory] = useState(false);
  const [searchDeliveryInventory, setSearchDeliveryInventory] = useState("");
  const filteredDeliveryInventory = inventoryList.filter(item => item.quantity > 0 && (searchDeliveryInventory === "" || item.name.toLowerCase().includes(searchDeliveryInventory.toLowerCase()) || (item.category || "").toLowerCase().includes(searchDeliveryInventory.toLowerCase())));

  const unreadCount = notifications.filter((n) => !n.read).length;
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const toggleEditAcc = (acc: string) => { setEditSelectedAccessories(prev => { if (prev.includes(acc)) { setEditAccessoryDetails(d => { const copy = { ...d }; delete copy[acc]; return copy; }); return prev.filter(a => a !== acc); } return [...prev, acc]; }); };
  const updateEditDetail = (acc: string, detail: string) => { setEditAccessoryDetails(prev => ({ ...prev, [acc]: detail })); };
  const buildEditAccessoriesArray = (): string[] => { return editSelectedAccessories.map(acc => { const detail = editAccessoryDetails[acc]?.trim(); return detail ? `${acc} (${detail})` : acc; }); };
  const toggleEditService = (serviceName: string) => { setEditSelectedServices(prev => { const next = prev.includes(serviceName) ? prev.filter(s => s !== serviceName) : [...prev, serviceName]; recalcEditCost(next, editSelectedInventory); return next; }); };
  const toggleEditSoftware = (name: string) => { setEditSelectedSoftware(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]); };
  const recalcEditCost = (services: string[], invIds: string[]) => {
    const svcTotal = services.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0);
    const invTotal = invIds.reduce((sum, id) => { const item = inventoryList.find(i => i.id === id); return sum + (item?.price || 0); }, 0);
    setEditCost(String(svcTotal + invTotal));
  };
  const toggleEditInventory = (itemId: string) => {
    setEditSelectedInventory(prev => {
      const next = prev.includes(itemId) ? prev.filter(i => i !== itemId) : [...prev, itemId];
      recalcEditCost(editSelectedServices, next);
      return next;
    });
  };

  const recalculateDeliveryCost = (services: string[], inventoryIds: string[]) => {
    const svcTotal = services.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0);
    const invTotal = inventoryIds.reduce((sum, id) => { const item = inventoryList.find(i => i.id === id); return sum + (item?.price || 0); }, 0);
    setDeliveryCost(String(svcTotal + invTotal));
  };
  const toggleDeliveryService = (serviceName: string) => {
    setDeliverySelectedServices(prev => {
      const next = prev.includes(serviceName) ? prev.filter(s => s !== serviceName) : [...prev, serviceName];
      recalculateDeliveryCost(next, deliverySelectedInventory);
      return next;
    });
  };
  const toggleDeliverySoftware = (name: string) => { setDeliverySelectedSoftware(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]); };
  const toggleDeliveryInventory = (itemId: string) => {
    setDeliverySelectedInventory(prev => {
      const next = prev.includes(itemId) ? prev.filter(i => i !== itemId) : [...prev, itemId];
      recalculateDeliveryCost(deliverySelectedServices, next);
      return next;
    });
  };

  const openDeliveryModal = () => {
    setShowDeliveryModal(true); setDeliverySelectedRepair(null); setDeliveryAccChecked({}); setDeliveryNotes("");
    setDeliverySelectedServices([]); setDeliverySelectedSoftware([]); setDeliveryCost("");
    setShowDeliveryServices(false); setShowDeliverySoftware(false); setSearchDeliveryServices(""); setSearchDeliverySoftware("");
    setDeliverySelectedInventory([]); setShowDeliveryInventory(false); setSearchDeliveryInventory("");
  };

  const selectDeliveryRepair = (repair: Repair) => {
    if (deliverySelectedRepair?.id === repair.id) {
      setDeliverySelectedRepair(null); setDeliveryAccChecked({}); setDeliverySelectedServices([]);
      setDeliverySelectedSoftware([]); setDeliverySelectedInventory([]); setDeliveryCost(""); return;
    }
    setDeliverySelectedRepair(repair);
    const accNames = parseAccessoriesDisplay(repair.accessories);
    const checked: Record<string, boolean> = {};
    accNames.forEach(a => { const { name } = parseAccWithDetail(a); checked[name] = true; });
    setDeliveryAccChecked(checked);
    const parsed = parseNotesAll(repair.notes, servicesList);
    setDeliverySelectedServices(parsed.services);
    setDeliverySelectedSoftware(parsed.software);
    setDeliverySelectedInventory([]);
    setDeliveryCost(String(repair.estimatedCost));
  };

  const confirmDelivery = async () => {
    if (!deliverySelectedRepair) return;
    const token = localStorage.getItem("token"); if (!token) return;
    try {
      const existingParsed = parseNotesAll(deliverySelectedRepair.notes, servicesList);
      const originalObs = existingParsed.notes;
      const invNames = deliverySelectedInventory.map(id => inventoryList.find(i => i.id === id)?.name).filter(Boolean) as string[];
      const finalNotes = buildNotesString(originalObs, deliverySelectedServices, deliverySelectedSoftware, invNames, deliveryNotes);
      const svcTotal = deliverySelectedServices.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0);
      const invTotal = deliverySelectedInventory.reduce((sum, id) => { const item = inventoryList.find(i => i.id === id); return sum + (item?.price || 0); }, 0);
      const totalCost = svcTotal + invTotal;
      for (const itemId of deliverySelectedInventory) {
        const item = inventoryList.find(i => i.id === itemId);
        if (item && item.quantity > 0) {
          await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: itemId, quantity: item.quantity - 1 }) });
        }
      }
      const res = await fetch(`/api/repairs/${deliverySelectedRepair.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "delivered", notes: finalNotes || null, estimatedCost: totalCost || deliverySelectedRepair.estimatedCost })
      });
      if (res.ok) {
        setShowDeliveryModal(false);
        showToast(`📱 Equipo ${deliverySelectedRepair.code} entregado`);
        await loadRepairs(token); loadNotifications(token);
        fetch("/api/inventory").then(res => res.json()).then(data => { if (Array.isArray(data)) setInventoryList(data); }).catch(() => {});
      }
    } catch {}
  };

  const loadRepairs = async (token: string) => { try { const res = await fetch("/api/repairs", { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setRepairs(await res.json()); } catch {} setLoading(false); };
  const loadNotifications = async (token: string) => { try { const res = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setNotifications(await res.json()); } catch {} };
  const markNotificationRead = async (notifId: string) => { const token = localStorage.getItem("token"); if (!token) return; try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ notificationId: notifId }) }); setNotifications(notifications.map((n) => (n.id === notifId ? { ...n, read: true } : n))); } catch {} };
  const markAllRead = async () => { const token = localStorage.getItem("token"); if (!token) return; try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ markAll: true }) }); setNotifications(notifications.map((n) => ({ ...n, read: true }))); } catch {} };
  const clearAllNotifications = async () => { if (!confirm("¿Eliminar todas las notificaciones?")) return; const token = localStorage.getItem("token"); if (!token) return; try { const res = await fetch("/api/notifications", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { setNotifications([]); setShowNotifications(false); showToast("🧹 Notificaciones limpiadas"); } } catch {} };

  useEffect(() => {
    const userData = localStorage.getItem("user"); const token = localStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role === "tech") { router.push("/asignaciones"); return; }
    setUser(parsedUser); loadRepairs(token); loadNotifications(token);
    fetch("/api/services").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setServicesList(data); }).catch(() => {});
    fetch("/api/software").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setSoftwareList(data); }).catch(() => {});
    fetch("/api/inventory").then(res => res.json()).then(data => { if (Array.isArray(data) && data.length > 0) setInventoryList(data); }).catch(() => {});
    fetch("/api/technicians", { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json()).then(data => { if (Array.isArray(data)) setTechniciansList(data); }).catch(() => {});
    const savedEdit = sessionStorage.getItem("editFormData");
    if (savedEdit) { try { const data = JSON.parse(savedEdit); setEditingRepair(data.repair); setEditDevice(data.editDevice || ""); setEditBrand(data.editBrand || ""); setEditModel(data.editModel || ""); setEditIssue(data.editIssue || ""); setEditCost(data.editCost || ""); setEditNotes(data.editNotes || ""); setEditClientName(data.editClientName || ""); setEditClientPhone(data.editClientPhone || ""); setEditClientEmail(data.editClientEmail || ""); setEditSelectedAccessories(data.editSelectedAccessories || []); setEditAccessoryDetails(data.editAccessoryDetails || {}); setEditSelectedServices(data.editSelectedServices || []); setEditSelectedSoftware(data.editSelectedSoftware || []); setEditStatus(data.editStatus || ""); setEditImageUrls(data.editImageUrls || []); setEditImagePreviews(data.editImagePreviews || []); } catch {} sessionStorage.removeItem("editFormData"); }
    const capturedData = sessionStorage.getItem("capturedImage");
    if (capturedData) { try { const { url, preview } = JSON.parse(capturedData); setEditImageUrls(prev => [...prev, url]); setEditImagePreviews(prev => [...prev, preview]); setTimeout(() => showToast("📸 Foto capturada"), 500); } catch {} sessionStorage.removeItem("capturedImage"); }
  }, []);

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { const token = localStorage.getItem("token"); if (!token) return; const interval = setInterval(() => { loadNotifications(token); loadRepairs(token); }, 10000); return () => clearInterval(interval); }, []);
  useEffect(() => { function handleClick(e: MouseEvent) { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false); } document.addEventListener("mousedown", handleClick); return () => document.removeEventListener("mousedown", handleClick); }, []);

  const uploadEditFiles = async (files: FileList) => { setUploading(true); for (let i = 0; i < files.length; i++) { const file = files[i]; const reader = new FileReader(); reader.onload = (ev) => setEditImagePreviews(prev => [...prev, ev.target?.result as string]); reader.readAsDataURL(file); const formData = new FormData(); formData.append("file", file); try { const res = await fetch("/api/upload", { method: "POST", body: formData }); if (res.ok) { const data = await res.json(); setEditImageUrls(prev => [...prev, data.url]); } } catch {} } showToast(`📷 ${files.length} imagen${files.length > 1 ? "es subidas" : " subida"}`); setUploading(false); };
  const handleEditImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files || files.length === 0) return; await uploadEditFiles(files); e.target.value = ""; };
  const handleEditTakePhoto = () => { sessionStorage.setItem("editFormData", JSON.stringify({ repair: editingRepair, editDevice, editBrand, editModel, editIssue, editCost, editNotes, editClientName, editClientPhone, editClientEmail, editSelectedAccessories, editAccessoryDetails, editSelectedServices, editSelectedSoftware, editStatus, editImageUrls, editImagePreviews })); sessionStorage.setItem("cameraReturnUrl", "/dashboard"); window.location.href = "/camera.html"; };
  const removeEditImage = (index: number) => { setEditImageUrls(prev => prev.filter((_, i) => i !== index)); setEditImagePreviews(prev => prev.filter((_, i) => i !== index)); };
  const deleteRepair = async (repairId: string) => { const token = localStorage.getItem("token"); try { const res = await fetch(`/api/repairs/${repairId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { setExpandedId(null); showToast("🗑️ Orden eliminada"); if (token) { await loadRepairs(token); loadNotifications(token); } } } catch {} };
  const updateStatus = async (repairId: string, newStatus: string) => { const token = localStorage.getItem("token"); try { const res = await fetch(`/api/repairs/${repairId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) }); if (res.ok) { showToast(`🔄 Estado: ${STATUS[newStatus]?.label}`); if (token) { await loadRepairs(token); loadNotifications(token); } } } catch {} };

  const openEditForm = (repair: Repair) => {
    setEditingRepair(repair); setEditDevice(repair.device); setEditBrand(repair.brand || ""); setEditModel(repair.model || "");
    setEditIssue(repair.issue);
    setEditClientName(repair.clientName || ""); setEditClientPhone(repair.clientPhone || ""); setEditClientEmail(repair.clientEmail || "");
    const { names, details } = parseAccessoriesFull(repair.accessories); setEditSelectedAccessories(names); setEditAccessoryDetails(details);
    const parsed = parseNotesAll(repair.notes, servicesList);
    setEditNotes(parsed.notes); setEditSelectedServices(parsed.services); setEditSelectedSoftware(parsed.software);
    const invIds = parsed.repuestos.map(name => inventoryList.find(i => i.name === name)?.id).filter(Boolean) as string[];
    setEditSelectedInventory(invIds);
    setEditOriginalInventory(invIds);
    const svcTotal = parsed.services.reduce((sum, name) => { const svc = servicesList.find(s => s.name === name); return sum + (svc?.price || 0); }, 0);
    const invTotal = invIds.reduce((sum, id) => { const item = inventoryList.find(i => i.id === id); return sum + (item?.price || 0); }, 0);
    setEditCost(String(svcTotal + invTotal || repair.estimatedCost));
    setEditStatus(repair.status); setEditTechnicianId(repair.technicianId || ""); const imgs = parseImages(repair.image); setEditImageUrls(imgs); setEditImagePreviews(imgs);
    setShowEditServices(false); setShowEditSoftware(false); setSearchEditServices(""); setSearchEditSoftware("");
    setShowEditInventory(false); setSearchEditInventory("");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingRepair) return; const token = localStorage.getItem("token");
    try {
      const imageData = editImageUrls.length > 0 ? JSON.stringify(editImageUrls) : null; const accArray = buildEditAccessoriesArray();
      const invNames = editSelectedInventory.map(id => inventoryList.find(i => i.id === id)?.name).filter(Boolean) as string[];
      const existingParsed = parseNotesAll(editingRepair.notes, servicesList);
      const finalNotes = buildNotesString(editNotes, editSelectedServices, editSelectedSoftware, invNames, existingParsed.deliveryNotes);
      const removedItems = editOriginalInventory.filter(id => !editSelectedInventory.includes(id));
      const addedItems = editSelectedInventory.filter(id => !editOriginalInventory.includes(id));
      for (const itemId of removedItems) {
        const item = inventoryList.find(i => i.id === itemId);
        if (item) { await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: itemId, quantity: item.quantity + 1 }) }); }
      }
      for (const itemId of addedItems) {
        const item = inventoryList.find(i => i.id === itemId);
        if (item && item.quantity > 0) { await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: itemId, quantity: item.quantity - 1 }) }); }
      }
      const res = await fetch(`/api/repairs/${editingRepair.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ device: editDevice, brand: editBrand, model: editModel, issue: editIssue, estimatedCost: parseFloat(editCost) || 0, notes: finalNotes || null, clientName: editClientName, clientPhone: editClientPhone, clientEmail: editClientEmail, image: imageData, accessories: accArray.length > 0 ? JSON.stringify(accArray) : null, status: editStatus, technicianId: editTechnicianId || null }) });
      if (res.ok) {
        setEditingRepair(null); showToast(`✏️ Orden ${editingRepair.code} actualizada`);
        if (token) { await loadRepairs(token); loadNotifications(token); }
        fetch("/api/inventory").then(res => res.json()).then(data => { if (Array.isArray(data)) setInventoryList(data); }).catch(() => {});
      }
    } catch {}
  };

  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); router.push("/"); };

  const printQROnly = (code: string, type: "reception" | "delivery") => {
    const origin = window.location.origin;
    const qrTargetUrl = type === "reception" ? `${origin}/track/${code}` : `${origin}/delivery/${code}`;
    const displayCode = type === "reception" ? code : `CE-${code.replace(/^OT-/i, "")}`;
    const title = type === "reception" ? "QR de Seguimiento" : "QR Comprobante de Entrega";
    const subtitle = type === "reception" ? "Escanea para rastrear tu equipo" : "Escanea para ver el acta de entrega";
    const color = type === "reception" ? "#3b82f6" : "#10b981";
    const qrColor = type === "reception" ? "3b82f6" : "10b981";
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrTargetUrl)}&color=${qrColor}&bgcolor=ffffff&margin=0`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${title} - ${displayCode}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:30px;background:#fff}
.card{background:#fff;border-radius:20px;padding:40px;text-align:center;max-width:360px;width:100%}
.badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:10px;font-weight:700;color:#fff;background:${color};margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}
h2{font-size:22px;font-weight:800;color:#111;margin-bottom:4px}
.sub{font-size:12px;color:#888;margin-bottom:24px}
.qr-frame{padding:16px;border:3px solid ${color};border-radius:16px;display:inline-block;margin-bottom:20px;background:#fff}
.qr-frame img{display:block;width:200px;height:200px}
.code{font-family:monospace;font-size:24px;font-weight:800;color:${color};letter-spacing:2px;margin-bottom:4px}
.order-ref{font-size:11px;color:#999;margin-bottom:6px}
.url{font-size:9px;color:#bbb;word-break:break-all;margin-bottom:24px}
.actions{display:flex;gap:10px;justify-content:center}
button{padding:12px 28px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
.btn-print{background:${color};color:#fff}
.btn-close{background:#f3f4f6;color:#666}
@media print{.actions{display:none}.badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body><div class="card">
<span class="badge">${type === "reception" ? "📡 Seguimiento" : "✅ Comprobante"}</span>
<h2>${title}</h2><p class="sub">${subtitle}</p>
<div class="qr-frame"><img src="${qrImg}" alt="QR Code" /></div>
<div class="code">${displayCode}</div>
${type === "delivery" ? `<div class="order-ref">Orden: ${code}</div>` : ""}
<div class="url">${qrTargetUrl}</div>
<div class="actions"><button class="btn-print" onclick="window.print()">🖨️ Imprimir</button><button class="btn-close" onclick="window.close()">✕ Cerrar</button></div>
</div></body></html>`);
    w.document.close();
  };

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
// ═══════════════════════════════════════════
// FIN DE LA PARTE 1 — CONTINÚA EN PARTE 2
// ═══════════════════════════════════════════
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
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>📷 Fotos del equipo</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                  {editImagePreviews.map((preview, idx) => (<div key={idx} style={{ width: 100, height: 100, borderRadius: 10, overflow: "hidden", position: "relative", border: "2px solid #6366f1", flexShrink: 0 }}><img src={preview} alt={`Foto ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /><button type="button" onClick={() => removeEditImage(idx)} style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none", color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>{uploading && idx === editImagePreviews.length - 1 && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "#fff", fontSize: 10, fontWeight: 600 }}>...</div></div>}</div>))}
                  <div onClick={() => editFileInputRef.current?.click()} style={{ width: 100, height: 100, borderRadius: 10, border: "2px dashed var(--border)", background: "var(--bg-tertiary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}><span style={{ fontSize: 22 }}>＋</span><span style={{ fontSize: 9, color: "var(--text-muted)" }}>Subir foto</span></div>
                  <div onClick={handleEditTakePhoto} style={{ width: 100, height: 100, borderRadius: 10, border: "2px dashed rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.04)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}><span style={{ fontSize: 22 }}>📸</span><span style={{ fontSize: 9, color: "#10b981" }}>Cámara</span></div>
                  <input ref={editFileInputRef} type="file" accept="image/*" multiple onChange={handleEditImageSelect} style={{ display: "none" }} />
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(99,102,241,0.04)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>👤 Datos del Cliente</div>
                <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><FormField label="Nombre" value={editClientName} onChange={setEditClientName} placeholder="Juan Pérez" /><FormField label="Celular" value={editClientPhone} onChange={setEditClientPhone} placeholder="70012345" /></div>
              </div>
              <div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(245,158,11,0.04)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>💻 Datos del Equipo</div>
                <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}><FormField label="Tipo" value={editDevice} onChange={setEditDevice} placeholder="Laptop, PC, Tablet..." /><FormField label="Marca" value={editBrand} onChange={setEditBrand} placeholder="HP, Dell, Lenovo..." /><FormField label="Modelo" value={editModel} onChange={setEditModel} placeholder="Pavilion 15, ThinkPad..." /></div>
              </div>
              <div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(16,185,129,0.04)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>🎒 Accesorios</div>
                <div translate="no" className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {ACCESSORIES_LIST.map((acc) => { const checked = editSelectedAccessories.includes(acc); const hint = ACCESSORIES_HINTS[acc]; const hasExtra = !!hint; const detail = editAccessoryDetails[acc] || ""; return (<div key={acc} style={{ display: "flex", flexDirection: "column", gap: 0 }}><div onClick={() => toggleEditAcc(acc)} style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderTop: `2px solid ${checked ? "#10b981" : "var(--border)"}`, borderLeft: `2px solid ${checked ? "#10b981" : "var(--border)"}`, borderRight: `2px solid ${checked ? "#10b981" : "var(--border)"}`, borderBottom: checked && hasExtra ? "1px solid rgba(16,185,129,0.2)" : `2px solid ${checked ? "#10b981" : "var(--border)"}`, borderRadius: checked && hasExtra ? "10px 10px 0 0" : 10, background: checked ? "rgba(16,185,129,0.1)" : "var(--bg-tertiary)", userSelect: "none", transition: "all 0.15s" }}><div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: checked ? "none" : "2px solid var(--border)", background: checked ? "#10b981" : "transparent", color: "#fff", fontSize: 11, fontWeight: 800 }}>{checked ? "✓" : ""}</div><span style={{ fontSize: 12, fontWeight: 600, color: checked ? "#10b981" : "var(--text-muted)" }}>{acc}</span></div>{checked && hint && (<div style={{ borderRadius: "0 0 10px 10px", borderLeft: "2px solid #10b981", borderRight: "2px solid #10b981", borderBottom: "2px solid #10b981", background: "rgba(16,185,129,0.05)", padding: "6px 8px" }}><input value={detail} onChange={(e) => updateEditDetail(acc, e.target.value)} placeholder={hint} onClick={(e) => e.stopPropagation()} style={{ width: "100%", padding: "5px 7px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 5, color: "var(--text-primary)", fontSize: 10, outline: "none" }} /></div>)}</div>); })}
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={labelStyle}>🔧 Problema reportado</label><textarea value={editIssue} onChange={(e) => setEditIssue(e.target.value)} placeholder="Describe el problema..." rows={4} style={{ ...fieldStyle, resize: "vertical" }} /></div>
                <div><label style={labelStyle}>📋 Observaciones del equipo</label><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Estado físico, detalles visibles..." rows={4} style={{ ...fieldStyle, resize: "vertical" }} /></div>
              </div>
              {servicesList.length > 0 && (<div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(168,85,247,0.04)", borderRadius: 12, border: `1px solid ${showEditServices ? "rgba(168,85,247,0.2)" : "rgba(168,85,247,0.08)"}` }}><div onClick={() => setShowEditServices(!showEditServices)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}><div style={{ fontSize: 12, fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>🛠️ Servicios y Costos {editSelectedServices.length > 0 && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "rgba(168,85,247,0.15)", color: "#c084fc", fontWeight: 800 }}>{editSelectedServices.length}</span>}</div><div style={{ width: 26, height: 26, borderRadius: 6, background: showEditServices ? "rgba(168,85,247,0.15)" : "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#a855f7", transition: "all 0.2s", transform: showEditServices ? "rotate(180deg)" : "none" }}>▾</div></div>{editSelectedServices.length > 0 && !showEditServices && (<div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>{editSelectedServices.map(name => { const svc = servicesList.find(s => s.name === name); return <span key={name} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7" }}>{svc?.icon} {name} — Bs.{svc?.price}</span>; })}</div>)}{showEditServices && (<div style={{ marginTop: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", borderRadius: 6, padding: "0 10px", border: "1px solid var(--border)", marginBottom: 8 }}><span style={{ fontSize: 11, color: "var(--text-muted)" }}>🔍</span><input value={searchEditServices} onChange={(e) => setSearchEditServices(e.target.value)} placeholder="Buscar servicio..." style={{ flex: 1, border: "none", background: "none", padding: "7px 0", color: "var(--text-primary)", fontSize: 11, outline: "none" }} />{searchEditServices && <span onClick={() => setSearchEditServices("")} style={{ cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>✕</span>}</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 220, overflow: "auto" }}>{filteredEditServices.map((svc) => { const active = editSelectedServices.includes(svc.name); return (<div key={svc.id} onClick={() => toggleEditService(svc.name)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none", transition: "all 0.15s", border: `2px solid ${active ? "#a855f7" : "var(--border)"}`, background: active ? "rgba(168,85,247,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: active ? "none" : "2px solid var(--border)", background: active ? "#a855f7" : "transparent", color: "#fff", fontSize: 9, fontWeight: 800 }}>{active ? "✓" : ""}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: active ? "#a855f7" : "var(--text-muted)", lineHeight: 1.2 }}>{svc.icon} {svc.name}</div><div style={{ fontSize: 10, fontWeight: 800, color: active ? "#c084fc" : "var(--text-muted)" }}>Bs. {svc.price}</div></div></div>); })}</div>{filteredEditServices.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>No se encontraron servicios</div>}</div>)}</div>)}
              {softwareList.length > 0 && (<div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(139,92,246,0.04)", borderRadius: 12, border: `1px solid ${showEditSoftware ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.08)"}` }}><div onClick={() => setShowEditSoftware(!showEditSoftware)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}><div style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>🎮 Software a Instalar {editSelectedSoftware.length > 0 && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "rgba(139,92,246,0.15)", color: "#a78bfa", fontWeight: 800 }}>{editSelectedSoftware.length}</span>}</div><div style={{ width: 26, height: 26, borderRadius: 6, background: showEditSoftware ? "rgba(139,92,246,0.15)" : "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#8b5cf6", transition: "all 0.2s", transform: showEditSoftware ? "rotate(180deg)" : "none" }}>▾</div></div>{editSelectedSoftware.length > 0 && !showEditSoftware && (<div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>{editSelectedSoftware.map(name => <span key={name} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#8b5cf6" }}>🎮 {name}</span>)}</div>)}{showEditSoftware && (<div style={{ marginTop: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", borderRadius: 6, padding: "0 10px", border: "1px solid var(--border)", marginBottom: 8 }}><span style={{ fontSize: 11, color: "var(--text-muted)" }}>🔍</span><input value={searchEditSoftware} onChange={(e) => setSearchEditSoftware(e.target.value)} placeholder="Buscar software..." style={{ flex: 1, border: "none", background: "none", padding: "7px 0", color: "var(--text-primary)", fontSize: 11, outline: "none" }} />{searchEditSoftware && <span onClick={() => setSearchEditSoftware("")} style={{ cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>✕</span>}</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 220, overflow: "auto" }}>{filteredEditSoftware.map((sw) => { const active = editSelectedSoftware.includes(sw.name); return (<div key={sw.id} onClick={() => toggleEditSoftware(sw.name)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none", transition: "all 0.15s", border: `2px solid ${active ? "#8b5cf6" : "var(--border)"}`, background: active ? "rgba(139,92,246,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: active ? "none" : "2px solid var(--border)", background: active ? "#8b5cf6" : "transparent", color: "#fff", fontSize: 9, fontWeight: 800 }}>{active ? "✓" : ""}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: active ? "#8b5cf6" : "var(--text-muted)", lineHeight: 1.2 }}>{sw.name}</div>{sw.category && <div style={{ fontSize: 9, color: active ? "#a78bfa" : "var(--text-muted)" }}>{sw.category}</div>}</div></div>); })}</div>{filteredEditSoftware.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>No se encontró software</div>}</div>)}</div>)}
              {inventoryList.length > 0 && (<div style={{ gridColumn: "1 / -1", padding: "12px 16px", background: "rgba(245,158,11,0.04)", borderRadius: 12, border: `1px solid ${showEditInventory ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.08)"}` }}><div onClick={() => setShowEditInventory(!showEditInventory)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}><div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>📦 Repuestos del Inventario {editSelectedInventory.length > 0 && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontWeight: 800 }}>{editSelectedInventory.length}</span>}</div><div style={{ width: 26, height: 26, borderRadius: 6, background: showEditInventory ? "rgba(245,158,11,0.15)" : "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#f59e0b", transition: "all 0.2s", transform: showEditInventory ? "rotate(180deg)" : "none" }}>▾</div></div>{editSelectedInventory.length > 0 && !showEditInventory && (<div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>{editSelectedInventory.map(id => { const item = inventoryList.find(i => i.id === id); return item ? <span key={id} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>📦 {item.name} — Bs.{item.price}</span> : null; })}</div>)}{showEditInventory && (<div style={{ marginTop: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", borderRadius: 6, padding: "0 10px", border: "1px solid var(--border)", marginBottom: 8 }}><span style={{ fontSize: 11, color: "var(--text-muted)" }}>🔍</span><input value={searchEditInventory} onChange={(e) => setSearchEditInventory(e.target.value)} placeholder="Buscar repuesto..." style={{ flex: 1, border: "none", background: "none", padding: "7px 0", color: "var(--text-primary)", fontSize: 11, outline: "none" }} />{searchEditInventory && <span onClick={() => setSearchEditInventory("")} style={{ cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>✕</span>}</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 220, overflow: "auto" }}>{filteredEditInventory.map((item) => { const active = editSelectedInventory.includes(item.id); return (<div key={item.id} onClick={() => toggleEditInventory(item.id)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none", transition: "all 0.15s", border: `2px solid ${active ? "#f59e0b" : "var(--border)"}`, background: active ? "rgba(245,158,11,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: active ? "none" : "2px solid var(--border)", background: active ? "#f59e0b" : "transparent", color: "#fff", fontSize: 9, fontWeight: 800 }}>{active ? "✓" : ""}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: active ? "#f59e0b" : "var(--text-muted)", lineHeight: 1.2 }}>📦 {item.name}</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}><span style={{ fontSize: 10, fontWeight: 800, color: active ? "#fbbf24" : "var(--text-muted)" }}>Bs. {item.price}</span><span style={{ fontSize: 9, color: item.quantity <= item.minStock ? "#ef4444" : "var(--text-muted)" }}>Stock: {item.quantity}</span></div></div></div>); })}</div>{filteredEditInventory.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>No hay repuestos disponibles</div>}</div>)}</div>)}
              <FormField label="Costo Total (Bs.)" value={editCost} onChange={setEditCost} placeholder="0.00" type="number" />
              <div><label style={labelStyle}>Estado</label><select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ ...fieldStyle, cursor: "pointer" }}>{ALL_STATUS_KEYS.map((key) => { const val = STATUS[key]; return (<option key={key} value={key}>{val.icon} {val.label}</option>); })}</select></div>
              <div><label style={labelStyle}>🔧 Asignar Técnico</label><select value={editTechnicianId} onChange={(e) => setEditTechnicianId(e.target.value)} style={{ ...fieldStyle, cursor: "pointer" }}><option value="">— Sin asignar —</option>{techniciansList.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}</select></div>
              <div><label style={labelStyle}>Resumen</label><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{editSelectedServices.map(name => { const svc = servicesList.find(s => s.name === name); return (<div key={name} style={{ padding: "3px 8px", background: "rgba(168,85,247,0.06)", borderRadius: 5, border: "1px solid rgba(168,85,247,0.1)" }}><span style={{ fontSize: 9, fontWeight: 600, color: "#a855f7" }}>🛠️ {name} {svc ? `Bs.${svc.price}` : ""}</span></div>); })}{editSelectedInventory.map(id => { const item = inventoryList.find(i => i.id === id); return item ? (<div key={id} style={{ padding: "3px 8px", background: "rgba(245,158,11,0.06)", borderRadius: 5, border: "1px solid rgba(245,158,11,0.1)" }}><span style={{ fontSize: 9, fontWeight: 600, color: "#f59e0b" }}>📦 {item.name} Bs.{item.price}</span></div>) : null; })}{editSelectedSoftware.map(name => (<div key={name} style={{ padding: "3px 8px", background: "rgba(139,92,246,0.06)", borderRadius: 5, border: "1px solid rgba(139,92,246,0.1)" }}><span style={{ fontSize: 9, fontWeight: 600, color: "#8b5cf6" }}>🎮 {name}</span></div>))}{editSelectedServices.length === 0 && editSelectedSoftware.length === 0 && editSelectedInventory.length === 0 && <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "8px 0", textAlign: "center" }}>Sin selección</div>}</div></div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, marginTop: 4 }}><button type="button" onClick={() => setEditingRepair(null)} style={{ padding: "12px 24px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button><button type="submit" disabled={uploading} style={{ padding: "12px 28px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: uploading ? "wait" : "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>💾 Guardar Cambios</button></div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ MODAL ENTREGAR EQUIPO ═══ */}
      {showDeliveryModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 700, maxHeight: "90vh", overflow: "auto", background: "var(--bg-card)", borderRadius: 20, border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeScale 0.3s ease-out" }}>
            <div style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>📱</div><div><h3 style={{ fontSize: 17, fontWeight: 700 }}>Entregar Equipo</h3><p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Selecciona la orden completada y verifica los datos</p></div></div><button onClick={() => setShowDeliveryModal(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button></div>
              <div style={{ marginBottom: 20 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>📋 Seleccionar Orden de Trabajo</div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{completedRepairs.length === 0 ? (<div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 12, background: "var(--bg-tertiary)", borderRadius: 12 }}>No hay órdenes completadas para entregar</div>) : completedRepairs.filter(r => !deliverySelectedRepair || deliverySelectedRepair.id === r.id).map(repair => { const isSelected = deliverySelectedRepair?.id === repair.id; const repairImages = parseImages(repair.image); const firstImage = repairImages[0] || null; return (<div key={repair.id} onClick={() => selectDeliveryRepair(repair)} style={{ padding: "12px 16px", borderRadius: 12, cursor: "pointer", border: `2px solid ${isSelected ? "#10b981" : "var(--border)"}`, background: isSelected ? "rgba(16,185,129,0.06)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}><div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: isSelected ? "none" : "2px solid var(--border)", background: isSelected ? "#10b981" : "transparent", color: "#fff", fontSize: 11, fontWeight: 800 }}>{isSelected ? "✓" : ""}</div>{firstImage ? (<div style={{ width: 44, height: 44, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}><img src={firstImage} alt={repair.device} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>) : (<div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(16,185,129,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✅</div>)}<div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "monospace", fontSize: 12, color: "#6366f1", fontWeight: 700 }}>{repair.code}</span><span style={{ fontSize: 13, fontWeight: 700 }}>{[repair.device, repair.brand, repair.model].filter(Boolean).join(" ")}</span></div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{repair.clientName && <span>👤 {repair.clientName}</span>}{repair.clientName && <span style={{ marginLeft: 8 }}>💰 Bs. {repair.estimatedCost}</span>}</div></div>{isSelected && <span style={{ fontSize: 10, color: "#10b981", fontWeight: 600 }}>✕ Cambiar</span>}</div>); })}</div></div>
              {deliverySelectedRepair && (<>
                <div style={{ marginBottom: 20, padding: "14px 18px", background: "var(--bg-tertiary)", borderRadius: 12, border: "1px solid var(--border)" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>📋 Resumen de la Orden</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>{deliverySelectedRepair.clientName && <div><div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Cliente</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>👤 {deliverySelectedRepair.clientName}</div></div>}{deliverySelectedRepair.clientPhone && <div><div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Celular</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>📱 {deliverySelectedRepair.clientPhone}</div></div>}<div><div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Costo Total</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, color: "#f59e0b" }}>💰 Bs. {deliveryCost || deliverySelectedRepair.estimatedCost}</div></div></div></div>
                {Object.keys(deliveryAccChecked).length > 0 && (<div style={{ marginBottom: 20, padding: "14px 18px", background: "rgba(16,185,129,0.04)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.15)" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>🎒 Accesorios a Devolver</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>{Object.entries(deliveryAccChecked).map(([accName, checked]) => (<div key={accName} onClick={() => setDeliveryAccChecked(prev => ({ ...prev, [accName]: !prev[accName] }))} style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `2px solid ${checked ? "#10b981" : "var(--border)"}`, background: checked ? "rgba(16,185,129,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 8, userSelect: "none", transition: "all 0.15s" }}><div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: checked ? "none" : "2px solid var(--border)", background: checked ? "#10b981" : "transparent", color: "#fff", fontSize: 12, fontWeight: 800 }}>{checked ? "✓" : ""}</div><span style={{ fontSize: 12, fontWeight: 600, color: checked ? "#10b981" : "var(--text-muted)" }}>{accName}</span></div>))}</div></div>)}
                {servicesList.length > 0 && (<div style={{ marginBottom: 20, padding: "14px 18px", background: "rgba(168,85,247,0.04)", borderRadius: 12, border: `1px solid ${showDeliveryServices ? "rgba(168,85,247,0.2)" : "rgba(168,85,247,0.1)"}` }}><div onClick={() => setShowDeliveryServices(!showDeliveryServices)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>🛠️ Servicios Realizados {deliverySelectedServices.length > 0 && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "rgba(168,85,247,0.15)", color: "#c084fc", fontWeight: 800 }}>{deliverySelectedServices.length}</span>}</div><div style={{ width: 26, height: 26, borderRadius: 6, background: showDeliveryServices ? "rgba(168,85,247,0.15)" : "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#a855f7", transition: "all 0.2s", transform: showDeliveryServices ? "rotate(180deg)" : "none" }}>▾</div></div>{deliverySelectedServices.length > 0 && !showDeliveryServices && (<div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>{deliverySelectedServices.map(name => { const svc = servicesList.find(s => s.name === name); return <span key={name} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)", color: "#a855f7" }}>{svc?.icon} {name} — Bs.{svc?.price}</span>; })}</div>)}{showDeliveryServices && (<div style={{ marginTop: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", borderRadius: 6, padding: "0 10px", border: "1px solid var(--border)", marginBottom: 8 }}><span style={{ fontSize: 11, color: "var(--text-muted)" }}>🔍</span><input value={searchDeliveryServices} onChange={(e) => setSearchDeliveryServices(e.target.value)} placeholder="Buscar servicio..." style={{ flex: 1, border: "none", background: "none", padding: "7px 0", color: "var(--text-primary)", fontSize: 11, outline: "none" }} />{searchDeliveryServices && <span onClick={() => setSearchDeliveryServices("")} style={{ cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>✕</span>}</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 220, overflow: "auto" }}>{filteredDeliveryServices.map((svc) => { const active = deliverySelectedServices.includes(svc.name); return (<div key={svc.id} onClick={() => toggleDeliveryService(svc.name)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none", transition: "all 0.15s", border: `2px solid ${active ? "#a855f7" : "var(--border)"}`, background: active ? "rgba(168,85,247,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: active ? "none" : "2px solid var(--border)", background: active ? "#a855f7" : "transparent", color: "#fff", fontSize: 9, fontWeight: 800 }}>{active ? "✓" : ""}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: active ? "#a855f7" : "var(--text-muted)", lineHeight: 1.2 }}>{svc.icon} {svc.name}</div><div style={{ fontSize: 10, fontWeight: 800, color: active ? "#c084fc" : "var(--text-muted)" }}>Bs. {svc.price}</div></div></div>); })}</div>{filteredDeliveryServices.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>No se encontraron servicios</div>}</div>)}</div>)}
                {softwareList.length > 0 && (<div style={{ marginBottom: 20, padding: "14px 18px", background: "rgba(139,92,246,0.04)", borderRadius: 12, border: `1px solid ${showDeliverySoftware ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.1)"}` }}><div onClick={() => setShowDeliverySoftware(!showDeliverySoftware)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>🎮 Software Instalado {deliverySelectedSoftware.length > 0 && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "rgba(139,92,246,0.15)", color: "#a78bfa", fontWeight: 800 }}>{deliverySelectedSoftware.length}</span>}</div><div style={{ width: 26, height: 26, borderRadius: 6, background: showDeliverySoftware ? "rgba(139,92,246,0.15)" : "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#8b5cf6", transition: "all 0.2s", transform: showDeliverySoftware ? "rotate(180deg)" : "none" }}>▾</div></div>{deliverySelectedSoftware.length > 0 && !showDeliverySoftware && (<div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>{deliverySelectedSoftware.map(name => <span key={name} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#8b5cf6" }}>🎮 {name}</span>)}</div>)}{showDeliverySoftware && (<div style={{ marginTop: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", borderRadius: 6, padding: "0 10px", border: "1px solid var(--border)", marginBottom: 8 }}><span style={{ fontSize: 11, color: "var(--text-muted)" }}>🔍</span><input value={searchDeliverySoftware} onChange={(e) => setSearchDeliverySoftware(e.target.value)} placeholder="Buscar software..." style={{ flex: 1, border: "none", background: "none", padding: "7px 0", color: "var(--text-primary)", fontSize: 11, outline: "none" }} />{searchDeliverySoftware && <span onClick={() => setSearchDeliverySoftware("")} style={{ cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>✕</span>}</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 220, overflow: "auto" }}>{filteredDeliverySoftware.map((sw) => { const active = deliverySelectedSoftware.includes(sw.name); return (<div key={sw.id} onClick={() => toggleDeliverySoftware(sw.name)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none", transition: "all 0.15s", border: `2px solid ${active ? "#8b5cf6" : "var(--border)"}`, background: active ? "rgba(139,92,246,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: active ? "none" : "2px solid var(--border)", background: active ? "#8b5cf6" : "transparent", color: "#fff", fontSize: 9, fontWeight: 800 }}>{active ? "✓" : ""}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: active ? "#8b5cf6" : "var(--text-muted)", lineHeight: 1.2 }}>{sw.name}</div>{sw.category && <div style={{ fontSize: 9, color: active ? "#a78bfa" : "var(--text-muted)" }}>{sw.category}</div>}</div></div>); })}</div>{filteredDeliverySoftware.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>No se encontró software</div>}</div>)}</div>)}
                {inventoryList.length > 0 && (<div style={{ marginBottom: 20, padding: "14px 18px", background: "rgba(245,158,11,0.04)", borderRadius: 12, border: `1px solid ${showDeliveryInventory ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.1)"}` }}><div onClick={() => setShowDeliveryInventory(!showDeliveryInventory)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>📦 Artículos del Inventario {deliverySelectedInventory.length > 0 && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontWeight: 800 }}>{deliverySelectedInventory.length}</span>}</div><div style={{ width: 26, height: 26, borderRadius: 6, background: showDeliveryInventory ? "rgba(245,158,11,0.15)" : "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#f59e0b", transition: "all 0.2s", transform: showDeliveryInventory ? "rotate(180deg)" : "none" }}>▾</div></div>{deliverySelectedInventory.length > 0 && !showDeliveryInventory && (<div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>{deliverySelectedInventory.map(id => { const item = inventoryList.find(i => i.id === id); return item ? <span key={id} style={{ fontSize: 9, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>📦 {item.name} — Bs.{item.price}</span> : null; })}</div>)}{showDeliveryInventory && (<div style={{ marginTop: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", borderRadius: 6, padding: "0 10px", border: "1px solid var(--border)", marginBottom: 8 }}><span style={{ fontSize: 11, color: "var(--text-muted)" }}>🔍</span><input value={searchDeliveryInventory} onChange={(e) => setSearchDeliveryInventory(e.target.value)} placeholder="Buscar artículo..." style={{ flex: 1, border: "none", background: "none", padding: "7px 0", color: "var(--text-primary)", fontSize: 11, outline: "none" }} />{searchDeliveryInventory && <span onClick={() => setSearchDeliveryInventory("")} style={{ cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>✕</span>}</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 220, overflow: "auto" }}>{filteredDeliveryInventory.map((item) => { const active = deliverySelectedInventory.includes(item.id); return (<div key={item.id} onClick={() => toggleDeliveryInventory(item.id)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none", transition: "all 0.15s", border: `2px solid ${active ? "#f59e0b" : "var(--border)"}`, background: active ? "rgba(245,158,11,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: active ? "none" : "2px solid var(--border)", background: active ? "#f59e0b" : "transparent", color: "#fff", fontSize: 9, fontWeight: 800 }}>{active ? "✓" : ""}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: active ? "#f59e0b" : "var(--text-muted)", lineHeight: 1.2 }}>📦 {item.name}</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}><span style={{ fontSize: 10, fontWeight: 800, color: active ? "#fbbf24" : "var(--text-muted)" }}>Bs. {item.price}</span><span style={{ fontSize: 9, color: item.quantity <= item.minStock ? "#ef4444" : "var(--text-muted)" }}>Stock: {item.quantity}</span></div></div></div>); })}</div>{filteredDeliveryInventory.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>No hay artículos disponibles</div>}</div>)}</div>)}
                <div style={{ marginBottom: 20 }}><label style={labelStyle}>📝 Notas de Entrega (Opcional)</label><textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Observaciones al momento de la entrega..." rows={3} style={{ ...fieldStyle, resize: "vertical" }} /></div>
                {(deliverySelectedServices.length > 0 || deliverySelectedSoftware.length > 0 || deliverySelectedInventory.length > 0) && (<div style={{ marginBottom: 20, padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: 12, border: "1px solid var(--border)" }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>📋 Resumen Final</div><div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{deliverySelectedServices.map(name => { const svc = servicesList.find(s => s.name === name); return (<div key={name} style={{ padding: "4px 10px", background: "rgba(168,85,247,0.06)", borderRadius: 6, border: "1px solid rgba(168,85,247,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 11, fontWeight: 600, color: "#a855f7" }}>🛠️ {name}</span><span style={{ fontSize: 11, fontWeight: 700, color: "#c084fc" }}>Bs. {svc?.price}</span></div>); })}{deliverySelectedInventory.map(id => { const item = inventoryList.find(i => i.id === id); return item ? (<div key={id} style={{ padding: "4px 10px", background: "rgba(245,158,11,0.06)", borderRadius: 6, border: "1px solid rgba(245,158,11,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b" }}>📦 {item.name}</span><span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>Bs. {item.price}</span></div>) : null; })}{deliverySelectedSoftware.map(name => (<div key={name} style={{ padding: "4px 10px", background: "rgba(139,92,246,0.06)", borderRadius: 6, border: "1px solid rgba(139,92,246,0.1)" }}><span style={{ fontSize: 11, fontWeight: 600, color: "#8b5cf6" }}>🎮 {name}</span></div>))}<div style={{ marginTop: 6, paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 12, fontWeight: 700 }}>Total:</span><span style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>Bs. {deliveryCost || deliverySelectedRepair.estimatedCost}</span></div></div></div>)}
                <div style={{ display: "flex", gap: 10 }}><button onClick={() => setShowDeliveryModal(false)} style={{ padding: "12px 24px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button><button onClick={confirmDelivery} style={{ flex: 1, padding: "12px 28px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>📱 Confirmar Entrega</button></div>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL IMPRIMIR ═══ */}
      {printModal && (
        <div onClick={() => setPrintModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "var(--bg-card)", borderRadius: 20, border: `1px solid ${printModal.type === "reception" ? "rgba(59,130,246,0.2)" : "rgba(16,185,129,0.2)"}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeScale 0.2s ease-out", overflow: "hidden" }}>
            <div style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: printModal.type === "reception" ? "rgba(59,130,246,0.1)" : "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🖨️</div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{printModal.type === "reception" ? "Imprimir Recepción" : "Imprimir Entrega"}</h3>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, marginTop: 2 }}>Orden: <span style={{ fontFamily: "monospace", color: printModal.type === "reception" ? "#3b82f6" : "#10b981", fontWeight: 700 }}>{printModal.code}</span></p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div onClick={() => { window.open(printModal.type === "reception" ? `/print/${printModal.code}` : `/delivery/${printModal.code}`, "_blank"); setPrintModal(null); }} style={{ padding: "16px 20px", borderRadius: 12, cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }} onMouseEnter={(e) => { const c = printModal.type === "reception" ? "#3b82f6" : "#10b981"; e.currentTarget.style.borderColor = c; e.currentTarget.style.background = printModal.type === "reception" ? "rgba(59,130,246,0.06)" : "rgba(16,185,129,0.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-tertiary)"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: printModal.type === "reception" ? "rgba(59,130,246,0.1)" : "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📄</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Documento Completo</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{printModal.type === "reception" ? "Orden de trabajo con QR de seguimiento" : "Acta de entrega con QR comprobante"}</div>
                </div>
              </div>
              <div onClick={() => { printQROnly(printModal.code, printModal.type); setPrintModal(null); }} style={{ padding: "16px 20px", borderRadius: 12, cursor: "pointer", border: "1px solid var(--border)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }} onMouseEnter={(e) => { const c = printModal.type === "reception" ? "#3b82f6" : "#10b981"; e.currentTarget.style.borderColor = c; e.currentTarget.style.background = printModal.type === "reception" ? "rgba(59,130,246,0.06)" : "rgba(16,185,129,0.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-tertiary)"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: printModal.type === "reception" ? "rgba(59,130,246,0.1)" : "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📱</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Solo Código QR</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{printModal.type === "reception" ? "QR azul de seguimiento para el cliente" : "QR verde comprobante de entrega"}</div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
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
          {[{ label: "Panel Principal", path: "/dashboard", icon: "📋", active: true }, { label: "Servicios", path: "/services", icon: "🛠️" }, { label: "Inventario", path: "/inventory", icon: "📦" }, { label: "Software", path: "/software", icon: "🎮" }, { label: "Mensajes", path: "/messages", icon: "💬" }, { label: "Escáner", path: "/scanner", icon: "📷" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾" }, { label: "Extracto", path: "/extracto", icon: "📊" }].map((item) => (
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
          <button onClick={logout} style={{ width: "100%", padding: "9px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 10, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>🚪 Cerrar Sesión</button>
        </div>
      </aside>

      {/* ═══ HEADER ═══ */}
      <header style={{ position: "fixed", top: 0, left: 200, right: 0, height: 64, background: "rgba(12,12,18,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", alignItems: "center", padding: "0 28px", zIndex: 40, gap: 16 }}>
        <div suppressHydrationWarning style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#10b981", animation: "pulse 1s ease-in-out infinite" }} />
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: "#6366f1" }}>{clock.time}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", padding: "2px 5px", background: "rgba(99,102,241,0.1)", borderRadius: 4 }}>{clock.period}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, textTransform: "capitalize" }}>{formatDate(now)} · <span style={{ color: "#6366f1" }}>📍</span> La Paz, Bolivia</div>
          </div>
          <div ref={notifRef} style={{ position: "relative" }}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: showNotifications ? "rgba(99,102,241,0.1)" : "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, position: "relative" }}>🔔{unreadCount > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 17, height: 17, background: "#ef4444", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", border: "2px solid var(--bg-secondary)" }}>{unreadCount}</span>}</button>
            {showNotifications && (<div style={{ position: "absolute", top: 46, right: 0, width: 380, maxHeight: 460, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", boxShadow: "0 12px 48px rgba(0,0,0,0.5)", overflow: "hidden", zIndex: 50, animation: "fadeScale 0.2s ease-out" }}><div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 700, fontSize: 14 }}>Notificaciones {unreadCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", background: "rgba(239,68,68,0.12)", color: "#ef4444", borderRadius: 10, fontWeight: 600 }}>{unreadCount}</span>}</span><div style={{ display: "flex", gap: 10 }}>{unreadCount > 0 && <button onClick={markAllRead} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>✓ Leídas</button>}{notifications.length > 0 && <button onClick={clearAllNotifications} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>🗑️ Limpiar</button>}</div></div><div style={{ maxHeight: 400, overflow: "auto" }}>{notifications.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}><div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>🔔</div><p style={{ fontSize: 13 }}>Sin notificaciones</p></div> : notifications.map((notif, i) => (<div key={notif.id} onClick={() => markNotificationRead(notif.id)} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", background: notif.read ? "transparent" : "rgba(99,102,241,0.03)", display: "flex", gap: 12, alignItems: "flex-start", animation: `fadeIn 0.2s ease-out ${i * 0.03}s both` }}><span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{NOTIF_ICONS[notif.type] || "📋"}</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: notif.read ? 400 : 600, color: notif.read ? "var(--text-secondary)" : "var(--text-primary)" }}>{notif.title}</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{notif.message}</div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{new Date(notif.createdAt).toLocaleString()}</div></div>{!notif.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", flexShrink: 0, marginTop: 6 }} />}</div>))}</div></div>)}
          </div>
        </div>
      </header>

      {/* ═══ CONTENIDO PRINCIPAL ═══ */}
      <div className="main-content" style={{ marginLeft: 200, paddingTop: 64 }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px" }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }} suppressHydrationWarning>{getGreeting()}, {user?.name?.split(" ")[0]} 👋</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Aquí está el resumen de tu taller</p>
          </div>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>{[{ label: "Total Órdenes", value: stats.total, icon: "📋", color: "#6366f1", gradient: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))" }, { label: "Pendientes", value: stats.pending, icon: "⏳", color: "#f59e0b", gradient: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))" }, { label: "En Progreso", value: stats.inProgress, icon: "🔧", color: "#3b82f6", gradient: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.02))" }, { label: "Completadas", value: stats.completed, icon: "✅", color: "#10b981", gradient: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))" }].map((s, i) => (<div key={i} style={{ padding: "20px 18px", background: s.gradient, borderRadius: 16, border: `1px solid ${s.color}15`, animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06 }}>{s.icon}</div><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>{s.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 8, letterSpacing: "-0.5px" }}>{s.value}</div></div>))}</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240, maxWidth: 380, display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)", borderRadius: 12, padding: "0 16px", border: "1px solid var(--border)" }}><span style={{ color: "var(--text-muted)", fontSize: 14 }}>🔍</span><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por código, dispositivo, cliente..." style={{ flex: 1, border: "none", background: "none", padding: "12px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }} /></div>
            <div className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[{ key: "all", label: "Todas", icon: "📋", color: "#6366f1" }, ...Object.entries(STATUS).map(([key, val]) => ({ key, label: val.label, icon: val.icon, color: val.color }))].map((f) => { const isActive = filterStatus === f.key; const count = f.key === "all" ? repairs.length : repairs.filter(r => r.status === f.key).length; return (<button key={f.key} onClick={() => setFilterStatus(f.key)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", background: isActive ? `${f.color}15` : "var(--bg-card)", border: isActive ? `1.5px solid ${f.color}40` : "1.5px solid var(--border)", color: isActive ? f.color : "var(--text-muted)" }}><span style={{ fontSize: 13 }}>{f.icon}</span>{f.label}{count > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6, minWidth: 18, textAlign: "center", background: isActive ? `${f.color}20` : "var(--bg-tertiary)", color: isActive ? f.color : "var(--text-muted)" }}>{count}</span>}</button>); })}</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              {completedRepairs.length > 0 && (<button onClick={openDeliveryModal} style={{ padding: "10px 20px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 12, color: "#818cf8", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>📱 Entregar <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 8, background: "rgba(99,102,241,0.15)", fontWeight: 800 }}>{completedRepairs.length}</span></button>)}
              <button onClick={() => router.push("/new-order")} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #6366f1, #7c3aed)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>＋ Nueva Orden</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}><h2 style={{ fontSize: 18, fontWeight: 700 }}>Reparaciones</h2><span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card)", padding: "3px 10px", borderRadius: 10 }}>{filteredRepairs.length}</span></div>
          {loading ? (<div style={{ padding: 60, textAlign: "center" }}><p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p></div>
          ) : filteredRepairs.length === 0 ? (<div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 18, border: "1px solid var(--border)" }}><div style={{ fontSize: 48, marginBottom: 16 }}>📋</div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay reparaciones</h3><p style={{ color: "var(--text-muted)", fontSize: 13 }}>Crea tu primera orden</p></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredRepairs.map((repair, i) => {
                const st = STATUS[repair.status] || STATUS.pending;
                const isExpanded = expandedId === repair.id;
                const isDelivered = repair.status === "delivered";
                const currentTrackingIndex = isDelivered ? TRACKING_KEYS.length - 1 : TRACKING_KEYS.indexOf(repair.status);
                const nextStatus = !isDelivered && currentTrackingIndex >= 0 && currentTrackingIndex < TRACKING_KEYS.length - 1 ? TRACKING_KEYS[currentTrackingIndex + 1] : undefined;
                const repairAcc = parseAccessoriesDisplay(repair.accessories); const repairImages = parseImages(repair.image); const firstImage = repairImages[0] || null;
                const parsedAll = parseNotesAll(repair.notes, servicesList);
                const repairNotes = parsedAll.notes; const repairServices = parsedAll.services; const repairSoftware = parsedAll.software; const repairRepuestos = parsedAll.repuestos; const repairDeliveryNotes = parsedAll.deliveryNotes;
                return (
                  <div key={repair.id} onClick={() => setExpandedId(isExpanded ? null : repair.id)} style={{ background: "var(--bg-card)", borderRadius: 16, border: `1px solid ${isExpanded ? st.color + "30" : "var(--border)"}`, cursor: "pointer", transition: "all 0.25s", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, overflow: "hidden" }}>
                    {!isExpanded && (
                      <div style={{ display: "flex", alignItems: "stretch" }}>
                        {firstImage ? (<div onClick={(e) => { e.stopPropagation(); setViewImage(firstImage); }} style={{ width: 120, minHeight: 120, flexShrink: 0, cursor: "pointer", position: "relative" }}><img src={firstImage} alt={repair.device} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />{repairImages.length > 1 && <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "2px 6px", fontSize: 10, color: "#fff", fontWeight: 700 }}>+{repairImages.length - 1}</div>}</div>) : (<div style={{ width: 120, minHeight: 120, flexShrink: 0, background: st.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, borderRight: "1px solid var(--border)" }}>{st.icon}</div>)}
                        <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "monospace", fontSize: 12, color: "#6366f1", fontWeight: 700, background: "rgba(99,102,241,0.08)", padding: "2px 8px", borderRadius: 6 }}>{repair.code}</span><span style={{ fontSize: 14, fontWeight: 700 }}>{[repair.device, repair.brand, repair.model].filter(Boolean).join(" ")}</span></div><div className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{repair.clientName && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-secondary)" }}>👤 {repair.clientName}</span>}{repair.clientPhone && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)", color: "var(--text-muted)" }}>📱 {repair.clientPhone}</span>}{repair.technician && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.1)", color: "#a855f7" }}>🔧 {repair.technician.name}</span>}</div><p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>🔧 {repair.issue}</p></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", flexShrink: 0 }}><div style={{ textAlign: "right" }}><span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.color}20`, display: "inline-block" }}>{st.icon} {st.label}</span><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>Bs. {repair.estimatedCost}</div></div><span style={{ fontSize: 14, color: "var(--text-muted)" }}>▾</span></div>
                      </div>
                    )}
                    {isExpanded && (
                      <div style={{ padding: 22, animation: "fadeIn 0.3s ease-out" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{firstImage ? (<div onClick={(e) => { e.stopPropagation(); setViewImage(firstImage); }} style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: `2px solid ${st.color}30`, cursor: "pointer" }}><img src={firstImage} alt={repair.device} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>) : (<div style={{ width: 44, height: 44, borderRadius: 10, background: st.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: `2px solid ${st.color}20`, flexShrink: 0 }}>{st.icon}</div>)}<div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontFamily: "monospace", fontSize: 13, color: "#6366f1", fontWeight: 700 }}>{repair.code}</span><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, border: `1px solid ${st.color}20` }}>{st.icon} {st.label}</span></div><span style={{ fontSize: 15, fontWeight: 700, marginTop: 2, display: "block" }}>{[repair.device, repair.brand, repair.model].filter(Boolean).join(" ")}</span></div></div>
                          <span onClick={(e) => { e.stopPropagation(); setExpandedId(null); }} style={{ fontSize: 14, color: "var(--text-muted)", transform: "rotate(180deg)", cursor: "pointer", padding: 4 }}>▾</span>
                        </div>
                        {repairImages.length > 0 && (<div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginBottom: 10 }}>📷 Fotos ({repairImages.length})</div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{repairImages.map((img, idx) => (<div key={idx} onClick={(e) => { e.stopPropagation(); setViewImage(img); }} style={{ width: repairImages.length === 1 ? "100%" : 180, height: repairImages.length === 1 ? 220 : 140, borderRadius: 12, overflow: "hidden", cursor: "pointer", border: "1px solid var(--border)", flexShrink: 0, position: "relative" }}><img src={img} alt={`Foto ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /><div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 10px", background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}><span style={{ fontSize: 10, color: "#fff" }}>📷 {idx + 1}/{repairImages.length}</span></div></div>))}</div></div>)}
                        <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {(repair.clientName || repair.clientPhone) && (<div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{repair.clientName && <InfoBox label="Nombre" value={repair.clientName} icon="👤" color="#818cf8" bg="rgba(99,102,241,0.04)" span={true} />}{repair.clientPhone && <InfoBox label="Celular" value={repair.clientPhone} icon="📱" color="#818cf8" bg="rgba(99,102,241,0.04)" />}</div>)}
                            <div style={{ padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: 10, borderLeft: `3px solid ${st.color}` }}><div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 4 }}>Problema</div><div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{repair.issue}</div></div>
                            {repairNotes && (<div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.05)", borderRadius: 10, borderLeft: "3px solid #f59e0b" }}><div style={{ fontSize: 9, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 4 }}>Observaciones</div><div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{repairNotes}</div></div>)}
                            {repairDeliveryNotes && (<div style={{ padding: "10px 14px", background: "rgba(107,114,128,0.05)", borderRadius: 10, borderLeft: "3px solid #6b7280" }}><div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 4 }}>Notas de Entrega</div><div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{repairDeliveryNotes}</div></div>)}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><InfoBox label="Dispositivo" value={repair.device} icon="💻" /><InfoBox label="Marca" value={repair.brand || "—"} icon="🏷️" /><InfoBox label="Modelo" value={repair.model || "—"} icon="📋" /><InfoBox label="Costo Est." value={`Bs. ${repair.estimatedCost}`} icon="💰" /></div>
                            {repairAcc.length > 0 && (<div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.04)", borderRadius: 10, borderLeft: "3px solid #10b981" }}><div style={{ fontSize: 9, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 6 }}>Accesorios</div><div className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{repairAcc.map((a) => (<span key={a} style={{ padding: "3px 8px", background: "rgba(16,185,129,0.1)", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#10b981" }}>✓ {a}</span>))}</div></div>)}
                            {repairServices.length > 0 && (<div style={{ padding: "10px 14px", background: "rgba(168,85,247,0.04)", borderRadius: 10, borderLeft: "3px solid #a855f7" }}><div style={{ fontSize: 9, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 6 }}>Servicios</div><div className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{repairServices.map((name) => { const svc = servicesList.find(s => s.name === name); return (<span key={name} style={{ padding: "3px 8px", background: "rgba(168,85,247,0.1)", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#a855f7" }}>{svc?.icon} {name}</span>); })}</div></div>)}
                            {repairSoftware.length > 0 && (<div style={{ padding: "10px 14px", background: "rgba(139,92,246,0.04)", borderRadius: 10, borderLeft: "3px solid #8b5cf6" }}><div style={{ fontSize: 9, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 6 }}>Software</div><div className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{repairSoftware.map((name) => (<span key={name} style={{ padding: "3px 8px", background: "rgba(139,92,246,0.1)", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#8b5cf6" }}>🎮 {name}</span>))}</div></div>)}
                            {repairRepuestos.length > 0 && (<div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.04)", borderRadius: 10, borderLeft: "3px solid #f59e0b" }}><div style={{ fontSize: 9, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, marginBottom: 6 }}>Repuestos Usados</div><div className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{repairRepuestos.map((name) => (<span key={name} style={{ padding: "3px 8px", background: "rgba(245,158,11,0.1)", borderRadius: 6, fontSize: 11, fontWeight: 600, color: "#f59e0b" }}>📦 {name}</span>))}</div></div>)}
                          </div>
                        </div>
                        <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 0 }}>{TRACKING_KEYS.map((key, idx) => { const val = STATUS[key]; const done = isDelivered || idx <= currentTrackingIndex; const current = !isDelivered && idx === currentTrackingIndex; return (<div key={key} style={{ display: "flex", alignItems: "center", flex: idx < TRACKING_KEYS.length - 1 ? 1 : "none" }}><div title={val.label} style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: done ? val.color : "var(--bg-primary)", border: `2px solid ${done ? val.color : "var(--border)"}`, boxShadow: current ? `0 0 10px ${val.color}40` : "none", opacity: done ? 1 : 0.25, flexShrink: 0 }}>{val.icon}</div>{idx < TRACKING_KEYS.length - 1 && <div style={{ flex: 1, height: 2, borderRadius: 2, margin: "0 3px", background: (isDelivered || idx < currentTrackingIndex) ? val.color : "var(--border)" }} />}</div>); })}</div>{isDelivered && (<div style={{ marginTop: 8, textAlign: "center", fontSize: 11, fontWeight: 700, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><span style={{ padding: "3px 10px", borderRadius: 8, background: "rgba(107,114,128,0.1)", border: "1px solid rgba(107,114,128,0.2)" }}>📱 Entregado</span></div>)}</div>
                        <div translate="no" className="filter-btns" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {nextStatus && <button onClick={(e) => { e.stopPropagation(); updateStatus(repair.id, nextStatus); }} style={{ ...btnAction, background: `${STATUS[nextStatus].color}10`, border: `1px solid ${STATUS[nextStatus].color}25`, color: STATUS[nextStatus].color, fontWeight: 700 }}>{STATUS[nextStatus].icon} {STATUS[nextStatus].label}</button>}
                          <button onClick={(e) => { e.stopPropagation(); openEditForm(repair); }} style={{ ...btnAction, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", color: "#6366f1" }}>✏️ Editar</button>
                          <button onClick={(e) => { e.stopPropagation(); router.push("/messages"); }} style={btnAction}>💬 Chat</button>
                          <button onClick={(e) => { e.stopPropagation(); setPrintModal({ code: repair.code, type: "reception" }); }} style={{ ...btnAction, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", color: "#3b82f6" }}>🖨️ Recepción</button>
                          <button onClick={(e) => { e.stopPropagation(); setPrintModal({ code: repair.code, type: "delivery" }); }} style={{ ...btnAction, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", color: "#10b981" }}>🖨️ Entrega</button>
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
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (<div><label style={labelStyle}>{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={fieldStyle} /></div>);
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" };
const fieldStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none" };