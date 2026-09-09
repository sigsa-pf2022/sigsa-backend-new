/* eslint-disable no-console */
import { QueryRunner } from 'typeorm';
import { bad, count, info, ok, title } from './demo-utils';
import { OWNER_ID, ROSA_DNI } from './demo-seed';

/**
 * Réplica de la ventana que usa el dashboard: los últimos 30 días, con el tope
 * al final del día de hoy.
 */
function dashboardWindow() {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

type Check = { label: string; sql: string; params?: any[]; expect: (n: number) => boolean; hint: string };

export async function verify(qr: QueryRunner): Promise<number> {
  const { from, to } = dashboardWindow();
  let failures = 0;

  const checks: Check[] = [
    {
      label: 'no hay ráfaga de push al levantar el backend',
      sql: `SELECT count(*)::int AS n FROM notifications WHERE status='created'
              AND "scheduledFor" - ("leadMinutes" * INTERVAL '1 minute') <= LOCALTIMESTAMP`,
      expect: (n) => n === 0,
      hint: 'hay notificaciones vencidas sin despachar: al arrancar saldrían todas juntas',
    },
    {
      label: 'el cron no va a pisar el estado de ningún turno',
      sql: `SELECT count(*)::int AS n FROM appointment
             WHERE status='created' AND date < LOCALTIMESTAMP - INTERVAL '1 day'`,
      expect: (n) => n === 0,
      hint: 'cancelOldCreatedAppointments los pasaría a canceled en el próximo minuto',
    },
    {
      label: 'todo evento de dependiente tiene su notificación',
      sql: `SELECT (
              (SELECT count(*) FROM med_event e WHERE e."createdByType"='dependent'
                 AND NOT EXISTS (SELECT 1 FROM notifications n
                                  WHERE n.type='medication' AND n."referenceId"=e.id))
            + (SELECT count(*) FROM appointment a WHERE a."createdByType"='dependent'
                 AND NOT EXISTS (SELECT 1 FROM notifications n
                                  WHERE n.type='appointment' AND n."referenceId"=a.id))
            )::int AS n`,
      expect: (n) => n === 0,
      hint: '"Me hago cargo" devolvería 404 sobre esos eventos',
    },
    {
      label: 'el dueño de la demo es destinatario en las notificaciones de sus grupos',
      sql: `SELECT count(*)::int AS n FROM notifications n
             WHERE n."groupId" IN (SELECT id FROM family_group WHERE "createdById"=$1)
               AND NOT EXISTS (SELECT 1 FROM notification_recipients r
                                WHERE r."notificationId"=n.id AND r."userId"=$1)`,
      params: [OWNER_ID],
      expect: (n) => n === 0,
      hint: '"Me hago cargo" devolvería 403 sobre esos eventos',
    },
    {
      label: 'el dueño ve sus dos grupos (innerJoin sobre members)',
      sql: `SELECT count(*)::int AS n FROM family_group fg
              JOIN family_group_members_user m ON m."familyGroupId"=fg.id AND m."userId"=$1`,
      params: [OWNER_ID],
      expect: (n) => n === 2,
      hint: 'si el creador no está en members, la app no muestra el grupo',
    },
    {
      label: 'la dependiente de la demo NO está vinculada a ningún profesional',
      sql: `SELECT count(*)::int AS n FROM patient_professional
             WHERE "patientType"='dependent'
               AND "patientId"=(SELECT id FROM dependent WHERE dni=$1)`,
      params: [ROSA_DNI],
      expect: (n) => n === 0,
      hint: 'la vinculación tiene que hacerse en vivo durante la reunión',
    },
    {
      label: 'no hay DNIs de dependiente repetidos',
      sql: `SELECT count(*)::int AS n FROM (SELECT dni FROM dependent GROUP BY dni HAVING count(*)>1) x`,
      expect: (n) => n === 0,
      hint: 'la búsqueda del profesional devolvería más de un resultado',
    },
    {
      label: 'el Dr. Ferreyra no tiene solicitudes pendientes viejas',
      sql: `SELECT count(*)::int AS n FROM patient_professional
             WHERE status='PENDING'
               AND professional_id=(SELECT id FROM "user" WHERE email='julian.ferreyra@sigsa.demo')`,
      expect: (n) => n === 0,
      hint: 'su bandeja tiene que mostrar sólo la solicitud que se genere en vivo',
    },
    {
      label: 'hay próximos eventos de la dependiente para el carrusel',
      sql: `SELECT count(*)::int AS n FROM med_event
             WHERE "createdByType"='dependent'
               AND "createdById"=(SELECT id FROM dependent WHERE dni=$1)
               AND status IN ('created','confirmed')
               AND date >= DATE_TRUNC('day', LOCALTIMESTAMP)`,
      params: [ROSA_DNI],
      expect: (n) => n >= 3,
      hint: 'la pantalla del grupo se vería sin actividad próxima',
    },
    {
      label: 'los catálogos quedaron intactos',
      sql: `SELECT ((SELECT count(*) FROM meds)+(SELECT count(*) FROM meds_drug)
                   +(SELECT count(*) FROM meds_type)+(SELECT count(*) FROM meds_shape)
                   +(SELECT count(*) FROM meds_measurement_unit)
                   +(SELECT count(*) FROM professionals_specialization))::int AS n`,
      expect: (n) => n === 42,
      hint: 'se esperaban 5+12+5+5+5+10 = 42 filas de catálogo',
    },
    {
      label: 'el dueño conserva su dispositivo registrado',
      sql: `SELECT count(*)::int AS n FROM notification_device_tokens WHERE "userId"=$1 AND enabled`,
      params: [OWNER_ID],
      expect: (n) => n >= 1,
      hint: 'sin token habilitado no llega ningún push a su teléfono',
    },
  ];

  title('INVARIANTES');
  for (const c of checks) {
    const n = await count(qr, c.sql, c.params ?? []);
    if (c.expect(n)) ok(`${c.label} (${n})`);
    else { bad(`${c.label} → ${n}: ${c.hint}`); failures++; }
  }

  title('LO QUE VA A MOSTRAR EL DASHBOARD');
  info(`ventana: ${from.toLocaleDateString('es-AR')} 00:00 → ${to.toLocaleDateString('es-AR')} 23:59\n`);

  const [ov] = await qr.query(
    `SELECT (SELECT count(*) FROM "user" WHERE type='NormalUser' AND "createdAt" BETWEEN $1 AND $2) usuarios,
            (SELECT count(*) FROM "user" WHERE type='ProfessionalUser' AND "createdAt" BETWEEN $1 AND $2) profesionales,
            (SELECT count(*) FROM family_group WHERE "createdAt" BETWEEN $1 AND $2) grupos,
            (SELECT count(*) FROM dependent WHERE "createdAt" BETWEEN $1 AND $2) dependientes,
            (SELECT count(*) FROM appointment WHERE "createdAt" BETWEEN $1 AND $2) turnos,
            (SELECT count(*) FROM med_event WHERE "createdAt" BETWEEN $1 AND $2) medicamentos,
            (SELECT count(*) FROM medical_document WHERE "createdAt" BETWEEN $1 AND $2) documentos,
            (SELECT count(*) FROM patient_professional WHERE "createdAt" BETWEEN $1 AND $2) vinculaciones`,
    [from, to],
  );
  Object.entries(ov).forEach(([k, v]) => info(`  ${k.padEnd(16)} ${v}`));
  if (Object.values(ov).some((v) => Number(v) === 0)) {
    bad('algún KPI del resumen queda en cero'); failures++;
  }

  const dias = await qr.query(
    `SELECT count(*)::int AS n FROM generate_series($1::date, $2::date, '1 day') d
      WHERE NOT EXISTS (SELECT 1 FROM appointment WHERE "createdAt"::date = d)
        AND NOT EXISTS (SELECT 1 FROM med_event WHERE "createdAt"::date = d)
        AND NOT EXISTS (SELECT 1 FROM medical_document WHERE "createdAt"::date = d)`,
    [from, to],
  );
  if (Number(dias[0].n) === 0) ok('los 31 días de la ventana tienen eventos');
  else { bad(`${dias[0].n} días sin ningún evento: el gráfico va a tener huecos`); failures++; }

  const specs = await qr.query(
    `SELECT s.name, count(*)::int AS n FROM appointment a
       JOIN user_specialization_professionals_specialization us ON us."userId" = a."professionalId"
       JOIN professionals_specialization s ON s.id = us."professionalsSpecializationId"
      WHERE a."createdAt" BETWEEN $1 AND $2 AND s.deleted = false
      GROUP BY s.name ORDER BY n DESC LIMIT 5`,
    [from, to],
  );
  info('\n  top especialidades:');
  specs.forEach((r: any) => info(`    ${r.name.padEnd(20)} ${r.n}`));
  if (!specs.length) { bad('el gráfico de especialidades queda vacío'); failures++; }

  const links = await qr.query(
    `SELECT status, count(*)::int AS n FROM patient_professional
      WHERE "createdAt" BETWEEN $1 AND $2 GROUP BY status ORDER BY status`,
    [from, to],
  );
  info('\n  vinculaciones: ' + links.map((r: any) => `${r.status} ${r.n}`).join(' · '));

  const [cov] = await qr.query(
    `SELECT count(*)::int AS total, count("takenChargeByUserId")::int AS tomados FROM (
       SELECT "takenChargeByUserId" FROM appointment
        WHERE "createdByType"='dependent' AND "createdAt" BETWEEN $1 AND $2
       UNION ALL
       SELECT "takenChargeByUserId" FROM med_event
        WHERE "createdByType"='dependent' AND "createdAt" BETWEEN $1 AND $2) e`,
    [from, to],
  );
  const [resp] = await qr.query(
    `SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY m)::numeric, 1) AS mediana,
            round(percentile_cont(0.9) WITHIN GROUP (ORDER BY m)::numeric, 1) AS p90,
            count(*)::int AS muestras
       FROM (SELECT extract(epoch FROM ("respondedAt"-"deliveredAt"))/60 m
               FROM notification_recipients
              WHERE action='take_charge' AND "deliveredAt" IS NOT NULL
                AND "respondedAt" BETWEEN "deliveredAt" AND "deliveredAt" + INTERVAL '1 day'
                AND "respondedAt" BETWEEN $1 AND $2) r`,
    [from, to],
  );
  const pct = cov.total ? Math.round((cov.tomados / cov.total) * 100) : 0;
  info(`\n  coordinación: ${cov.tomados}/${cov.total} eventos tomados a cargo (${pct}%)`);
  info(`  tiempo de respuesta: mediana ${resp.mediana} min · p90 ${resp.p90} min · ${resp.muestras} muestras`);
  if (!Number(resp.muestras)) { bad('el panel de tiempos de respuesta queda vacío'); failures++; }

  return failures;
}
