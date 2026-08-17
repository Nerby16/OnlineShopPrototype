"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element, react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../../hooks/use-api";
import { money, type Product } from "../../lib/products";

type SessionUser = { id: number; email: string; name: string; phone: string; marketingOptIn: boolean; role: "customer" | "admin" };

type AccountOrder = {
  id: number;
  customerName: string;
  customerEmail: string;
  shippingAddress: { address?: string; city?: string; postalCode?: string };
  status: "pending" | "paid" | "shipped" | "cancelled";
  subtotal: number;
  shipping: number;
  total: number;
  createdAt: string;
  items: Array<{ productId: number; productName: string; unitPrice: number; quantity: number }>;
};

export type SavedAddress = {
  id: number;
  label: string;
  recipientName: string;
  addressLine: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
};

const emptyAddress = { label: "Casa", recipientName: "", addressLine: "", city: "", postalCode: "", isDefault: false };

const statusCopy = {
  pending: { label: "Pendiente", description: "Hemos recibido el pedido y estamos revisándolo." },
  paid: { label: "Preparando", description: "El pedido está confirmado y se está preparando." },
  shipped: { label: "Enviado", description: "La selección ya está en camino." },
  cancelled: { label: "Cancelado", description: "Este pedido ha sido cancelado." },
};

export default function AccountArea() {
  const apiFetch = useApi();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [filter, setFilter] = useState<"all" | AccountOrder["status"]>("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancellationOrder, setCancellationOrder] = useState<AccountOrder | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<SavedAddress | null>(null);
  const [deletingAddress, setDeletingAddress] = useState(false);
  const cancellationSafeActionRef = useRef<HTMLButtonElement>(null);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", marketingOptIn: false });

  async function loadAccountData() {
    const [profile, orderList, addressList, favoriteList] = await Promise.all([
      apiFetch<SessionUser>("/account/profile"),
      apiFetch<AccountOrder[]>("/account/orders"),
      apiFetch<SavedAddress[]>("/account/addresses"),
      apiFetch<Product[]>("/account/favorites"),
    ]);
    setUser(profile);
    setProfileForm({ name: profile.name, phone: profile.phone, marketingOptIn: profile.marketingOptIn });
    setOrders(orderList);
    setAddresses(addressList);
    setFavorites(favoriteList);
  }

  async function bootstrap() {
    try {
      const { user: sessionUser } = await apiFetch<{ user: SessionUser | null }>("/auth/me");
      if (sessionUser) {
        setUser(sessionUser);
        setAddressForm({ ...emptyAddress, recipientName: sessionUser.name });
        await loadAccountData();
      }
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!cancellationOrder && !addressToDelete) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => cancellationSafeActionRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !cancelling && !deletingAddress) {
        setCancellationOrder(null);
        setAddressToDelete(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [addressToDelete, cancellationOrder, cancelling, deletingAddress]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (mode === "register" && password !== String(form.get("confirmation") ?? "")) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }
    try {
      const { user: signedInUser } = await apiFetch<{ user: SessionUser }>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), password }),
      });
      setUser(signedInUser);
      setAddressForm({ ...emptyAddress, recipientName: signedInUser.name });
      await loadAccountData();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "No se pudo completar el acceso.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setOrders([]);
      setAddresses([]);
      setFavorites([]);
      setProfileForm({ name: "", phone: "", marketingOptIn: false });
      setMode("login");
    }
  }

  function resetAddressEditor() {
    setEditingAddressId(null);
    setAddressForm({ ...emptyAddress, recipientName: user?.name ?? "" });
  }

  function editAddress(address: SavedAddress) {
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label,
      recipientName: address.recipientName,
      addressLine: address.addressLine,
      city: address.city,
      postalCode: address.postalCode,
      isDefault: address.isDefault,
    });
    document.getElementById("address-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch(editingAddressId ? `/account/addresses/${editingAddressId}` : "/account/addresses", {
        method: editingAddressId ? "PATCH" : "POST",
        body: JSON.stringify(addressForm),
      });
      setAddresses(await apiFetch<SavedAddress[]>("/account/addresses"));
      setNotice(editingAddressId ? "Dirección actualizada" : "Dirección guardada");
      resetAddressEditor();
    } catch (addressError) {
      setError(addressError instanceof Error ? addressError.message : "No se pudo guardar la dirección.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAddress(address: SavedAddress) {
    setDeletingAddress(true);
    setError("");
    try {
      await apiFetch(`/account/addresses/${address.id}`, { method: "DELETE" });
      setAddresses(await apiFetch<SavedAddress[]>("/account/addresses"));
      if (editingAddressId === address.id) resetAddressEditor();
      setNotice("Dirección eliminada");
      setAddressToDelete(null);
    } catch (addressError) {
      setError(addressError instanceof Error ? addressError.message : "No se pudo eliminar la dirección.");
      setAddressToDelete(null);
    } finally {
      setDeletingAddress(false);
    }
  }

  async function makeDefault(address: SavedAddress) {
    try {
      await apiFetch(`/account/addresses/${address.id}`, { method: "PATCH", body: JSON.stringify({ ...address, isDefault: true }) });
      setAddresses(await apiFetch<SavedAddress[]>("/account/addresses"));
      setNotice("Dirección predeterminada actualizada");
    } catch (addressError) {
      setError(addressError instanceof Error ? addressError.message : "No se pudo actualizar la dirección.");
    }
  }

  async function removeFavorite(productId: number) {
    try {
      await apiFetch(`/account/favorites/${productId}`, { method: "DELETE" });
      setFavorites((current) => current.filter((product) => product.id !== productId));
      setNotice("Producto eliminado de favoritos");
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : "No se pudo actualizar favoritos.");
    }
  }

  async function cancelOrder(orderId: number) {
    setCancelling(true);
    setError("");
    try {
      await apiFetch(`/account/orders/${orderId}/cancel`, { method: "PATCH", body: "{}" });
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: "cancelled" } : order));
      setNotice(`Pedido #${orderId} cancelado`);
      setCancellationOrder(null);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "No se pudo cancelar el pedido.");
      setCancellationOrder(null);
    } finally {
      setCancelling(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmation") ?? "")) {
      setError("Las contraseñas nuevas no coinciden.");
      setLoading(false);
      return;
    }
    try {
      await apiFetch("/account/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: String(form.get("currentPassword") ?? ""), newPassword }),
      });
      formElement.reset();
      setNotice("Contraseña actualizada; tu sesión sigue protegida");
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const profile = await apiFetch<SessionUser>("/account/profile", {
        method: "PATCH",
        body: JSON.stringify(profileForm),
      });
      setUser(profile);
      setProfileForm({ name: profile.name, phone: profile.phone, marketingOptIn: profile.marketingOptIn });
      setAddressForm((current) => ({ ...current, recipientName: current.recipientName || profile.name }));
      setNotice("Perfil actualizado");
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "No se pudo actualizar el perfil.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => ({
    pending: orders.filter((order) => ["pending", "paid"].includes(order.status)).length,
    shipped: orders.filter((order) => order.status === "shipped").length,
    total: orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.total, 0),
  }), [orders]);
  const visibleOrders = filter === "all" ? orders : orders.filter((order) => order.status === filter);

  if (checking) return <main className="account-loading"><a className="brand" href="/">NEXO ANIMAL</a><p>Preparando tu espacio personal…</p></main>;

  if (!user) {
    return (
      <main className="account-auth">
        <header className="account-header"><a className="brand" href="/">NEXO ANIMAL</a><a href="/">← Volver a la tienda</a></header>
        <section className="account-auth-layout">
          <div className="account-auth-copy"><p className="eyebrow">Tu espacio en Nexo Animal</p><h1>Pedidos y preferencias,<br /><em>en un solo lugar.</em></h1><p>Consulta tus pedidos, guarda productos y reutiliza tus direcciones en futuras compras.</p><ul><li>Historial y cancelación de pedidos pendientes</li><li>Favoritos y direcciones guardadas</li><li>Sesión privada y contraseña cifrada</li></ul></div>
          <form className="account-auth-form" onSubmit={authenticate}>
            <div className="auth-tabs" role="tablist" aria-label="Acceso a la cuenta"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Iniciar sesión</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Crear cuenta</button></div>
            <p className="eyebrow">{mode === "login" ? "Bienvenido de nuevo" : "Primera visita"}</p><h2>{mode === "login" ? "Accede a tus pedidos." : "Crea tu espacio personal."}</h2>
            <div className="form-grid">{mode === "register" && <label className="field field-wide"><span>Nombre completo</span><input name="name" autoComplete="name" required /></label>}<label className="field field-wide"><span>Correo electrónico</span><input name="email" type="email" autoComplete="email" required /></label><label className="field field-wide"><span>Contraseña</span><input name="password" type="password" minLength={mode === "register" ? 12 : 1} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>{mode === "register" && <label className="field field-wide"><span>Repite la contraseña</span><input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label>}</div>
            {error && <p className="form-error" role="alert">{error}</p>}<button className="checkout-submit" type="submit" disabled={loading}>{loading ? "Un momento…" : mode === "login" ? "Entrar en mi cuenta" : "Crear mi cuenta"} <span>→</span></button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <header className="account-header"><a className="brand" href="/">NEXO ANIMAL</a><nav><a href="/">Tienda</a>{user.role === "admin" && <a href="/admin">Administración</a>}<button type="button" onClick={logout}>Cerrar sesión</button></nav></header>
      <section className="account-hero"><div><p className="eyebrow">Mi cuenta</p><h1>Hola, <em>{user.name.split(" ")[0]}.</em></h1><p>{user.email}</p></div><span>Cliente registrado · #{String(user.id).padStart(4, "0")}</span></section>
      <section className="account-dashboard">
        {error && <p className="admin-message error" role="alert">{error}</p>}{notice && <p className="admin-message" role="status">{notice}</p>}
        <div className="account-stats"><article><span>Pedidos totales</span><strong>{orders.length}</strong></article><article><span>En curso</span><strong>{stats.pending}</strong></article><article><span>Enviados</span><strong>{stats.shipped}</strong></article><article><span>Valor de compras</span><strong>{money.format(stats.total)}</strong></article></div>
        <section className="account-subsection" id="perfil"><div className="account-orders-heading"><div><p className="eyebrow">Datos personales</p><h2>Mi perfil</h2></div><span>El correo se mantiene protegido</span></div><form className="account-settings-form profile" onSubmit={saveProfile}><div className="form-grid"><label className="field"><span>Nombre completo</span><input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} autoComplete="name" minLength={2} maxLength={120} required /></label><label className="field"><span>Teléfono</span><input type="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} autoComplete="tel" maxLength={30} placeholder="+34 600 000 000" /></label><label className="field field-wide"><span>Correo electrónico</span><input value={user.email} type="email" readOnly aria-describedby="profile-email-help" /></label><label className="check-field field-wide"><input type="checkbox" checked={profileForm.marketingOptIn} onChange={(event) => setProfileForm({ ...profileForm, marketingOptIn: event.target.checked })} /><span>Quiero recibir novedades y selecciones de Nexo Animal</span></label></div><button className="checkout-submit" type="submit" disabled={loading}>{loading ? "Guardando…" : "Guardar perfil"} <span>→</span></button><small id="profile-email-help">Para cambiar el correo añadiremos más adelante un proceso de verificación.</small></form></section>
        <div className="account-orders-heading"><div><p className="eyebrow">Historial</p><h2>Mis pedidos</h2></div><label><span className="sr-only">Filtrar pedidos</span><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="paid">En preparación</option><option value="shipped">Enviados</option><option value="cancelled">Cancelados</option></select></label></div>
        {visibleOrders.length ? <div className="account-orders">{visibleOrders.map((order) => <article className="account-order" key={order.id}><header><div><span>Pedido #{order.id}</span><strong>{new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(order.createdAt))}</strong></div><span className={`status ${order.status}`}>{statusCopy[order.status].label}</span></header><div className="account-order-body"><div className="account-order-items">{order.items.map((item) => <div key={`${order.id}-${item.productId}`}><span>{item.quantity} × {item.productName}</span><strong>{money.format(item.unitPrice * item.quantity)}</strong></div>)}</div><div className="account-order-status"><span className={`order-status-dot ${order.status}`} /><div><strong>{statusCopy[order.status].label}</strong><p>{statusCopy[order.status].description}</p></div></div></div><footer><div><span>Entrega</span><strong>{[order.shippingAddress.address, order.shippingAddress.postalCode, order.shippingAddress.city].filter(Boolean).join(", ")}</strong></div><div><span>Total</span><strong>{money.format(order.total)}</strong></div><a className="account-order-link" href={`/cuenta/pedidos/${order.id}`}>Ver detalle →</a>{order.status === "pending" && <button className="account-danger-action" type="button" onClick={() => setCancellationOrder(order)}>Cancelar pedido</button>}</footer></article>)}</div> : <div className="account-empty"><p className="eyebrow">Sin pedidos en esta vista</p><h2>{orders.length ? "Prueba con otro filtro." : "Todavía no has realizado ningún pedido."}</h2><a className="primary-link" href="/#coleccion">Explorar catálogo <span>→</span></a></div>}

        <section className="account-subsection" id="favoritos"><div className="account-orders-heading"><div><p className="eyebrow">Tu selección</p><h2>Favoritos</h2></div><span>{favorites.length} guardados</span></div>{favorites.length ? <div className="account-favorites">{favorites.map((product) => <article key={product.id}><a href={`/productos/${product.slug}`}><img src={product.image} alt={product.name} /></a><div><span>{product.category}</span><h3><a href={`/productos/${product.slug}`}>{product.name}</a></h3><strong>{money.format(product.price)}</strong><button type="button" onClick={() => removeFavorite(product.id)}>Quitar de favoritos</button></div></article>)}</div> : <div className="account-empty compact"><h2>Aún no has guardado favoritos.</h2><a href="/#coleccion">Descubrir productos →</a></div>}</section>

        <section className="account-subsection" id="direcciones"><div className="account-orders-heading"><div><p className="eyebrow">Entrega</p><h2>Mis direcciones</h2></div><button type="button" onClick={resetAddressEditor}>+ Nueva dirección</button></div><div className="account-address-layout"><div className="address-list">{addresses.length ? addresses.map((address) => <article className={address.isDefault ? "default" : ""} key={address.id}><header><strong>{address.label}</strong>{address.isDefault && <span>Predeterminada</span>}</header><p>{address.recipientName}<br />{address.addressLine}<br />{address.postalCode} {address.city}</p><footer><button type="button" onClick={() => editAddress(address)}>Editar</button>{!address.isDefault && <button type="button" onClick={() => makeDefault(address)}>Hacer principal</button>}<button type="button" onClick={() => setAddressToDelete(address)}>Eliminar</button></footer></article>) : <div className="account-empty compact"><h2>No tienes direcciones guardadas.</h2><p>Añade una para completar el checkout más rápido.</p></div>}</div>
          <form className="account-settings-form" id="address-editor" onSubmit={saveAddress}><p className="eyebrow">{editingAddressId ? "Editar dirección" : "Nueva dirección"}</p><div className="form-grid"><label className="field"><span>Etiqueta</span><input value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} placeholder="Casa, Trabajo…" required /></label><label className="field"><span>Destinatario</span><input value={addressForm.recipientName} onChange={(event) => setAddressForm({ ...addressForm, recipientName: event.target.value })} autoComplete="name" required /></label><label className="field field-wide"><span>Dirección</span><input value={addressForm.addressLine} onChange={(event) => setAddressForm({ ...addressForm, addressLine: event.target.value })} autoComplete="street-address" required /></label><label className="field"><span>Ciudad</span><input value={addressForm.city} onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })} autoComplete="address-level2" required /></label><label className="field"><span>Código postal</span><input value={addressForm.postalCode} onChange={(event) => setAddressForm({ ...addressForm, postalCode: event.target.value })} autoComplete="postal-code" required /></label><label className="check-field field-wide"><input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })} /><span>Usar como dirección predeterminada</span></label></div><button className="checkout-submit" type="submit" disabled={loading}>{editingAddressId ? "Guardar cambios" : "Guardar dirección"} <span>→</span></button></form></div></section>

        <section className="account-subsection" id="seguridad"><div className="account-orders-heading"><div><p className="eyebrow">Seguridad</p><h2>Cambiar contraseña</h2></div></div><form className="account-settings-form security" onSubmit={changePassword}><div className="form-grid"><label className="field"><span>Contraseña actual</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label><label className="field"><span>Nueva contraseña</span><input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label><label className="field"><span>Repite la nueva contraseña</span><input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label></div><button className="checkout-submit" type="submit" disabled={loading}>Actualizar contraseña <span>→</span></button><small>Usa al menos 12 caracteres. Se cerrarán las demás sesiones y esta se renovará automáticamente.</small></form></section>
      </section>
      {cancellationOrder && (
        <div className="account-confirmation-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
          <button className="account-confirmation-backdrop" type="button" aria-label="Volver sin cancelar" onClick={() => { if (!cancelling) setCancellationOrder(null); }} />
          <section className="account-confirmation-panel">
            <span className="account-confirmation-number">Pedido #{cancellationOrder.id}</span>
            <p className="eyebrow">Confirmar cancelación</p>
            <h2 id="cancel-order-title">¿Quieres cancelar<br /><em>este pedido?</em></h2>
            <p>Esta acción marcará el pedido como cancelado y devolverá sus {cancellationOrder.items.reduce((sum, item) => sum + item.quantity, 0)} {cancellationOrder.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "producto" : "productos"} al stock disponible.</p>
            <div className="account-confirmation-summary"><span>Total del pedido</span><strong>{money.format(cancellationOrder.total)}</strong></div>
            <div className="account-confirmation-actions">
              <button ref={cancellationSafeActionRef} type="button" onClick={() => setCancellationOrder(null)} disabled={cancelling}>Mantener pedido</button>
              <button type="button" onClick={() => cancelOrder(cancellationOrder.id)} disabled={cancelling}>{cancelling ? "Cancelando…" : "Sí, cancelar pedido"}</button>
            </div>
            <small>Puedes cerrar este mensaje con la tecla Esc.</small>
          </section>
        </div>
      )}
      {addressToDelete && (
        <div className="account-confirmation-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-address-title">
          <button className="account-confirmation-backdrop" type="button" aria-label="Volver sin eliminar" onClick={() => { if (!deletingAddress) setAddressToDelete(null); }} />
          <section className="account-confirmation-panel">
            <span className="account-confirmation-number">Dirección guardada</span>
            <p className="eyebrow">Confirmar eliminación</p>
            <h2 id="delete-address-title">¿Eliminar<br /><em>{addressToDelete.label}?</em></h2>
            <p>Se quitará de tu libreta de direcciones, pero no afectará a los pedidos que ya hayas realizado.</p>
            <div className="account-confirmation-summary"><span>Dirección</span><strong>{addressToDelete.postalCode} · {addressToDelete.city}</strong></div>
            <div className="account-confirmation-actions"><button ref={cancellationSafeActionRef} type="button" onClick={() => setAddressToDelete(null)} disabled={deletingAddress}>Mantener dirección</button><button type="button" onClick={() => deleteAddress(addressToDelete)} disabled={deletingAddress}>{deletingAddress ? "Eliminando…" : "Sí, eliminar"}</button></div>
            <small>Puedes cerrar este mensaje con la tecla Esc.</small>
          </section>
        </div>
      )}
    </main>
  );
}
