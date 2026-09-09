/* eslint-disable no-console */
import { QueryRunner } from 'typeorm';
import { count, info, title } from './demo-utils';

/** El único usuario que sobrevive: la cuenta con la que se hace la demo. */
export const KEEP_USER_IDS = [1];

/**
 * Tablas que NO se tocan: catálogos cargados desde el backoffice y geografía.
 * Si alguna vez se agrega un catálogo nuevo, va acá.
 */
const PRESERVED = [
  'meds',
  'meds_drug',
  'meds_type',
  'meds_shape',
  'meds_measurement_unit',
  'professionals_specialization',
  'countries',
  'states',
  'cities',
  'event_type',
  'medical_centers',
];

/**
 * Orden de borrado. No es alfabético ni caprichoso: respeta las foreign keys
 * relevadas en `information_schema`. Las tres primeras no tienen FK que las
 * limpie sola, así que si no se borran a mano quedan huérfanas apuntando a ids
 * que Postgres va a reciclar.
 */
const DELETE_ORDER: { table: string; where?: string }[] = [
  { table: 'notification_recipients' },
  { table: 'notifications' },
  { table: 'group_event_log' },
  { table: 'patient_professional' }, // FK -> user
  { table: 'appointment' }, // FK -> user (professionalId) y -> professionals
  { table: 'med_event' },
  { table: 'medical_document' },
  { table: 'family_group_members_user' },
  { table: 'family_group' }, // FK -> dependent, -> user
  { table: 'dependent' },
  { table: 'professionals' }, // FK -> user (createdById)
  { table: 'user_specialization_professionals_specialization', where: '"userId" <> ALL($1)' },
  { table: 'user_jurisdiction_states', where: '"userId" <> ALL($1)' },
  // Los tokens de dispositivo del usuario que se conserva son los que hacen
  // posible mostrar una notificación real en vivo: no se borran.
  { table: 'notification_device_tokens', where: '"userId" <> ALL($1)' },
  { table: 'user', where: 'id <> ALL($1)' },
];

export async function reportWhatWillBeDeleted(qr: QueryRunner) {
  title('SE VA A BORRAR');
  for (const { table, where } of DELETE_ORDER) {
    const sql = `SELECT count(*)::int AS n FROM "${table}"${where ? ` WHERE ${where}` : ''}`;
    const n = await count(qr, sql, where ? [KEEP_USER_IDS] : []);
    if (n) info(`${table.padEnd(46)} ${String(n).padStart(5)}`);
  }
  info(`\n  se conserva el usuario id ${KEEP_USER_IDS.join(', ')} con su contraseña, foto y tokens de dispositivo`);

  title('SE CONSERVA (catálogos)');
  for (const table of PRESERVED) {
    const n = await count(qr, `SELECT count(*)::int AS n FROM "${table}"`);
    info(`${table.padEnd(46)} ${String(n).padStart(5)}`);
  }
}

export async function cleanup(qr: QueryRunner) {
  for (const { table, where } of DELETE_ORDER) {
    await qr.query(
      `DELETE FROM "${table}"${where ? ` WHERE ${where}` : ''}`,
      where ? [KEEP_USER_IDS] : [],
    );
  }
}
