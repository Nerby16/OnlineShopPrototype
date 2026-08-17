"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { FormEvent, useEffect, useRef, useState } from "react";
import { useApi } from "../../hooks/use-api";
import { useSession, type SessionUser } from "../../hooks/use-session";
import { money, type Product } from "../../lib/products";

type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";
type Order = { id: number; user_id: number | null; customer_name: string; customer_email: string; status: OrderStatus; total: number; item_count: number; created_at: string };
type Customer = { id: number; name: string; email: string; active: boolean; order_count: number; lifetime_value: number; created_at: string; last_login_at: string | null };
type Pagination = { page: number; pageSize: number; total: number; pages: number };
type PageResult<T> = { items: T[]; pagination: Pagination };
type Analytics = {
  activeProducts: number;
  lowStock: number;
  outOfStock: number;
  pendingOrders: number;
  customers: number;
  orderCount: number;
  revenue: number;
  averageOrder: number;
  topProducts: Array<{ productId: number; productName: string; units: number; revenue: number }>;
};

const emptyProduct = { name: "", slug: "", category: "Casa", description: "", price: "", stock: "", image: "", featured: false };
const emptyPagination: Pagination = { page: 1, pageSize: 8, total: 0, pages: 1 };
const emptyAnalytics: Analytics = { activeProducts: 0, lowStock: 0, outOfStock: 0, pendingOrders: 0, customers: 0, orderCount: 0, revenue: 0, averageOrder: 0, topProducts: [] };

function PaginationControls({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
  if (!pagination.total) return null;
  const first = (pagination.page - 1) * pagination.pageSize + 1;
  const last = Math.min(pagination.total, pagination.page * pagination.pageSize);
  return (
    <div className="admin-pagination">
      <span>{first}–{last} de {pagination.total}</span>
      <div><button type="button" onClick={() => onPage(pagination.page - 1)} disabled={pagination.page <= 1}>← Anterior</button><strong>{pagination.page} / {pagination.pages}</strong><button type="button" onClick={() => onPage(pagination.page + 1)} disabled={pagination.page >= pagination.pages}>Siguiente →</button></div>
    </div>
  );
}

export default function AdminDashboard() {
  const apiFetch = useApi();
  const { user: sessionUser, setUser, checking: checkingSession, signOut } = useSession();
  const user = sessionUser?.role === "admin" ? sessionUser : null;
  const [email, setEmail] = useState("admin@lumina.local");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>(emptyAnalytics);
  const [productPagination, setProductPagination] = useState(emptyPagination);
  const [orderPagination, setOrderPagination] = useState(emptyPagination);
  const [customerPagination, setCustomerPagination] = useState(emptyPagination);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productState, setProductState] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [archiveCandidate, setArchiveCandidate] = useState<Product | null>(null);
  const [archiving, setArchiving] = useState(false);
  const archiveSafeActionRef = useRef<HTMLButtonElement>(null);

  function queryString(values: Record<string, string | number>) {
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => { if (String(value)) params.set(key, String(value)); });
    return params.toString();
  }

  async function loadProducts() {
    const query = queryString({ page: productPage, pageSize: 8, search: productSearch, category: productCategory, state: productState, stock: productStock });
    const result: PageResult<Product> = await apiFetch(`/admin/products?${query}`);
    setProducts(result.items);
    setProductPagination(result.pagination);
  }

  async function loadOrders() {
    const query = queryString({ page: orderPage, pageSize: 8, search: orderSearch, status: orderStatus, dateFrom: orderDateFrom, dateTo: orderDateTo });
    const result: PageResult<Order> = await apiFetch(`/admin/orders?${query}`);
    setOrders(result.items);
    setOrderPagination(result.pagination);
  }

  async function loadCustomers() {
    const query = queryString({ page: customerPage, pageSize: 8, search: customerSearch, state: customerState });
    const result: PageResult<Customer> = await apiFetch(`/admin/customers?${query}`);
    setCustomers(result.items);
    setCustomerPagination(result.pagination);
  }

  async function loadAnalytics() {
    setAnalytics(await apiFetch<Analytics>("/admin/analytics"));
  }

  async function refreshAll() {
    setTablesLoading(true);
    setError("");
    try {
      await Promise.all([loadProducts(), loadOrders(), loadCustomers(), loadAnalytics()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo actualizar el panel.");
    } finally {
      setTablesLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => { loadProducts().catch((loadError) => setError(loadError.message)); }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, productSearch, productCategory, productState, productStock, productPage]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => { loadOrders().catch((loadError) => setError(loadError.message)); }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, orderSearch, orderStatus, orderDateFrom, orderDateTo, orderPage]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => { loadCustomers().catch((loadError) => setError(loadError.message)); }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, customerSearch, customerState, customerPage]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => { loadAnalytics().catch((loadError) => setError(loadError.message)); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!archiveCandidate) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => archiveSafeActionRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !archiving) setArchiveCandidate(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.documentElement.style.overflow = previousOverflow; window.cancelAnimationFrame(focusFrame); window.removeEventListener("keydown", closeOnEscape); };
  }, [archiveCandidate, archiving]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const { user: signedInUser } = await apiFetch<{ user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (signedInUser.role !== "admin") { await apiFetch("/auth/logout", { method: "POST" }); throw new Error("Esta cuenta no tiene permisos administrativos."); }
      setUser(signedInUser); setPassword("");
    } catch (loginError) { setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión."); }
    finally { setLoading(false); }
  }

  async function logout() {
    try { await signOut(); }
    finally { setProducts([]); setOrders([]); setCustomers([]); }
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setProductForm({ name: product.name, slug: product.slug, category: product.category, description: product.description, price: String(product.price), stock: String(product.stock), image: product.image, featured: product.featured });
    document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  function resetEditor() { setEditingId(null); setProductForm(emptyProduct); }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      await apiFetch(editingId ? `/admin/products/${editingId}` : "/admin/products", { method: editingId ? "PATCH" : "POST", body: JSON.stringify({ ...productForm, price: Number(productForm.price), stock: Number(productForm.stock) }) });
      setNotice(editingId ? "Producto actualizado" : "Producto creado"); resetEditor(); await Promise.all([loadProducts(), loadAnalytics()]);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el producto."); }
  }

  async function uploadImage(file: File) {
    setUploading(true); setError("");
    try {
      const data = await apiFetch<{ url: string }>("/admin/uploads", { method: "POST", headers: { "Content-Type": file.type }, body: file });
      setProductForm((current) => ({ ...current, image: data.url })); setNotice("Imagen subida y preparada para guardar");
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir la imagen."); }
    finally { setUploading(false); }
  }

  async function confirmArchive() {
    if (!archiveCandidate) return; setArchiving(true); setError("");
    try { await apiFetch(`/admin/products/${archiveCandidate.id}`, { method: "DELETE" }); setNotice("Producto retirado del catálogo"); setArchiveCandidate(null); await Promise.all([loadProducts(), loadAnalytics()]); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "No se pudo retirar el producto."); setArchiveCandidate(null); }
    finally { setArchiving(false); }
  }

  async function restoreProduct(product: Product) {
    try { await apiFetch(`/admin/products/${product.id}/restore`, { method: "PATCH", body: "{}" }); setNotice("Producto restaurado en el catálogo"); await Promise.all([loadProducts(), loadAnalytics()]); }
    catch (restoreError) { setError(restoreError instanceof Error ? restoreError.message : "No se pudo restaurar el producto."); }
  }

  async function updateOrderStatus(orderId: number, status: OrderStatus) {
    try { await apiFetch(`/admin/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) }); setNotice(`Pedido #${orderId} actualizado`); await Promise.all([loadOrders(), loadAnalytics(), loadProducts()]); }
    catch (statusError) { setError(statusError instanceof Error ? statusError.message : "No se pudo actualizar el pedido."); }
  }

  function resetProductFilters() { setProductSearch(""); setProductCategory(""); setProductState(""); setProductStock(""); setProductPage(1); }
  function resetOrderFilters() { setOrderSearch(""); setOrderStatus(""); setOrderDateFrom(""); setOrderDateTo(""); setOrderPage(1); }
  const maxTopUnits = Math.max(1, ...analytics.topProducts.map((product) => product.units));

  if (!user) return <main className="admin-login"><a className="brand" href="/">LÚMINA</a><form onSubmit={login}><p className="eyebrow">Acceso de administración</p><h1>El estudio,<br /><em>por dentro.</em></h1><p>Inicia sesión con la cuenta administrativa para gestionar el catálogo, los pedidos y los clientes.</p><div className="form-grid"><label className="field field-wide"><span>Correo</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required disabled={checkingSession} /></label><label className="field field-wide"><span>Contraseña</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={checkingSession} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="checkout-submit" type="submit" disabled={loading || checkingSession}>{checkingSession ? "Comprobando sesión…" : loading ? "Entrando…" : "Entrar al panel"} <span>→</span></button><a href="/">← Volver a la tienda</a></form></main>;

  return (
    <main className="admin-page">
      <aside className="admin-sidebar"><a className="brand" href="/">LÚMINA</a><div><span>Sesión de {user.name}</span><strong>Catálogo & operaciones</strong></div><nav><a href="#resumen">Resumen</a><a href="#productos">Productos</a><a href="#pedidos">Pedidos</a><a href="#clientes">Clientes</a></nav><button type="button" onClick={logout}>Cerrar sesión</button></aside>
      <div className="admin-content">
        <header className="admin-topbar"><div><p className="eyebrow">Lúmina Estudio</p><h1>Buenos días, {user.name.split(" ")[0]}.</h1></div><button type="button" onClick={refreshAll} disabled={tablesLoading}>{tablesLoading ? "Actualizando…" : "Actualizar datos ↻"}</button></header>
        {error && <p className="admin-message error" role="alert">{error}</p>}{notice && <p className="admin-message" role="status">{notice}</p>}

        <section className="admin-section" id="resumen"><div className="admin-stats"><article><span>Productos activos</span><strong>{analytics.activeProducts}</strong></article><article className={analytics.lowStock ? "warning" : ""}><span>Stock bajo</span><strong>{analytics.lowStock}</strong></article><article className={analytics.outOfStock ? "danger" : ""}><span>Agotados</span><strong>{analytics.outOfStock}</strong></article><article><span>Pedidos pendientes</span><strong>{analytics.pendingOrders}</strong></article><article><span>Clientes</span><strong>{analytics.customers}</strong></article><article><span>Ventas acumuladas</span><strong>{money.format(analytics.revenue)}</strong></article><article><span>Pedido medio</span><strong>{money.format(analytics.averageOrder)}</strong></article></div>
          <div className="admin-ranking"><div className="admin-section-heading"><div><p className="eyebrow">Rendimiento</p><h2>Productos más vendidos</h2></div><span>{analytics.orderCount} pedidos válidos</span></div>{analytics.topProducts.length ? <div className="ranking-list">{analytics.topProducts.map((product, index) => <article key={product.productId}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{product.productName}</strong><div><i style={{ width: `${(product.units / maxTopUnits) * 100}%` }} /></div></div><b>{product.units} uds.</b><small>{money.format(product.revenue)}</small></article>)}</div> : <p className="empty-table">Los productos vendidos aparecerán aquí.</p>}</div>
        </section>

        <section className="admin-section" id="productos"><div className="admin-section-heading"><div><p className="eyebrow">Catálogo</p><h2>Productos</h2></div><button type="button" onClick={resetEditor}>+ Nuevo producto</button></div>
          <div className="admin-filters"><label className="admin-search"><span className="sr-only">Buscar productos</span><input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductPage(1); }} placeholder="Buscar por nombre, slug o descripción…" /></label><label><span>Categoría</span><select value={productCategory} onChange={(event) => { setProductCategory(event.target.value); setProductPage(1); }}><option value="">Todas</option><option value="Casa">Casa</option><option value="Accesorios">Accesorios</option></select></label><label><span>Estado</span><select value={productState} onChange={(event) => { setProductState(event.target.value); setProductPage(1); }}><option value="">Todos</option><option value="active">Activos</option><option value="archived">Retirados</option></select></label><label><span>Inventario</span><select value={productStock} onChange={(event) => { setProductStock(event.target.value); setProductPage(1); }}><option value="">Todo el stock</option><option value="out">Agotado</option><option value="low">Stock bajo</option><option value="healthy">Stock saludable</option></select></label><button type="button" onClick={resetProductFilters}>Limpiar</button></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{products.length ? products.map((product) => <tr key={product.id}><td><div className="admin-product"><img src={product.image} alt="" /><div><strong>{product.name}</strong><span>/{product.slug}</span></div></div></td><td>{product.category}</td><td>{money.format(product.price)}</td><td><span className={`inventory-badge ${product.stock === 0 ? "out" : product.stock <= 5 ? "low" : "healthy"}`}>{product.stock === 0 ? "Agotado" : product.stock <= 5 ? `${product.stock} · Bajo` : product.stock}</span></td><td><span className={`status ${product.active === false ? "cancelled" : "paid"}`}>{product.active === false ? "Retirado" : "Activo"}</span></td><td><div className="table-actions"><button type="button" onClick={() => editProduct(product)}>Editar</button>{product.active === false ? <button type="button" onClick={() => restoreProduct(product)}>Restaurar</button> : <button type="button" onClick={() => setArchiveCandidate(product)}>Retirar</button>}</div></td></tr>) : <tr><td colSpan={6} className="empty-table">No hay productos que coincidan con estos filtros.</td></tr>}</tbody></table></div><PaginationControls pagination={productPagination} onPage={setProductPage} />
          <form className="product-editor" id="product-editor" onSubmit={saveProduct}><div className="admin-section-heading"><div><p className="eyebrow">Editor</p><h2>{editingId ? "Editar producto" : "Nueva pieza"}</h2></div>{editingId && <button type="button" onClick={resetEditor}>Cancelar</button>}</div><div className="form-grid"><label className="field"><span>Nombre</span><input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required /></label><label className="field"><span>Slug</span><input value={productForm.slug} onChange={(event) => setProductForm({ ...productForm, slug: event.target.value })} placeholder="se-genera-si-esta-vacio" /></label><label className="field"><span>Categoría</span><select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}><option>Casa</option><option>Accesorios</option></select></label><label className="field"><span>Precio</span><input type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} required /></label><label className="field"><span>Stock</span><input type="number" min="0" step="1" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} required /></label><div className="admin-image-field field-wide"><div className="admin-image-preview">{productForm.image ? <img src={productForm.image} alt="Vista previa del producto" /> : <span>Sin imagen</span>}</div><div><label className="field"><span>Subir imagen</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.target.value = ""; }} /></label><small>JPEG, PNG o WebP · máximo 5 MB.</small></div></div><label className="field field-wide"><span>URL de imagen (alternativa)</span><input type="url" value={productForm.image} onChange={(event) => setProductForm({ ...productForm, image: event.target.value })} required /></label><label className="field field-wide"><span>Descripción</span><textarea rows={3} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} required /></label><label className="check-field field-wide"><input type="checkbox" checked={productForm.featured} onChange={(event) => setProductForm({ ...productForm, featured: event.target.checked })} /><span>Mostrar como pieza destacada</span></label></div><button className="checkout-submit" type="submit" disabled={uploading}>{uploading ? "Subiendo imagen…" : editingId ? "Guardar cambios" : "Crear producto"} <span>→</span></button></form>
        </section>

        <section className="admin-section" id="pedidos"><div className="admin-section-heading"><div><p className="eyebrow">Operaciones</p><h2>Pedidos</h2></div><span>{orderPagination.total} pedidos</span></div><div className="admin-filters order-filters"><label className="admin-search"><span className="sr-only">Buscar pedidos</span><input value={orderSearch} onChange={(event) => { setOrderSearch(event.target.value); setOrderPage(1); }} placeholder="Pedido, cliente o correo…" /></label><label><span>Estado</span><select value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value); setOrderPage(1); }}><option value="">Todos</option><option value="pending">Pendientes</option><option value="paid">Preparando</option><option value="shipped">Enviados</option><option value="cancelled">Cancelados</option></select></label><label><span>Desde</span><input type="date" value={orderDateFrom} onChange={(event) => { setOrderDateFrom(event.target.value); setOrderPage(1); }} /></label><label><span>Hasta</span><input type="date" value={orderDateTo} min={orderDateFrom} onChange={(event) => { setOrderDateTo(event.target.value); setOrderPage(1); }} /></label><button type="button" onClick={resetOrderFilters}>Limpiar</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Cuenta</th><th>Piezas</th><th>Total</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{orders.length ? orders.map((order) => <tr key={order.id}><td><a className="admin-order-link" href={`/admin/pedidos/${order.id}`}>#{order.id} →</a></td><td><div className="admin-customer"><strong>{order.customer_name}</strong><span>{order.customer_email}</span></div></td><td><span className={`status ${order.user_id ? "paid" : "pending"}`}>{order.user_id ? "Registrado" : "Invitado"}</span></td><td>{order.item_count}</td><td>{money.format(order.total)}</td><td>{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(order.created_at))}</td><td><select className={`status-select ${order.status}`} value={order.status} onChange={(event) => updateOrderStatus(order.id, event.target.value as OrderStatus)}><option value="pending">Pendiente</option><option value="paid">Pagado</option><option value="shipped">Enviado</option><option value="cancelled">Cancelado</option></select></td></tr>) : <tr><td colSpan={7} className="empty-table">No hay pedidos que coincidan con estos filtros.</td></tr>}</tbody></table></div><PaginationControls pagination={orderPagination} onPage={setOrderPage} /></section>

        <section className="admin-section" id="clientes"><div className="admin-section-heading"><div><p className="eyebrow">Comunidad</p><h2>Clientes registrados</h2></div><span>{customerPagination.total} cuentas</span></div><div className="admin-filters customer-filters"><label className="admin-search"><span className="sr-only">Buscar clientes</span><input value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerPage(1); }} placeholder="Buscar por nombre o correo…" /></label><label><span>Estado</span><select value={customerState} onChange={(event) => { setCustomerState(event.target.value); setCustomerPage(1); }}><option value="">Todos</option><option value="active">Activos</option><option value="blocked">Bloqueados</option></select></label><button type="button" onClick={() => { setCustomerSearch(""); setCustomerState(""); setCustomerPage(1); }}>Limpiar</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Cliente</th><th>Alta</th><th>Último acceso</th><th>Pedidos</th><th>Valor acumulado</th><th>Estado</th><th>Ficha</th></tr></thead><tbody>{customers.length ? customers.map((customer) => <tr key={customer.id}><td><div className="admin-customer"><strong>{customer.name}</strong><span>{customer.email}</span></div></td><td>{new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(customer.created_at))}</td><td>{customer.last_login_at ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(customer.last_login_at)) : "Todavía no"}</td><td>{customer.order_count}</td><td>{money.format(customer.lifetime_value)}</td><td><span className={`status ${customer.active ? "paid" : "cancelled"}`}>{customer.active ? "Activo" : "Bloqueado"}</span></td><td><a className="admin-order-link" href={`/admin/clientes/${customer.id}`}>Abrir →</a></td></tr>) : <tr><td colSpan={7} className="empty-table">No hay clientes que coincidan con la búsqueda.</td></tr>}</tbody></table></div><PaginationControls pagination={customerPagination} onPage={setCustomerPage} /></section>
      </div>

      {archiveCandidate && <div className="account-confirmation-overlay" role="dialog" aria-modal="true" aria-labelledby="archive-product-title"><button className="account-confirmation-backdrop" type="button" aria-label="Volver sin retirar" onClick={() => { if (!archiving) setArchiveCandidate(null); }} /><section className="account-confirmation-panel"><span className="account-confirmation-number">Producto #{archiveCandidate.id}</span><p className="eyebrow">Confirmar retirada</p><h2 id="archive-product-title">¿Retirar<br /><em>{archiveCandidate.name}?</em></h2><p>Dejará de aparecer en la tienda, pero sus datos y el historial de pedidos se conservarán. Podrás restaurarlo en cualquier momento.</p><div className="account-confirmation-summary"><span>Stock actual</span><strong>{archiveCandidate.stock} unidades</strong></div><div className="account-confirmation-actions"><button ref={archiveSafeActionRef} type="button" onClick={() => setArchiveCandidate(null)} disabled={archiving}>Mantener producto</button><button type="button" onClick={confirmArchive} disabled={archiving}>{archiving ? "Retirando…" : "Sí, retirar"}</button></div><small>Puedes cerrar este mensaje con la tecla Esc.</small></section></div>}
    </main>
  );
}
