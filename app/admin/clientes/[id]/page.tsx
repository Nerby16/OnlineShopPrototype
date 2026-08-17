import type { Metadata } from "next";
import AdminCustomerDetail from "./admin-customer-detail";

export const metadata: Metadata = {
  title: "Cliente — Administración de Nexo Animal",
  description: "Consulta la actividad, los pedidos y el estado de una cuenta de cliente.",
  robots: { index: false, follow: false },
};

type AdminCustomerPageProps = { params: Promise<{ id: string }> };

export default async function AdminCustomerPage({ params }: AdminCustomerPageProps) {
  const { id } = await params;
  return <AdminCustomerDetail customerId={Number(id)} />;
}
