import type { Metadata } from "next";
import AccountArea from "./account";

export const metadata: Metadata = {
  title: "Mi cuenta — Pata Papaya",
  description: "Consulta tus pedidos y el estado de cada envío en Pata Papaya.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountArea />;
}
