/* eslint-disable no-console */
// Deja la base lista para la demostración en vivo: limpia los datos de prueba
// acumulados y siembra un set curado (grupo familiar con eventos en distintos
// estados, documentos, y relleno para que los gráficos del backoffice tengan
// contenido en el mes actual).
//
//   npm run seed:demo -- --dry-run          ensayo, no escribe nada
//   npm run seed:demo -- --yes              lo hace de verdad
//   npm run seed:demo:check                 sólo verifica lo que ya hay
//
// El backend tiene que estar BAJADO: dos crons escriben cada minuto y pelean
// con la transacción de borrado.

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { cleanup, reportWhatWillBeDeleted } from './demo/demo-cleanup';
import { seedDemo } from './demo/demo-seed';
import { verify } from './demo/demo-verify';
import { bad, info, ok, title } from './demo/demo-utils';

dotenv.config();

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const value = (f: string) => args.find((a) => a.startsWith(`${f}=`))?.split('=')[1];

const DRY_RUN = has('--dry-run');
const CONFIRMED = has('--yes') || process.env.CONFIRM === '1';
const VERIFY_ONLY = has('--verify-only');
const FORCE = has('--force');
const SEED = Number(value('--seed') ?? 42);

/** Ancla de los eventos futuros. Por defecto, mañana a las 10. */
function resolveDemoStart(): Date {
  const raw = value('--demo-start');
  if (raw) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      console.error(`Fecha inválida en --demo-start: ${raw}`);
      process.exit(1);
    }
    return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

const DB_NAME = process.env.DB_NAME || 'sigsa_db';

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: DB_NAME,
  entities: [`${__dirname}/../**/*.entity.{ts,js}`],
  synchronize: false,
  logging: false,
});

class DryRunRollback extends Error {}

async function main() {
  const demoStart = resolveDemoStart();

  if (DB_NAME !== 'sigsa_db') {
    console.error(`Base inesperada (${DB_NAME}). Abortado por seguridad.`);
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('NODE_ENV=production. Abortado.');
    process.exit(1);
  }

  await ds.initialize();
  const qr = ds.createQueryRunner();
  await qr.connect();

  title('PREFLIGHT');
  info(`base ${DB_NAME} · semilla ${SEED} · modo ${VERIFY_ONLY ? 'sólo verificación' : DRY_RUN ? 'ensayo (rollback)' : 'escritura'}`);
  if (!VERIFY_ONLY) info(`eventos futuros anclados a ${demoStart.toLocaleString('es-AR')}`);

  if (VERIFY_ONLY) {
    const failures = await verify(qr);
    await qr.release();
    await ds.destroy();
    console.log(failures ? `\n\x1b[31m${failures} verificaciones fallaron.\x1b[0m` : '\n\x1b[32mTodo en orden.\x1b[0m');
    process.exit(failures ? 1 : 0);
  }

  // Los crons del backend escriben cada minuto: con la transacción abierta se
  // bloquean entre sí.
  const [{ n: conns }] = await qr.query(
    `SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND state IS NOT NULL`,
  );
  if (conns > 0) {
    if (!FORCE) {
      bad(`hay ${conns} conexión(es) abierta(s) contra la base.`);
      info('Bajá el backend (npm run start:dev) antes de sembrar, o pasá --force.');
      await qr.release();
      await ds.destroy();
      process.exit(1);
    }
    info(`hay ${conns} conexión(es) abierta(s); se continúa por --force`);
  } else {
    ok('no hay otras conexiones contra la base');
  }

  if (!DRY_RUN && !CONFIRMED) {
    bad('Esto borra datos. Volvé a correrlo con --yes (o probá primero con --dry-run).');
    await qr.release();
    await ds.destroy();
    process.exit(1);
  }

  await qr.startTransaction();
  try {
    await reportWhatWillBeDeleted(qr);
    await cleanup(qr);

    const summary = await seedDemo(qr, { demoStart, seed: SEED });
    title('SE CREÓ');
    Object.entries(summary).forEach(([k, v]) => info(`${k.padEnd(20)} ${String(v).padStart(5)}`));

    const failures = await verify(qr);

    if (DRY_RUN) throw new DryRunRollback();
    if (failures) {
      bad(`\n${failures} verificaciones fallaron: se revierte todo.`);
      throw new Error('verificación fallida');
    }
    await qr.commitTransaction();
    title('LISTO');
    info('La base quedó preparada. Levantá el backend y revisá con: npm run seed:demo:check');
  } catch (err) {
    await qr.rollbackTransaction();
    if (err instanceof DryRunRollback) {
      title('ENSAYO TERMINADO');
      info('Rollback: no se escribió nada. Repetí con --yes para aplicarlo.');
    } else {
      throw err;
    }
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('\nFalló la siembra:', err.message);
  process.exit(1);
});
