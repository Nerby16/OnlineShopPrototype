import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Nexo Animal storefront and social metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);

  const html = await response.text();
  assert.match(html, /<html lang="es">/i);
  assert.match(html, /<title>Nexo Animal — Bienestar para todas las especies<\/title>/i);
  assert.match(html, /Todo lo que necesitan, en un solo lugar\./i);
  assert.match(html, /Disco de entrenamiento Terra/);
  assert.match(html, /Percha natural Olmo/);
  assert.match(html, /Filtro compacto Aqua 40/);
  assert.match(html, /property="og:image" content="http:\/\/localhost(?::3000)?\/og\.png"/i);
  assert.match(html, /name="twitter:card" content="summary_large_image"/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("renders product records with route-specific social metadata", async () => {
  for (const product of [
    { slug: "disco-entrenamiento-terra", name: "Disco de entrenamiento Terra", imageId: "photo-1604182965221-88b1bc9897ed" },
    { slug: "tunel-heno-prado", name: "Túnel de heno Prado", imageId: "photo-1742094611825-4e4d6493fbfd" },
  ]) {
    const response = await render(`/productos/${product.slug}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<title>${product.name} — Nexo Animal<\\/title>`));
    assert.match(html, new RegExp(`property="og:title" content="${product.name} — Nexo Animal"`));
    assert.match(html, new RegExp(`property="og:image" content="[^"]*${product.imageId}`));
    assert.match(html, new RegExp(`name="twitter:title" content="${product.name} — Nexo Animal"`));
    assert.doesNotMatch(html, /property="og:image" content="[^"]*\/og\.png"/i);
  }
});

test("renders checkout, customer account and protected administration surfaces", async () => {
  const [checkoutResponse, accountResponse, adminResponse, customerOrderResponse, adminOrderResponse, adminCustomerResponse] = await Promise.all([
    render("/checkout"),
    render("/cuenta"),
    render("/admin"),
    render("/cuenta/pedidos/8"),
    render("/admin/pedidos/8"),
    render("/admin/clientes/4"),
  ]);
  assert.equal(checkoutResponse.status, 200);
  assert.equal(accountResponse.status, 200);
  assert.equal(adminResponse.status, 200);
  assert.equal(customerOrderResponse.status, 200);
  assert.equal(adminOrderResponse.status, 200);
  assert.equal(adminCustomerResponse.status, 200);
  const [checkoutHtml, accountHtml, adminHtml, customerOrderHtml, adminOrderHtml, adminCustomerHtml] = await Promise.all([
    checkoutResponse.text(),
    accountResponse.text(),
    adminResponse.text(),
    customerOrderResponse.text(),
    adminOrderResponse.text(),
    adminCustomerResponse.text(),
  ]);
  assert.match(checkoutHtml, /<title>Finalizar compra — Nexo Animal<\/title>/i);
  assert.match(checkoutHtml, /Checkout seguro/);
  assert.match(accountHtml, /<title>Mi cuenta — Nexo Animal<\/title>/i);
  assert.match(accountHtml, /Preparando tu espacio personal/);
  assert.match(adminHtml, /<title>Administración — Nexo Animal<\/title>/i);
  assert.match(adminHtml, /Acceso de administración/);
  assert.match(customerOrderHtml, /<title>Detalle del pedido — Nexo Animal<\/title>/i);
  assert.match(customerOrderHtml, /Preparando los detalles del pedido/);
  assert.match(adminOrderHtml, /<title>Pedido — Administración de Nexo Animal<\/title>/i);
  assert.match(adminOrderHtml, /Abriendo la información del pedido/);
  assert.match(adminCustomerHtml, /<title>Cliente — Administración de Nexo Animal<\/title>/i);
  assert.match(adminCustomerHtml, /Preparando la ficha del cliente/);
});

test("includes the local MySQL data layer and seeded schema", async () => {
  const [schema, server, auth, packageJson, socialImage, adminDashboard, accountArea] = await Promise.all([
    readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../server/index.mjs", import.meta.url), "utf8"),
    readFile(new URL("../server/auth.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    stat(new URL("../public/og.png", import.meta.url)),
    readFile(new URL("../app/admin/admin-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cuenta/account.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS products/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS orders/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS order_items/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS users/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS sessions/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS addresses/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS favorites/i);
  assert.match(schema, /user_id BIGINT UNSIGNED NULL/i);
  assert.match(schema, /tracking_number VARCHAR\(80\)/i);
  assert.match(schema, /phone VARCHAR\(30\)/i);
  assert.match(schema, /marketing_opt_in TINYINT\(1\)/i);
  assert.match(schema, /customer_phone VARCHAR\(30\)/i);
  assert.match(schema, /shipped_at TIMESTAMP NULL/i);
  assert.match(schema, /INSERT INTO products/i);
  assert.match(schema, /Disco de entrenamiento Terra/i);
  assert.match(schema, /Túnel de heno Prado/i);
  assert.match(server, /from "mysql2\/promise"/);
  assert.match(server, /url\.pathname === "\/api\/products"/);
  assert.match(server, /url\.pathname === "\/api\/orders"/);
  assert.match(server, /beginTransaction\(\)/);
  assert.match(server, /subtotal >= 45/);
  assert.match(server, /FOR UPDATE/);
  assert.match(server, /\/api\/auth\/register/);
  assert.match(server, /\/api\/auth\/login/);
  assert.match(server, /\/api\/account\/orders/);
  assert.match(server, /\/api\/account\/addresses/);
  assert.match(server, /\/api\/account\/favorites/);
  assert.match(server, /\/api\/account\/password/);
  assert.match(server, /\/api\/account\/profile/);
  assert.match(server, /\/api\/admin\/uploads/);
  assert.match(server, /\/api\/admin\/analytics/);
  assert.match(server, /\/api\/admin\/customers/);
  assert.match(server, /adminCustomerStatusMatch/);
  assert.match(server, /paginatedPayload/);
  assert.match(server, /\/restore/);
  assert.match(server, /getOrderDetails/);
  assert.match(server, /\/tracking/);
  assert.match(server, /stock = stock \+ \?/);
  assert.match(server, /\/api\/admin\/products/);
  assert.match(server, /requireUser\(request, "admin"\)/);
  assert.match(server, /API_PUBLIC_ORIGIN/);
  assert.match(server, /consumeRequestLimit/);
  assert.match(server, /dummyPasswordHash/);
  assert.match(server, /application\/json/);
  assert.match(auth, /scrypt/);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /SameSite=Strict/);
  assert.match(packageJson, /"api": "node --env-file-if-exists=\.env server\/index\.mjs"/);
  assert.match(packageJson, /"mysql2":/);
  assert.match(packageJson, /"db:seed-demo":/);
  assert.ok(socialImage.size > 100_000);
  assert.doesNotMatch(adminDashboard, /window\.confirm/);
  assert.doesNotMatch(accountArea, /window\.confirm/);
  await access(new URL("../.env.example", import.meta.url));
});

test("validates uploaded image signatures instead of trusting file extensions", async () => {
  const { detectImageType, MAX_IMAGE_BYTES } = await import("../server/uploads.mjs");
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))?.mime, "image/jpeg");
  assert.equal(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension, "png");
  assert.equal(detectImageType(Buffer.from("RIFF0000WEBP"))?.extension, "webp");
  assert.equal(detectImageType(Buffer.from("esto no es una imagen")), null);
  assert.equal(MAX_IMAGE_BYTES, 5 * 1024 * 1024);
});

test("hashes credentials, rejects malformed hashes and protects session cookies", async () => {
  const { hashPassword, verifyPassword, readCookie, sessionCookie } = await import("../server/auth.mjs");
  const hash = await hashPassword("contraseña-segura-2026");
  assert.notEqual(hash, "contraseña-segura-2026");
  assert.equal(await verifyPassword("contraseña-segura-2026", hash), true);
  assert.equal(await verifyPassword("contraseña-incorrecta", hash), false);
  assert.equal(await verifyPassword("cualquier-clave", "scrypt$mal$formado"), false);
  assert.equal(readCookie({ headers: { cookie: "lumina_session=%E0%A4%A" } }, "lumina_session"), null);
  assert.match(
    sessionCookie("token-de-prueba", 3600),
    /HttpOnly; SameSite=Strict; Path=\/; Max-Age=3600; Priority=High/,
  );
});

test("centralizes API URLs and reusable client hooks", async () => {
  const [apiClient, sessionHook, cartHook, storefront, products, envExample, server] = await Promise.all([
    readFile(new URL("../lib/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/use-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../hooks/use-cart.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/storefront.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/products.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../server/index.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(apiClient, /VITE_API_BASE_URL/);
  assert.match(apiClient, /credentials: "include"/);
  assert.match(sessionHook, /export function useSession/);
  assert.match(cartHook, /export function useCart/);
  assert.match(cartHook, /normalizeCart/);
  assert.match(storefront, /useSession\(\)/);
  assert.match(storefront, /useCart\(\)/);
  assert.doesNotMatch(storefront, /http:\/\/localhost:3001/);
  assert.doesNotMatch(products, /API_URL/);
  assert.match(envExample, /SITE_PUBLIC_ORIGIN=/);
  assert.match(envExample, /VITE_API_BASE_URL=/);
  assert.match(server, /url\.protocol !== "https:"/);
});
