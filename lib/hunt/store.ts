import "server-only";
import { randomInt } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../db";
import { closeRegistration, ensureKoSchema, getKoById, makeTeams, type HuntSetup } from "../knockout";
import { AppError, withTx } from "../tx";
import {
  arenaFight, bossFight, callSlot, createHunt, fight, HuntError, monsterDef, rerollMonster, revealFate, spawnAll, spawnNext, summonEndboss, type HuntState, type SlotCall,
} from "./engine";
import { findSlotByName, randomPoolSlot } from "../slots";
import { normalizeName } from "../slotFeed";

// Persistence of "The Reaping · Hunt": the game is one JSON document on its
// tournament row, changed only here, under the row lock, with crypto
// randomness. Players come from the usual `!join` registration.

export type HuntOp =
  | { op: "start" } | { op: "spawn" } | { op: "spawn_all" } | { op: "reroll"; index: number }
  | { op: "fight"; index: number; p: number; b: number } | { op: "arena"; index: number; a: number; b: number }
  | { op: "fate" } | { op: "endboss" } | { op: "boss"; p: number; b: number } | { op: "secret"; on: boolean }
  /** a slot call: from Kick chat (kickUserId) or by the host (eid) */
  | { op: "call"; call: Omit<SlotCall, "by">; kickUserId?: string; eid?: number };

const rand = (n: number) => randomInt(n);

async function lockHunt(conn: PoolConnection, id: number): Promise<{ t: RowDataPacket; raw: { setup?: HuntSetup } | HuntState | null }> {
  const [rows] = await conn.query<RowDataPacket[]>("SELECT id, title, status, mode, team_size, prize_1, hunt FROM ko_tournaments WHERE id = ? FOR UPDATE", [id]);
  const t = rows[0];
  if (!t) throw new AppError("not_found");
  if (t.mode !== "hunt") throw new AppError("invalid_input", "not a Hunt tournament");
  if (t.status === "finished") throw new AppError("ko_finished");
  if (t.status === "cancelled") throw new AppError("ko_cancelled");
  return { t, raw: t.hunt ? JSON.parse(String(t.hunt)) : null };
}

/**
 * Every new monster plays a slot the site offers (the catalogue without the
 * Stake-only ones, i.e. what Ravo can open on Qzino): its bestiary slot when
 * the catalogue has it, else a popular one from the pool.
 */
async function placeSlots(conn: PoolConnection, s: HuntState) {
  for (const m of [...s.fights.map((f) => f.monster), s.reckon?.boss ?? null]) {
    if (!m || m.secret || m.slot) continue;
    const want = monsterDef(m)?.s ?? "";
    const hit = want ? await findSlotByName(want) : null;
    if (hit?.matched && normalizeName(hit.name) === normalizeName(want)) m.slot = { name: hit.name, provider: hit.provider, image: hit.imageUrl || null };
    else {
      const r = await randomPoolSlot(conn).catch(() => null); // empty catalogue: keep the bestiary slot
      if (r) m.slot = { name: r.name, provider: r.provider, image: r.imageUrl || null };
    }
  }
}

/** Final result → tournament row and players (champion, reaped). */
async function settle(conn: PoolConnection, id: number, s: HuntState) {
  const r = s.result!;
  const champ = r.champ != null && (r.type === "champion" || r.type === "legend") ? s.ents[r.champ] : null;
  await conn.query("UPDATE ko_participants SET state = 'eliminated' WHERE tournament_id = ? AND disqualified = 0", [id]);
  const reaped = s.ents.filter((e) => /^(Reaped|Judged|Fell)/.test(e.fate)).flatMap((e) => e.pids);
  if (reaped.length) await conn.query("UPDATE ko_participants SET reaped = 1 WHERE id IN (?)", [reaped]);
  if (champ) await conn.query("UPDATE ko_participants SET state = 'champion' WHERE id IN (?)", [champ.pids]);
  await conn.query("UPDATE ko_tournaments SET status = 'finished', champion_id = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?", [champ?.pids[0] ?? null, id]);
}

export async function huntAction(id: number, a: HuntOp): Promise<{ seq: number; secretNext: boolean }> {
  await ensureKoSchema();
  if (a.op === "start") {
    // fix the field first (own transactions): registration closed, duo teams drawn
    const t = await getKoById(id);
    if (!t) throw new AppError("not_found");
    if (t.mode !== "hunt") throw new AppError("invalid_input", "not a Hunt tournament");
    if (t.status === "open") await closeRegistration(id);
    if (t.team_size === 2) {
      const [teamed] = await getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM ko_participants WHERE tournament_id = ? AND team_id IS NOT NULL", [id]);
      if (!Number(teamed[0].n)) await makeTeams(id);
    }
  }
  try {
    return await withTx(async (conn) => {
      const { t, raw } = await lockHunt(conn, id);
      const started = (raw as HuntState | null)?.v === 1;
      let s: HuntState;
      if (a.op === "start") {
        if (started) throw new AppError("hunt_started");
        const setup = (raw as { setup?: HuntSetup } | null)?.setup ?? { waves: 1, chance: 50, fall: "half" };
        const [ps] = await conn.query<RowDataPacket[]>(
          "SELECT id, username, team_id FROM ko_participants WHERE tournament_id = ? AND disqualified = 0 AND is_boss = 0 ORDER BY id FOR UPDATE", [id]);
        const duo = Number(t.team_size) === 2;
        const entrants = duo
          ? ps.filter((p) => Number(p.team_id) === Number(p.id)).map((cap) => {
              const mate = ps.find((p) => Number(p.team_id) === Number(cap.id) && Number(p.id) !== Number(cap.id));
              return { name: mate ? `${cap.username} & ${mate.username}` : String(cap.username), pids: [Number(cap.id), ...(mate ? [Number(mate.id)] : [])] };
            })
          : ps.map((p) => ({ name: String(p.username), pids: [Number(p.id)] }));
        s = createHunt({ title: String(t.title), prize: Number(t.prize_1 ?? 0), duo, ...setup }, entrants, rand);
        await conn.query("UPDATE ko_participants SET state = 'in_knockout' WHERE tournament_id = ? AND disqualified = 0", [id]);
      } else {
        if (!started) throw new AppError("hunt_not_started");
        s = raw as HuntState;
        switch (a.op) {
          case "spawn": spawnNext(s, rand); break;
          case "spawn_all": spawnAll(s, rand); break;
          case "reroll": rerollMonster(s, a.index, rand); break;
          case "fight": fight(s, a.index, a.p, a.b, rand); break;
          case "arena": arenaFight(s, a.index, a.a, a.b, rand); break;
          case "fate": revealFate(s, rand); break;
          case "endboss": summonEndboss(s, rand); break;
          case "boss": bossFight(s, a.p, a.b, rand); break;
          case "secret": s.secretNext = a.on; break;
          case "call": {
            let eid = a.eid;
            let by = "Host";
            if (a.kickUserId != null) {
              const [me] = await conn.query<RowDataPacket[]>("SELECT id, username FROM ko_participants WHERE tournament_id = ? AND kick_user_id = ? AND disqualified = 0", [id, a.kickUserId]);
              if (!me[0]) throw new AppError("hunt_not_player");
              eid = s.ents.find((e) => e.pids.includes(Number(me[0].id)))?.id;
              by = String(me[0].username);
            }
            if (eid == null || !s.ents[eid]?.alive) throw new AppError("hunt_not_player");
            callSlot(s, eid, { ...a.call, by }, a.kickUserId == null);
            break;
          }
        }
      }
      await placeSlots(conn, s);
      await conn.query("UPDATE ko_tournaments SET hunt = ? WHERE id = ?", [JSON.stringify(s), id]);
      if (s.phase === "done") await settle(conn, id, s);
      return { seq: s.seq, secretNext: s.secretNext };
    });
  } catch (e) {
    if (e instanceof HuntError) throw new AppError(e.code, e.detail);
    throw e;
  }
}
