USE nexo_animal_store;

SET @shipping_address_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name = 'shipping_address'
);

SET @shipping_address_migration = IF(
  @shipping_address_exists = 0,
  'ALTER TABLE orders ADD COLUMN shipping_address VARCHAR(400) NOT NULL DEFAULT ''{}'' AFTER customer_name',
  'SELECT ''shipping_address already exists'''
);

PREPARE shipping_address_statement FROM @shipping_address_migration;
EXECUTE shipping_address_statement;
DEALLOCATE PREPARE shipping_address_statement;
