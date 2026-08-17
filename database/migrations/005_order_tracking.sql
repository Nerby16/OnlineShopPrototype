USE nexo_animal_store;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_number') = 0,
  'ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(80) NULL AFTER total',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'tracking_url') = 0,
  'ALTER TABLE orders ADD COLUMN tracking_url VARCHAR(600) NULL AFTER tracking_number',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'paid_at') = 0,
  'ALTER TABLE orders ADD COLUMN paid_at TIMESTAMP NULL DEFAULT NULL AFTER tracking_url',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipped_at') = 0,
  'ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP NULL DEFAULT NULL AFTER paid_at',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cancelled_at') = 0,
  'ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMP NULL DEFAULT NULL AFTER shipped_at',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'updated_at') = 0,
  'ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;
