-- migrate: tolerate-existing
-- Free DB space (free tier): data of features the site no longer has.
-- Store cards get their big text (card_label, also added by the app).

ALTER TABLE store_items ADD COLUMN card_label VARCHAR(24) NOT NULL DEFAULT '';

-- Stake-only slots: hidden everywhere, the slot sync no longer stores them.
DELETE FROM slot_catalog WHERE stake_only = 1;

-- Raffles (removed from the site) and the old Q-boards leaderboard (now QHub).
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS raffle_winners;
DROP TABLE IF EXISTS raffle_entries;
DROP TABLE IF EXISTS raffles;
DROP TABLE IF EXISTS lb_prizes;
DROP TABLE IF EXISTS lb_entries;
DROP TABLE IF EXISTS lb_periods;
DROP TABLE IF EXISTS qboards_snapshots;
SET FOREIGN_KEY_CHECKS = 1;
DELETE FROM site_settings WHERE k <> 'store_qhub_seeded';

-- Flush (no longer a partner).
ALTER TABLE user_accounts DROP COLUMN flush_username;
ALTER TABLE user_accounts DROP COLUMN flush_status;
ALTER TABLE user_accounts DROP COLUMN flush_ticket;
ALTER TABLE user_accounts DROP COLUMN flush_note;

-- Old store rewards (site-points scale, hidden since the QHub store).
DELETE FROM store_items WHERE active = 0;

-- Logs and dedupe rows nobody reads anymore once old.
DELETE FROM rate_limits WHERE 1 = 1;
