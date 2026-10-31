-- 001: tablet heartbeats for the admin System Health page. One row per device, upserted by
-- POST /api/health/heartbeat from the kiosk page (frontend/feedback/js/heartbeat.js).
CREATE TABLE IF NOT EXISTS device_heartbeats (
  device_id VARCHAR(64) NOT NULL,
  label VARCHAR(80) NULL,
  page VARCHAR(40) NULL,
  battery_level TINYINT UNSIGNED NULL,
  charging TINYINT(1) NULL,
  user_agent VARCHAR(255) NULL,
  ip VARCHAR(64) NULL,
  first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (device_id),
  KEY idx_device_heartbeats_last_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
