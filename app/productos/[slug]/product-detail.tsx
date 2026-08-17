"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */

import { useState } from "react";
import { useCart } from "../../../hooks/use-cart";
import { money, type Product } from "../../../lib/products";

type ProductDetailProps = {
  product: Product;
  related: Product[];
};

export default function ProductDetail({ product, related }: ProductDetailProps) {
  const { cart, setCart, ready } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function saveToCart(goToCheckout = false) {
    const existing = cart.find((line) => line.id === product.id);
    const nextCart = existing
      ? cart.map((line) => line.id === product.id
        ? { ...line, quantity: Math.min(product.stock, line.quantity + quantity) }
        : line)
      : [...cart, { id: product.id, quantity }];

    setCart(nextCart);
    setAdded(true);
    if (goToCheckout) window.location.href = "/checkout";
  }

  return (
    <main className="product-page">
      <div className="announcement">Envío gratuito desde 45 € <span>·</span> Atención especializada</div>
      <header className="detail-header">
        <a className="brand" href="/">NEXO ANIMAL</a>
        <a href="/#coleccion">← Volver al catálogo</a>
        <a href="/checkout">Cesta y checkout</a>
      </header>

      <section className="product-detail">
        <div className="product-detail-image">
          {product.featured && <span className="product-badge">Producto destacado</span>}
          <img src={product.image} alt={product.name} />
        </div>
        <div className="product-detail-copy">
          <p className="eyebrow">{product.category} · Selección especializada</p>
          <h1>{product.name}</h1>
          <strong className="detail-price">{money.format(product.price)}</strong>
          <p className="detail-description">{product.description}</p>

          <dl className="detail-facts">
            <div><dt>Entrega</dt><dd>2–4 días laborables</dd></div>
            <div><dt>Selección</dt><dd>Producto revisado para su categoría</dd></div>
            <div><dt>Disponibilidad</dt><dd>{product.stock > 0 ? `${product.stock} unidades` : "Agotado"}</dd></div>
          </dl>

          <div className="detail-actions">
            <div className="detail-quantity" aria-label="Cantidad">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Reducir cantidad">−</button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} aria-label="Aumentar cantidad">+</button>
            </div>
            <button className="detail-add" type="button" disabled={!product.stock || !ready} onClick={() => saveToCart(false)}>
              {added ? "Añadido a la cesta ✓" : "Añadir a la cesta"}
            </button>
          </div>
          <button className="detail-buy" type="button" disabled={!product.stock || !ready} onClick={() => saveToCart(true)}>Comprar ahora <span>→</span></button>
        </div>
      </section>

      {related.length > 0 && (
        <section className="related-products">
          <div className="section-heading"><div><p className="eyebrow">También puede interesarte</p><h2>Productos relacionados</h2></div></div>
          <div className="product-grid">
            {related.map((item) => (
              <a className="product-card" href={`/productos/${item.slug}`} key={item.id}>
                <div className="product-image"><img src={item.image} alt={item.name} /></div>
                <div className="product-meta"><div><p>{item.category}</p><h3>{item.name}</h3></div><strong>{money.format(item.price)}</strong></div>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
