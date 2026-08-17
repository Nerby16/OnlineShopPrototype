"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element, react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useApi } from "../../hooks/use-api";
import { useCart } from "../../hooks/use-cart";
import { useSession } from "../../hooks/use-session";
import { FALLBACK_PRODUCTS, money, type Product } from "../../lib/products";

type OrderResult = {
  id: number;
  status: string;
  total: number;
  linkedToAccount: boolean;
};

type SavedAddress = { id: number; label: string; recipientName: string; addressLine: string; city: string; postalCode: string; isDefault: boolean };

export default function Checkout() {
  const request = useApi();
  const { cart, setCart, clearCart, ready } = useCart();
  const { user: account } = useSession();
  const [products, setProducts] = useState<Product[]>(FALLBACK_PRODUCTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", address: "", city: "", postalCode: "" });

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
    if (!account) return;
    const controller = new AbortController();
    setCustomer((current) => ({ ...current, name: account.name, email: account.email, phone: account.phone ?? "" }));
    request<SavedAddress[]>("/account/addresses", { signal: controller.signal })
      .then((savedAddresses) => {
        setAddresses(savedAddresses);
        const preferred = savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
        if (preferred) applyAddress(preferred);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [account, request]);

  function applyAddress(address: SavedAddress) {
    setSelectedAddressId(String(address.id));
    setCustomer((current) => ({
      ...current,
      name: address.recipientName,
      address: address.addressLine,
      city: address.city,
      postalCode: address.postalCode,
    }));
  }

  function chooseAddress(value: string) {
    setSelectedAddressId(value);
    if (!value) return;
    const address = addresses.find((item) => item.id === Number(value));
    if (address) applyAddress(address);
  }

  const lines = useMemo(() => cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.id);
    return product ? [{ ...line, product }] : [];
  }), [cart, products]);

  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const shipping = subtotal >= 80 ? 0 : 6.9;
  const total = subtotal + shipping;

  function updateQuantity(product: Product, delta: number) {
    const nextCart = cart
      .map((line) => line.id === product.id
        ? { ...line, quantity: Math.min(product.stock, line.quantity + delta) }
        : line)
      .filter((line) => line.quantity > 0);
    setCart(nextCart);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const payload = {
      customer,
      items: cart,
    };

    try {
      const data = await request<OrderResult>("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (account && saveAddress && !selectedAddressId) {
        await request("/account/addresses", {
          method: "POST",
          body: JSON.stringify({ label: "Casa", recipientName: customer.name, addressLine: customer.address, city: customer.city, postalCode: customer.postalCode, isDefault: addresses.length === 0 }),
        }).catch(() => undefined);
      }
      setOrder(data);
      clearCart();
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "No se pudo crear el pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  if (order) {
    return (
      <main className="checkout-page checkout-success">
        <a className="brand" href="/">LÚMINA</a>
        <div className="success-mark">✓</div>
        <p className="eyebrow">Pedido confirmado</p>
        <h1>Gracias por elegir<br /><em>con intención.</em></h1>
        <p>Tu pedido <strong>#{order.id}</strong> se ha guardado correctamente por un total de <strong>{money.format(order.total)}</strong>.</p>
        <div className="success-actions"><a className="primary-link" href={order.linkedToAccount ? "/cuenta" : "/"}>{order.linkedToAccount ? "Ver en mis pedidos" : "Volver a la tienda"} <span>→</span></a>{order.linkedToAccount && <a href="/">Seguir comprando</a>}</div>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <a className="brand" href="/">LÚMINA</a>
        <span>Checkout seguro · Demostración</span>
        <a href="/cuenta">Mi cuenta</a>
      </header>

      {!ready ? (
        <div className="checkout-empty">Preparando tu selección…</div>
      ) : lines.length === 0 ? (
        <div className="checkout-empty">
          <p className="eyebrow">Tu cesta está vacía</p>
          <h1>Aún queda mucho<br /><em>por descubrir.</em></h1>
          <a className="primary-link" href="/#coleccion">Explorar la colección <span>→</span></a>
        </div>
      ) : (
        <div className="checkout-layout">
          <form className="checkout-form" onSubmit={submitOrder}>
            <p className="eyebrow">01 · Datos de entrega</p>
            <h1>¿Dónde enviamos<br /><em>tu selección?</em></h1>

            <div className={`checkout-account-note ${account ? "signed-in" : ""}`}>
              <span>{account ? `Pedido asociado a ${account.email}` : "¿Quieres consultar este pedido más tarde?"}</span>
              {!account && <a href="/cuenta">Inicia sesión o crea una cuenta →</a>}
            </div>

            {account && (
              <div className="checkout-saved-addresses">
                <label className="field"><span>Dirección guardada</span><select value={selectedAddressId} onChange={(event) => chooseAddress(event.target.value)}><option value="">Introducir una dirección nueva</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label}{address.isDefault ? " · Predeterminada" : ""} — {address.addressLine}</option>)}</select></label>
                <a href="/cuenta#direcciones">Gestionar direcciones →</a>
              </div>
            )}

            <div className="form-grid">
              <label className="field field-wide"><span>Nombre completo</span><input name="name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} autoComplete="name" required /></label>
              <label className="field field-wide"><span>Correo electrónico</span><input name="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} type="email" autoComplete="email" required readOnly={Boolean(account)} /></label>
              <label className="field field-wide"><span>Teléfono de contacto (opcional)</span><input name="phone" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} type="tel" autoComplete="tel" maxLength={30} placeholder="+34 600 000 000" /></label>
              <label className="field field-wide"><span>Dirección</span><input name="address" value={customer.address} onChange={(event) => { setSelectedAddressId(""); setCustomer({ ...customer, address: event.target.value }); }} autoComplete="street-address" required /></label>
              <label className="field"><span>Ciudad</span><input name="city" value={customer.city} onChange={(event) => { setSelectedAddressId(""); setCustomer({ ...customer, city: event.target.value }); }} autoComplete="address-level2" required /></label>
              <label className="field"><span>Código postal</span><input name="postalCode" value={customer.postalCode} onChange={(event) => { setSelectedAddressId(""); setCustomer({ ...customer, postalCode: event.target.value }); }} autoComplete="postal-code" required pattern="[0-9A-Za-z -]{4,20}" /></label>
              {account && !selectedAddressId && <label className="check-field field-wide"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} /><span>Guardar esta dirección en mi cuenta</span></label>}
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="checkout-submit" type="submit" disabled={submitting}>
              {submitting ? "Creando pedido…" : `Confirmar pedido · ${money.format(total)}`} <span>→</span>
            </button>
            <small>No se procesa ningún pago real. Este checkout demuestra la creación transaccional de pedidos.</small>
          </form>

          <aside className="order-review">
            <div className="order-review-heading"><p className="eyebrow">02 · Resumen</p><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} piezas</span></div>
            <div className="review-lines">
              {lines.map(({ product, quantity }) => (
                <article className="review-line" key={product.id}>
                  <img src={product.image} alt="" />
                  <div><span>{product.category}</span><h2>{product.name}</h2><strong>{money.format(product.price)}</strong><div className="quantity-control"><button type="button" onClick={() => updateQuantity(product, -1)}>−</button><span>{quantity}</span><button type="button" onClick={() => updateQuantity(product, 1)}>+</button></div></div>
                </article>
              ))}
            </div>
            <dl className="review-totals">
              <div><dt>Subtotal</dt><dd>{money.format(subtotal)}</dd></div>
              <div><dt>Envío</dt><dd>{shipping ? money.format(shipping) : "Gratis"}</dd></div>
              <div className="review-total"><dt>Total</dt><dd>{money.format(total)}</dd></div>
            </dl>
          </aside>
        </div>
      )}
    </main>
  );
}
