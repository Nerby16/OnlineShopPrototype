import type { Metadata } from "next";
import AdminOrderDetail from "./admin-order-detail";

export const metadata: Metadata = {
  title: "Pedido — Administración de Nexo Animal",
  description: "Gestiona el estado, la entrega y el seguimiento del pedido.",
  robots: { index: false, follow: false },
};

type AdminOrderPageProps = { params: Promise<{ id: string }> };

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const { id } = await params;
  return <AdminOrderDetail orderId={Number(id)} />;
}
