"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface InventoryItem { id: string; name: string; category: string | null; quantity: number; price: number; minStock: number; active: boolean; }

const CATEGORIES = ["Repuestos", "Discos / SSD", "Memorias RAM", "Pantallas", "Baterías", "Cargadores", "Cables", "Teclados", "Otros"];

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadItems = async () => {
    try { const res = await fetch("/api/inventory"); if (res.ok) setItems(await res.json()); } catch {}
    setLoading(false);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/"); return; }
    loadItems();
  }, []);

  const resetForm = () => { setName(""); setCategory(""); setQuantity(""); setPrice(""); setMinStock("5"); setEditingId(null); setShowForm(false); };

  const saveItem = async () => {
    const token = localStorage.getItem("token"); if (!token) return;
    if (!name.trim()) { showToast("❌ Nombre es requerido"); return; }
    try {
      if (editingId) {
        const res = await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: editingId, name, category, quantity, price, minStock }) });
        if (res.ok) { showToast("✅ Item actualizado"); resetForm(); loadItems(); }
      } else {
        const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name, category, quantity, price, minStock }) });
        if (res.ok) { showToast("✅ Item agregado al inventario"); resetForm(); loadItems(); }
      }
    } catch { showToast("❌ Error de conexión"); }
  };

  const editItem = (item: InventoryItem) => {
    setEditingId(item.id); setName(item.name); setCategory(item.category || "");
    setQuantity(String(item.quantity)); setPrice(String(item.price)); setMinStock(String(item.minStock));
    setShowForm(true);
  };

  const deleteItem = async (id: string) => {
    if (!confirm("¿Eliminar este item del inventario?")) return;
    const token = localStorage.getItem("token"); if (!token) return;
    try {
      const res = await fetch("/api/inventory", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      if (res.ok) { showToast("🗑️ Item eliminado"); loadItems(); }
    } catch {}
  };

  const updateQuantity = async (id: string, delta: number) => {
    const token = localStorage.getItem("token"); if (!token) return;
    const item = items.find(i => i.id === id); if (!item) return;
    const newQty = Math.max(0, item.quantity + delta);
    try {
      await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id, quantity: newQty }) });
      loadItems();
    } catch {}
  };

  const filteredItems = items.filter(item => {
    const matchSearch = searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = filterCategory === "all" || item.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const totalValue = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const lowStock = items.filter(i => i.quantity <= i.minStock).length;
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {toast && <div style={{ position: "fixed", top: 24, right: 24, padding: "14px 24px", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", borderRadius: 14, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(16,185,129,0.3)", zIndex: 100, animation: "slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>{toast}</div>}
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(80px) scale(0.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <header style={{ padding: "0 28px", height: 64, background: "rgba(12,12,18,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 0 20px rgba(59,130,246,0.2)" }}>📦</div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>Repair<span style={{ color: "#6366f1" }}>Track</span><span style={{ color: "#818cf8", fontSize: 13 }}>QR</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[{ label: "📋 Panel Principal", path: "/dashboard" }, { label: "🛠️ Servicios", path: "/services" }, { label: "📦 Inventario", path: "/inventory", active: true }, { label: "💬 Mensajes", path: "/messages" }, { label: "📷 Escáner", path: "/scanner" }].map((btn) => (
            <button key={btn.path} onClick={() => router.push(btn.path)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: (btn as any).active ? "rgba(59,130,246,0.12)" : "transparent", color: (btn as any).active ? "#3b82f6" : "var(--text-muted)" }}>{btn.label}</button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total Items", value: items.length, icon: "📦", color: "#3b82f6" },
            { label: "Valor Total", value: `Bs.${totalValue.toFixed(0)}`, icon: "💰", color: "#a855f7" },
            { label: "Stock Bajo", value: lowStock, icon: "⚠️", color: "#f59e0b" },
            { label: "Categorías", value: categories.length, icon: "🏷️", color: "#10b981" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "20px 18px", background: `linear-gradient(135deg, ${s.color}10, ${s.color}02)`, borderRadius: 16, border: `1px solid ${s.color}15`, animation: `fadeIn 0.4s ease-out ${i * 0.06}s both`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -10, right: -10, fontSize: 48, opacity: 0.06 }}>{s.icon}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 8, letterSpacing: "-0.5px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* BARRA DE ACCIONES */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 10, padding: "0 14px", border: "1px solid var(--border)", flex: 1, maxWidth: 300 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>🔍</span>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar item..." style={{ border: "none", background: "none", padding: "10px 0", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%" }} />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-primary)", fontSize: 12, cursor: "pointer", outline: "none" }}>
              <option value="all">Todas las categorías</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}>＋ Nuevo Item</button>
        </div>

        {/* FORMULARIO */}
        {showForm && (
          <div style={{ padding: 24, background: "var(--bg-card)", borderRadius: 16, border: "1px solid rgba(59,130,246,0.2)", marginBottom: 24, animation: "fadeScale 0.3s ease-out" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#3b82f6" }}>{editingId ? "✏️ Editar Item" : "＋ Nuevo Item"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.7fr 0.7fr 0.7fr auto", gap: 12, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Nombre *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: SSD Kingston 500GB" style={{ width: "100%", padding: "10px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Categoría</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none", cursor: "pointer" }}>
                  <option value="">Sin categoría</option>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Cantidad</label>
                <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" type="number" style={{ width: "100%", padding: "10px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Precio (Bs.)</label>
                <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" type="number" style={{ width: "100%", padding: "10px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Stock mín.</label>
                <input value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="5" type="number" style={{ width: "100%", padding: "10px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={saveItem} style={{ padding: "10px 18px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{editingId ? "💾 Guardar" : "＋ Crear"}</button>
                <button onClick={resetForm} style={{ padding: "10px 14px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          </div>
        )}

        {/* TABLA */}
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Cargando...</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", borderRadius: 18, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>No hay items en el inventario</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>Agrega tu primer item</p>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 20px", background: "linear-gradient(135deg, #3b82f6, #2563eb)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>＋ Agregar Item</button>
          </div>
        ) : (
          <div style={{ background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
            {/* HEADER */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 1fr", padding: "14px 20px", background: "var(--bg-tertiary)", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border)" }}>
              <span>Nombre</span>
              <span>Categoría</span>
              <span style={{ textAlign: "center" }}>Stock</span>
              <span style={{ textAlign: "center" }}>Precio</span>
              <span style={{ textAlign: "right" }}>Acciones</span>
            </div>
            {/* ROWS */}
            {filteredItems.map((item, i) => {
              const isLow = item.quantity <= item.minStock;
              return (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 1fr", padding: "14px 20px", borderBottom: "1px solid var(--border)", alignItems: "center", animation: `fadeIn 0.2s ease-out ${i * 0.03}s both`, background: isLow ? "rgba(239,68,68,0.02)" : "transparent" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</span>
                    {isLow && <span style={{ marginLeft: 8, fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700 }}>⚠️ BAJO</span>}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {item.category ? (
                      <span style={{ padding: "3px 8px", borderRadius: 6, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.1)", fontSize: 10, fontWeight: 600, color: "#3b82f6" }}>{item.category}</span>
                    ) : "—"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <button onClick={() => updateQuantity(item.id, -1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
                    <span style={{ fontSize: 16, fontWeight: 800, color: isLow ? "#ef4444" : "#10b981", minWidth: 32, textAlign: "center" }}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#a855f7", textAlign: "center" }}>Bs. {item.price}</span>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => editItem(item)} style={{ padding: "7px 14px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 8, color: "#6366f1", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✏️ Editar</button>
                    <button onClick={() => deleteItem(item.id)} style={{ padding: "7px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              );
            })}
            {/* FOOTER TOTALES */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 1fr", padding: "14px 20px", background: "var(--bg-tertiary)", alignItems: "center", borderTop: "2px solid var(--border)" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>Total: {filteredItems.length} items</span>
              <span />
              <span style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{filteredItems.reduce((s, i) => s + i.quantity, 0)} uds.</span>
              <span style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: "#a855f7" }}>Bs. {filteredItems.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(0)}</span>
              <span />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}