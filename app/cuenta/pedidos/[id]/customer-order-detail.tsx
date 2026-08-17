"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useApi } from "../../../../hooks/use-api";
import { money } from "../../../../lib/products";
import OrderTimeline from "../../../order-timeline";
import { orderStatusLabels, type OrderDetail } from "../../../order-types";

export default function CustomerOrderDetail({ orderId }: { orderId: number }) {
  const apiFetch = useApi();
  const invalidOrderId = !Number.isInteger(orderId) || orderId < 1;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(!invalidOrderId);
  const [error, setError] = useState(invalidOrderId ? "El pedido solicitado no es válido." : "");

  useEffect(() => {
    if (invalidOrderId) return;
    const controller = new AbortController();
    apiFetch<OrderDetail>(`/account/orders/${orderId}`, { signal: controller.signal })
      .then(setOrder)
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar el pedido.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [apiFetch, invalidOrderId, orderId]);

  if (loading) return <main className="order-detail-loading"><a className="brand" href="/">PATA PAPAYA</a><p>Preparando los detalles del pedido…</p></main>;

  if (!order) {
    return <main className="order-detail-error"><a className="brand" href="/">PATA PAPAYA</a><div><p className="eyebrow">No hemos podido abrirlo</p><h1>Este pedido no está<br /><em>disponible.</em></h1><p>{error}</p><a className="primary-link" href="/cuenta">Volver a mi cuenta <span>→</span></a></div></main>;
  }

  return (
    <main className="order-detail-page">
      <header className="account-header"><a className="brand" href="/">PATA PAPAYA</a><nav><a href="/cuenta">← Mis pedidos</a><a href="/">Tienda</a></nav></header>
      <section className="order-detail-hero"><div><p className="eyebrow">Pedido #{order.id}</p><h1>Tu selección,<br /><em>paso a paso.</em></h1></div><div><span>Estado actual</span><strong className={`status ${order.status}`}>{orderStatusLabels[order.status]}</strong><time>{new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(order.createdAt))}</time></div></section>
      <div className="order-detail-layout">
        <div className="order-detail-main">
          <section className="order-detail-section"><div className="order-detail-heading"><p className="eyebrow">Seguimiento</p><h2>Recorrido del pedido</h2></div><OrderTimeline order={order} /></section>
          <section className="order-detail-section"><div className="order-detail-heading"><p className="eyebrow">Contenido</p><h2>{order.items.reduce((sum, item) => sum + item.quantity, 0)} juguetes elegidos</h2></div><div className="order-detail-items">{order.items.map((item) => <article key={item.productId}><a href={`/productos/${item.productSlug}`}><img src={item.productImage} alt={item.productName} /></a><div><span>Producto</span><h3><a href={`/productos/${item.productSlug}`}>{item.productName}</a></h3><p>{item.quantity} × {money.format(item.unitPrice)}</p></div><strong>{money.format(item.unitPrice * item.quantity)}</strong></article>)}</div></section>
        </div>
        <aside className="order-detail-aside">
          <section><p className="eyebrow">Entrega</p><h2>{order.customerName}</h2><p>{order.shippingAddress.address}<br />{order.shippingAddress.postalCode} {order.shippingAddress.city}<br />{order.customerEmail}{order.customerPhone && <><br />{order.customerPhone}</>}</p></section>
          <section><p className="eyebrow">Seguimiento</p>{order.trackingNumber ? <><strong className="tracking-number">{order.trackingNumber}</strong><p>Referencia simulada para demostrar el flujo logístico.</p>{order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer">Consultar transportista ↗</a>}</> : <p>El número de seguimiento aparecerá cuando el pedido sea enviado.</p>}</section>
          <section className="order-totals"><div><span>Subtotal</span><strong>{money.format(order.subtotal)}</strong></div><div><span>Envío</span><strong>{order.shipping ? money.format(order.shipping) : "Gratis"}</strong></div><div><span>Total</span><strong>{money.format(order.total)}</strong></div></section>
          {order.status === "pending" && <a className="order-detail-manage" href="/cuenta">Gestionar o cancelar pedido →</a>}
        </aside>
      </div>
    </main>
  );
}
