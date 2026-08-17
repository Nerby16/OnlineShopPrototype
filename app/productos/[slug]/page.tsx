import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getProducts, getRequestBaseUrl } from "../../../lib/server-products";
import ProductDetail from "./product-detail";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Producto no encontrado — Pata Papaya",
      description: "Este juguete ya no está disponible.",
      openGraph: { title: "Producto no encontrado — Pata Papaya", description: "Este juguete ya no está disponible.", images: [] },
      twitter: { title: "Producto no encontrado — Pata Papaya", description: "Este juguete ya no está disponible.", images: [] },
    };
  }

  const baseUrl = await getRequestBaseUrl();
  const title = `${product.name} — Pata Papaya`;
  const description = product.description;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${baseUrl}/productos/${product.slug}`,
      images: [{ url: product.image, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [product.image],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, products] = await Promise.all([getProductBySlug(slug), getProducts()]);
  if (!product) notFound();

  const related = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 3);

  return <ProductDetail product={product} related={related} />;
}
