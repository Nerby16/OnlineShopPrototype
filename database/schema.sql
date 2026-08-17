CREATE DATABASE IF NOT EXISTS nexo_animal_store
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nexo_animal_store;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  category VARCHAR(60) NOT NULL,
  description VARCHAR(320) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  image_url VARCHAR(600) NOT NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY products_slug_unique (slug),
  KEY products_category_index (category),
  KEY products_active_featured_index (active, featured)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  KEY users_role_active_index (role, active)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY sessions_user_index (user_id),
  KEY sessions_expiry_index (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS addresses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(60) NOT NULL DEFAULT 'Casa',
  recipient_name VARCHAR(120) NOT NULL,
  address_line VARCHAR(220) NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY addresses_user_default_index (user_id, is_default),
  CONSTRAINT addresses_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  KEY favorites_product_index (product_id),
  CONSTRAINT favorites_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT favorites_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  customer_email VARCHAR(190) NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(30) NULL,
  shipping_address VARCHAR(400) NOT NULL,
  status ENUM('pending', 'paid', 'shipped', 'cancelled') NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10, 2) NOT NULL,
  shipping DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  tracking_number VARCHAR(80) NULL,
  tracking_url VARCHAR(600) NULL,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  shipped_at TIMESTAMP NULL DEFAULT NULL,
  cancelled_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY orders_user_index (user_id),
  KEY orders_email_index (customer_email),
  KEY orders_status_index (status),
  KEY orders_tracking_index (tracking_number),
  CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(120) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY order_items_order_index (order_id),
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id)
);

INSERT INTO products (name, slug, category, description, price, stock, image_url, featured)
VALUES
  ('Disco de entrenamiento Terra', 'disco-entrenamiento-terra', 'Perros', 'Disco flexible de alta visibilidad, diseñado para sesiones de juego y entrenamiento al aire libre.', 16.90, 24, 'https://images.unsplash.com/photo-1604182965221-88b1bc9897ed?auto=format&fit=crop&w=1000&q=85', 1),
  ('Varita de juego Nilo', 'varita-juego-nilo', 'Gatos', 'Varita ligera con movimiento irregular para favorecer la actividad y la estimulación diaria.', 14.50, 18, 'https://images.unsplash.com/photo-1611279976163-acf6a363e73a?auto=format&fit=crop&w=1000&q=85', 1),
  ('Percha natural Olmo', 'percha-natural-olmo', 'Aves', 'Percha de madera natural con diámetro variable para favorecer el apoyo y el desgaste de las uñas.', 22.90, 30, 'https://images.unsplash.com/photo-1607798136809-1483b83f32fd?auto=format&fit=crop&w=1000&q=85', 1),
  ('Túnel de heno Prado', 'tunel-heno-prado', 'Pequeños animales', 'Refugio de fibras vegetales para explorar, descansar y roer de forma segura.', 13.90, 26, 'https://images.unsplash.com/photo-1742094611825-4e4d6493fbfd?auto=format&fit=crop&w=1000&q=85', 0),
  ('Filtro compacto Aqua 40', 'filtro-compacto-aqua-40', 'Acuario', 'Sistema de filtración silencioso para acuarios pequeños, con caudal regulable y mantenimiento sencillo.', 39.90, 20, 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=1000&q=85', 0),
  ('Refugio mineral Duna', 'refugio-mineral-duna', 'Terrario', 'Escondite estable de acabado mineral para crear una zona de descanso protegida en el terrario.', 27.90, 12, 'https://unsplash.com/photos/9CWKfMwIGfo/download?force=true&w=1000', 0)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  category = VALUES(category),
  description = VALUES(description),
  price = VALUES(price),
  stock = VALUES(stock),
  image_url = VALUES(image_url),
  featured = VALUES(featured),
  active = 1;
