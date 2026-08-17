import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  readCookie,
  sessionCookie,
  verifyPassword,
} from "./auth.mjs";
import { detectImageType, imageTypeFromFilename, MAX_IMAGE_BYTES } from "./uploads.mjs";

const port = Number(process.env.API_PORT ?? 3001);
const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
const adminEmail = String(process.env.ADMIN_EMAIL ?? "admin@lumina.local").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_TOKEN ?? "";
const secureCookies = process.env.NODE_ENV === "production";
const sessionDurationSeconds = 60 * 60 * 24 * 7;
const uploadDirectory = fileURLToPath(new URL("../storage/product-images/", import.meta.url));

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "lumina_store",
  connectionLimit: 8,
  waitForConnections: true,
  decimalNumbers: true,
});

const loginAttempts = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
    Vary: "Origin",
  };
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(httpError(413, "La solicitud es demasiado grande."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(httpError(400, "El cuerpo de la solicitud no es JSON válido."));
      }
    });
    request.on("error", reject);
  });
}

async function readBinary(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    request.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        reject(httpError(413, "La imagen supera el límite de 5 MB."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!settled) resolve(Buffer.concat(chunks));
    });
    request.on("error", (error) => {
      if (!settled) reject(error);
    });
  });
}

function normalizeProduct(row) {
  return {
    ...row,
    active: Boolean(row.active),
    featured: Boolean(row.featured),
    price: Number(row.price),
    stock: Number(row.stock),
  };
}

function normalizeUser(row) {
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    phone: row.phone ?? "",
    marketingOptIn: Boolean(row.marketing_opt_in),
    role: row.role,
  };
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function validateProduct(input) {
  const product = {
    name: String(input.name ?? "").trim(),
    slug: slugify(input.slug || input.name),
    category: String(input.category ?? "").trim(),
    description: String(input.description ?? "").trim(),
    price: Number(input.price),
    stock: Number(input.stock),
    image: String(input.image ?? "").trim(),
    featured: Boolean(input.featured),
  };

  if (product.name.length < 2 || product.name.length > 120) throw httpError(400, "El nombre del producto no es válido.");
  if (!product.slug || product.slug.length > 140) throw httpError(400, "El slug del producto no es válido.");
  if (!product.category || product.category.length > 60) throw httpError(400, "La categoría no es válida.");
  if (product.description.length < 10 || product.description.length > 320) throw httpError(400, "La descripción debe tener entre 10 y 320 caracteres.");
  if (!Number.isFinite(product.price) || product.price < 0) throw httpError(400, "El precio no es válido.");
  if (!Number.isInteger(product.stock) || product.stock < 0) throw httpError(400, "El stock no es válido.");
  if (!/^https?:\/\//i.test(product.image) || product.image.length > 600) throw httpError(400, "La URL de imagen no es válida.");
  return product;
}

function validateEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
    throw httpError(400, "Introduce un correo válido.");
  }
  return email;
}

function validatePassword(value) {
  const password = String(value ?? "");
  if (password.length < 8 || password.length > 128) {
    throw httpError(400, "La contraseña debe tener entre 8 y 128 caracteres.");
  }
  return password;
}

function validateName(value) {
  const name = String(value ?? "").trim();
  if (name.length < 2 || name.length > 120) throw httpError(400, "Introduce un nombre válido.");
  return name;
}

function validatePhone(value) {
  const phone = String(value ?? "").trim();
  if (phone && (phone.length < 7 || phone.length > 30 || !/^[0-9+() .-]+$/.test(phone))) {
    throw httpError(400, "Introduce un teléfono válido.");
  }
  return phone;
}

function validateAddress(input) {
  const address = {
    label: String(input.label ?? "Casa").trim(),
    recipientName: String(input.recipientName ?? "").trim(),
    addressLine: String(input.addressLine ?? "").trim(),
    city: String(input.city ?? "").trim(),
    postalCode: String(input.postalCode ?? "").trim(),
    isDefault: Boolean(input.isDefault),
  };
  if (address.label.length < 2 || address.label.length > 60) throw httpError(400, "La etiqueta de la dirección no es válida.");
  if (address.recipientName.length < 2 || address.recipientName.length > 120) throw httpError(400, "El destinatario no es válido.");
  if (address.addressLine.length < 5 || address.addressLine.length > 220) throw httpError(400, "La dirección no es válida.");
  if (address.city.length < 2 || address.city.length > 100) throw httpError(400, "La ciudad no es válida.");
  if (address.postalCode.length < 4 || address.postalCode.length > 20) throw httpError(400, "El código postal no es válido.");
  return address;
}

function paginationFromUrl(url, defaultPageSize = 10) {
  const requestedPage = Number(url.searchParams.get("page") ?? 1);
  const requestedPageSize = Number(url.searchParams.get("pageSize") ?? defaultPageSize);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(50, Math.max(5, requestedPageSize)) : defaultPageSize;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function searchParam(url, name, maxLength = 120) {
  return String(url.searchParams.get(name) ?? "").trim().slice(0, maxLength);
}

function paginatedPayload(items, total, page, pageSize) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total: Number(total),
      pages: Math.max(1, Math.ceil(Number(total) / pageSize)),
    },
  };
}

function normalizeAddress(row) {
  return {
    id: Number(row.id),
    label: row.label,
    recipientName: row.recipient_name,
    addressLine: row.address_line,
    city: row.city,
    postalCode: row.postal_code,
    isDefault: Boolean(row.is_default),
  };
}

function assertAllowedOrigin(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method ?? "GET")) return;
  const origin = request.headers.origin;
  if (origin && origin !== allowedOrigin) throw httpError(403, "Origen de la solicitud no permitido.");
}

function loginAttemptKey(request, email) {
  return `${request.socket.remoteAddress ?? "local"}:${email}`;
}

function assertLoginAllowed(key) {
  const attempt = loginAttempts.get(key);
  if (!attempt) return;
  if (attempt.resetAt <= Date.now()) {
    loginAttempts.delete(key);
    return;
  }
  if (attempt.count >= 5) throw httpError(429, "Demasiados intentos. Espera 15 minutos antes de volver a probar.");
}

function recordLoginFailure(key) {
  const current = loginAttempts.get(key);
  loginAttempts.set(key, {
    count: (current?.count ?? 0) + 1,
    resetAt: current?.resetAt ?? Date.now() + 15 * 60 * 1000,
  });
}

async function createSessionForUser(userId) {
  const { token, tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + sessionDurationSeconds * 1000);
  await pool.execute("DELETE FROM sessions WHERE expires_at <= NOW()");
  await pool.execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [tokenHash, userId, expiresAt],
  );
  return token;
}

async function getSessionUser(request) {
  const token = readCookie(request, "lumina_session");
  if (!token) return null;
  const [rows] = await pool.execute(`
    SELECT u.id, u.email, u.name, u.phone, u.marketing_opt_in, u.role
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.active = 1
    LIMIT 1
  `, [hashSessionToken(token)]);
  return rows[0] ? normalizeUser(rows[0]) : null;
}

async function getProfileForUser(userId) {
  const [rows] = await pool.execute(`
    SELECT id, email, name, phone, marketing_opt_in, role, active, created_at, last_login_at
    FROM users
    WHERE id = ? AND active = 1
    LIMIT 1
  `, [userId]);
  const row = rows[0];
  if (!row) throw httpError(404, "Perfil no encontrado.");
  return {
    ...normalizeUser(row),
    active: Boolean(row.active),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

async function requireUser(request, role) {
  const user = await getSessionUser(request);
  if (!user) throw httpError(401, "Inicia sesión para continuar.");
  if (role && user.role !== role) throw httpError(403, "No tienes permisos para realizar esta operación.");
  return user;
}

async function ensureAdminUser() {
  if (!adminPassword) {
    console.warn("ADMIN_PASSWORD no está configurada; no se creará la cuenta administrativa inicial.");
    return;
  }
  validateEmail(adminEmail);
  validatePassword(adminPassword);

  const [rows] = await pool.execute("SELECT id, role FROM users WHERE email = ? LIMIT 1", [adminEmail]);
  if (rows[0]) {
    if (rows[0].role !== "admin") await pool.execute("UPDATE users SET role = 'admin' WHERE id = ?", [rows[0].id]);
    return;
  }

  await pool.execute(`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (?, 'Lúmina Estudio', ?, 'admin')
  `, [adminEmail, await hashPassword(adminPassword)]);
  console.log(`Cuenta administrativa preparada para ${adminEmail}`);
}

async function getProductById(id) {
  const [rows] = await pool.execute(`
    SELECT id, name, slug, category, description, price, stock,
      image_url AS image, featured, active
    FROM products WHERE id = ? LIMIT 1
  `, [id]);
  return rows[0] ? normalizeProduct(rows[0]) : null;
}

async function createOrder(payload, sessionUser = null) {
  const customer = payload.customer ?? {};
  const name = validateName(customer.name);
  const email = sessionUser?.email ?? validateEmail(customer.email);
  const phone = validatePhone(customer.phone ?? sessionUser?.phone ?? "");
  const address = String(customer.address ?? "").trim();
  const city = String(customer.city ?? "").trim();
  const postalCode = String(customer.postalCode ?? "").trim();

  if (address.length < 5 || city.length < 2 || postalCode.length < 4) throw httpError(400, "Completa la dirección de entrega.");
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw httpError(400, "La cesta está vacía.");

  const combined = new Map();
  for (const item of payload.items) {
    const id = Number(item.id);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw httpError(400, "La cesta contiene una cantidad no válida.");
    }
    combined.set(id, (combined.get(id) ?? 0) + quantity);
  }
  if ([...combined.values()].some((quantity) => quantity > 20)) {
    throw httpError(400, "No se pueden pedir más de 20 unidades de una misma pieza.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const ids = [...combined.keys()];
    const placeholders = ids.map(() => "?").join(",");
    const [productRows] = await connection.execute(`
      SELECT id, name, price, stock, active
      FROM products
      WHERE id IN (${placeholders})
      FOR UPDATE
    `, ids);

    if (productRows.length !== ids.length) throw httpError(409, "Uno de los productos ya no existe.");
    const byId = new Map(productRows.map((product) => [Number(product.id), product]));
    const resolved = ids.map((id) => ({ product: byId.get(id), quantity: combined.get(id) }));

    for (const { product, quantity } of resolved) {
      if (!product.active) throw httpError(409, `${product.name} ya no está disponible.`);
      if (Number(product.stock) < quantity) throw httpError(409, `Solo quedan ${product.stock} unidades de ${product.name}.`);
    }

    const subtotal = resolved.reduce((sum, { product, quantity }) => sum + Number(product.price) * quantity, 0);
    const shipping = subtotal >= 80 ? 0 : 6.9;
    const total = subtotal + shipping;
    const shippingAddress = JSON.stringify({ address, city, postalCode });

    const [orderResult] = await connection.execute(`
      INSERT INTO orders (user_id, customer_email, customer_name, customer_phone, shipping_address, status, subtotal, shipping, total)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `, [sessionUser?.id ?? null, email, name, phone || null, shippingAddress, subtotal, shipping, total]);

    const orderId = Number(orderResult.insertId);
    const valueGroups = resolved.map(() => "(?, ?, ?, ?, ?)").join(",");
    const values = resolved.flatMap(({ product, quantity }) => [orderId, product.id, product.name, product.price, quantity]);
    await connection.execute(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
      VALUES ${valueGroups}
    `, values);

    for (const { product, quantity } of resolved) {
      await connection.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, product.id]);
    }

    await connection.commit();
    return { id: orderId, status: "pending", total, linkedToAccount: Boolean(sessionUser) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getOrdersForUser(userId) {
  const [orders] = await pool.execute(`
    SELECT id, customer_name, customer_email, customer_phone, shipping_address, status,
      subtotal, shipping, total, tracking_number, tracking_url,
      paid_at, shipped_at, cancelled_at, created_at, updated_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
  `, [userId]);

  if (!orders.length) return [];
  const placeholders = orders.map(() => "?").join(",");
  const [items] = await pool.execute(`
    SELECT order_id, product_id, product_name, unit_price, quantity
    FROM order_items
    WHERE order_id IN (${placeholders})
    ORDER BY id ASC
  `, orders.map((order) => order.id));
  const itemsByOrder = new Map();
  for (const item of items) {
    const orderId = Number(item.order_id);
    const current = itemsByOrder.get(orderId) ?? [];
    current.push({
      productId: Number(item.product_id),
      productName: item.product_name,
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
    });
    itemsByOrder.set(orderId, current);
  }

  return orders.map((order) => {
    let shippingAddress = {};
    try {
      shippingAddress = JSON.parse(order.shipping_address);
    } catch {
      shippingAddress = { address: order.shipping_address };
    }
    return {
      id: Number(order.id),
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      shippingAddress,
      status: order.status,
      subtotal: Number(order.subtotal),
      shipping: Number(order.shipping),
      total: Number(order.total),
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url,
      paidAt: order.paid_at,
      shippedAt: order.shipped_at,
      cancelledAt: order.cancelled_at,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: itemsByOrder.get(Number(order.id)) ?? [],
    };
  });
}

async function getOrderDetails(orderId, userId = null) {
  const ownershipClause = userId ? "AND o.user_id = ?" : "";
  const values = userId ? [orderId, userId] : [orderId];
  const [orders] = await pool.execute(`
    SELECT o.id, o.user_id, o.customer_name, o.customer_email, o.customer_phone, o.shipping_address,
      o.status, o.subtotal, o.shipping, o.total, o.tracking_number, o.tracking_url,
      o.paid_at, o.shipped_at, o.cancelled_at, o.created_at, o.updated_at
    FROM orders o
    WHERE o.id = ? ${ownershipClause}
    LIMIT 1
  `, values);
  const order = orders[0];
  if (!order) throw httpError(404, "Pedido no encontrado.");

  const [items] = await pool.execute(`
    SELECT oi.product_id, oi.product_name, oi.unit_price, oi.quantity,
      p.slug AS product_slug, p.image_url AS product_image
    FROM order_items oi
    INNER JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
    ORDER BY oi.id ASC
  `, [orderId]);

  let shippingAddress = {};
  try {
    shippingAddress = JSON.parse(order.shipping_address);
  } catch {
    shippingAddress = { address: order.shipping_address };
  }

  return {
    id: Number(order.id),
    userId: order.user_id ? Number(order.user_id) : null,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    shippingAddress,
    status: order.status,
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping),
    total: Number(order.total),
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    paidAt: order.paid_at,
    shippedAt: order.shipped_at,
    cancelledAt: order.cancelled_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((item) => ({
      productId: Number(item.product_id),
      productName: item.product_name,
      productSlug: item.product_slug,
      productImage: item.product_image,
      unitPrice: Number(item.unit_price),
      quantity: Number(item.quantity),
    })),
  };
}

async function getAddressesForUser(userId) {
  const [rows] = await pool.execute(`
    SELECT id, label, recipient_name, address_line, city, postal_code, is_default
    FROM addresses
    WHERE user_id = ?
    ORDER BY is_default DESC, updated_at DESC
  `, [userId]);
  return rows.map(normalizeAddress);
}

async function setOrderStatus(orderId, nextStatus, options = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute(`
      SELECT id, user_id, status
      FROM orders
      WHERE id = ?
      FOR UPDATE
    `, [orderId]);
    const order = orders[0];
    if (!order) throw httpError(404, "Pedido no encontrado.");
    if (options.userId && Number(order.user_id) !== Number(options.userId)) throw httpError(404, "Pedido no encontrado.");
    if (options.onlyPending && order.status !== "pending") throw httpError(409, "Solo puedes cancelar pedidos que todavía estén pendientes.");

    if (order.status !== nextStatus && (order.status === "cancelled" || nextStatus === "cancelled")) {
      const [items] = await connection.execute(`
        SELECT oi.product_id, oi.product_name, oi.quantity, p.stock, p.active
        FROM order_items oi
        INNER JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        FOR UPDATE
      `, [orderId]);

      if (nextStatus === "cancelled") {
        for (const item of items) {
          await connection.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [item.quantity, item.product_id]);
        }
      } else {
        for (const item of items) {
          if (!item.active || Number(item.stock) < Number(item.quantity)) {
            throw httpError(409, `No hay stock suficiente para reabrir el pedido: ${item.product_name}.`);
          }
          await connection.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, item.product_id]);
        }
      }
    }

    if (nextStatus === "pending") {
      await connection.execute(`
        UPDATE orders SET status = 'pending', paid_at = NULL, shipped_at = NULL, cancelled_at = NULL
        WHERE id = ?
      `, [orderId]);
    } else if (nextStatus === "paid") {
      await connection.execute(`
        UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
          shipped_at = NULL, cancelled_at = NULL
        WHERE id = ?
      `, [orderId]);
    } else if (nextStatus === "shipped") {
      await connection.execute(`
        UPDATE orders SET status = 'shipped', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
          shipped_at = COALESCE(shipped_at, CURRENT_TIMESTAMP), cancelled_at = NULL,
          tracking_number = COALESCE(tracking_number, ?)
        WHERE id = ?
      `, [`LUM-${String(orderId).padStart(6, "0")}`, orderId]);
    } else {
      await connection.execute(`
        UPDATE orders SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP)
        WHERE id = ?
      `, [orderId]);
    }
    await connection.commit();
    return { id: orderId, status: nextStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveAddress(userId, input, addressId = null) {
  const address = validateAddress(input);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [countRows] = await connection.execute("SELECT COUNT(*) AS total FROM addresses WHERE user_id = ? FOR UPDATE", [userId]);
    const shouldBeDefault = address.isDefault || Number(countRows[0].total) === 0;
    if (shouldBeDefault) await connection.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [userId]);

    let id = addressId;
    if (addressId) {
      const [result] = await connection.execute(`
        UPDATE addresses
        SET label = ?, recipient_name = ?, address_line = ?, city = ?, postal_code = ?, is_default = ?
        WHERE id = ? AND user_id = ?
      `, [address.label, address.recipientName, address.addressLine, address.city, address.postalCode, shouldBeDefault, addressId, userId]);
      if (!result.affectedRows) throw httpError(404, "Dirección no encontrada.");
    } else {
      const [result] = await connection.execute(`
        INSERT INTO addresses (user_id, label, recipient_name, address_line, city, postal_code, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [userId, address.label, address.recipientName, address.addressLine, address.city, address.postalCode, shouldBeDefault]);
      id = Number(result.insertId);
    }

    const [rows] = await connection.execute(`
      SELECT id, label, recipient_name, address_line, city, postal_code, is_default
      FROM addresses WHERE id = ? AND user_id = ? LIMIT 1
    `, [id, userId]);
    await connection.commit();
    return normalizeAddress(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  try {
    assertAllowedOrigin(request);

    if (request.method === "GET" && url.pathname === "/api/health") {
      await pool.query("SELECT 1");
      sendJson(response, 200, { database: "connected", service: "lumina-api" });
      return;
    }

    const uploadedImageMatch = url.pathname.match(/^\/api\/uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/);
    if (request.method === "GET" && uploadedImageMatch) {
      const filename = uploadedImageMatch[1];
      const imageType = imageTypeFromFilename(filename);
      const filePath = path.join(uploadDirectory, filename);
      let image;
      try {
        image = await readFile(filePath);
      } catch (error) {
        if (error.code === "ENOENT") throw httpError(404, "Imagen no encontrada.");
        throw error;
      }
      response.writeHead(200, {
        ...corsHeaders(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": image.length,
        "Content-Type": imageType.mime,
        "X-Content-Type-Options": "nosniff",
      });
      response.end(image);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register") {
      const input = await readJson(request);
      const name = validateName(input.name);
      const email = validateEmail(input.email);
      const password = validatePassword(input.password);
      const [existing] = await pool.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
      if (existing[0]) throw httpError(409, "Ya existe una cuenta con este correo.");

      const [result] = await pool.execute(`
        INSERT INTO users (email, name, password_hash, role)
        VALUES (?, ?, ?, 'customer')
      `, [email, name, await hashPassword(password)]);
      const user = { id: Number(result.insertId), email, name, role: "customer" };
      const token = await createSessionForUser(user.id);
      sendJson(response, 201, { user }, {
        "Set-Cookie": sessionCookie(token, sessionDurationSeconds, secureCookies),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const input = await readJson(request);
      const email = validateEmail(input.email);
      const password = String(input.password ?? "");
      const attemptKey = loginAttemptKey(request, email);
      assertLoginAllowed(attemptKey);

      const [rows] = await pool.execute(`
        SELECT id, email, name, phone, marketing_opt_in, role, password_hash
        FROM users
        WHERE email = ? AND active = 1
        LIMIT 1
      `, [email]);
      const row = rows[0];
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        recordLoginFailure(attemptKey);
        throw httpError(401, "Correo o contraseña incorrectos.");
      }

      loginAttempts.delete(attemptKey);
      await pool.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);
      const user = normalizeUser(row);
      const token = await createSessionForUser(user.id);
      sendJson(response, 200, { user }, {
        "Set-Cookie": sessionCookie(token, sessionDurationSeconds, secureCookies),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      const token = readCookie(request, "lumina_session");
      if (token) await pool.execute("DELETE FROM sessions WHERE token_hash = ?", [hashSessionToken(token)]);
      sendJson(response, 200, { success: true }, { "Set-Cookie": clearSessionCookie(secureCookies) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/me") {
      sendJson(response, 200, { user: await getSessionUser(request) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/account/profile") {
      const user = await requireUser(request);
      sendJson(response, 200, await getProfileForUser(user.id));
      return;
    }

    if (request.method === "PATCH" && url.pathname === "/api/account/profile") {
      const user = await requireUser(request);
      const input = await readJson(request);
      const name = validateName(input.name);
      const phone = validatePhone(input.phone);
      const marketingOptIn = Boolean(input.marketingOptIn);
      await pool.execute(`
        UPDATE users SET name = ?, phone = ?, marketing_opt_in = ?
        WHERE id = ? AND active = 1
      `, [name, phone || null, marketingOptIn, user.id]);
      sendJson(response, 200, await getProfileForUser(user.id));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/account/orders") {
      const user = await requireUser(request);
      sendJson(response, 200, await getOrdersForUser(user.id));
      return;
    }

    const accountOrderDetailMatch = url.pathname.match(/^\/api\/account\/orders\/(\d+)$/);
    if (request.method === "GET" && accountOrderDetailMatch) {
      const user = await requireUser(request);
      sendJson(response, 200, await getOrderDetails(Number(accountOrderDetailMatch[1]), user.id));
      return;
    }

    const accountOrderMatch = url.pathname.match(/^\/api\/account\/orders\/(\d+)\/cancel$/);
    if (request.method === "PATCH" && accountOrderMatch) {
      const user = await requireUser(request);
      const result = await setOrderStatus(Number(accountOrderMatch[1]), "cancelled", { userId: user.id, onlyPending: true });
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/account/addresses") {
      const user = await requireUser(request);
      sendJson(response, 200, await getAddressesForUser(user.id));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/account/addresses") {
      const user = await requireUser(request);
      sendJson(response, 201, await saveAddress(user.id, await readJson(request)));
      return;
    }

    const accountAddressMatch = url.pathname.match(/^\/api\/account\/addresses\/(\d+)$/);
    if (request.method === "PATCH" && accountAddressMatch) {
      const user = await requireUser(request);
      sendJson(response, 200, await saveAddress(user.id, await readJson(request), Number(accountAddressMatch[1])));
      return;
    }

    if (request.method === "DELETE" && accountAddressMatch) {
      const user = await requireUser(request);
      const addressId = Number(accountAddressMatch[1]);
      const [rows] = await pool.execute("SELECT is_default FROM addresses WHERE id = ? AND user_id = ? LIMIT 1", [addressId, user.id]);
      if (!rows[0]) throw httpError(404, "Dirección no encontrada.");
      await pool.execute("DELETE FROM addresses WHERE id = ? AND user_id = ?", [addressId, user.id]);
      if (rows[0].is_default) {
        await pool.execute("UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1", [user.id]);
      }
      sendJson(response, 200, { success: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/account/favorites") {
      const user = await requireUser(request);
      const [rows] = await pool.execute(`
        SELECT p.id, p.name, p.slug, p.category, p.description, p.price, p.stock,
          p.image_url AS image, p.featured, p.active
        FROM favorites f
        INNER JOIN products p ON p.id = f.product_id
        WHERE f.user_id = ? AND p.active = 1
        ORDER BY f.created_at DESC
      `, [user.id]);
      sendJson(response, 200, rows.map(normalizeProduct));
      return;
    }

    const accountFavoriteMatch = url.pathname.match(/^\/api\/account\/favorites\/(\d+)$/);
    if (request.method === "POST" && accountFavoriteMatch) {
      const user = await requireUser(request);
      const product = await getProductById(Number(accountFavoriteMatch[1]));
      if (!product || !product.active) throw httpError(404, "Producto no encontrado.");
      await pool.execute(`
        INSERT INTO favorites (user_id, product_id) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE created_at = created_at
      `, [user.id, product.id]);
      sendJson(response, 201, { success: true });
      return;
    }

    if (request.method === "DELETE" && accountFavoriteMatch) {
      const user = await requireUser(request);
      await pool.execute("DELETE FROM favorites WHERE user_id = ? AND product_id = ?", [user.id, Number(accountFavoriteMatch[1])]);
      sendJson(response, 200, { success: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/account/password") {
      const user = await requireUser(request);
      const input = await readJson(request);
      const currentPassword = String(input.currentPassword ?? "");
      const newPassword = validatePassword(input.newPassword);
      const [rows] = await pool.execute("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [user.id]);
      if (!rows[0] || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
        throw httpError(401, "La contraseña actual no es correcta.");
      }
      await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(newPassword), user.id]);
      await pool.execute("DELETE FROM sessions WHERE user_id = ?", [user.id]);
      const token = await createSessionForUser(user.id);
      sendJson(response, 200, { success: true }, {
        "Set-Cookie": sessionCookie(token, sessionDurationSeconds, secureCookies),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/products") {
      const [rows] = await pool.execute(`
        SELECT id, name, slug, category, description, price, stock,
          image_url AS image, featured, active
        FROM products
        WHERE active = 1
        ORDER BY featured DESC, id ASC
      `);
      sendJson(response, 200, rows.map(normalizeProduct));
      return;
    }

    const publicProductMatch = url.pathname.match(/^\/api\/products\/([a-z0-9-]+)$/);
    if (request.method === "GET" && publicProductMatch) {
      const [rows] = await pool.execute(`
        SELECT id, name, slug, category, description, price, stock,
          image_url AS image, featured, active
        FROM products
        WHERE slug = ? AND active = 1
        LIMIT 1
      `, [publicProductMatch[1]]);
      if (!rows[0]) throw httpError(404, "Producto no encontrado.");
      sendJson(response, 200, normalizeProduct(rows[0]));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/orders") {
      const result = await createOrder(await readJson(request), await getSessionUser(request));
      sendJson(response, 201, result);
      return;
    }

    if (url.pathname.startsWith("/api/admin/")) await requireUser(request, "admin");

    if (request.method === "POST" && url.pathname === "/api/admin/uploads") {
      const declaredType = String(request.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
      const image = await readBinary(request, MAX_IMAGE_BYTES);
      const detectedType = detectImageType(image);
      if (!detectedType || detectedType.mime !== declaredType) {
        throw httpError(415, "Solo se admiten imágenes JPEG, PNG o WebP válidas.");
      }
      await mkdir(uploadDirectory, { recursive: true });
      const filename = `${randomUUID()}.${detectedType.extension}`;
      await writeFile(path.join(uploadDirectory, filename), image, { flag: "wx" });
      const origin = `http://${request.headers.host ?? `127.0.0.1:${port}`}`;
      sendJson(response, 201, { url: `${origin}/api/uploads/${filename}` });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/products") {
      const { page, pageSize, offset } = paginationFromUrl(url, 8);
      const search = searchParam(url, "search");
      const category = searchParam(url, "category", 60);
      const state = searchParam(url, "state", 20);
      const stock = searchParam(url, "stock", 20);
      const clauses = [];
      const values = [];
      if (search) {
        clauses.push("(name LIKE ? OR slug LIKE ? OR description LIKE ?)");
        const term = `%${search}%`;
        values.push(term, term, term);
      }
      if (category) {
        clauses.push("category = ?");
        values.push(category);
      }
      if (state === "active") clauses.push("active = 1");
      if (state === "archived") clauses.push("active = 0");
      if (stock === "out") clauses.push("stock = 0");
      if (stock === "low") clauses.push("stock BETWEEN 1 AND 5");
      if (stock === "healthy") clauses.push("stock > 5");
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM products ${where}`, values);
      const [rows] = await pool.execute(`
        SELECT id, name, slug, category, description, price, stock,
          image_url AS image, featured, active
        FROM products
        ${where}
        ORDER BY active DESC, updated_at DESC, id DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `, values);
      sendJson(response, 200, paginatedPayload(rows.map(normalizeProduct), countRows[0].total, page, pageSize));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/products") {
      const product = validateProduct(await readJson(request));
      const [result] = await pool.execute(`
        INSERT INTO products (name, slug, category, description, price, stock, image_url, featured, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [product.name, product.slug, product.category, product.description, product.price, product.stock, product.image, product.featured]);
      sendJson(response, 201, await getProductById(result.insertId));
      return;
    }

    const adminProductMatch = url.pathname.match(/^\/api\/admin\/products\/(\d+)$/);
    if (request.method === "PATCH" && adminProductMatch) {
      const product = validateProduct(await readJson(request));
      const id = Number(adminProductMatch[1]);
      const [result] = await pool.execute(`
        UPDATE products
        SET name = ?, slug = ?, category = ?, description = ?, price = ?, stock = ?, image_url = ?, featured = ?
        WHERE id = ?
      `, [product.name, product.slug, product.category, product.description, product.price, product.stock, product.image, product.featured, id]);
      if (!result.affectedRows) throw httpError(404, "Producto no encontrado.");
      sendJson(response, 200, await getProductById(id));
      return;
    }

    if (request.method === "DELETE" && adminProductMatch) {
      const [result] = await pool.execute("UPDATE products SET active = 0 WHERE id = ?", [Number(adminProductMatch[1])]);
      if (!result.affectedRows) throw httpError(404, "Producto no encontrado.");
      sendJson(response, 200, { success: true });
      return;
    }

    const adminProductRestoreMatch = url.pathname.match(/^\/api\/admin\/products\/(\d+)\/restore$/);
    if (request.method === "PATCH" && adminProductRestoreMatch) {
      const [result] = await pool.execute("UPDATE products SET active = 1 WHERE id = ?", [Number(adminProductRestoreMatch[1])]);
      if (!result.affectedRows) throw httpError(404, "Producto no encontrado.");
      sendJson(response, 200, await getProductById(Number(adminProductRestoreMatch[1])));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/analytics") {
      const [[orderRows], [productRows], [customerRows], [topProducts]] = await Promise.all([
        pool.execute(`
          SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS revenue,
            COALESCE(AVG(total), 0) AS average_order,
            SUM(status = 'pending') AS pending_orders
          FROM orders WHERE status <> 'cancelled'
        `),
        pool.execute(`
          SELECT SUM(active = 1) AS active_products,
            SUM(active = 1 AND stock BETWEEN 1 AND 5) AS low_stock,
            SUM(active = 1 AND stock = 0) AS out_of_stock
          FROM products
        `),
        pool.execute("SELECT COUNT(*) AS customers FROM users WHERE role = 'customer' AND active = 1"),
        pool.execute(`
          SELECT oi.product_id, oi.product_name,
            SUM(oi.quantity) AS units,
            SUM(oi.unit_price * oi.quantity) AS revenue
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE o.status <> 'cancelled'
          GROUP BY oi.product_id, oi.product_name
          ORDER BY units DESC, revenue DESC
          LIMIT 5
        `),
      ]);
      sendJson(response, 200, {
        activeProducts: Number(productRows[0].active_products ?? 0),
        lowStock: Number(productRows[0].low_stock ?? 0),
        outOfStock: Number(productRows[0].out_of_stock ?? 0),
        pendingOrders: Number(orderRows[0].pending_orders ?? 0),
        customers: Number(customerRows[0].customers ?? 0),
        orderCount: Number(orderRows[0].order_count ?? 0),
        revenue: Number(orderRows[0].revenue ?? 0),
        averageOrder: Number(orderRows[0].average_order ?? 0),
        topProducts: topProducts.map((row) => ({
          productId: Number(row.product_id),
          productName: row.product_name,
          units: Number(row.units),
          revenue: Number(row.revenue),
        })),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/orders") {
      const { page, pageSize, offset } = paginationFromUrl(url, 8);
      const search = searchParam(url, "search");
      const status = searchParam(url, "status", 20);
      const dateFrom = searchParam(url, "dateFrom", 10);
      const dateTo = searchParam(url, "dateTo", 10);
      const clauses = [];
      const values = [];
      if (search) {
        clauses.push("(o.customer_name LIKE ? OR o.customer_email LIKE ? OR CAST(o.id AS CHAR) = ?)");
        const term = `%${search}%`;
        values.push(term, term, search.replace(/^#/, ""));
      }
      if (["pending", "paid", "shipped", "cancelled"].includes(status)) {
        clauses.push("o.status = ?");
        values.push(status);
      }
      if (dateFrom) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) throw httpError(400, "La fecha inicial no es válida.");
        clauses.push("o.created_at >= ?");
        values.push(dateFrom);
      }
      if (dateTo) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) throw httpError(400, "La fecha final no es válida.");
        clauses.push("o.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
        values.push(dateTo);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM orders o ${where}`, values);
      const [rows] = await pool.execute(`
        SELECT o.id, o.user_id, o.customer_name, o.customer_email, o.status, o.total, o.created_at,
          COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS item_count
        FROM orders o
        ${where}
        ORDER BY o.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `, values);
      const items = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        user_id: row.user_id ? Number(row.user_id) : null,
        total: Number(row.total),
        item_count: Number(row.item_count),
      }));
      sendJson(response, 200, paginatedPayload(items, countRows[0].total, page, pageSize));
      return;
    }

    const adminOrderMatch = url.pathname.match(/^\/api\/admin\/orders\/(\d+)$/);
    if (request.method === "GET" && adminOrderMatch) {
      sendJson(response, 200, await getOrderDetails(Number(adminOrderMatch[1])));
      return;
    }

    if (request.method === "PATCH" && adminOrderMatch) {
      const { status } = await readJson(request);
      if (!["pending", "paid", "shipped", "cancelled"].includes(status)) throw httpError(400, "Estado de pedido no válido.");
      sendJson(response, 200, await setOrderStatus(Number(adminOrderMatch[1]), status));
      return;
    }

    const adminTrackingMatch = url.pathname.match(/^\/api\/admin\/orders\/(\d+)\/tracking$/);
    if (request.method === "PATCH" && adminTrackingMatch) {
      const input = await readJson(request);
      const trackingNumber = String(input.trackingNumber ?? "").trim();
      const trackingUrl = String(input.trackingUrl ?? "").trim();
      if (trackingNumber.length > 80 || (trackingNumber && !/^[\p{L}\p{N} ._-]+$/u.test(trackingNumber))) {
        throw httpError(400, "El número de seguimiento no es válido.");
      }
      if (trackingUrl && (!/^https?:\/\//i.test(trackingUrl) || trackingUrl.length > 600)) {
        throw httpError(400, "La URL de seguimiento no es válida.");
      }
      const orderId = Number(adminTrackingMatch[1]);
      const [result] = await pool.execute(`
        UPDATE orders SET tracking_number = ?, tracking_url = ? WHERE id = ?
      `, [trackingNumber || null, trackingUrl || null, orderId]);
      if (!result.affectedRows) throw httpError(404, "Pedido no encontrado.");
      sendJson(response, 200, await getOrderDetails(orderId));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/customers") {
      const { page, pageSize, offset } = paginationFromUrl(url, 8);
      const search = searchParam(url, "search");
      const state = searchParam(url, "state", 20);
      const clauses = ["u.role = 'customer'"];
      const values = [];
      if (search) {
        clauses.push("(u.name LIKE ? OR u.email LIKE ?)");
        const term = `%${search}%`;
        values.push(term, term);
      }
      if (state === "active") clauses.push("u.active = 1");
      if (state === "blocked") clauses.push("u.active = 0");
      const where = `WHERE ${clauses.join(" AND ")}`;
      const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM users u ${where}`, values);
      const [rows] = await pool.execute(`
        SELECT u.id, u.name, u.email, u.active, u.created_at, u.last_login_at,
          COUNT(o.id) AS order_count,
          COALESCE(SUM(CASE WHEN o.status <> 'cancelled' THEN o.total ELSE 0 END), 0) AS lifetime_value
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        ${where}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `, values);
      const items = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        active: Boolean(row.active),
        order_count: Number(row.order_count),
        lifetime_value: Number(row.lifetime_value),
      }));
      sendJson(response, 200, paginatedPayload(items, countRows[0].total, page, pageSize));
      return;
    }

    const adminCustomerMatch = url.pathname.match(/^\/api\/admin\/customers\/(\d+)$/);
    if (request.method === "GET" && adminCustomerMatch) {
      const customerId = Number(adminCustomerMatch[1]);
      const { page, pageSize, offset } = paginationFromUrl(url, 8);
      const search = searchParam(url, "search");
      const status = searchParam(url, "status", 20);
      const dateFrom = searchParam(url, "dateFrom", 10);
      const dateTo = searchParam(url, "dateTo", 10);
      const [customerRows] = await pool.execute(`
        SELECT u.id, u.name, u.email, u.phone, u.marketing_opt_in, u.active,
          u.created_at, u.updated_at, u.last_login_at,
          (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
          (SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE o.user_id = u.id AND o.status <> 'cancelled') AS lifetime_value,
          (SELECT COALESCE(AVG(o.total), 0) FROM orders o WHERE o.user_id = u.id AND o.status <> 'cancelled') AS average_order,
          (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at,
          (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favorite_count,
          (SELECT COUNT(*) FROM addresses a WHERE a.user_id = u.id) AS address_count
        FROM users u
        WHERE u.id = ? AND u.role = 'customer'
        LIMIT 1
      `, [customerId]);
      if (!customerRows[0]) throw httpError(404, "Cliente no encontrado.");

      const clauses = ["o.user_id = ?"];
      const values = [customerId];
      if (search) {
        clauses.push("(CAST(o.id AS CHAR) = ? OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_name LIKE ?))");
        values.push(search.replace(/^#/, ""), `%${search}%`);
      }
      if (["pending", "paid", "shipped", "cancelled"].includes(status)) {
        clauses.push("o.status = ?");
        values.push(status);
      }
      if (dateFrom) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) throw httpError(400, "La fecha inicial no es válida.");
        clauses.push("o.created_at >= ?");
        values.push(dateFrom);
      }
      if (dateTo) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) throw httpError(400, "La fecha final no es válida.");
        clauses.push("o.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
        values.push(dateTo);
      }
      const where = `WHERE ${clauses.join(" AND ")}`;
      const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM orders o ${where}`, values);
      const [orderRows] = await pool.execute(`
        SELECT o.id, o.status, o.total, o.created_at, o.updated_at,
          COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0) AS item_count
        FROM orders o
        ${where}
        ORDER BY o.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `, values);
      const [[addresses], [favorites]] = await Promise.all([
        pool.execute(`
          SELECT id, label, recipient_name, address_line, city, postal_code, is_default
          FROM addresses WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC
        `, [customerId]),
        pool.execute(`
          SELECT p.id, p.name, p.slug, p.image_url AS image
          FROM favorites f INNER JOIN products p ON p.id = f.product_id
          WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT 8
        `, [customerId]),
      ]);
      const row = customerRows[0];
      sendJson(response, 200, {
        customer: {
          id: Number(row.id), name: row.name, email: row.email, phone: row.phone ?? "",
          marketingOptIn: Boolean(row.marketing_opt_in), active: Boolean(row.active),
          createdAt: row.created_at, updatedAt: row.updated_at, lastLoginAt: row.last_login_at,
          orderCount: Number(row.order_count), lifetimeValue: Number(row.lifetime_value),
          averageOrder: Number(row.average_order), lastOrderAt: row.last_order_at,
          favoriteCount: Number(row.favorite_count), addressCount: Number(row.address_count),
        },
        orders: paginatedPayload(orderRows.map((order) => ({
          id: Number(order.id), status: order.status, total: Number(order.total),
          itemCount: Number(order.item_count), createdAt: order.created_at, updatedAt: order.updated_at,
        })), countRows[0].total, page, pageSize),
        addresses: addresses.map(normalizeAddress),
        favorites: favorites.map((product) => ({ ...product, id: Number(product.id) })),
      });
      return;
    }

    const adminCustomerStatusMatch = url.pathname.match(/^\/api\/admin\/customers\/(\d+)\/status$/);
    if (request.method === "PATCH" && adminCustomerStatusMatch) {
      const customerId = Number(adminCustomerStatusMatch[1]);
      const input = await readJson(request);
      if (typeof input.active !== "boolean") throw httpError(400, "El estado del cliente no es válido.");
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
          "UPDATE users SET active = ? WHERE id = ? AND role = 'customer'",
          [input.active, customerId],
        );
        if (!result.affectedRows) throw httpError(404, "Cliente no encontrado.");
        if (!input.active) await connection.execute("DELETE FROM sessions WHERE user_id = ?", [customerId]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      sendJson(response, 200, { id: customerId, active: input.active });
      return;
    }

    throw httpError(404, "Ruta no encontrada.");
  } catch (error) {
    const duplicate = error.code === "ER_DUP_ENTRY";
    const status = error.status ?? (duplicate ? 409 : 503);
    if (status >= 500) console.error("Database request failed:", error.message);
    sendJson(response, status, {
      error: status === 503
        ? "No se pudo completar la operación en MySQL."
        : duplicate
          ? "Ya existe un registro con esos datos."
          : error.message,
    });
  }
});

async function start() {
  await ensureAdminUser();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Lúmina API disponible en http://127.0.0.1:${port}`);
  });
}

async function shutdown() {
  await pool.end();
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error) => {
  console.error("No se pudo iniciar Lúmina API:", error.message);
  process.exitCode = 1;
});
