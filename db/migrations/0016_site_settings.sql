-- migrate: tolerate-existing
-- Small key/value settings edited in admin (e.g. leaderboard top prizes).
CREATE TABLE IF NOT EXISTS site_settings (
  k           VARCHAR(64)  PRIMARY KEY,
  v           TEXT         NOT NULL,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
