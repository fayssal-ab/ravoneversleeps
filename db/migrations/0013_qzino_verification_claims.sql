-- migrate: tolerate-existing
-- Qzino usernames are verified by staff through a Discord ticket; challenge
-- claims open a ticket for the proof. Also applied on first use by the app.
ALTER TABLE user_accounts
  ADD COLUMN qzino_status ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN qzino_ticket VARCHAR(32) NULL;
-- usernames saved before verification existed stay usable
UPDATE user_accounts SET qzino_status = 'verified' WHERE qzino_username <> '' AND qzino_status = 'none';
CREATE TABLE IF NOT EXISTS challenge_claims (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  challenge_id  BIGINT       NOT NULL,
  account_id    BIGINT       NOT NULL,
  ticket        VARCHAR(32)  NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_challenge_claim (challenge_id, account_id),
  INDEX idx_claims_challenge (challenge_id)
) ENGINE=InnoDB;
