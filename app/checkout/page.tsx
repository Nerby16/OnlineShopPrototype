import type { Metadata } from "next";
import Checkout from "./checkout";

export const metadata: Metadata = {
  title: "Finalizar compra — Pata Papaya",
  description: "Revisa tus juguetes y crea tu pedido en Pata Papaya.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <Checkout />;
}
