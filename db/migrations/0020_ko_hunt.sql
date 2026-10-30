-- migrate: tolerate-existing
-- "The Reaping · Hunt" (lib/hunt): the whole game is one JSON document on its
-- tournament (mode = 'hunt'); before the start it holds the chosen settings.
ALTER TABLE ko_tournaments ADD COLUMN hunt MEDIUMTEXT NULL;
