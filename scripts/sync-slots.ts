// Downloads the slot catalogue (names, providers, art) into slot_catalog.
//   npm run sync:slots
// Same work as Admin → Slots → Sync now and the daily /api/cron/slots.
import mysql from "mysql2/promise";
import { normalizeName, parseFeed } from "../lib/slotFeed";

async function main() {
  const url = process.env.SLOTS_FEED_URL || "https://api.sharkz.gg/api/slots";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`feed answered ${res.status}`);
  const rows = parseFeed(await res.json());
  if (rows.length < 500) throw new Error(`only ${rows.length} slots in the feed`);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1", port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root", password: process.env.DB_PASSWORD ?? "", database: process.env.DB_NAME ?? "ravo",
    // managed hosts requiring TLS (Aiven): base64 of the CA PEM
    ssl: process.env.DB_SSL_CA_BASE64 ? { ca: Buffer.from(process.env.DB_SSL_CA_BASE64, "base64").toString("utf8") } : undefined,
  });
  const [col] = await conn.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'slot_catalog' AND COLUMN_NAME = 'stake_only'");
  if (!(col as unknown[]).length) await conn.query("ALTER TABLE slot_catalog ADD COLUMN stake_only TINYINT(1) NOT NULL DEFAULT 0");
  await conn.query("UPDATE slot_catalog SET active = 0");
  // Stake-only slots are hidden everywhere: not stored at all (saves DB space)
  const kept = rows.filter((r) => !r.stakeOnly);
  await conn.query("DELETE FROM slot_catalog WHERE stake_only = 1");
  for (let i = 0; i < kept.length; i += 1000) {
    await conn.query(
      `INSERT INTO slot_catalog (id, slug, name, name_norm, provider, image_url, popularity, stake_only, active, synced_at) VALUES ?
       ON DUPLICATE KEY UPDATE name = VALUES(name), name_norm = VALUES(name_norm), provider = VALUES(provider),
         image_url = VALUES(image_url), popularity = VALUES(popularity), stake_only = VALUES(stake_only), active = 1, synced_at = VALUES(synced_at)`,
      [kept.slice(i, i + 1000).map((r) => [r.id, r.slug, r.name, normalizeName(r.name).slice(0, 191), r.provider, r.imageUrl, r.popularity, r.stakeOnly ? 1 : 0, 1, now])]
    );
  }
  console.log(`slots: ${rows.length} synced, ${rows.filter((r) => r.imageUrl).length} with art`);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
