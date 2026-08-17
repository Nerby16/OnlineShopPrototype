import { headers } from "next/headers";
import { apiUrl } from "./api";
import { FALLBACK_PRODUCTS, type Product } from "./products";

export async function getProducts(): Promise<Product[]> {
  try {
    const response = await fetch(apiUrl("/products"), { cache: "no-store" });
    if (response.ok) {
      const products = (await response.json()) as Product[];
      if (Array.isArray(products) && products.length) return products;
    }
  } catch {
    // The local API is optional while rendering static previews.
  }
  return FALLBACK_PRODUCTS;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  try {
    const response = await fetch(apiUrl(`/products/${encodeURIComponent(slug)}`), {
      cache: "no-store",
    });
    if (response.ok) return (await response.json()) as Product;
  } catch {
    // Fall back to the seeded catalog when the local API is not running.
  }
  return FALLBACK_PRODUCTS.find((product) => product.slug === slug);
}

export async function getRequestBaseUrl() {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
