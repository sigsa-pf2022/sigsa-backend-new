/* eslint-disable no-console */
import { hashSync } from 'bcrypt';
import { QueryRunner } from 'typeorm';
import {
  addHours,
  addMinutes,
  between,
  daysAgoAt,
  fmt,
  info,
  insert,
  insertNoId,
  makeRng,
  pick,
  Rng,
  title,
} from './demo-utils';

export const DEMO_PASSWORD = 'Sigsa2026!';
export const OWNER_ID = 1; // Pedro Martinez, la cuenta que se conserva
export const ROSA_DNI = '4812337';
const WINDOW_DAYS = 30; // el dashboard mira los últimos 30 días

/** PDF mínimo válido: los listados devuelven el contenido, así que va chico. */
const PDF_B64 = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF',
).toString('base64');

const NOMBRES = [
  ['Sofía', 'Ramírez'], ['Mateo', 'Ibáñez'], ['Valentina', 'Ocampo'], ['Joaquín', 'Bustos'],
  ['Camila', 'Peralta'], ['Benjamín', 'Aguirre'], ['Julieta', 'Sosa'], ['Tomás', 'Molina'],
  ['Delfina', 'Quiroga'], ['Santiago', 'Vera'], ['Emilia', 'Cabrera'], ['Bautista', 'Roldán'],
  ['Renata', 'Figueroa'], ['Thiago', 'Maldonado'], ['Isabella', 'Ledesma'], ['Lorenzo', 'Suárez'],
];
const DEPENDIENTES = [
  ['Elsa', 'Ramírez'], ['Alberto', 'Ibáñez'], ['Norma', 'Ocampo'], ['Raúl', 'Bustos'],
  ['Haydée', 'Peralta'], ['Osvaldo', 'Aguirre'], ['Marta', 'Sosa'], ['Hugo', 'Molina'],
  ['Nélida', 'Quiroga'], ['Ramón', 'Vera'], ['Alicia', 'Cabrera'], ['Jorge', 'Roldán'],
];
const PROFESIONALES = [
  ['Alejandra', 'Bianchi', 3], ['Gustavo', 'Paz', 2], ['Verónica', 'Luna', 1],
  ['Ricardo', 'Ávila', 7], ['Natalia', 'Cortés', 4], ['Esteban', 'Miranda', 5],
];
const SANGRE = ['A+', 'A-', 'B+', 'O+', 'O-', 'AB+'];

type Ctx = { qr: QueryRunner; rng: Rng; demoStart: Date };

/**
 * Las cuentas sembradas van sin foto a propósito: `<app-avatar>` cae a las
 * iniciales, que es lo que la app muestra para cualquier usuario que todavía
 * no subió una. Nada de data URIs SVG acá: el sanitizador de Angular sólo
 * admite data URIs de bmp/gif/jpeg/png/tiff/webp, así que un SVG se reescribe
 * a "unsafe:" y el avatar queda como imagen rota.
 */
async function createUser(
  ctx: Ctx,
  o: { firstName: string; lastName: string; dni: string; email: string; gender: string;
       birthday: string; role: 'user' | 'professional'; createdAt: Date;
       licenseNumber?: number; photo?: string },
) {
  return insert(ctx.qr, 'user', {
    first_name: o.firstName,
    last_name: o.lastName,
    dni: o.dni,
    email: o.email,
    password: hashSync(DEMO_PASSWORD, 10),
    createdAt: o.createdAt,
    gender: o.gender,
    birthday: new Date(o.birthday),
    verification_code: null,
    recovery_password_token: null,
    email_verified: true, // sin esto el login rebota con "correo no validado"
    role: o.role,
    type: o.role === 'professional' ? 'ProfessionalUser' : 'NormalUser',
    license_number: o.licenseNumber ?? null,
    photo: o.photo ?? null,
  });
}

async function createGroup(
  ctx: Ctx,
  o: { name: string; dependent: { firstName: string; lastName: string; dni: string;
        bloodType: string; birthday: string }; ownerId: number; memberIds: number[];
       createdAt: Date },
) {
  const dependentId = await insert(ctx.qr, 'dependent', {
    first_name: o.dependent.firstName,
    last_name: o.dependent.lastName,
    dni: o.dependent.dni,
    blood_type: o.dependent.bloodType,
    birthday: new Date(o.dependent.birthday),
    createdAt: o.createdAt,
  });
  const groupId = await insert(ctx.qr, 'family_group', {
    name: o.name,
    createdAt: o.createdAt,
    dependentId,
    createdById: o.ownerId,
    photo: null,
  });
  // El creador va DENTRO de members: `getFamilyGroupsByUser` filtra con un
  // innerJoin sobre members, así que si se omite no ve su propio grupo.
  const members = Array.from(new Set([o.ownerId, ...o.memberIds]));
  for (const userId of members) {
    await insertNoId(ctx.qr, 'family_group_members_user', { familyGroupId: groupId, userId });
  }
  return { groupId, dependentId, memberIds: members };
}

/**
 * Minutos que tarda alguien en hacerse cargo desde que le llega el aviso.
 * Sesgado a propósito: la mayoría responde enseguida y unos pocos tardan, que
 * es lo que se ve en el uso real. Una distribución uniforme dejaba la mediana
 * en la mitad del rango y el panel parecía inventado.
 */
function responseDelay(rng: Rng): number {
  const r = rng();
  if (r < 0.55) return between(rng, 2, 9);
  if (r < 0.85) return between(rng, 10, 25);
  return between(rng, 26, 55);
}

type EventOpts = {
  kind: 'med_event' | 'appointment';
  date: Date;
  createdAt: Date;
  status: string;
  creator: { id: number; type: 'user' | 'dependent'; name?: string };
  group?: { id: number; memberIds: number[] };
  medId?: number;
  medName?: string;
  professionalId?: number;
  professionalName?: string;
  description?: string;
  takenChargeBy?: number | null;
  /** La única notificación que se deja sin despachar, para el push en vivo. */
  live?: boolean;
  series?: { seriesId: string; doseIndex: number; totalDoses: number; intervalHours: number };
};

/**
 * Crea un evento con TODO lo que la app genera alrededor: la notificación, un
 * destinatario por integrante y las entradas del historial.
 *
 * Es deliberadamente fiel: `respondToEvent` busca la notificación por
 * (type, referenceId) y devuelve 404 si no existe, y 403 si quien responde no
 * figura entre los destinatarios. Un evento de dependiente sembrado "pelado"
 * rompe el botón "Me hago cargo" justo en la demo.
 */
async function createEvent(ctx: Ctx, o: EventOpts): Promise<number> {
  const { qr, rng } = ctx;
  const isMed = o.kind === 'med_event';
  const leadMinutes = isMed ? 5 : 15;
  const takenAt = o.takenChargeBy
    ? addMinutes(o.date, -leadMinutes + responseDelay(rng))
    : null;

  const eventId = await insert(qr, o.kind, {
    date: o.date,
    createdById: o.creator.id,
    createdByType: o.creator.type,
    status: o.status,
    updatedAt: takenAt ?? o.createdAt,
    createdAt: o.createdAt,
    ...(isMed
      ? {
          medId: o.medId,
          seriesId: o.series?.seriesId ?? null,
          doseIndex: o.series?.doseIndex ?? null,
          totalDoses: o.series?.totalDoses ?? null,
          intervalHours: o.series?.intervalHours ?? null,
        }
      : {
          description: o.description ?? '',
          myProfessionalId: null,
          professionalId: o.professionalId ?? null,
        }),
    takenChargeByUserId: o.takenChargeBy ?? null,
    takenChargeAt: takenAt,
  });

  // Sin grupo (evento personal) igual hay notificación, pero con groupId null.
  const recipients = o.group ? o.group.memberIds : [o.creator.id];
  const payload = isMed
    ? { medName: o.medName, dependentName: o.creator.name ?? null, dependentId: o.creator.type === 'dependent' ? o.creator.id : null }
    : { professionalName: o.professionalName, description: o.description, dependentName: o.creator.name ?? null, dependentId: o.creator.type === 'dependent' ? o.creator.id : null };

  const notifStatus = o.live
    ? 'created'
    : o.status === 'canceled'
    ? 'canceled'
    : o.takenChargeBy
    ? 'completed'
    : 'sent';

  const notificationId = await insert(qr, 'notifications', {
    type: isMed ? 'medication' : 'appointment',
    referenceId: eventId,
    groupId: o.group?.id ?? null,
    scheduledFor: o.date,
    leadMinutes,
    status: notifStatus,
    payload: JSON.stringify(payload),
    createdAt: o.createdAt,
    updatedAt: takenAt ?? o.createdAt,
  });

  const deliveredAt = o.live ? null : addMinutes(o.date, -leadMinutes);
  for (const userId of recipients) {
    const isTaker = o.takenChargeBy === userId;
    await insert(qr, 'notification_recipients', {
      notificationId,
      userId,
      status: o.live
        ? 'pending'
        : o.status === 'canceled'
        ? 'canceled'
        : isTaker
        ? 'confirmed'
        : o.takenChargeBy
        ? 'canceled'
        : 'delivered',
      action: isTaker ? 'take_charge' : null,
      deliveredAt,
      respondedAt: isTaker ? takenAt : null,
      createdAt: o.createdAt,
    });
  }

  if (o.group) {
    const targetType = isMed ? 'med_event' : 'appointment';
    // Un tratamiento se registra una sola vez, en su primera toma.
    const logCreation = !o.series || o.series.doseIndex === 1;
    if (logCreation) {
      await insert(qr, 'group_event_log', {
        groupId: o.group.id,
        actorUserId: OWNER_ID,
        action: 'event_created',
        targetType,
        targetId: eventId,
        payload: JSON.stringify({ ...payload, eventDate: o.date }),
        createdAt: o.createdAt,
      });
    }
    if (o.takenChargeBy && takenAt) {
      const [actor] = await qr.query(
        'SELECT first_name, last_name FROM "user" WHERE id=$1',
        [o.takenChargeBy],
      );
      await insert(qr, 'group_event_log', {
        groupId: o.group.id,
        actorUserId: o.takenChargeBy,
        action: 'event_taken_charge',
        targetType,
        targetId: eventId,
        payload: JSON.stringify({
          ...payload,
          actorName: `${actor.first_name} ${actor.last_name}`,
          eventDate: o.date,
        }),
        createdAt: takenAt,
      });
    }
  }
  return eventId;
}

async function createDocument(
  ctx: Ctx,
  o: { title: string; creator: { id: number; type: 'user' | 'dependent' }; date: Date; mime?: string },
) {
  return insert(ctx.qr, 'medical_document', {
    date: o.date,
    createdById: o.creator.id,
    createdByType: o.creator.type,
    status: 'created',
    updatedAt: o.date,
    createdAt: o.date,
    title: o.title,
    description: null,
    fileContent: PDF_B64,
    fileName: `${o.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
    mimeType: o.mime ?? 'application/pdf',
    fileSize: PDF_B64.length,
    documentDate: o.date,
  });
}

export async function seedDemo(qr: QueryRunner, opts: { demoStart: Date; seed: number }) {
  const ctx: Ctx = { qr, rng: makeRng(opts.seed), demoStart: opts.demoStart };
  const { rng } = ctx;
  const summary: Record<string, number> = {};
  const bump = (k: string, n = 1) => (summary[k] = (summary[k] ?? 0) + n);

  // ── El elenco de la demo ────────────────────────────────────────────────
  const lucia = await createUser(ctx, {
    firstName: 'Lucía', lastName: 'Gutiérrez', dni: '32458901',
    email: 'lucia.gutierrez@sigsa.demo', gender: 'female', birthday: '1986-04-18',
    role: 'user', createdAt: daysAgoAt(28, 10),
  });
  const martin = await createUser(ctx, {
    firstName: 'Martín', lastName: 'Gutiérrez', dni: '30112945',
    email: 'martin.gutierrez@sigsa.demo', gender: 'male', birthday: '1983-11-02',
    role: 'user', createdAt: daysAgoAt(26, 16),
  });
  const ferreyra = await createUser(ctx, {
    firstName: 'Julián', lastName: 'Ferreyra', dni: '27884512',
    email: 'julian.ferreyra@sigsa.demo', gender: 'male', birthday: '1979-06-25',
    role: 'professional', createdAt: daysAgoAt(29, 9), licenseNumber: 118342,
  });
  await insertNoId(qr, 'user_specialization_professionals_specialization', {
    userId: ferreyra, professionalsSpecializationId: 3, // Clinica medica
  });
  bump('usuarios', 3);

  // ── Grupos de la demo ───────────────────────────────────────────────────
  const gutierrez = await createGroup(ctx, {
    name: 'Familia Gutiérrez',
    dependent: { firstName: 'Rosa', lastName: 'Gutiérrez', dni: ROSA_DNI,
      bloodType: 'O+', birthday: '1944-03-12' },
    ownerId: OWNER_ID, memberIds: [lucia, martin], createdAt: daysAgoAt(25, 11),
  });
  const martinez = await createGroup(ctx, {
    name: 'Familia Martínez',
    dependent: { firstName: 'Tomás', lastName: 'Martínez', dni: '55231480',
      bloodType: 'A+', birthday: '2018-07-05' },
    ownerId: OWNER_ID, memberIds: [lucia], createdAt: daysAgoAt(20, 15),
  });
  bump('grupos', 2);
  bump('dependientes', 2);

  const rosa = { id: gutierrez.dependentId, type: 'dependent' as const, name: 'Rosa Gutiérrez' };
  const tomas = { id: martinez.dependentId, type: 'dependent' as const, name: 'Tomás Martínez' };
  const gA = { id: gutierrez.groupId, memberIds: gutierrez.memberIds };
  const gB = { id: martinez.groupId, memberIds: martinez.memberIds };

  // "Mis profesionales" de Pedro: los que carga a mano, sin padrón.
  for (const [fn, ln] of [['Hernán', 'Fernández'], ['Milagros', 'Sosa']]) {
    await insert(qr, 'professionals', {
      first_name: fn, last_name: ln, createdAt: daysAgoAt(24, 12), createdById: OWNER_ID,
    });
  }

  // ── Calendario del grupo Gutiérrez (lo que se muestra en la demo) ────────
  await createEvent(ctx, {
    kind: 'appointment', date: daysAgoAt(22, 9, 30), createdAt: daysAgoAt(24, 18),
    status: 'confirmed', creator: rosa, group: gA, professionalId: ferreyra,
    professionalName: 'Julián Ferreyra', description: 'Control clínico general',
    takenChargeBy: lucia,
  });
  bump('turnos');

  // Tratamiento cerrado: 9 tomas cada 8 horas, con una descartada.
  const serieAmoxi = '11111111-1111-4111-8111-111111111111';
  for (let i = 0; i < 9; i++) {
    const date = addHours(daysAgoAt(19, 8), i * 8);
    await createEvent(ctx, {
      kind: 'med_event', date, createdAt: daysAgoAt(19, 7), status: i === 5 ? 'discarded' : 'confirmed',
      creator: rosa, group: gA, medId: 3, medName: 'Amoxicilina 500mg',
      takenChargeBy: i === 5 ? null : i % 2 === 0 ? OWNER_ID : lucia,
      series: { seriesId: serieAmoxi, doseIndex: i + 1, totalDoses: 9, intervalHours: 8 },
    });
    bump('medicamentos');
  }

  await createEvent(ctx, {
    kind: 'med_event', date: daysAgoAt(14, 21), createdAt: daysAgoAt(14, 20),
    status: 'confirmed', creator: rosa, group: gA, medId: 1, medName: 'Ibuprofeno 400mg',
    takenChargeBy: OWNER_ID,
  });
  bump('medicamentos');

  await createEvent(ctx, {
    kind: 'appointment', date: daysAgoAt(11, 11), createdAt: daysAgoAt(15, 10),
    status: 'canceled', creator: rosa, group: gA, professionalId: ferreyra,
    professionalName: 'Verónica Luna', description: 'Control cardiológico',
  });
  bump('turnos');

  // Nadie respondió: queda como recordatorio entregado y sin dueño.
  await createEvent(ctx, {
    kind: 'med_event', date: daysAgoAt(7, 8), createdAt: daysAgoAt(7, 7),
    status: 'sended', creator: rosa, group: gA, medId: 2, medName: 'Paracetamol 500mg',
  });
  bump('medicamentos');

  for (const [d, t] of [[6, 'Análisis de sangre - hemograma'], [5, 'Radiografía de tórax'],
                        [1, 'Receta - Enalapril 10mg']] as [number, string][]) {
    await createDocument(ctx, { title: t, creator: rosa, date: daysAgoAt(d, 10) });
    bump('documentos');
  }

  // Tratamiento en curso: tomas pasadas resueltas y futuras pendientes.
  const serieEnalapril = '22222222-2222-4222-8222-222222222222';
  for (let i = 0; i < 10; i++) {
    const date = addHours(daysAgoAt(3, 9), i * 12);
    const past = date.getTime() < Date.now();
    await createEvent(ctx, {
      kind: 'med_event', date, createdAt: daysAgoAt(3, 8),
      status: past ? 'confirmed' : 'created', creator: rosa, group: gA,
      medId: 5, medName: 'Enalapril 10mg',
      takenChargeBy: past ? (i % 2 === 0 ? lucia : OWNER_ID) : null,
      series: { seriesId: serieEnalapril, doseIndex: i + 1, totalDoses: 10, intervalHours: 12 },
    });
    bump('medicamentos');
  }

  await createEvent(ctx, {
    kind: 'appointment', date: daysAgoAt(2, 9), createdAt: daysAgoAt(8, 9),
    status: 'confirmed', creator: rosa, group: gA, professionalId: ferreyra,
    professionalName: 'Ricardo Ávila', description: 'Control traumatológico',
    takenChargeBy: OWNER_ID,
  });
  bump('turnos');

  // ── Lo que se demuestra en vivo ─────────────────────────────────────────
  // Única notificación sin despachar: el scheduler la manda sola y el push
  // llega al teléfono durante la reunión.
  const livePush = addMinutes(ctx.demoStart, 25);
  await createEvent(ctx, {
    kind: 'med_event', date: livePush, createdAt: new Date(), status: 'created',
    creator: rosa, group: gA, medId: 5, medName: 'Enalapril 10mg', live: true,
  });
  bump('medicamentos');

  // Plan B si falla la red: ya entregada, se toma a cargo desde la app.
  await createEvent(ctx, {
    kind: 'appointment', date: addHours(ctx.demoStart, 3), createdAt: daysAgoAt(1, 12),
    status: 'created', creator: rosa, group: gA, professionalId: ferreyra,
    professionalName: 'Julián Ferreyra', description: 'Control de presión',
  });
  bump('turnos');

  await createEvent(ctx, {
    kind: 'appointment', date: addHours(ctx.demoStart, 48), createdAt: daysAgoAt(0, 9),
    status: 'created', creator: rosa, group: gA, professionalId: ferreyra,
    professionalName: 'Julián Ferreyra', description: 'Análisis de laboratorio',
  });
  bump('turnos');

  // ── Grupo Martínez y eventos personales de Pedro ─────────────────────────
  await createEvent(ctx, {
    kind: 'appointment', date: daysAgoAt(9, 16), createdAt: daysAgoAt(12, 9),
    status: 'confirmed', creator: tomas, group: gB, professionalId: ferreyra,
    professionalName: 'Gustavo Paz', description: 'Control pediátrico',
    takenChargeBy: lucia,
  });
  bump('turnos');
  const serieParacetamol = '33333333-3333-4333-8333-333333333333';
  for (let i = 0; i < 6; i++) {
    await createEvent(ctx, {
      kind: 'med_event', date: addHours(daysAgoAt(4, 10), i * 8), createdAt: daysAgoAt(4, 9),
      status: 'confirmed', creator: tomas, group: gB, medId: 2, medName: 'Paracetamol 500mg',
      takenChargeBy: i % 2 === 0 ? OWNER_ID : lucia,
      series: { seriesId: serieParacetamol, doseIndex: i + 1, totalDoses: 6, intervalHours: 8 },
    });
    bump('medicamentos');
  }
  await createDocument(ctx, { title: 'Carnet de vacunación', creator: tomas, date: daysAgoAt(10, 11) });
  bump('documentos');

  const pedro = { id: OWNER_ID, type: 'user' as const };
  await createEvent(ctx, {
    kind: 'appointment', date: addHours(ctx.demoStart, 26), createdAt: daysAgoAt(5, 14),
    status: 'created', creator: pedro, professionalId: ferreyra,
    professionalName: 'Julián Ferreyra', description: 'Chequeo anual',
  });
  bump('turnos');
  for (let i = 0; i < 4; i++) {
    await createEvent(ctx, {
      kind: 'med_event', date: addHours(daysAgoAt(1, 8), i * 12), createdAt: daysAgoAt(1, 7),
      status: i < 2 ? 'confirmed' : 'created', creator: pedro, medId: 1,
      medName: 'Ibuprofeno 400mg',
      series: { seriesId: '44444444-4444-4444-8444-444444444444', doseIndex: i + 1, totalDoses: 4, intervalHours: 12 },
    });
    bump('medicamentos');
  }
  await createDocument(ctx, { title: 'Apto físico', creator: pedro, date: daysAgoAt(13, 9) });
  bump('documentos');

  // ── Relleno para los gráficos del backoffice ────────────────────────────
  // Vive sólo en el backoffice: ninguno de estos grupos incluye a Pedro, así
  // que nada de esto aparece en la app durante la demo.
  const fillUsers: number[] = [];
  for (let i = 0; i < NOMBRES.length; i++) {
    const [fn, ln] = NOMBRES[i];
    fillUsers.push(await createUser(ctx, {
      firstName: fn, lastName: ln, dni: `3${String(1000000 + i * 7919).slice(0, 7)}`,
      email: `${fn.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${ln.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@sigsa.demo`,
      gender: i % 2 ? 'female' : 'male', birthday: `19${70 + (i % 25)}-0${(i % 9) + 1}-1${i % 9}`,
      role: 'user', createdAt: daysAgoAt(WINDOW_DAYS - i * 2, 9 + (i % 10)),
    }));
    bump('usuarios');
  }
  const fillProfs: { id: number; spec: number; name: string }[] = [];
  for (let i = 0; i < PROFESIONALES.length; i++) {
    const [fn, ln, spec] = PROFESIONALES[i] as [string, string, number];
    const id = await createUser(ctx, {
      firstName: fn, lastName: ln, dni: `2${String(7000000 + i * 4441).slice(0, 7)}`,
      email: `${fn.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${ln.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@sigsa.demo`,
      gender: i % 2 ? 'male' : 'female', birthday: `197${i}-03-15`, role: 'professional',
      createdAt: daysAgoAt(WINDOW_DAYS - i * 3, 10), licenseNumber: 120000 + i * 137,
    });
    await insertNoId(qr, 'user_specialization_professionals_specialization', {
      userId: id, professionalsSpecializationId: spec,
    });
    fillProfs.push({ id, spec, name: `${fn} ${ln}` });
    bump('usuarios');
  }

  const fillGroups: { id: number; memberIds: number[]; dependentId: number; name: string }[] = [];
  const sizes = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4];
  for (let i = 0; i < DEPENDIENTES.length; i++) {
    const [fn, ln] = DEPENDIENTES[i];
    const owner = fillUsers[i % fillUsers.length];
    const extra = Array.from({ length: sizes[i] - 1 }, (_, k) => fillUsers[(i + k + 1) % fillUsers.length]);
    const g = await createGroup(ctx, {
      name: `Familia ${ln}`,
      dependent: { firstName: fn, lastName: ln, dni: `1${String(2000000 + i * 3313).slice(0, 7)}`,
        bloodType: pick(rng, SANGRE), birthday: `194${i % 10}-0${(i % 9) + 1}-2${i % 8}` },
      ownerId: owner, memberIds: extra, createdAt: daysAgoAt(WINDOW_DAYS - i * 2, 11),
    });
    fillGroups.push({ id: g.groupId, memberIds: g.memberIds, dependentId: g.dependentId, name: `${fn} ${ln}` });
    bump('grupos'); bump('dependientes');
  }

  // Sesgo de especialidades para que el ranking del gráfico se lea claro.
  const specWeights = [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5];

  for (let day = WINDOW_DAYS; day >= 0; day--) {
    for (let k = 0; k < 3; k++) {
      const useDep = rng() < 0.45;
      const g = pick(rng, fillGroups);
      const prof = fillProfs[pick(rng, specWeights)];
      const creator = useDep
        ? { id: g.dependentId, type: 'dependent' as const, name: g.name }
        : { id: pick(rng, fillUsers), type: 'user' as const };
      const date = daysAgoAt(day, between(rng, 8, 20), pick(rng, [0, 15, 30, 45]));
      const taken = useDep && rng() < 0.55 ? pick(rng, g.memberIds) : null;
      await createEvent(ctx, {
        kind: 'appointment', date, createdAt: date, status: taken ? 'confirmed' : 'sended',
        creator, group: useDep ? { id: g.id, memberIds: g.memberIds } : undefined,
        professionalId: prof.id, professionalName: prof.name,
        description: 'Consulta', takenChargeBy: taken,
      });
      bump('turnos');
    }
    for (let k = 0; k < 4; k++) {
      const useDep = rng() < 0.5;
      const g = pick(rng, fillGroups);
      const medId = between(rng, 1, 5);
      const creator = useDep
        ? { id: g.dependentId, type: 'dependent' as const, name: g.name }
        : { id: pick(rng, fillUsers), type: 'user' as const };
      const date = daysAgoAt(day, between(rng, 8, 21), pick(rng, [0, 30]));
      const taken = useDep && rng() < 0.55 ? pick(rng, g.memberIds) : null;
      await createEvent(ctx, {
        kind: 'med_event', date, createdAt: date, status: taken ? 'confirmed' : 'sended',
        creator, group: useDep ? { id: g.id, memberIds: g.memberIds } : undefined,
        medId, medName: `Medicamento ${medId}`, takenChargeBy: taken,
      });
      bump('medicamentos');
    }
    if (day % 2 === 0) {
      const g = pick(rng, fillGroups);
      await createDocument(ctx, {
        title: pick(rng, ['Estudio de laboratorio', 'Informe médico', 'Receta', 'Ecografía']),
        creator: { id: g.dependentId, type: 'dependent' }, date: daysAgoAt(day, between(rng, 9, 18)),
      });
      bump('documentos');
    }
  }

  // Vínculos paciente-profesional para el gráfico de estados.
  // Ninguno toca a Rosa: su vinculación se hace en vivo en la reunión.
  const linkPlan: [string, number][] = [['ACCEPTED', 14], ['PENDING', 6], ['REJECTED', 4]];
  // Se arman todos los pares posibles y se barajan: asignar por módulo hacía
  // que los índices se repitieran y la mitad de los vínculos se descartaran
  // por duplicados, dejando el gráfico con casi todo en ACCEPTED.
  const pairs: { profId: number; patientId: number; type: 'user' | 'dependent' }[] = [];
  for (const prof of fillProfs) {
    for (const g of fillGroups) pairs.push({ profId: prof.id, patientId: g.dependentId, type: 'dependent' });
    for (const u of fillUsers) pairs.push({ profId: prof.id, patientId: u, type: 'user' });
  }
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  let cursor = 0;
  for (const [status, n] of linkPlan) {
    for (let i = 0; i < n; i++) {
      const pair = pairs[cursor++];
      if (!pair) break;
      const createdAt = daysAgoAt(between(rng, 0, WINDOW_DAYS), between(rng, 9, 18));
      await insert(qr, 'patient_professional', {
        professional_id: pair.profId,
        patientId: pair.patientId,
        patientType: pair.type,
        createdAt,
        status,
        resolvedAt: status === 'PENDING' ? null : addHours(createdAt, between(rng, 1, 40)),
      });
      bump('vinculaciones');
    }
  }
  // Al Dr. Ferreyra le dejamos pacientes ya aceptados para que su pantalla no
  // arranque vacía, pero ninguna solicitud pendiente: la única que va a ver es
  // la que se genere en vivo.
  for (let i = 0; i < 3; i++) {
    const g = fillGroups[i + 5];
    const createdAt = daysAgoAt(between(rng, 5, WINDOW_DAYS), 10);
    await insert(qr, 'patient_professional', {
      professional_id: ferreyra, patientId: g.dependentId, patientType: 'dependent',
      createdAt, status: 'ACCEPTED', resolvedAt: addHours(createdAt, 6),
    });
    bump('vinculaciones');
  }

  title('CUENTAS PARA LA DEMO');
  info(`responsable    Pedro Martinez        1999pedromartinez@gmail.com   (tu contraseña actual)`);
  info(`integrante     Lucía Gutiérrez       lucia.gutierrez@sigsa.demo    ${DEMO_PASSWORD}`);
  info(`integrante     Martín Gutiérrez      martin.gutierrez@sigsa.demo   ${DEMO_PASSWORD}`);
  info(`profesional    Dr. Julián Ferreyra   julian.ferreyra@sigsa.demo    ${DEMO_PASSWORD}`);
  info(`\n  dependiente de la demo: Rosa Gutiérrez, DNI ${ROSA_DNI} (sin vincular)`);
  info(`  push en vivo programado para las ${fmt(addMinutes(livePush, -5))}`);

  return summary;
}
