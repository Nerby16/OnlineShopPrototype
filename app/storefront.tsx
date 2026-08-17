"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useApi } from "../hooks/use-api";
import { useCart } from "../hooks/use-cart";
import { useSession } from "../hooks/use-session";
import { FALLBACK_PRODUCTS as fallbackProducts, money, type Product } from "../lib/products";

export default function Storefront() {
  const request = useApi();
  const { cart, setCart } = useCart();
  const { user: account } = useSession();
  const [products, setProducts] = useState(fallbackProducts);
  const [category, setCategory] = useState("Todo");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    request<Product[]>("/products", { signal: controller.signal })
      .then((data) => {
        if (Array.isArray(data) && data.length) setProducts(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    if (!account) {
      setFavoriteIds([]);
      return;
    }
    const controller = new AbortController();
    request<Product[]>("/account/favorites", { signal: controller.signal })
      .then((favorites) => {
        setFavoriteIds(favorites.map((product) => product.id));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [account, request]);

  useEffect(() => {
    document.documentElement.style.overflow = searchOpen || cartOpen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [searchOpen, cartOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return products.filter((product) => {
      const inCategory = category === "Todo" || product.category === category;
      const inSearch = !term || `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase("es").includes(term);
      return inCategory && inSearch;
    });
  }, [category, products, search]);

  const cartLines = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.id) ?? fallbackProducts.find((item) => item.id === line.id);
    return product ? [{ ...line, product }] : [];
  });
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const shippingLeft = Math.max(0, 80 - cartTotal);

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.id === product.id);
      if (existing) {
        return current.map((line) => line.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, product.stock) } : line);
      }
      return [...current, { id: product.id, quantity: 1 }];
    });
    setNotice(`${product.name} está en tu cesta`);
  }

  function changeQuantity(product: Product, delta: number) {
    setCart((current) => current
      .map((line) => line.id === product.id ? { ...line, quantity: Math.min(product.stock, line.quantity + delta) } : line)
      .filter((line) => line.quantity > 0));
  }

  async function toggleFavorite(product: Product) {
    if (!account) {
      window.location.assign("/cuenta");
      return;
    }
    const isFavorite = favoriteIds.includes(product.id);
    try {
      await request(`/account/favorites/${product.id}`, {
        method: isFavorite ? "DELETE" : "POST",
        body: isFavorite ? undefined : "{}",
      });
      setFavoriteIds((current) => isFavorite ? current.filter((id) => id !== product.id) : [...current, product.id]);
      setNotice(isFavorite ? `${product.name} ya no está en favoritos` : `${product.name} guardado en favoritos`);
    } catch {
      setNotice("No se pudieron actualizar tus favoritos");
    }
  }

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.currentTarget.reset();
    setNotice("¡Gracias! Ya formas parte de Lúmina");
  }

  return (
    <main>
      <div className="announcement">Envíos gratis desde 80 € <span>·</span> Cambios durante 30 días</div>

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Lúmina, inicio">LÚMINA</a>
        <nav aria-label="Navegación principal">
          <a href="#coleccion">Novedades</a>
          <a href="#coleccion" onClick={() => setCategory("Casa")}>Casa</a>
          <a href="#coleccion" onClick={() => setCategory("Accesorios")}>Accesorios</a>
          <a href="#historia">Nuestra historia</a>
        </nav>
        <div className="header-actions">
          <a href="/cuenta">Mi cuenta</a>
          <button type="button" onClick={() => setSearchOpen(true)}>Buscar</button>
          <button type="button" onClick={() => setCartOpen(true)} aria-label={`Abrir cesta con ${cartCount} productos`}>
            Cesta ({cartCount})
          </button>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">Colección 01 · Hecho para durar</p>
          <h1>Objetos que <em>cambian</em> el ritmo.</h1>
          <p className="hero-description">Una selección de piezas honestas para vestir tu casa y acompañar tus días. Diseño sereno, materiales con carácter.</p>
          <a className="primary-link" href="#coleccion">Explorar la colección <span aria-hidden="true">↗</span></a>
        </div>
        <div className="hero-visual">
          <img src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=90" alt="Salón contemporáneo en tonos cálidos" />
          <div className="hero-tag"><span>Nueva edición</span><strong>Formas esenciales</strong></div>
        </div>
      </section>

      <section className="collection" id="coleccion">
        <div className="section-heading">
          <div><p className="eyebrow">Selección de la semana</p><h2>Recién llegados</h2></div>
          <span className="result-count">{visibleProducts.length} piezas</span>
        </div>

        <div className="catalog-tools" aria-label="Filtros del catálogo">
          <div className="category-tabs">
            {["Todo", "Casa", "Accesorios"].map((item) => (
              <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
          <button className="inline-search" type="button" onClick={() => setSearchOpen(true)}>
            {search ? `Buscando “${search}”` : "Buscar en la colección"} <span aria-hidden="true">⌕</span>
          </button>
        </div>

        {visibleProducts.length ? (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image">
                  {product.featured && <span className="product-badge">Nuevo</span>}
                  <a className="product-image-link" href={`/productos/${product.slug}`} aria-label={`Ver ${product.name}`}>
                    <img src={product.image} alt={product.name} />
                  </a>
                  <button className={`favorite-button ${favoriteIds.includes(product.id) ? "active" : ""}`} type="button" aria-pressed={favoriteIds.includes(product.id)} onClick={() => toggleFavorite(product)} aria-label={`${favoriteIds.includes(product.id) ? "Quitar" : "Añadir"} ${product.name} ${favoriteIds.includes(product.id) ? "de" : "a"} favoritos`}>{favoriteIds.includes(product.id) ? "♥" : "♡"}</button>
                  <button className="add-product-button" type="button" onClick={() => addToCart(product)} aria-label={`Añadir ${product.name} a la cesta`}>Añadir</button>
                </div>
                <div className="product-meta">
                  <div><p>{product.category}</p><h3><a href={`/productos/${product.slug}`}>{product.name}</a></h3><small>{product.description}</small></div>
                  <strong>{money.format(product.price)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-results"><span>Sin coincidencias</span><h3>Probemos otra búsqueda.</h3><button type="button" onClick={() => { setSearch(""); setCategory("Todo"); }}>Ver todas las piezas</button></div>
        )}
      </section>

      <section className="manifesto" id="historia">
        <div className="manifesto-image">
          <img src="https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=1400&q=85" alt="Interior de un taller de diseño" />
          <span>Madrid · Desde 2024</span>
        </div>
        <div className="manifesto-copy">
          <p className="eyebrow">Nuestra forma de hacer</p>
          <h2>Menos ruido.<br /><em>Más intención.</em></h2>
          <p>Elegimos objetos que envejecen bien, creados en series pequeñas por estudios y talleres independientes. Queremos que cada pieza se sienta propia desde el primer día.</p>
          <div className="manifesto-stats"><div><strong>24</strong><span>Talleres colaboradores</span></div><div><strong>92%</strong><span>Materiales de origen europeo</span></div></div>
        </div>
      </section>

      <section className="newsletter">
        <p className="eyebrow">Cartas desde el estudio</p>
        <h2>Ideas para vivir<br /><em>un poco mejor.</em></h2>
        <form onSubmit={subscribe}>
          <label className="sr-only" htmlFor="newsletter-email">Tu correo electrónico</label>
          <input id="newsletter-email" type="email" placeholder="tu@email.com" required />
          <button type="submit">Apuntarme <span aria-hidden="true">→</span></button>
        </form>
        <small>Sin ruido. Un correo al mes y puedes irte cuando quieras.</small>
      </section>

      <footer>
        <a className="footer-brand" href="#inicio">LÚMINA</a>
        <p>Objetos con carácter para días con calma.</p>
        <div className="footer-links"><a href="#coleccion">Catálogo</a><a href="#historia">Estudio</a><a href="/cuenta">Mi cuenta</a><a href="/admin">Administración</a><a href="mailto:hola@lumina.local">Contacto</a></div>
        <div className="footer-legal"><span>© 2026 Lúmina Estudio</span><span>Prototipo de tienda online</span></div>
      </footer>

      {searchOpen && (
        <div className="overlay search-overlay" role="dialog" aria-modal="true" aria-label="Buscar productos">
          <button className="overlay-backdrop" type="button" onClick={() => setSearchOpen(false)} aria-label="Cerrar búsqueda" />
          <div className="search-panel">
            <button className="close-button" type="button" onClick={() => setSearchOpen(false)} aria-label="Cerrar búsqueda">×</button>
            <p className="eyebrow">¿Qué estás buscando?</p>
            <label className="sr-only" htmlFor="store-search">Buscar productos</label>
            <input id="store-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Escribe aquí…" />
            <div className="search-suggestions"><span>Prueba con:</span>{["sillón", "cerámica", "accesorios"].map((term) => <button type="button" key={term} onClick={() => setSearch(term)}>{term}</button>)}</div>
            <button className="search-submit" type="button" onClick={() => { setSearchOpen(false); document.getElementById("coleccion")?.scrollIntoView(); }}>Ver {visibleProducts.length} resultados <span>→</span></button>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="overlay cart-overlay" role="dialog" aria-modal="true" aria-label="Tu cesta">
          <button className="overlay-backdrop" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar cesta" />
          <aside className="cart-drawer">
            <div className="drawer-header"><div><p className="eyebrow">Tu selección</p><h2>Cesta <span>({cartCount})</span></h2></div><button className="close-button" type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar cesta">×</button></div>
            {cartLines.length ? (
              <>
                <div className="shipping-note">{shippingLeft ? `Te faltan ${money.format(shippingLeft)} para el envío gratuito.` : "Tu envío es gratuito."}<div><span style={{ width: `${Math.min(100, (cartTotal / 80) * 100)}%` }} /></div></div>
                <div className="cart-lines">
                  {cartLines.map(({ product, quantity }) => (
                    <article className="cart-line" key={product.id}>
                      <img src={product.image} alt="" />
                      <div className="cart-line-copy"><span>{product.category}</span><h3>{product.name}</h3><strong>{money.format(product.price)}</strong><div className="quantity-control"><button type="button" onClick={() => changeQuantity(product, -1)} aria-label={`Quitar una unidad de ${product.name}`}>−</button><span>{quantity}</span><button type="button" onClick={() => changeQuantity(product, 1)} aria-label={`Añadir una unidad de ${product.name}`}>+</button></div></div>
                    </article>
                  ))}
                </div>
                <div className="cart-summary"><div><span>Subtotal</span><strong>{money.format(cartTotal)}</strong></div><small>Impuestos incluidos. Envío calculado al finalizar.</small><button type="button" onClick={() => { window.location.href = "/checkout"; }}>Finalizar compra <span>→</span></button></div>
              </>
            ) : (
              <div className="empty-cart"><span>Tu cesta está esperando.</span><p>Explora la colección y guarda aquí tus piezas favoritas.</p><button type="button" onClick={() => setCartOpen(false)}>Seguir descubriendo</button></div>
            )}
          </aside>
        </div>
      )}

      <div className={`toast ${notice ? "visible" : ""}`} role="status" aria-live="polite">{notice}<span>✓</span></div>
    </main>
  );
}
