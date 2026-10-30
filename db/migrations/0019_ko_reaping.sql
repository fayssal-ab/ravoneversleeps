-- migrate: tolerate-existing
-- "The Reaping": knockout mode with computer bosses (lib/reaping.ts). A boss
-- is a ko_participants row with is_boss = 1 and a target multiplier; a match
-- it ambushes carries boss_id. ko_boss_rolls keeps one roll per stage.
ALTER TABLE ko_tournaments
  ADD COLUMN mode VARCHAR(16) NOT NULL DEFAULT 'classic',
  ADD COLUMN boss_chance TINYINT UNSIGNED NOT NULL DEFAULT 40,
  ADD COLUMN final_boss TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN rollover TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE ko_participants
  ADD COLUMN is_boss TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN boss_target DECIMAL(10,2) NULL,
  ADD COLUMN boss_tier VARCHAR(16) NULL,
  ADD COLUMN boss_line VARCHAR(191) NULL,
  ADD COLUMN reaped TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE ko_matches ADD COLUMN boss_id BIGINT NULL;
CREATE TABLE IF NOT EXISTS ko_boss_rolls (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  tournament_id  INT       NOT NULL,
  round          TINYINT   NOT NULL,
  chance         TINYINT UNSIGNED NOT NULL,
  spawned        TINYINT(1) NOT NULL,
  boss_id        BIGINT    NULL,
  match_id       BIGINT    NULL,
  spins          INT       NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ko_boss_round (tournament_id, round),
  CONSTRAINT fk_ko_boss_t FOREIGN KEY (tournament_id) REFERENCES ko_tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB;
