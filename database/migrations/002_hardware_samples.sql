-- Migration 002: hardware_samples
-- Applied once, in order, by: npm run db:migrate
-- Plain MySQL. Add tables/columns here; never edit this file after it has been applied.

-- <Jun Kai start>
-- 002: one row per hardware sample for the admin Hardware page (CPU, memory, disk and GPU use).
-- Written by backend/features/hardware/sampler.js on the interval set in Admin > Hardware; rows older
-- than the retention setting are deleted by the same sampler. sampled_at is UTC (the DB session is UTC).
CREATE TABLE IF NOT EXISTS hardware_samples (
  id INT NOT NULL AUTO_INCREMENT,
  sampled_at DATETIME NOT NULL,
  cpu_percent DECIMAL(5,1) NULL,
  memory_percent DECIMAL(5,1) NULL,
  memory_used_mb INT UNSIGNED NULL,
  memory_total_mb INT UNSIGNED NULL,
  disk_percent DECIMAL(5,1) NULL,
  disk_used_gb DECIMAL(10,1) NULL,
  disk_total_gb DECIMAL(10,1) NULL,
  gpu_percent DECIMAL(5,1) NULL,
  gpu_memory_used_mb INT UNSIGNED NULL,
  gpu_memory_total_mb INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_hardware_samples_sampled_at (sampled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- <Jun Kai end>
