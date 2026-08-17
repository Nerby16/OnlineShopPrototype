import type { Metadata } from "next";
import Checkout from "./checkout";

export const metadata: Metadata = {
  title: "Finalizar compra — Nexo Animal",
  description: "Revisa los productos seleccionados y crea tu pedido en Nexo Animal.",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <Checkout />;
}
