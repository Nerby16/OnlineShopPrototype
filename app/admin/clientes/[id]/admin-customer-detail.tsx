"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { API_URL, money } from "../../../../lib/products";

type SessionUser = { id: number; email: string; name: string; role: "customer" | "admin" };
type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";
type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  orderCount: number;
  lifetimeValue: number;
  averageOrder: number;
  lastOrderAt: string | null;
  favoriteCount: number;
  addressCount: number;
};
type CustomerOrder = { id: number; status: OrderStatus; total: number; itemCount: number; createdAt: string; updatedAt: string };
type Address = { id: number; label: string; recipientName: string; addressLine: string; city: string; postalCode: string; isDefault: boolean };
type Favorite = { id: number; name: string; slug: string; image: string };
type Pagination = { page: number; pageSize: number; total: number; pages: number };
type CustomerResult = { customer: Customer; orders: { items: CustomerOrder[]; pagination: Pagination }; addresses: Address[]; favorites: Favorite[] };

const statusLabels: Record<OrderStatus, string> = { pending: "Pendiente", paid: "Preparando", shipped: "Enviado", cancelled: "Cancelado" };
const emptyPagination: Pagination = { page: 1, pageSize: 8, total: 0, pages: 1 };
const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });

export default function AdminCustomerDetail({ customerId }: { customerId: number }) {
  const invalidCustomerId = !Number.isInteger(customerId) || customerId < 1;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(!invalidCustomerId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(invalidCustomerId ? "El cliente solicitado no es válido." : "");
  const [notice, setNotice] = useState("");
  const [statusDialog, setStatusDialog] = useState(false);
  const safeActionRef = useRef<HTMLButtonElement>(null);

  async function apiFetch(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "No se pudo completar la operación.");
    return data;
  }

  function queryString() {
    const params = new URLSearchParams({ page: String(page), pageSize: "8" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  }

  async function loadCustomer() {
    const data: CustomerResult = await apiFetch(`/admin/customers/${customerId}?${queryString()}`);
    setCustomer(data.customer);
    setOrders(data.orders.items);
    setPagination(data.orders.pagination);
    setAddresses(data.addresses);
    setFavorites(data.favorites);
  }

  useEffect(() => {
    if (invalidCustomerId) return;
    apiFetch("/auth/me")
      .then(({ user: sessionUser }) => {
        if (sessionUser?.role !== "admin") throw new Error("Inicia sesión como administrador para consultar este cliente.");
        setUser(sessionUser);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "No se pudo comprobar la sesión.");
        setLoading(false);
      });
  }, [customerId, invalidCustomerId]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      loadCustomer()
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el cliente."))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, customerId, page, search, status, dateFrom, dateTo]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!statusDialog) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => safeActionRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) setStatusDialog(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [saving, statusDialog]);

  async function updateAccountStatus() {
    if (!customer) return;
    const nextActive = !customer.active;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/admin/customers/${customer.id}/status`, { method: "PATCH", body: JSON.stringify({ active: nextActive }) });
      setStatusDialog(false);
      await loadCustomer();
      setNotice(nextActive ? "Cuenta reactivada" : "Cuenta bloqueada y sesiones cerradas");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado de la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  function resetFilters() { setSearch(""); setStatus(""); setDateFrom(""); setDateTo(""); setPage(1); }

  if (loading) return <main className="order-detail-loading admin"><a className="brand" href="/">LÚMINA</a><p>Preparando la ficha del cliente…</p></main>;
  if (!user || !customer) return <main className="order-detail-error"><a className="brand" href="/">LÚMINA</a><div><p className="eyebrow">Acceso administrativo</p><h1>No podemos abrir<br /><em>este cliente.</em></h1><p>{error}</p><a className="primary-link" href="/admin#clientes">Volver a clientes <span>→</span></a></div></main>;

  const first = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const last = Math.min(pagination.total, pagination.page * pagination.pageSize);

  return (
    <main className="order-detail-page admin-customer-detail-page">
      <header className="account-header"><a className="brand" href="/">LÚMINA</a><nav><a href="/admin#clientes">← Todos los clientes</a><span>Sesión de {user.name}</span></nav></header>
      <section className="order-detail-hero admin"><div><p className="eyebrow">Comunidad · Cliente #{customer.id}</p><h1>Ficha<br /><em>del cliente.</em></h1></div><div><span>Estado de la cuenta</span><strong className={`status ${customer.active ? "paid" : "cancelled"}`}>{customer.active ? "Activa" : "Bloqueada"}</strong><time>Alta · {dateFormatter.format(new Date(customer.createdAt))}</time></div></section>
      <div className="customer-detail-content">
        {error && <p className="admin-message error" role="alert">{error}</p>}{notice && <p className="admin-message" role="status">{notice}</p>}
        <div className="account-stats customer-stats"><article><span>Pedidos</span><strong>{customer.orderCount}</strong></article><article><span>Valor acumulado</span><strong>{money.format(customer.lifetimeValue)}</strong></article><article><span>Pedido medio</span><strong>{money.format(customer.averageOrder)}</strong></article><article><span>Favoritos</span><strong>{customer.favoriteCount}</strong></article><article><span>Direcciones</span><strong>{customer.addressCount}</strong></article></div>
        <div className="customer-detail-layout">
          <section className="admin-section customer-orders-panel"><div className="admin-section-heading"><div><p className="eyebrow">Actividad comercial</p><h2>Pedidos del cliente</h2></div><span>{pagination.total} resultados</span></div>
            <div className="admin-filters order-filters"><label className="admin-search"><span className="sr-only">Buscar pedidos</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pedido o producto…" /></label><label><span>Estado</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Todos</option><option value="pending">Pendientes</option><option value="paid">Preparando</option><option value="shipped">Enviados</option><option value="cancelled">Cancelados</option></select></label><label><span>Desde</span><input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label><label><span>Hasta</span><input type="date" value={dateTo} min={dateFrom} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label><button type="button" onClick={resetFilters}>Limpiar</button></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Fecha</th><th>Piezas</th><th>Total</th><th>Estado</th></tr></thead><tbody>{orders.length ? orders.map((order) => <tr key={order.id}><td><a className="admin-order-link" href={`/admin/pedidos/${order.id}`}>#{order.id} →</a></td><td>{dateFormatter.format(new Date(order.createdAt))}</td><td>{order.itemCount}</td><td>{money.format(order.total)}</td><td><span className={`status ${order.status}`}>{statusLabels[order.status]}</span></td></tr>) : <tr><td colSpan={5} className="empty-table">No hay pedidos que coincidan con estos filtros.</td></tr>}</tbody></table></div>
            {pagination.total > 0 && <div className="admin-pagination"><span>{first}–{last} de {pagination.total}</span><div><button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}>← Anterior</button><strong>{page} / {pagination.pages}</strong><button type="button" onClick={() => setPage(page + 1)} disabled={page >= pagination.pages}>Siguiente →</button></div></div>}
          </section>
          <aside className="customer-profile-aside">
            <section><p className="eyebrow">Perfil</p><h2>{customer.name}</h2><p>{customer.email}<br />{customer.phone || "Sin teléfono guardado"}</p><dl><div><dt>Último acceso</dt><dd>{customer.lastLoginAt ? dateFormatter.format(new Date(customer.lastLoginAt)) : "Todavía no"}</dd></div><div><dt>Último pedido</dt><dd>{customer.lastOrderAt ? dateFormatter.format(new Date(customer.lastOrderAt)) : "Sin pedidos"}</dd></div><div><dt>Preferencias</dt><dd>{customer.marketingOptIn ? "Acepta novedades" : "Sin comunicaciones"}</dd></div></dl><button className={customer.active ? "danger" : ""} type="button" onClick={() => setStatusDialog(true)}>{customer.active ? "Bloquear cuenta" : "Reactivar cuenta"}</button></section>
            <section><p className="eyebrow">Direcciones</p>{addresses.length ? <div className="customer-addresses">{addresses.map((address) => <article key={address.id}><strong>{address.label}{address.isDefault ? " · Principal" : ""}</strong><span>{address.recipientName}<br />{address.addressLine}<br />{address.postalCode} {address.city}</span></article>)}</div> : <p>Este cliente todavía no ha guardado direcciones.</p>}</section>
            <section><p className="eyebrow">Favoritos recientes</p>{favorites.length ? <div className="customer-favorite-list">{favorites.map((favorite) => <a key={favorite.id} href={`/productos/${favorite.slug}`}><img src={favorite.image} alt="" /><span>{favorite.name}</span></a>)}</div> : <p>Este cliente todavía no ha guardado favoritos.</p>}</section>
          </aside>
        </div>
      </div>
      {statusDialog && <div className="account-confirmation-overlay" role="dialog" aria-modal="true" aria-labelledby="customer-status-title"><button className="account-confirmation-backdrop" type="button" aria-label="Volver sin cambiar el estado" onClick={() => { if (!saving) setStatusDialog(false); }} /><section className="account-confirmation-panel"><span className="account-confirmation-number">Cliente #{customer.id}</span><p className="eyebrow">Confirmar cambio</p><h2 id="customer-status-title">¿{customer.active ? "Bloquear" : "Reactivar"}<br /><em>esta cuenta?</em></h2><p>{customer.active ? "La persona perderá el acceso inmediatamente y se cerrarán todas sus sesiones. Sus pedidos y datos históricos se conservarán." : "La persona podrá volver a iniciar sesión con sus credenciales actuales."}</p><div className="account-confirmation-summary"><span>Cuenta</span><strong>{customer.email}</strong></div><div className="account-confirmation-actions"><button ref={safeActionRef} type="button" onClick={() => setStatusDialog(false)} disabled={saving}>Mantener estado</button><button type="button" onClick={updateAccountStatus} disabled={saving}>{saving ? "Actualizando…" : customer.active ? "Sí, bloquear" : "Sí, reactivar"}</button></div><small>Puedes cerrar este mensaje con la tecla Esc.</small></section></div>}
    </main>
  );
}
