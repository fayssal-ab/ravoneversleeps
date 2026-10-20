// Safe defaults only: the 40-level rank ladder and the starter store items.
// Re-running never overwrites what an admin has edited (INSERT IGNORE / only
// when the store is empty). No fake leaderboard or users.
import mysql from "mysql2/promise";
import { defaultMinXp, defaultRankName, MAX_LEVEL } from "../lib/ranks";

// Store unlocks from rank 31 to 40. Prices 20 → 800 as specified, then the
// doubling continues for the last four ranks (editable in Admin → Store).
const STORE: { min_rank: number; price: number; name: string; kind: "cash" | "bonus" | "merch"; description: string }[] = [
  { min_rank: 1, price: 20, name: "$5 Qzino tip", kind: "cash", description: "A $5 tip sent to your Qzino account (your Qzino username must be set on your account)." },
  { min_rank: 1, price: 50, name: "$10 Qzino tip", kind: "cash", description: "A $10 tip sent to your Qzino account (your Qzino username must be set on your account)." },
  { min_rank: 1, price: 100, name: "$20 Qzino tip", kind: "cash", description: "A $20 tip sent to your Qzino account (your Qzino username must be set on your account)." },
  { min_rank: 1, price: 200, name: "$40 bonus buy split", kind: "bonus", description: "Ravo opens a $40 bonus buy on stream for you and splits the win with you." },
  { min_rank: 1, price: 400, name: "$100 bonus buy split", kind: "bonus", description: "Ravo opens a $100 bonus buy on stream for you and splits the win with you." },
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "ravo",
    // managed hosts requiring TLS (Aiven): base64 of the CA PEM
    ssl: process.env.DB_SSL_CA_BASE64 ? { ca: Buffer.from(process.env.DB_SSL_CA_BASE64, "base64").toString("utf8") } : undefined,
  });

  for (let level = 1; level <= MAX_LEVEL; level++) {
    await conn.query("INSERT IGNORE INTO ranks (level, name, min_xp) VALUES (?, ?, ?)", [level, defaultRankName(level), defaultMinXp(level)]);
  }
  console.log(`ranks: ${MAX_LEVEL} levels ensured`);

  const [[{ n }]] = await conn.query<mysql.RowDataPacket[]>("SELECT COUNT(*) AS n FROM store_items");
  if (Number(n) === 0) {
    for (const [i, it] of STORE.entries()) {
      await conn.query(
        "INSERT INTO store_items (name, description, kind, price, min_rank, sort) VALUES (?, ?, ?, ?, ?, ?)",
        [it.name, it.description, it.kind, it.price, it.min_rank, i]
      );
    }
    console.log(`store: ${STORE.length} items added`);
  } else {
    console.log("store: already has items, left alone");
  }
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
