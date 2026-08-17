USE nexo_animal_store;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'phone') = 0,
  'ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL AFTER name',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'marketing_opt_in') = 0,
  'ALTER TABLE users ADD COLUMN marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0 AFTER role',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;

SET @statement = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'customer_phone') = 0,
  'ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(30) NULL AFTER customer_name',
  'SELECT 1'
);
PREPARE migration_statement FROM @statement; EXECUTE migration_statement; DEALLOCATE PREPARE migration_statement;
