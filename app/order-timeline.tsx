import type { OrderDetail } from "./order-types";

const dateFormatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" });

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Próximamente";
}

export default function OrderTimeline({ order }: { order: OrderDetail }) {
  const currentIndex = order.status === "shipped" ? 3 : order.status === "paid" ? 2 : 0;
  const steps = [
    { label: "Recibido", detail: "Pedido registrado", date: order.createdAt },
    { label: "Confirmado", detail: "Selección confirmada", date: order.paidAt },
    { label: "Preparando", detail: "En nuestro almacén", date: order.paidAt },
    { label: "Enviado", detail: "En camino a tu dirección", date: order.shippedAt },
  ];

  return (
    <div>
      {order.status === "cancelled" && (
        <div className="order-cancelled-note"><strong>Pedido cancelado</strong><span>{formatDate(order.cancelledAt)}</span><p>Los productos se devolvieron automáticamente al stock disponible.</p></div>
      )}
      <ol className={`order-timeline ${order.status === "cancelled" ? "cancelled" : ""}`} aria-label="Progreso del pedido">
        {steps.map((step, index) => {
          const state = order.status === "cancelled"
            ? step.date ? "done" : "upcoming"
            : index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          return (
            <li className={state} key={step.label}>
              <span className="order-timeline-marker" aria-hidden="true" />
              <div><strong>{step.label}</strong><span>{step.detail}</span><time dateTime={step.date ?? undefined}>{formatDate(step.date)}</time></div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
