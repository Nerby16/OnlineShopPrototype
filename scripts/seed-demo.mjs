import mysql from "mysql2/promise";
import { hashPassword } from "../server/auth.mjs";

if (process.env.NODE_ENV === "production") {
  throw new Error("La cuenta de demostración no puede generarse en producción.");
}

const demoEmail = "cliente@lumina.local";
const demoPassword = "lumina-cliente-2026";

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "lumina_store",
  decimalNumbers: true,
});

const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const passwordHash = await hashPassword(demoPassword);
  await connection.execute(`
    INSERT INTO users (email, name, phone, password_hash, role, marketing_opt_in, active)
    VALUES (?, 'Cliente Demo', '+34 600 123 456', ?, 'customer', 1, 1)
    ON DUPLICATE KEY UPDATE name = 'Cliente Demo', phone = '+34 600 123 456', role = 'customer', marketing_opt_in = 1, active = 1
  `, [demoEmail, passwordHash]);
  const [users] = await connection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [demoEmail]);
  const userId = Number(users[0].id);
  await connection.execute(
    "UPDATE orders SET customer_phone = '+34 600 123 456' WHERE user_id = ? AND customer_phone IS NULL",
    [userId],
  );

  const [addresses] = await connection.execute("SELECT id FROM addresses WHERE user_id = ? LIMIT 1", [userId]);
  if (!addresses.length) {
    await connection.execute(`
      INSERT INTO addresses (user_id, label, recipient_name, address_line, city, postal_code, is_default)
      VALUES (?, 'Casa', 'Cliente Demo', 'Calle del Diseño 24, 2º B', 'Madrid', '28004', 1)
    `, [userId]);
  }

  const [products] = await connection.execute(`
    SELECT id, name, price, stock FROM products WHERE active = 1 ORDER BY id LIMIT 4 FOR UPDATE
  `);
  if (products.length < 4) throw new Error("Se necesitan al menos cuatro productos activos para generar la demostración.");
  const [existingOrders] = await connection.execute("SELECT DISTINCT status FROM orders WHERE user_id = ?", [userId]);
  const existingStatuses = new Set(existingOrders.map((order) => order.status));
  const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const demoOrders = [
    { status: "pending", createdAt: daysAgo(1), paidAt: null, shippedAt: null, tracking: null, items: [{ product: products[0], quantity: 1 }] },
    { status: "paid", createdAt: daysAgo(4), paidAt: daysAgo(3), shippedAt: null, tracking: null, items: [{ product: products[1], quantity: 2 }] },
    { status: "shipped", createdAt: daysAgo(12), paidAt: daysAgo(11), shippedAt: daysAgo(9), tracking: "LUM-DEMO-2026", items: [{ product: products[2], quantity: 1 }, { product: products[3], quantity: 1 }] },
  ].filter((order) => !existingStatuses.has(order.status));

  for (const demoOrder of demoOrders) {
      const subtotal = demoOrder.items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
      const shipping = subtotal >= 80 ? 0 : 6.9;
      for (const item of demoOrder.items) {
        if (Number(item.product.stock) < item.quantity) throw new Error(`No hay stock suficiente de ${item.product.name}.`);
      }

      const [result] = await connection.execute(`
        INSERT INTO orders (
          user_id, customer_email, customer_name, customer_phone, shipping_address, status,
          subtotal, shipping, total, tracking_number, paid_at, shipped_at, created_at
        ) VALUES (?, ?, 'Cliente Demo', '+34 600 123 456', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        demoEmail,
        JSON.stringify({ address: "Calle del Diseño 24, 2º B", city: "Madrid", postalCode: "28004" }),
        demoOrder.status,
        subtotal,
        shipping,
        subtotal + shipping,
        demoOrder.tracking,
        demoOrder.paidAt,
        demoOrder.shippedAt,
        demoOrder.createdAt,
      ]);
      const orderId = Number(result.insertId);

      for (const item of demoOrder.items) {
        await connection.execute(`
          INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
          VALUES (?, ?, ?, ?, ?)
        `, [orderId, item.product.id, item.product.name, item.product.price, item.quantity]);
        await connection.execute("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, item.product.id]);
        item.product.stock = Number(item.product.stock) - item.quantity;
      }
  }

  await connection.commit();
  console.log(demoOrders.length
    ? `Cuenta demo completada con ${demoOrders.length} pedidos representativos.`
    : "La cuenta demo ya contiene todos los estados representativos; no se han duplicado.");
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
