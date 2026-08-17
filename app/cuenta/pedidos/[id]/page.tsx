import type { Metadata } from "next";
import CustomerOrderDetail from "./customer-order-detail";

export const metadata: Metadata = {
  title: "Detalle del pedido — Nexo Animal",
  description: "Consulta el contenido, la entrega y el seguimiento de tu pedido.",
  robots: { index: false, follow: false },
};

type OrderPageProps = { params: Promise<{ id: string }> };

export default async function CustomerOrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  return <CustomerOrderDetail orderId={Number(id)} />;
}
