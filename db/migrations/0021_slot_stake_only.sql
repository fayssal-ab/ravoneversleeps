-- migrate: tolerate-existing
-- Slots the feed marks "only on Stake": kept in the catalogue but hidden
-- everywhere (Ravo plays on Qzino). Also added by the app on first use.
ALTER TABLE slot_catalog ADD COLUMN stake_only TINYINT(1) NOT NULL DEFAULT 0;
