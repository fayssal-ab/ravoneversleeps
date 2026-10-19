-- migrate: tolerate-existing
-- VIP Transfer applications (one open application per account). Proof of the
-- VIP level is shared privately in the Discord ticket, never stored here.
CREATE TABLE IF NOT EXISTS vip_applications (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  account_id      BIGINT        NOT NULL,
  qzino_username  VARCHAR(64)   NOT NULL,
  casino          VARCHAR(80)   NOT NULL,
  vip_level       VARCHAR(80)   NOT NULL,
  monthly_wager   VARCHAR(20)   NOT NULL,
  note            VARCHAR(500)  NOT NULL DEFAULT '',
  status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note      VARCHAR(255)  NOT NULL DEFAULT '',
  ticket          VARCHAR(32)   NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vip_status (status, created_at),
  INDEX idx_vip_account (account_id)
) ENGINE=InnoDB;
