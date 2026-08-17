USE lumina_store;

UPDATE products SET name = 'Frisbee Guayaba', slug = 'frisbee-guayaba', category = 'Perros', description = 'Disco flexible y ligero para vuelos largos, saltos épicos y aterrizajes suaves.', price = 16.00, stock = 24, image_url = 'https://images.unsplash.com/photo-1604182965221-88b1bc9897ed?auto=format&fit=crop&w=1000&q=85', featured = 1 WHERE id = 1;
UPDATE products SET name = 'Caña Tucán', slug = 'cana-tucan', category = 'Gatos', description = 'Plumas, cintas y movimiento impredecible para despertar al cazador de salón.', price = 14.00, stock = 18, image_url = 'https://images.unsplash.com/photo-1611279976163-acf6a363e73a?auto=format&fit=crop&w=1000&q=85', featured = 1 WHERE id = 2;
UPDATE products SET name = 'Pelota Coco Loco', slug = 'pelota-coco-loco', category = 'Perros', description = 'Rebote irregular, textura resistente y el tamaño perfecto para perseguir sin descanso.', price = 12.00, stock = 30, image_url = 'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=1000&q=85', featured = 1 WHERE id = 3;
UPDATE products SET name = 'Ratón Maracuyá', slug = 'raton-maracuya', category = 'Gatos', description = 'Peluche ligero con cascabel suave para carreras nocturnas y emboscadas felinas.', price = 9.00, stock = 26, image_url = 'https://images.unsplash.com/photo-1708979346051-e809d2059b32?auto=format&fit=crop&w=1000&q=85', featured = 0 WHERE id = 4;
UPDATE products SET name = 'Mordedor Piña Pop', slug = 'mordedor-pina-pop', category = 'Perros', description = 'Relieves que masajean las encías y caucho natural preparado para mandíbulas curiosas.', price = 18.00, stock = 20, image_url = 'https://images.unsplash.com/photo-1560160951-fc67dc9fd4f3?auto=format&fit=crop&w=1000&q=85', featured = 0 WHERE id = 5;
UPDATE products SET name = 'Túnel Monstera', slug = 'tunel-monstera', category = 'Gatos', description = 'Refugio plegable con ventanas para acechar, esconderse y aparecer por sorpresa.', price = 29.00, stock = 12, image_url = 'https://images.unsplash.com/photo-1529778873920-4da4926a72c2?auto=format&fit=crop&w=1000&q=85', featured = 0 WHERE id = 6;

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
