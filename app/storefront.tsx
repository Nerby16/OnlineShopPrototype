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
  const shippingLeft = Math.max(0, 45 - cartTotal);

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
    setNotice("¡Ya formas parte de la manada!");
  }

  return (
    <main className="storefront">
      <div className="announcement">Envío gratis desde 45 € <span>●</span> Juegos aprobados por patas exigentes</div>

      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Pata Papaya, inicio">PATA PAPAYA</a>
        <nav aria-label="Navegación principal">
          <a href="#coleccion">Juguetes</a>
          <a href="#coleccion" onClick={() => setCategory("Perros")}>Perros</a>
          <a href="#coleccion" onClick={() => setCategory("Gatos")}>Gatos</a>
          <a href="#historia">Nuestra manada</a>
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
          <p className="eyebrow">Juguetes tropicales · Diversión responsable</p>
          <h1>Más <em>juego.</em><br />Menos sofás mordidos.</h1>
          <p className="hero-description">Color, movimiento y juguetes con mucha selva para perros y gatos que se toman la diversión muy en serio.</p>
          <a className="primary-link" href="#coleccion">Soltar la diversión <span aria-hidden="true">↗</span></a>
        </div>
        <div className="hero-visual">
          <img src="https://images.unsplash.com/photo-1604182965221-88b1bc9897ed?auto=format&fit=crop&w=1600&q=90" alt="Perro saltando para atrapar un frisbee amarillo" />
          <div className="hero-tag"><span>Favorito de la manada</span><strong>Frisbee Guayaba</strong></div>
        </div>
      </section>

      <section className="collection" id="coleccion">
        <div className="section-heading">
          <div><p className="eyebrow">La juguetería feliz</p><h2>Para mover la cola</h2></div>
          <span className="result-count">{visibleProducts.length} aventuras</span>
        </div>

        <div className="catalog-tools" aria-label="Filtros del catálogo">
          <div className="category-tabs">
            {["Todo", "Perros", "Gatos"].map((item) => (
              <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
          <button className="inline-search" type="button" onClick={() => setSearchOpen(true)}>
            {search ? `Buscando “${search}”` : "Buscar el próximo favorito"} <span aria-hidden="true">⌕</span>
          </button>
        </div>

        {visibleProducts.length ? (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="product-image">
                  {product.featured && <span className="product-badge">Top patitas</span>}
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
          <div className="empty-results"><span>Ese juguete se ha escondido</span><h3>Probemos otra búsqueda.</h3><button type="button" onClick={() => { setSearch(""); setCategory("Todo"); }}>Ver todos los juguetes</button></div>
        )}
      </section>

      <section className="manifesto" id="historia">
        <div className="manifesto-image">
          <img src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=85" alt="Dos perros corriendo juntos al aire libre" />
          <span>Madrid · Manada desde 2024</span>
        </div>
        <div className="manifesto-copy">
          <p className="eyebrow">Nuestro manifiesto animal</p>
          <h2>Jugar también<br /><em>es cuidar.</em></h2>
          <p>Elegimos juguetes que despiertan instintos, gastan energía y fortalecen vínculos. Más carreras por el pasillo, más siestas felices y menos aburrimiento.</p>
          <div className="manifesto-stats"><div><strong>0%</strong><span>Aburrimiento permitido</span></div><div><strong>100%</strong><span>Colas en movimiento</span></div></div>
        </div>
      </section>

      <section className="newsletter">
        <p className="eyebrow">Correo que da la patita</p>
        <h2>Novedades con<br /><em>mucho olfato.</em></h2>
        <form onSubmit={subscribe}>
          <label className="sr-only" htmlFor="newsletter-email">Tu correo electrónico</label>
          <input id="newsletter-email" type="email" placeholder="tu@email.com" required />
          <button type="submit">Apuntarme <span aria-hidden="true">→</span></button>
        </form>
        <small>Un correo al mes. Sin spam, salvo que tu perro aprenda a escribir.</small>
      </section>

      <footer>
        <a className="footer-brand" href="#inicio">PATA PAPAYA</a>
        <p>Juguetes tropicales para animales con personalidad.</p>
        <div className="footer-links"><a href="#coleccion">Juguetes</a><a href="#historia">La manada</a><a href="/cuenta">Mi cuenta</a><a href="/admin">Administración</a><a href="mailto:hola@patapapaya.local">Contacto</a></div>
        <div className="footer-legal"><span>© 2026 Pata Papaya</span><span>Prototipo de tienda online</span></div>
      </footer>

      {searchOpen && (
        <div className="overlay search-overlay" role="dialog" aria-modal="true" aria-label="Buscar productos">
          <button className="overlay-backdrop" type="button" onClick={() => setSearchOpen(false)} aria-label="Cerrar búsqueda" />
          <div className="search-panel">
            <button className="close-button" type="button" onClick={() => setSearchOpen(false)} aria-label="Cerrar búsqueda">×</button>
            <p className="eyebrow">¿Qué estás buscando?</p>
            <label className="sr-only" htmlFor="store-search">Buscar productos</label>
            <input id="store-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Escribe aquí…" />
            <div className="search-suggestions"><span>Prueba con:</span>{["pelota", "mordedor", "gatos"].map((term) => <button type="button" key={term} onClick={() => setSearch(term)}>{term}</button>)}</div>
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
                <div className="shipping-note">{shippingLeft ? `Te faltan ${money.format(shippingLeft)} para el envío gratuito.` : "Tu envío es gratuito."}<div><span style={{ width: `${Math.min(100, (cartTotal / 45) * 100)}%` }} /></div></div>
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
              <div className="empty-cart"><span>La cesta está de siesta.</span><p>Encuentra un juguete que haga mover esa cola.</p><button type="button" onClick={() => setCartOpen(false)}>Seguir olfateando</button></div>
            )}
          </aside>
        </div>
      )}

      <div className={`toast ${notice ? "visible" : ""}`} role="status" aria-live="polite">{notice}<span>✓</span></div>
    </main>
  );
}
