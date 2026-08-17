export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";

export type OrderDetail = {
  id: number;
  userId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: { address?: string; city?: string; postalCode?: string };
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
  trackingNumber: string | null;
  trackingUrl: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    productId: number;
    productName: string;
    productSlug: string;
    productImage: string;
    unitPrice: number;
    quantity: number;
  }>;
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pendiente",
  paid: "Preparando",
  shipped: "Enviado",
  cancelled: "Cancelado",
};
