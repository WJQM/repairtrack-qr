"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User { id: string; name: string; email: string; role: string; }
interface InventoryItemData { id: string; name: string; category: string | null; quantity: number; price: number; minStock: number; image: string | null; }
interface QuotationItem { inventoryId: string; name: string; price: number; qty: number; stock: number; }
interface Quotation { id: string; type: "quotation" | "sale"; clientName: string; clientPhone: string; items: QuotationItem[]; total: number; notes: string; createdAt: string; }

export default function QuotationsPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryItemData[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"quotation" | "sale">("quotation");
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState<QuotationItem[]>([]);
  const [searchInventory, setSearchInventory] = useState("");
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);

  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);

  const [filterType, setFilterType] = useState<"all" | "quotation" | "sale">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const filteredInventory = inventoryList.filter(item =>
    item.quantity > 0 && (searchInventory === "" || item.name.toLowerCase().includes(searchInventory.toLowerCase()) || (item.category || "").toLowerCase().includes(searchInventory.toLowerCase()))
  );

  const filteredQuotations = quotations.filter(q => {
    const matchType = filterType === "all" || q.type === filterType;
    const matchSearch = searchQuery === "" || q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || q.clientPhone.includes(searchQuery) || q.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  const total = selectedItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const addItem = (inv: InventoryItemData) => {
    const existing = selectedItems.find(i => i.inventoryId === inv.id);
    if (existing) {
      if (existing.qty < inv.quantity) {
        setSelectedItems(prev => prev.map(i => i.inventoryId === inv.id ? { ...i, qty: i.qty + 1 } : i));
      } else { showToast("⚠️ Stock insuficiente"); }
      return;
    }
    setSelectedItems(prev => [...prev, { inventoryId: inv.id, name: inv.name, price: inv.price, qty: 1, stock: inv.quantity }]);
  };

  const updateQty = (inventoryId: string, newQty: number) => {
    const item = selectedItems.find(i => i.inventoryId === inventoryId);
    if (!item) return;
    if (newQty <= 0) { removeItem(inventoryId); return; }
    const inv = inventoryList.find(i => i.id === inventoryId);
    const maxStock = inv?.quantity || item.stock;
    if (newQty > maxStock) { showToast("⚠️ Stock insuficiente"); return; }
    setSelectedItems(prev => prev.map(i => i.inventoryId === inventoryId ? { ...i, qty: newQty } : i));
  };

  const removeItem = (inventoryId: string) => {
    setSelectedItems(prev => prev.filter(i => i.inventoryId !== inventoryId));
  };

  // ✅ MODIFICADO: Función para generar códigos secuenciales (igual que OT-1, OT-2...)
  const generateNextCode = (prefix: "COT" | "NV", existing: Quotation[]): string => {
    let maxNum = 0;
    existing.forEach(q => {
      const match = q.id.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) { const n = parseInt(match[1], 10); if (n > maxNum) maxNum = n; }
    });
    return `${prefix}-${maxNum + 1}`;
  };

  const openCreateModal = (type: "quotation" | "sale") => {
    setModalType(type); setEditingQuotation(null); setShowModal(true);
    setClientName(""); setClientPhone(""); setNotes("");
    setSelectedItems([]); setSearchInventory(""); setShowInventoryPicker(false);
  };

  const openEditModal = (q: Quotation) => {
    setEditingQuotation(q); setModalType(q.type); setShowModal(true);
    setClientName(q.clientName); setClientPhone(q.clientPhone); setNotes(q.notes);
    setSelectedItems(q.items.map(item => ({ ...item })));
    setSearchInventory(""); setShowInventoryPicker(false);
    setViewQuotation(null);
  };

  const reloadInventory = async () => {
    try { const res = await fetch("/api/inventory"); if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setInventoryList(data); } } catch {}
  };

  const restoreStock = async (items: QuotationItem[]) => {
    const token = localStorage.getItem("token"); if (!token) return;
    for (const item of items) {
      const inv = inventoryList.find(i => i.id === item.inventoryId);
      if (inv) {
        await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: item.inventoryId, quantity: inv.quantity + item.qty }) });
      }
    }
    await reloadInventory();
  };

  const reduceStock = async (items: QuotationItem[]) => {
    const token = localStorage.getItem("token"); if (!token) return;
    for (const item of items) {
      const inv = inventoryList.find(i => i.id === item.inventoryId);
      if (inv) {
        if (inv.quantity < item.qty) { showToast(`⚠️ Stock insuficiente para ${item.name}`); return false; }
        await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: item.inventoryId, quantity: inv.quantity - item.qty }) });
      }
    }
    await reloadInventory();
    return true;
  };

  const saveQuotation = async () => {
    if (selectedItems.length === 0) { showToast("⚠️ Agrega al menos un artículo"); return; }
    if (!clientName.trim()) { showToast("⚠️ Ingresa el nombre del cliente"); return; }

    if (editingQuotation) {
      if (editingQuotation.type === "sale") {
        await restoreStock(editingQuotation.items);
        const ok = await reduceStock(selectedItems);
        if (ok === false) return;
      }
      if (editingQuotation.type === "quotation" && modalType === "sale") {
        const ok = await reduceStock(selectedItems);
        if (ok === false) return;
      }
      const updated = quotations.map(q => q.id === editingQuotation.id ? {
        ...q, type: modalType, clientName: clientName.trim(), clientPhone: clientPhone.trim(),
        items: selectedItems, total, notes: notes.trim(),
      } : q);
      localStorage.setItem("quotations", JSON.stringify(updated));
      setQuotations(updated);
      setShowModal(false);
      showToast("✏️ Documento actualizado");
    } else {
      if (modalType === "sale") {
        const ok = await reduceStock(selectedItems);
        if (ok === false) return;
      }
      const newQ: Quotation = {
        // ✅ MODIFICADO: Numeración secuencial en vez de hash aleatorio
        id: generateNextCode(modalType === "quotation" ? "COT" : "NV", quotations),
        type: modalType, clientName: clientName.trim(), clientPhone: clientPhone.trim(),
        items: selectedItems, total, notes: notes.trim(), createdAt: new Date().toISOString(),
      };
      const saved = [newQ, ...quotations];
      localStorage.setItem("quotations", JSON.stringify(saved));
      setQuotations(saved);
      setShowModal(false);
      showToast(modalType === "quotation" ? "📋 Cotización creada" : "💰 Nota de venta registrada");
    }
  };

  const deleteQuotation = async (q: Quotation) => {
    if (!confirm("¿Eliminar este documento?")) return;
    if (q.type === "sale") { await restoreStock(q.items); }
    const updated = quotations.filter(x => x.id !== q.id);
    localStorage.setItem("quotations", JSON.stringify(updated));
    setQuotations(updated);
    setViewQuotation(null);
    showToast("🗑️ Documento eliminado" + (q.type === "sale" ? " y stock restaurado" : ""));
  };

  const convertToSale = async (quotation: Quotation) => {
    if (!confirm("¿Convertir esta cotización en nota de venta? Se reducirá el stock.")) return;
    for (const item of quotation.items) {
      const inv = inventoryList.find(i => i.id === item.inventoryId);
      if (inv && inv.quantity < item.qty) { showToast(`⚠️ Stock insuficiente para ${item.name}`); return; }
    }
    const ok = await reduceStock(quotation.items);
    if (ok === false) return;
    // ✅ MODIFICADO: Numeración secuencial en vez de hash aleatorio
    const newId = generateNextCode("NV", quotations);
    const updated = quotations.map(q => q.id === quotation.id ? { ...q, type: "sale" as const, id: newId } : q);
    localStorage.setItem("quotations", JSON.stringify(updated));
    setQuotations(updated);
    setViewQuotation(null);
    showToast("💰 Cotización convertida a nota de venta");
  };

  // ═══ IMPRIMIR DOCUMENTO COMPLETO ═══
  const printDocument = (q: Quotation) => {
    const origin = window.location.origin;
    const isQuot = q.type === "quotation";
    const color = isQuot ? "#d97706" : "#059669";
    const colorLight = isQuot ? "#fef3c7" : "#d1fae5";
    const colorBorder = isQuot ? "#fde68a" : "#6ee7b7";
    const docTitle = isQuot ? "COTIZACIÓN" : "NOTA DE VENTA";
    const docIcon = isQuot ? "📋" : "💰";
    const today = new Date().toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric" });
    const createdDate = new Date(q.createdAt).toLocaleDateString("es-BO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const qrUrl = `${origin}/quotations?view=${q.id}`;
    const qrColor = isQuot ? "d97706" : "059669";
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}&color=${qrColor}`;
    const total = q.total.toFixed(2);
    const itemsHtml = q.items.map((item, idx) => `<tr style="background:${idx % 2 === 0 ? "#fff" : "#fafafa"}"><td style="padding:10px 16px;font-size:12px;color:#888;border-bottom:1px solid #f0f0f0">${idx + 1}</td><td style="padding:10px 16px;font-size:13px;font-weight:600;border-bottom:1px solid #f0f0f0">📦 ${item.name}</td><td style="padding:10px 16px;font-size:13px;font-weight:700;text-align:center;border-bottom:1px solid #f0f0f0">${item.qty}</td><td style="padding:10px 16px;font-size:12px;text-align:right;color:#555;border-bottom:1px solid #f0f0f0">Bs. ${item.price.toFixed(2)}</td><td style="padding:10px 16px;font-size:13px;font-weight:700;text-align:right;color:${color};border-bottom:1px solid #f0f0f0">Bs. ${(item.price * item.qty).toFixed(2)}</td></tr>`).join("");
    const totalQty = q.items.reduce((s, i) => s + i.qty, 0);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${docTitle} - ${q.id}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{background:#fff;font-family:'Segoe UI',Arial,sans-serif;color:#111}
@media print{@page{size:A4;margin:15mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}
table{width:100%;border-collapse:collapse}
</style></head><body>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;padding:12px 24px;background:#111118;display:flex;justify-content:space-between;align-items:center;z-index:100">
<span style="color:#eee;font-size:14px;font-weight:600">${docIcon} ${docTitle} — ${q.id}</span>
<div style="display:flex;gap:10px">
<button onclick="window.print()" style="padding:8px 20px;background:linear-gradient(135deg,${color},${isQuot ? "#b45309" : "#047857"});border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer">🖨️ Imprimir</button>
<button onclick="window.close()" style="padding:8px 20px;background:#1e1e2e;border:1px solid #2e2e3e;border-radius:8px;color:#888;font-size:13px;font-weight:600;cursor:pointer">✕ Cerrar</button>
</div></div>
<div style="max-width:780px;margin:0 auto;padding:80px 40px 40px">
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${color};padding-bottom:20px;margin-bottom:24px">
<div><h1 style="font-size:28px;font-weight:800">Repair<span style="color:#6366f1">Track</span><span style="color:#818cf8;font-size:20px">QR</span></h1><p style="font-size:11px;color:#666;margin-top:4px">SISTEMA DE GESTIÓN DE REPARACIONES</p></div>
<div style="text-align:right"><div style="display:inline-block;padding:6px 16px;background:${color};border-radius:6px;margin-bottom:4px"><span style="font-size:16px;font-weight:800;color:#fff;font-family:monospace;letter-spacing:1px">${q.id}</span></div><p style="font-size:11px;color:#666;margin-top:4px">Fecha: ${today}</p></div>
</div>
<div style="background:${colorLight};padding:14px 20px;border-radius:8px;margin-bottom:24px;text-align:center;border:2px solid ${colorBorder}">
<h2 style="font-size:20px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:1px">${docIcon} ${docTitle}</h2>
<p style="font-size:11px;color:#666;margin-top:4px">${isQuot ? "Presupuesto válido por 15 días a partir de la fecha de emisión" : "Documento que acredita la venta de artículos"}</p>
</div>
<div style="display:flex;gap:20px;margin-bottom:24px">
<div style="flex:1;border:1px solid #e2e2e2;border-radius:8px;overflow:hidden">
<div style="background:#f0f0ff;padding:10px 16px;border-bottom:1px solid #d5d5ef"><h3 style="font-size:12px;font-weight:700;color:#6366f1;text-transform:uppercase">👤 Datos del Cliente</h3></div>
<div style="padding:16px">
<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;margin-bottom:4px">Nombre</div><div style="font-size:16px;font-weight:700">${q.clientName || "—"}</div></div>
<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;margin-bottom:4px">Celular</div><div style="font-size:16px;font-weight:700">${q.clientPhone || "—"}</div></div>
<div><div style="font-size:10px;color:#888;font-weight:600;text-transform:uppercase;margin-bottom:4px">Fecha de Emisión</div><div style="font-size:13px;font-weight:600">${createdDate}</div></div>
</div></div>
<div style="text-align:center;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
<div style="display:inline-block;padding:10px;border:2px solid ${color};border-radius:12px;background:#fff"><img src="${qrImg}" alt="QR" width="120" height="120" style="display:block" /></div>
<p style="font-size:9px;color:${color};margin-top:6px;font-weight:600">QR ${docTitle}</p>
<p style="font-size:13px;font-weight:800;color:${color};font-family:monospace;margin-top:2px">${q.id}</p>
</div></div>
<div style="margin-bottom:24px;border:1px solid #e2e2e2;border-radius:8px;overflow:hidden">
<div style="background:${colorLight};padding:10px 16px;border-bottom:1px solid ${colorBorder}"><h3 style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase">📦 Detalle de Artículos</h3></div>
<table><thead><tr style="background:#f9fafb">
<th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;border-bottom:2px solid #e5e7eb">#</th>
<th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Artículo</th>
<th style="padding:10px 16px;text-align:center;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Cant.</th>
<th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;border-bottom:2px solid #e5e7eb">P. Unitario</th>
<th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;border-bottom:2px solid #e5e7eb">Subtotal</th>
</tr></thead><tbody>${itemsHtml}</tbody></table>
<div style="padding:16px;display:flex;justify-content:space-between;align-items:center;border-top:2px solid #e5e7eb;background:#f9fafb">
<span style="font-size:11px;color:#888">${q.items.length} artículo${q.items.length > 1 ? "s" : ""} · ${totalQty} unidades</span>
<div style="text-align:right"><div style="font-size:12px;color:#888;font-weight:600">TOTAL</div><div style="font-size:24px;font-weight:800;color:${color}">Bs. ${total}</div></div>
</div></div>
${q.notes ? `<div style="margin-bottom:24px;border:1px solid #e2e2e2;border-radius:8px;overflow:hidden"><div style="background:#fffbeb;padding:10px 16px;border-bottom:1px solid #fde68a"><h3 style="font-size:12px;font-weight:700;color:#b45309;text-transform:uppercase">📝 Notas / Observaciones</h3></div><div style="padding:12px 16px"><p style="font-size:13px;line-height:1.7;color:#333">${q.notes}</p></div></div>` : ""}
${isQuot ? `<div style="margin-bottom:24px;border:1px solid #e2e2e2;border-radius:8px;overflow:hidden"><div style="background:#fef3c7;padding:10px 16px;border-bottom:1px solid #fde68a"><h3 style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase">📋 Condiciones de la Cotización</h3></div><div style="padding:12px 16px;font-size:11px;color:#666;line-height:1.8"><p>1. Esta cotización tiene una validez de <strong>15 días</strong> a partir de su fecha de emisión.</p><p>2. Los precios están sujetos a disponibilidad de stock.</p><p>3. Los precios no incluyen el servicio de instalación salvo que se indique.</p><p>4. Para hacer efectiva la compra, presente este documento o el código <strong>${q.id}</strong>.</p></div></div>` : `<div style="margin-bottom:24px;padding:16px 20px;background:#d1fae5;border-radius:8px;border:2px solid #6ee7b7"><h3 style="font-size:12px;font-weight:700;color:#047857;text-transform:uppercase;margin-bottom:8px">✅ Confirmación de Venta</h3><p style="font-size:11px;line-height:1.7;color:#333">Se confirma la venta de los artículos detallados al cliente <strong>${q.clientName}</strong> por un total de <strong>Bs. ${total}</strong>. Los artículos han sido descontados del inventario. Garantía según política de cada producto.</p></div>`}
<div style="display:flex;gap:40px;margin-bottom:24px;margin-top:36px">
<div style="flex:1;text-align:center"><div style="border-bottom:2px solid #333;margin-bottom:8px;height:50px"></div><p style="font-size:12px;font-weight:700">Vendedor / Técnico</p><p style="font-size:10px;color:#888">Nombre y Firma</p></div>
<div style="flex:1;text-align:center"><div style="border-bottom:2px solid #333;margin-bottom:8px;height:50px"></div><p style="font-size:12px;font-weight:700">Cliente: ${q.clientName || "________________"}</p><p style="font-size:10px;color:#888">Firma de Conformidad</p></div>
</div>
<div style="text-align:center;padding-top:12px;border-top:1px solid #e2e2e2"><p style="font-size:10px;color:#999">RepairTrackQR — ${docTitle} — ${today} — ${q.id}</p></div>
</div></body></html>`);
    w.document.close();
  };

  // ═══ IMPRIMIR SOLO QR ═══
  const printQROnly = (q: Quotation) => {
    const origin = window.location.origin;
    const isQuot = q.type === "quotation";
    const qrUrl = `${origin}/quotations?view=${q.id}`;
    const color = isQuot ? "#d97706" : "#059669";
    const qrColor = isQuot ? "d97706" : "059669";
    const title = isQuot ? "QR Cotización" : "QR Nota de Venta";
    const subtitle = isQuot ? "Escanea para ver la cotización" : "Escanea para ver la nota de venta";
    const badge = isQuot ? "📋 Cotización" : "💰 Nota de Venta";
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}&color=${qrColor}&bgcolor=ffffff&margin=0`;
    const w = window.open("", "_blank");
    if (!w) return;
    // ✅ MODIFICADO: Se eliminaron datos del cliente (nombre, teléfono, total) del popup QR
    w.document.write(`<!DOCTYPE html><html><head><title>${title} - ${q.id}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:30px;background:#fff}
.card{background:#fff;border-radius:20px;padding:40px;text-align:center;max-width:360px;width:100%}
.badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:10px;font-weight:700;color:#fff;background:${color};margin-bottom:12px;text-transform:uppercase;letter-spacing:1px}
h2{font-size:22px;font-weight:800;color:#111;margin-bottom:4px}
.sub{font-size:12px;color:#888;margin-bottom:24px}
.qr-frame{padding:16px;border:3px solid ${color};border-radius:16px;display:inline-block;margin-bottom:20px;background:#fff}
.qr-frame img{display:block;width:200px;height:200px}
.code{font-family:monospace;font-size:20px;font-weight:800;color:${color};letter-spacing:1px;margin-bottom:20px}
.actions{display:flex;gap:10px;justify-content:center}
button{padding:12px 28px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
.btn-print{background:${color};color:#fff}
.btn-close{background:#f3f4f6;color:#666}
@media print{.actions{display:none}.badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
</head><body><div class="card">
<span class="badge">${badge}</span>
<h2>${title}</h2><p class="sub">${subtitle}</p>
<div class="qr-frame"><img src="${qrImg}" alt="QR Code" /></div>
<div class="code">${q.id}</div>
<div class="actions"><button class="btn-print" onclick="window.print()">🖨️ Imprimir</button><button class="btn-close" onclick="window.close()">✕ Cerrar</button></div>
</div></body></html>`);
    w.document.close();
  };

  useEffect(() => {
    const userData = localStorage.getItem("user"); const token = localStorage.getItem("token");
    if (!userData || !token) { router.push("/"); return; }
    setUser(JSON.parse(userData));
    fetch("/api/inventory").then(res => res.json()).then(data => { if (Array.isArray(data)) setInventoryList(data); }).catch(() => {});
    setQuotations(JSON.parse(localStorage.getItem("quotations") || "[]"));
    setLoading(false);
    // Auto-abrir si viene con ?view=
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get("view");
    if (viewId) {
      const saved = JSON.parse(localStorage.getItem("quotations") || "[]");
      const found = saved.find((q: Quotation) => q.id === viewId);
      if (found) setViewQuotation(found);
    }
  }, []);

  if (!user) return null;
  const stats = { totalQuotations: quotations.filter(q => q.type === "quotation").length, totalSales: quotations.filter(q => q.type === "sale").length};

  return (
    <div className="main-content" style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingLeft: 200, paddingTop: 0 }}>
      {toast && <div style={{ position: "fixed", top: 24, right: 24, padding: "14px 24px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(16,185,129,0.3)", zIndex: 200, animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>{toast}</div>}

      {/* ═══ MODAL CREAR / EDITAR ═══ */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 780, maxHeight: "90vh", overflow: "auto", background: "var(--bg-card)", borderRadius: 20, border: `1px solid ${modalType === "quotation" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeScale 0.3s ease-out" }}>
            <div style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: modalType === "quotation" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{modalType === "quotation" ? "📋" : "💰"}</div>
                  <div><h3 style={{ fontSize: 17, fontWeight: 700 }}>{editingQuotation ? "Editar" : "Nueva"} {modalType === "quotation" ? "Cotización" : "Nota de Venta"}</h3><p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{editingQuotation ? `Editando ${editingQuotation.id}` : modalType === "quotation" ? "Genera un presupuesto" : "Registra una venta"}</p></div>
                </div>
                <button onClick={() => setShowModal(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              {editingQuotation && (<div style={{ marginBottom: 20, display: "flex", gap: 8 }}>{(["quotation", "sale"] as const).map(t => { const active = modalType === t; const c = t === "quotation" ? "#f59e0b" : "#10b981"; return (<button key={t} onClick={() => setModalType(t)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${active ? c : "var(--border)"}`, background: active ? `${c}15` : "var(--bg-tertiary)", color: active ? c : "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{t === "quotation" ? "📋 Cotización" : "💰 Nota de Venta"}</button>); })}</div>)}
              <div style={{ marginBottom: 20, padding: "14px 18px", background: "rgba(99,102,241,0.04)", borderRadius: 12, border: "1px solid rgba(99,102,241,0.08)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>👤 Datos del Cliente</div>
                <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={labelStyle}>Nombre *</label><input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Juan Pérez" style={fieldStyle} /></div>
                  <div><label style={labelStyle}>Celular</label><input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="70012345" style={fieldStyle} /></div>
                </div>
              </div>
              <div style={{ marginBottom: 20, padding: "14px 18px", background: "rgba(245,158,11,0.04)", borderRadius: 12, border: `1px solid ${showInventoryPicker ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.1)"}` }}>
                <div onClick={() => setShowInventoryPicker(!showInventoryPicker)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>📦 Agregar Artículos {selectedItems.length > 0 && <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontWeight: 800 }}>{selectedItems.length}</span>}</div>
                  <div style={{ width: 26, height: 26, borderRadius: 6, background: showInventoryPicker ? "rgba(245,158,11,0.15)" : "var(--bg-tertiary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#f59e0b", transition: "all 0.2s", transform: showInventoryPicker ? "rotate(180deg)" : "none" }}>▾</div>
                </div>
                {showInventoryPicker && (<div style={{ marginTop: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", borderRadius: 6, padding: "0 10px", border: "1px solid var(--border)", marginBottom: 8 }}><span style={{ fontSize: 11, color: "var(--text-muted)" }}>🔍</span><input value={searchInventory} onChange={(e) => setSearchInventory(e.target.value)} placeholder="Buscar artículo..." style={{ flex: 1, border: "none", background: "none", padding: "7px 0", color: "var(--text-primary)", fontSize: 11, outline: "none" }} />{searchInventory && <span onClick={() => setSearchInventory("")} style={{ cursor: "pointer", fontSize: 10, color: "var(--text-muted)" }}>✕</span>}</div><div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 220, overflow: "auto" }}>{filteredInventory.map((item) => { const inCart = selectedItems.find(i => i.inventoryId === item.id); return (<div key={item.id} onClick={() => addItem(item)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", userSelect: "none", transition: "all 0.15s", border: `2px solid ${inCart ? "#f59e0b" : "var(--border)"}`, background: inCart ? "rgba(245,158,11,0.1)" : "var(--bg-tertiary)", display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: inCart ? "none" : "2px solid var(--border)", background: inCart ? "#f59e0b" : "transparent", color: "#fff", fontSize: 9, fontWeight: 800 }}>{inCart ? inCart.qty : ""}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 600, color: inCart ? "#f59e0b" : "var(--text-muted)", lineHeight: 1.2 }}>📦 {item.name}</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}><span style={{ fontSize: 10, fontWeight: 800, color: inCart ? "#fbbf24" : "var(--text-muted)" }}>Bs. {item.price}</span><span style={{ fontSize: 9, color: item.quantity <= item.minStock ? "#ef4444" : "var(--text-muted)" }}>Stock: {item.quantity}</span></div></div></div>); })}</div>{filteredInventory.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 10 }}>No hay artículos disponibles</div>}</div>)}
              </div>
              {selectedItems.length > 0 && (<div style={{ marginBottom: 20, padding: "14px 18px", background: "var(--bg-tertiary)", borderRadius: 12, border: "1px solid var(--border)" }}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>🛒 Artículos Seleccionados</div><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{selectedItems.map((item) => (<div key={item.inventoryId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border)" }}><div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>📦 {item.name}</div><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Bs. {item.price} c/u</div></div><div style={{ display: "flex", alignItems: "center", gap: 6 }}><button onClick={() => updateQty(item.inventoryId, item.qty - 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button><span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{item.qty}</span><button onClick={() => updateQty(item.inventoryId, item.qty + 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button></div><div style={{ textAlign: "right", minWidth: 70 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Bs. {(item.price * item.qty).toFixed(2)}</div></div><button onClick={() => removeItem(item.inventoryId)} style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button></div>))}</div><div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 14, fontWeight: 700 }}>Total:</span><span style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>Bs. {total.toFixed(2)}</span></div></div>)}
              <div style={{ marginBottom: 20 }}><label style={labelStyle}>📝 Notas (Opcional)</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones, condiciones, garantía..." rows={2} style={{ ...fieldStyle, resize: "vertical" }} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowModal(false)} style={{ padding: "12px 24px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                <button onClick={saveQuotation} style={{ flex: 1, padding: "12px 28px", background: modalType === "quotation" ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: modalType === "quotation" ? "0 4px 16px rgba(245,158,11,0.3)" : "0 4px 16px rgba(16,185,129,0.3)" }}>{editingQuotation ? "💾 Guardar Cambios" : modalType === "quotation" ? "📋 Crear Cotización" : "💰 Registrar Venta"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL VER DETALLE ═══ */}
      {viewQuotation && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto", background: "var(--bg-card)", borderRadius: 20, border: `1px solid ${viewQuotation.type === "quotation" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", animation: "fadeScale 0.3s ease-out" }}>
            <div style={{ padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: viewQuotation.type === "quotation" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{viewQuotation.type === "quotation" ? "📋" : "💰"}</div>
                  <div><h3 style={{ fontSize: 16, fontWeight: 700 }}>{viewQuotation.type === "quotation" ? "Cotización" : "Nota de Venta"}</h3><span style={{ fontFamily: "monospace", fontSize: 12, color: "#6366f1", fontWeight: 700 }}>{viewQuotation.id}</span></div>
                </div>
                <button onClick={() => setViewQuotation(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: 10, border: "1px solid var(--border)" }}><div style={{ fontSize: 9, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Cliente</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>👤 {viewQuotation.clientName}</div></div>
                <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: 10, border: "1px solid var(--border)" }}><div style={{ fontSize: 9, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Celular</div><div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>📱 {viewQuotation.clientPhone || "—"}</div></div>
              </div>
              <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderRadius: 10, border: "1px solid var(--border)" }}><div style={{ fontSize: 9, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Fecha</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>📅 {new Date(viewQuotation.createdAt).toLocaleString("es-BO")}</div></div>
                <div style={{ padding: "12px 16px", background: viewQuotation.type === "quotation" ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)", borderRadius: 10, border: `1px solid ${viewQuotation.type === "quotation" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)"}` }}><div style={{ fontSize: 9, color: viewQuotation.type === "quotation" ? "#f59e0b" : "#10b981", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Tipo</div><div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: viewQuotation.type === "quotation" ? "#f59e0b" : "#10b981" }}>{viewQuotation.type === "quotation" ? "📋 Cotización" : "💰 Nota de Venta"}</div></div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>📦 Artículos</div>
                {viewQuotation.items.map((item, idx) => (<div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: idx % 2 === 0 ? "var(--bg-tertiary)" : "transparent", borderRadius: 8, marginBottom: 2 }}><div><span style={{ fontSize: 12, fontWeight: 600 }}>📦 {item.name}</span><span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>×{item.qty} · Bs.{item.price} c/u</span></div><span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Bs. {(item.price * item.qty).toFixed(2)}</span></div>))}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "2px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 15, fontWeight: 700 }}>Total:</span><span style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>Bs. {viewQuotation.total.toFixed(2)}</span></div>
              </div>
              {viewQuotation.notes && (<div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.05)", borderRadius: 10, borderLeft: "3px solid #f59e0b", marginBottom: 16 }}><div style={{ fontSize: 9, color: "#f59e0b", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Notas</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{viewQuotation.notes}</div></div>)}

              {/* ═══ BOTONES DE ACCIÓN ACTUALIZADOS ═══ */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => openEditModal(viewQuotation)} style={{ padding: "10px 18px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, color: "#6366f1", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✏️ Editar</button>
                {viewQuotation.type === "quotation" && <button onClick={() => convertToSale(viewQuotation)} style={{ padding: "10px 18px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, color: "#10b981", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💰 Convertir a Venta</button>}
                <button onClick={() => printDocument(viewQuotation)} style={{ padding: "10px 18px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, color: "#818cf8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🖨️ Documento</button>
                <button onClick={() => printQROnly(viewQuotation)} style={{ padding: "10px 18px", background: viewQuotation.type === "quotation" ? "rgba(217,119,6,0.08)" : "rgba(5,150,105,0.08)", border: `1px solid ${viewQuotation.type === "quotation" ? "rgba(217,119,6,0.2)" : "rgba(5,150,105,0.2)"}`, borderRadius: 10, color: viewQuotation.type === "quotation" ? "#d97706" : "#059669", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📱 QR</button>
                <button onClick={() => deleteQuotation(viewQuotation)} style={{ padding: "10px 18px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}>🗑️ Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
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
          {[...(user?.role === "tech" ? [{ label: "Mis Asignaciones", path: "/asignaciones", icon: "📋" }, { label: "Mensajes", path: "/messages", icon: "💬" }, { label: "Escáner", path: "/scanner", icon: "📷" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾" }] : [{ label: "Panel Principal", path: "/dashboard", icon: "📋" }, { label: "Servicios", path: "/services", icon: "🛠️" }, { label: "Inventario", path: "/inventory", icon: "📦" }, { label: "Software", path: "/software", icon: "🎮" }, { label: "Mensajes", path: "/messages", icon: "💬" }, { label: "Escáner", path: "/scanner", icon: "📷" }, { label: "Cotizaciones", path: "/quotations", icon: "🧾" }, { label: "Extracto", path: "/extracto", icon: "📊" }])].map(item => ({ ...item, active: item.path === "/quotations" })).map((item) => (
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


      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ marginBottom: 28 }}><h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>🧾 Cotizaciones y Notas de Venta</h1><p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>Crea presupuestos y registra ventas con tu inventario</p></div>

        <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 28 }}>
          {[{ label: "Cotizaciones", value: stats.totalQuotations, icon: "📋", color: "#f59e0b", gradient: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))" }, { label: "Notas de Venta", value: stats.totalSales, icon: "💰", color: "#10b981", gradient: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))" }].map((s, i) => (<div key={i} style={{ padding: "20px 18px", background: s.gradient, borderRadius: 16, border: `1px solid ${s.color}15`, position: "relative", overflow: "hidden", animation: `fadeIn 0.4s ease-out ${i * 0.06}s both` }}><div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06 }}>{s.icon}</div><div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>{s.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 8 }}>{s.value}</div></div>))}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 340, display: "flex", alignItems: "center", gap: 10, background: "var(--bg-card)", borderRadius: 12, padding: "0 16px", border: "1px solid var(--border)" }}><span style={{ color: "var(--text-muted)", fontSize: 14 }}>🔍</span><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por cliente, ID..." style={{ flex: 1, border: "none", background: "none", padding: "12px 0", color: "var(--text-primary)", fontSize: 13, outline: "none" }} /></div>
          <div style={{ display: "flex", gap: 6 }}>{([{ key: "all", label: "Todas", icon: "📄", color: "#6366f1" }, { key: "quotation", label: "Cotizaciones", icon: "📋", color: "#f59e0b" }, { key: "sale", label: "Ventas", icon: "💰", color: "#10b981" }] as const).map((f) => { const isActive = filterType === f.key; const count = f.key === "all" ? quotations.length : quotations.filter(q => q.type === f.key).length; return (<button key={f.key} onClick={() => setFilterType(f.key)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 11, fontWeight: isActive ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: isActive ? `${f.color}15` : "var(--bg-card)", border: isActive ? `1.5px solid ${f.color}40` : "1.5px solid var(--border)", color: isActive ? f.color : "var(--text-muted)" }}><span style={{ fontSize: 13 }}>{f.icon}</span>{f.label}{count > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: isActive ? `${f.color}20` : "var(--bg-tertiary)", color: isActive ? f.color : "var(--text-muted)" }}>{count}</span>}</button>); })}</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button onClick={() => openCreateModal("quotation")} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(245,158,11,0.3)" }}>📋 Nueva Cotización</button>
            <button onClick={() => openCreateModal("sale")} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.3)" }}>💰 Nueva Venta</button>
          </div>
        </div>

        {loading ? (<div style={{ padding: 60, textAlign: "center" }}><p style={{ color: "var(--text-muted)", fontSize: 14 }}>Cargando...</p></div>
        ) : filteredQuotations.length === 0 ? (<div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 18, border: "1px solid var(--border)" }}><div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Sin documentos</h3><p style={{ color: "var(--text-muted)", fontSize: 13 }}>Crea tu primera cotización o nota de venta</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredQuotations.map((q, i) => { const isQuot = q.type === "quotation"; const color = isQuot ? "#f59e0b" : "#10b981"; const bg = isQuot ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)"; return (
              <div key={q.id} onClick={() => setViewQuotation(q)} style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", cursor: "pointer", transition: "all 0.25s", animation: `fadeIn 0.3s ease-out ${i * 0.04}s both`, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{isQuot ? "📋" : "💰"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "monospace", fontSize: 12, color: "#6366f1", fontWeight: 700, background: "rgba(99,102,241,0.08)", padding: "2px 8px", borderRadius: 6 }}>{q.id}</span><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, color, background: bg }}>{isQuot ? "📋 Cotización" : "💰 Venta"}</span></div>
                  <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}><span>👤 {q.clientName}</span>{q.clientPhone && <span>📱 {q.clientPhone}</span>}<span>📦 {q.items.length} art.</span></div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 16, fontWeight: 800, color }}>Bs. {q.total.toFixed(2)}</div><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{new Date(q.createdAt).toLocaleDateString("es-BO")}</div></div>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>▸</span>
              </div>
            ); })}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" };
const fieldStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 13, outline: "none" };
