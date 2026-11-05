import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { getPool } from "./db";

// A business error with a stable code the UI can explain (see ERROR_TEXT).
export class AppError extends Error {
  constructor(public code: string, public detail?: string) {
    super(code);
  }
}

export async function withTx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// DECIMAL(20,8): at most 12 integer digits and 8 decimals, plain notation.
export const DECIMAL_20_8 = /^\d{1,12}(\.\d{1,8})?$/;

export const zText = (max: number) => z.string().trim().max(max);
export const zRequiredText = (max: number) => z.string().trim().min(1).max(max);
export const zId = z.coerce.number().int().positive().max(2_147_483_647);
export const zMoney = z.string().trim().regex(DECIMAL_20_8, "invalid_amount");
export const zPoints = z.coerce.number().int().min(0).max(1_000_000_000);
export const zLevel = z.coerce.number().int().min(1).max(40);

/** `<input type="datetime-local">` value interpreted as UTC → "YYYY-MM-DD HH:MM:SS". */
export const zUtcDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "invalid_datetime")
  .transform((v, ctx) => {
    const iso = v.length === 16 ? `${v}:00` : v;
    const date = new Date(`${iso}Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 19) !== iso) {
      ctx.addIssue({ code: "custom", message: "invalid_datetime" });
      return z.NEVER;
    }
    return iso.replace("T", " ");
  });

/** Parse FormData with a schema; failures become AppError("invalid_input"). */
export function parseForm<T extends z.ZodTypeAny>(schema: T, form: FormData): z.infer<T> {
  const raw: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of form.entries()) raw[k] = v;
  const res = schema.safeParse(raw);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new AppError("invalid_input", `${issue.path.join(".")}: ${issue.message}`);
  }
  return res.data;
}

/** Serialises "only one active X" checks (rows seeded by migration 0005). */
export async function lockApp(conn: PoolConnection, name: "ko" | "hunt" | "slots"): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>("SELECT name FROM app_locks WHERE name = ? FOR UPDATE", [name]);
  if (!rows[0]) throw new AppError("unexpected", "migration missing");
}
