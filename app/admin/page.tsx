import type { Metadata } from "next";
import AdminDashboard from "./admin-dashboard";

export const metadata: Metadata = {
  title: "Estudio — Administración de Lúmina",
  description: "Panel local para gestionar el catálogo y los pedidos de Lúmina.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
