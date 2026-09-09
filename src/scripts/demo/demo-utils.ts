/* eslint-disable no-console */
import { QueryRunner } from 'typeorm';

/**
 * Generador pseudoaleatorio con semilla: dos corridas del seeder producen
 * exactamente el mismo set. Sirve para poder ensayar la demo y que el día de
 * la presentación se vea igual que en el ensayo.
 */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof makeRng>;

export const pick = <T>(rng: Rng, xs: T[]): T => xs[Math.floor(rng() * xs.length)];
export const between = (rng: Rng, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

/**
 * Las columnas de fecha son `timestamp without time zone`: node-pg las escribe
 * con el reloj de pared local, así que todas las fechas se construyen en hora
 * local y nunca con `toISOString()`.
 */
export function daysAgoAt(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

export const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);
export const addHours = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * 3_600_000);

/** Inserta una fila y devuelve su id. */
export async function insert(
  qr: QueryRunner,
  table: string,
  row: Record<string, any>,
): Promise<number> {
  const keys = Object.keys(row);
  const cols = keys.map((k) => `"${k}"`).join(', ');
  const holes = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map((k) => row[k]);
  const res = await qr.query(
    `INSERT INTO "${table}" (${cols}) VALUES (${holes}) RETURNING id`,
    values,
  );
  return res[0].id;
}

/** Igual que `insert` pero para tablas intermedias, que no tienen id. */
export async function insertNoId(
  qr: QueryRunner,
  table: string,
  row: Record<string, any>,
): Promise<void> {
  const keys = Object.keys(row);
  const cols = keys.map((k) => `"${k}"`).join(', ');
  const holes = keys.map((_, i) => `$${i + 1}`).join(', ');
  await qr.query(
    `INSERT INTO "${table}" (${cols}) VALUES (${holes})`,
    keys.map((k) => row[k]),
  );
}

export const count = async (qr: QueryRunner, sql: string, params: any[] = []) =>
  Number((await qr.query(sql, params))[0]?.n ?? 0);

export const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(
    d.getHours(),
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export const title = (t: string) => console.log(`\n\x1b[1m── ${t} ${'─'.repeat(Math.max(0, 42 - t.length))}\x1b[0m`);
export const ok = (t: string) => console.log(`  \x1b[32m[ok]\x1b[0m ${t}`);
export const bad = (t: string) => console.log(`  \x1b[31m[!!]\x1b[0m ${t}`);
export const info = (t: string) => console.log(`  ${t}`);
