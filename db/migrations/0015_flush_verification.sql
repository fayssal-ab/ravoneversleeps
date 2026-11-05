-- migrate: tolerate-existing
-- Flush usernames are verified by staff through the player's private Discord ticket.
ALTER TABLE user_accounts
  ADD COLUMN flush_username VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN flush_status ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN flush_ticket VARCHAR(32) NULL,
  ADD COLUMN flush_note VARCHAR(255) NULL,
  ADD INDEX idx_accounts_flush (flush_username);
