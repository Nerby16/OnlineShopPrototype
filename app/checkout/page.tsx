import type { Metadata } from "next";
import Checkout from "./checkout";

export const metadata: Metadata = {
  title: "Finalizar compra — Lúmina",
  description: "Revisa tu selección y crea tu pedido en Lúmina.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <Checkout />;
}
