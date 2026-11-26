-- Owner: Role 1, Zihan.
-- Restore optional battery telemetry on the existing tablet heartbeat.
-- <Jun Kai start>
-- Renumbered from 010 on 26 Nov 2026: main's 010 (the Lost & Found contact) was released first and two migrations may
-- not share a number. Each column is added only when it is missing, so a database that already ran the old 010 is not
-- changed twice.
SET @has_battery_level := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_heartbeats' AND COLUMN_NAME = 'battery_level');
SET @add_battery_level := IF(@has_battery_level = 0,
    'ALTER TABLE device_heartbeats ADD COLUMN battery_level TINYINT UNSIGNED NULL',
    'SELECT 1');
PREPARE add_battery_level_statement FROM @add_battery_level;
EXECUTE add_battery_level_statement;
DEALLOCATE PREPARE add_battery_level_statement;

SET @has_charging := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_heartbeats' AND COLUMN_NAME = 'charging');
SET @add_charging := IF(@has_charging = 0,
    'ALTER TABLE device_heartbeats ADD COLUMN charging TINYINT(1) NULL',
    'SELECT 1');
PREPARE add_charging_statement FROM @add_charging;
EXECUTE add_charging_statement;
DEALLOCATE PREPARE add_charging_statement;
-- <Jun Kai end>
