-- Milestones removed from the site: drop their tables (claims first).
-- Irreversible: this deletes every milestone and claim/payout record.
DROP TABLE IF EXISTS milestone_claims;
DROP TABLE IF EXISTS milestones;
