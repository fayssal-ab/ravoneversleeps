-- migrate: tolerate-existing
-- Discord ticket channels and when to close them (lib/tickets.ts).
CREATE TABLE IF NOT EXISTS discord_tickets (
  channel_id   VARCHAR(32)  PRIMARY KEY,
  kind         VARCHAR(20)  NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  close_after  DATETIME     NULL,
  INDEX idx_tickets_close (close_after)
) ENGINE=InnoDB;
