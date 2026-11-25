-- Owner: Role 1, Zihan.
-- Restore optional battery telemetry on the existing tablet heartbeat.
ALTER TABLE device_heartbeats
  ADD COLUMN battery_level TINYINT UNSIGNED NULL,
  ADD COLUMN charging TINYINT(1) NULL;
