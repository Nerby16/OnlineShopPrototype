import type { Metadata } from "next";
import AdminDashboard from "./admin-dashboard";

export const metadata: Metadata = {
  title: "Administración — Nexo Animal",
  description: "Panel local para gestionar el catálogo, los pedidos y los clientes de Nexo Animal.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
