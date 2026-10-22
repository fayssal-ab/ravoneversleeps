-- migrate: tolerate-existing
-- Tournament players' Kick profile picture (from the !join chat message, or
-- fetched from the Kick API). NULL = not looked up yet, '' = Kick has none.
ALTER TABLE ko_participants ADD COLUMN avatar VARCHAR(512) NULL;
