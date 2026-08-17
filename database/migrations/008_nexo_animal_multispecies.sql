USE nexo_animal_store;

UPDATE products SET name = 'Disco de entrenamiento Terra', slug = 'disco-entrenamiento-terra', category = 'Perros', description = 'Disco flexible de alta visibilidad, diseñado para sesiones de juego y entrenamiento al aire libre.', price = 16.90, stock = 24, image_url = 'https://images.unsplash.com/photo-1604182965221-88b1bc9897ed?auto=format&fit=crop&w=1000&q=85', featured = 1 WHERE id = 1;
UPDATE products SET name = 'Varita de juego Nilo', slug = 'varita-juego-nilo', category = 'Gatos', description = 'Varita ligera con movimiento irregular para favorecer la actividad y la estimulación diaria.', price = 14.50, stock = 18, image_url = 'https://images.unsplash.com/photo-1611279976163-acf6a363e73a?auto=format&fit=crop&w=1000&q=85', featured = 1 WHERE id = 2;
UPDATE products SET name = 'Percha natural Olmo', slug = 'percha-natural-olmo', category = 'Aves', description = 'Percha de madera natural con diámetro variable para favorecer el apoyo y el desgaste de las uñas.', price = 22.90, stock = 30, image_url = 'https://images.unsplash.com/photo-1607798136809-1483b83f32fd?auto=format&fit=crop&w=1000&q=85', featured = 1 WHERE id = 3;
UPDATE products SET name = 'Túnel de heno Prado', slug = 'tunel-heno-prado', category = 'Pequeños animales', description = 'Refugio de fibras vegetales para explorar, descansar y roer de forma segura.', price = 13.90, stock = 26, image_url = 'https://images.unsplash.com/photo-1742094611825-4e4d6493fbfd?auto=format&fit=crop&w=1000&q=85', featured = 0 WHERE id = 4;
UPDATE products SET name = 'Filtro compacto Aqua 40', slug = 'filtro-compacto-aqua-40', category = 'Acuario', description = 'Sistema de filtración silencioso para acuarios pequeños, con caudal regulable y mantenimiento sencillo.', price = 39.90, stock = 20, image_url = 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=1000&q=85', featured = 0 WHERE id = 5;
UPDATE products SET name = 'Refugio mineral Duna', slug = 'refugio-mineral-duna', category = 'Terrario', description = 'Escondite estable de acabado mineral para crear una zona de descanso protegida en el terrario.', price = 27.90, stock = 12, image_url = 'https://unsplash.com/photos/9CWKfMwIGfo/download?force=true&w=1000', featured = 0 WHERE id = 6;

UPDATE order_items oi
JOIN products p ON p.id = oi.product_id
SET oi.product_name = p.name,
    oi.unit_price = p.price;

UPDATE orders o
JOIN (
  SELECT order_id, SUM(unit_price * quantity) AS subtotal
  FROM order_items
  GROUP BY order_id
) totals ON totals.order_id = o.id
SET o.subtotal = totals.subtotal,
    o.shipping = IF(totals.subtotal >= 45, 0, 6.90),
    o.total = totals.subtotal + IF(totals.subtotal >= 45, 0, 6.90);
