"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
import { useApi } from "../../../../hooks/use-api";
import { money } from "../../../../lib/products";
import OrderTimeline from "../../../order-timeline";
import { orderStatusLabels, type OrderDetail, type OrderStatus } from "../../../order-types";

type SessionUser = { id: number; email: string; name: string; role: "customer" | "admin" };

export default function AdminOrderDetail({ orderId }: { orderId: number }) {
  const apiFetch = useApi();
  const invalidOrderId = !Number.isInteger(orderId) || orderId < 1;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [loading, setLoading] = useState(!invalidOrderId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(invalidOrderId ? "El pedido solicitado no es válido." : "");
  const [notice, setNotice] = useState("");

  async function loadOrder() {
    const data: OrderDetail = await apiFetch(`/admin/orders/${orderId}`);
    setOrder(data);
    setTrackingNumber(data.trackingNumber ?? "");
    setTrackingUrl(data.trackingUrl ?? "");
  }

  useEffect(() => {
    if (invalidOrderId) return;
    apiFetch<{ user: SessionUser | null }>("/auth/me")
      .then(async ({ user: sessionUser }) => {
        if (sessionUser?.role !== "admin") throw new Error("Inicia sesión como administrador para consultar este pedido.");
        setUser(sessionUser);
        await loadOrder();
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el pedido."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidOrderId, orderId]);

  async function updateStatus(status: OrderStatus) {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/admin/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadOrder();
      setNotice(`Pedido actualizado a “${orderStatusLabels[status]}”`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await apiFetch<OrderDetail>(`/admin/orders/${orderId}/tracking`, {
        method: "PATCH",
        body: JSON.stringify({ trackingNumber, trackingUrl }),
      });
      setOrder(data);
      setNotice("Datos de seguimiento guardados");
    } catch (trackingError) {
      setError(trackingError instanceof Error ? trackingError.message : "No se pudo guardar el seguimiento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="order-detail-loading admin"><a className="brand" href="/">LÚMINA</a><p>Abriendo el pedido en el estudio…</p></main>;
  if (!user || !order) return <main className="order-detail-error"><a className="brand" href="/">LÚMINA</a><div><p className="eyebrow">Acceso administrativo</p><h1>No podemos abrir<br /><em>este pedido.</em></h1><p>{error}</p><a className="primary-link" href="/admin">Ir a administración <span>→</span></a></div></main>;

  return (
    <main className="order-detail-page admin-order-detail-page">
      <header className="account-header"><a className="brand" href="/">LÚMINA</a><nav><a href="/admin#pedidos">← Todos los pedidos</a><span>Sesión de {user.name}</span></nav></header>
      <section className="order-detail-hero admin"><div><p className="eyebrow">Operaciones · Pedido #{order.id}</p><h1>Detalle<br /><em>del pedido.</em></h1></div><div><span>Estado actual</span><strong className={`status ${order.status}`}>{orderStatusLabels[order.status]}</strong><time>{new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(order.createdAt))}</time></div></section>
      <div className="order-detail-layout">
        <div className="order-detail-main">
          {error && <p className="admin-message error" role="alert">{error}</p>}{notice && <p className="admin-message" role="status">{notice}</p>}
          <section className="order-detail-section"><div className="order-detail-heading"><p className="eyebrow">Flujo operativo</p><h2>Estado del pedido</h2></div><OrderTimeline order={order} /></section>
          <section className="order-detail-section"><div className="order-detail-heading"><p className="eyebrow">Contenido</p><h2>Productos y cantidades</h2></div><div className="order-detail-items">{order.items.map((item) => <article key={item.productId}><a href={`/productos/${item.productSlug}`}><img src={item.productImage} alt={item.productName} /></a><div><span>Producto #{item.productId}</span><h3>{item.productName}</h3><p>{item.quantity} × {money.format(item.unitPrice)}</p></div><strong>{money.format(item.unitPrice * item.quantity)}</strong></article>)}</div></section>
          <section className="admin-order-customer"><div><p className="eyebrow">Cliente</p><h2>{order.customerName}</h2><p>{order.customerEmail}{order.customerPhone && <><br />{order.customerPhone}</>}<br />{order.userId ? <a className="admin-order-link" href={`/admin/clientes/${order.userId}`}>Cuenta registrada #{order.userId} →</a> : "Compra como invitado"}</p></div><div><p className="eyebrow">Dirección de entrega</p><h2>{order.shippingAddress.city}</h2><p>{order.shippingAddress.address}<br />{order.shippingAddress.postalCode} {order.shippingAddress.city}</p></div></section>
        </div>
        <aside className="order-detail-aside admin-controls">
          <section><p className="eyebrow">Cambiar estado</p><label className="field"><span>Estado del pedido</span><select value={order.status} onChange={(event) => updateStatus(event.target.value as OrderStatus)} disabled={saving}><option value="pending">Pendiente</option><option value="paid">Pagado / preparando</option><option value="shipped">Enviado</option><option value="cancelled">Cancelado</option></select></label><small>Al cancelar se repone el stock. Al reabrir se comprueba y descuenta de nuevo.</small></section>
          <form onSubmit={saveTracking}><p className="eyebrow">Seguimiento</p><div className="form-grid"><label className="field field-wide"><span>Número de seguimiento</span><input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder={`LUM-${String(order.id).padStart(6, "0")}`} maxLength={80} /></label><label className="field field-wide"><span>URL del transportista (opcional)</span><input type="url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="https://…" maxLength={600} /></label></div><button className="checkout-submit" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar seguimiento"} <span>→</span></button><small>Al marcar como enviado se genera automáticamente una referencia si está vacía.</small></form>
          <section className="order-totals"><div><span>Subtotal</span><strong>{money.format(order.subtotal)}</strong></div><div><span>Envío</span><strong>{order.shipping ? money.format(order.shipping) : "Gratis"}</strong></div><div><span>Total</span><strong>{money.format(order.total)}</strong></div></section>
        </aside>
      </div>
    </main>
  );
}
