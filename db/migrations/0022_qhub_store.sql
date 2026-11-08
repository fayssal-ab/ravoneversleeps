-- migrate: tolerate-existing
-- Store is back, paid in QHub Points (earned by watching Ravo on QHub). The
-- points live on QHub, so a redemption doesn't take site points: the viewer
-- sends a screenshot of their QHub Points as proof, that opens a private
-- Discord ticket, and staff mark it paid or rejected in Admin -> Store.
-- The app applies the same changes on first use (lib/store.ts), including
-- the starting items (once, marked in site_settings).
ALTER TABLE store_redemptions ADD COLUMN qhub_username VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE store_redemptions ADD COLUMN ticket VARCHAR(32) NULL;
ALTER TABLE store_items MODIFY COLUMN kind ENUM('cash','bonus','game','merch','other') NOT NULL DEFAULT 'cash';
