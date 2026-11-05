-- <Jun Kai start>
-- 003: drops the two battery columns that 001 gave device_heartbeats. Tablet battery monitoring is a
-- Feedback Screen (Role 1) task, so the health page only keeps which tablets are reporting.
ALTER TABLE device_heartbeats
  DROP COLUMN battery_level,
  DROP COLUMN charging;
-- <Jun Kai end>
