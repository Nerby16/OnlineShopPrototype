import type { Metadata } from "next";
import AccountArea from "./account";

export const metadata: Metadata = {
  title: "Mi cuenta — Lúmina",
  description: "Consulta tus pedidos y el estado de cada envío en Lúmina.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountArea />;
}
