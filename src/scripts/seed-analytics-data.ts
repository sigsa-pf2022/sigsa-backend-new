/* eslint-disable no-console */
// Standalone seeder to populate the local DB with enough data so the
// backoffice analytics dashboard becomes meaningful.
//
// Run with: npm run seed:analytics-data
// Idempotency: re-running will create duplicates (intentionally — unique
// columns like email/dni are namespaced with a per-run prefix).

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { hashSync } from 'bcrypt';
import * as dotenv from 'dotenv';

import { NormalUser } from '../users/entities/normal-user.entity';
import { ProfessionalUser } from '../professionals/entities/professional-user.entity';
import { ProfessionalSpecialization } from '../professionals/entities/professional-specialization.entity';
import { FamilyGroup } from '../family-groups/entities/family-group.entity';
import { Dependent } from '../family-groups/entities/dependent.entity';
import { PatientProfessional } from '../professionals/entities/patient-professional.entity';
import { PatientProfessionalStatus } from '../professionals/enums/patient-professional-status.enum';
import { Appointment } from '../appointments/appointment.entity';
import { MedEvent } from '../meds/meds-event/med-event.entity';
import { MedicalDocument } from '../documents/medical-document.entity';
import { Role } from '../roles/enums/role.enum';

dotenv.config();

const RUN_TAG = Date.now().toString(36); // unique suffix per run to avoid email/dni collisions
const PASSWORD_HASH = hashSync('Test1234!', 10);

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'sigsa_db',
  entities: [`${__dirname}/../**/*.entity.{ts,js}`],
  synchronize: false,
  logging: false,
});

function weightedRandomDaysAgo(): number {
  // 50% of events fall in the last 30 days, 30% in 30-90 days, 20% in 90-180 days.
  const r = Math.random();
  if (r < 0.5) return Math.random() * 30;
  if (r < 0.8) return 30 + Math.random() * 60;
  return 90 + Math.random() * 90;
}

function pastDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 86400000);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main(): Promise<void> {
  await ds.initialize();
  console.log('DB connected.');

  // ---- Specializations: ensure we have some to assign ----
  const specRepo = ds.getRepository(ProfessionalSpecialization);
  let specs = await specRepo.find({ where: { deleted: false } });
  if (specs.length === 0) {
    throw new Error(
      'No specializations found. Run `npm run seed` first to populate the catalog.',
    );
  }
  console.log(`Found ${specs.length} specializations.`);

  // ---- Professionals (~12) ----
  // Distribute so the top 5 chart shows a clear ranking.
  const profRepo = ds.getRepository(ProfessionalUser);
  const profs: ProfessionalUser[] = [];
  // Pick 6 specs to assign professionals to, with varied frequency.
  const targetSpecs = specs.slice(0, 6);
  const specAssignmentPlan: ProfessionalSpecialization[][] = [
    [targetSpecs[0]], // Pediatría heavy
    [targetSpecs[0]],
    [targetSpecs[0]],
    [targetSpecs[0]],
    [targetSpecs[1]], // Cardiología
    [targetSpecs[1]],
    [targetSpecs[1]],
    [targetSpecs[2]], // Clínica
    [targetSpecs[2]],
    [targetSpecs[3]], // Dermatología
    [targetSpecs[4]], // ...
    [targetSpecs[5]],
  ];

  for (let i = 0; i < specAssignmentPlan.length; i++) {
    const createdAt = pastDate(150 - i * 8);
    const prof = profRepo.create({
      firstName: `Profesional${i + 1}`,
      lastName: `Apellido${i + 1}`,
      dni: `40${RUN_TAG}${String(i).padStart(2, '0')}`.slice(0, 20),
      email: `prof_${RUN_TAG}_${i + 1}@test.com`,
      password: PASSWORD_HASH,
      gender: i % 2 === 0 ? 'M' : 'F',
      birthday: new Date(1970 + (i % 25), i % 12, ((i * 3) % 27) + 1),
      emailVerified: true,
      licenseNumber: 200000 + parseInt(RUN_TAG, 36) % 10000 + i,
      specialization: specAssignmentPlan[i],
      jurisdiction: [],
      role: Role.Professional,
      createdAt,
    } as Partial<ProfessionalUser>);
    profs.push(await profRepo.save(prof));
  }
  console.log(`Created ${profs.length} professionals.`);

  // ---- Normal users (~32) ----
  const userRepo = ds.getRepository(NormalUser);
  const users: NormalUser[] = [];
  for (let i = 0; i < 32; i++) {
    const createdAt = pastDate(170 - i * 5);
    const u = userRepo.create({
      firstName: `Usuario${i + 1}`,
      lastName: `Apellido${i + 1}`,
      dni: `30${RUN_TAG}${String(i).padStart(2, '0')}`.slice(0, 20),
      email: `user_${RUN_TAG}_${i + 1}@test.com`,
      password: PASSWORD_HASH,
      gender: i % 2 === 0 ? 'M' : 'F',
      birthday: new Date(1980 + (i % 25), i % 12, ((i * 7) % 27) + 1),
      emailVerified: true,
      role: Role.User,
      createdAt,
    } as Partial<NormalUser>);
    users.push(await userRepo.save(u));
  }
  console.log(`Created ${users.length} normal users.`);

  // ---- Dependents (~22) ----
  const depRepo = ds.getRepository(Dependent);
  const deps: Dependent[] = [];
  const bloodTypes: any[] = ['A+', 'O+', 'B+', 'AB+', 'A-', 'O-', 'B-', 'AB-'];
  for (let i = 0; i < 22; i++) {
    const d = depRepo.create({
      firstName: `Dependiente${i + 1}`,
      lastName: `Apellido${i + 1}`,
      dni: `50${RUN_TAG}${String(i).padStart(2, '0')}`.slice(0, 20),
      bloodType: bloodTypes[i % bloodTypes.length],
      birthday: new Date(2005 + (i % 15), i % 12, ((i * 5) % 27) + 1),
    });
    deps.push(await depRepo.save(d));
  }
  console.log(`Created ${deps.length} dependents.`);

  // ---- Family groups (~15) with varied sizes ----
  // sizes = createdBy + extra members. Picked to spread the distribution chart.
  const fgRepo = ds.getRepository(FamilyGroup);
  const fgSizes = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4];
  let depCursor = 0;
  for (let g = 0; g < fgSizes.length; g++) {
    const size = fgSizes[g];
    const createdBy = users[g % users.length];
    const additional: NormalUser[] = [];
    for (let m = 1; m < size; m++) {
      const candidate = users[(g + m * 7 + 3) % users.length];
      if (candidate.id !== createdBy.id && !additional.find((u) => u.id === candidate.id)) {
        additional.push(candidate);
      }
    }
    const fg = fgRepo.create({
      name: `Familia ${createdBy.lastName} ${g + 1}`,
      dependent: deps[depCursor++ % deps.length],
      createdBy,
      members: additional,
    });
    await fgRepo.save(fg);
  }
  console.log(`Created ${fgSizes.length} family groups.`);

  // ---- PatientProfessional links (~30) with mixed statuses ----
  const ppRepo = ds.getRepository(PatientProfessional);
  type LinkSpec = { count: number; status: PatientProfessionalStatus; type: 'user' | 'dependent' };
  const linkPlan: LinkSpec[] = [
    { count: 10, status: PatientProfessionalStatus.ACCEPTED, type: 'user' },
    { count: 3, status: PatientProfessionalStatus.PENDING, type: 'user' },
    { count: 2, status: PatientProfessionalStatus.REJECTED, type: 'user' },
    { count: 9, status: PatientProfessionalStatus.ACCEPTED, type: 'dependent' },
    { count: 5, status: PatientProfessionalStatus.PENDING, type: 'dependent' },
    { count: 2, status: PatientProfessionalStatus.REJECTED, type: 'dependent' },
  ];
  const seenPairs = new Set<string>();
  let totalLinks = 0;
  for (const spec of linkPlan) {
    const pool: { id: number }[] = spec.type === 'user' ? users : deps;
    let attempts = 0;
    let created = 0;
    while (created < spec.count && attempts < spec.count * 10) {
      attempts++;
      const patient = pick(pool);
      const professional = pick(profs);
      const key = `${professional.id}-${patient.id}-${spec.type}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const link = ppRepo.create({
        professional,
        patientId: patient.id,
        patientType: spec.type,
        status: spec.status,
        resolvedAt:
          spec.status === PatientProfessionalStatus.PENDING ? null : pastDate(Math.random() * 60),
        createdAt: pastDate(60 + Math.random() * 120),
      });
      await ppRepo.save(link);
      created++;
      totalLinks++;
    }
  }
  console.log(`Created ${totalLinks} patient-professional links.`);

  // ---- Events (appointments, med events, documents) spread across 6 months ----
  const apptRepo = ds.getRepository(Appointment);
  const mevRepo = ds.getRepository(MedEvent);
  const mdRepo = ds.getRepository(MedicalDocument);

  type Creator = { id: number; type: 'user' | 'dependent' };
  const creators: Creator[] = [
    ...users.map((u) => ({ id: u.id, type: 'user' as const })),
    ...deps.map((d) => ({ id: d.id, type: 'dependent' as const })),
  ];

  const TARGET_APPTS = 90;
  const TARGET_MEDS = 110;
  const TARGET_DOCS = 70;

  for (let i = 0; i < TARGET_APPTS; i++) {
    const daysAgo = weightedRandomDaysAgo();
    const createdAt = pastDate(daysAgo);
    const date = new Date(createdAt.getTime() + Math.random() * 14 * 86400000);
    const c = pick(creators);
    const a = apptRepo.create({
      date,
      createdAt,
      updatedAt: createdAt,
      createdById: c.id,
      createdByType: c.type,
      description: pick([
        'Consulta de control',
        'Estudios de rutina',
        'Seguimiento clínico',
        'Consulta especialidad',
      ]),
      professional: pick(profs),
    } as Partial<Appointment>);
    await apptRepo.save(a);
  }
  console.log(`Created ${TARGET_APPTS} appointments.`);

  for (let i = 0; i < TARGET_MEDS; i++) {
    const daysAgo = weightedRandomDaysAgo();
    const createdAt = pastDate(daysAgo);
    const date = new Date(createdAt.getTime() + Math.random() * 14 * 86400000);
    const c = pick(creators);
    const m = mevRepo.create({
      date,
      createdAt,
      updatedAt: createdAt,
      createdById: c.id,
      createdByType: c.type,
    } as Partial<MedEvent>);
    await mevRepo.save(m);
  }
  console.log(`Created ${TARGET_MEDS} med events.`);

  for (let i = 0; i < TARGET_DOCS; i++) {
    const daysAgo = weightedRandomDaysAgo();
    const createdAt = pastDate(daysAgo);
    const c = pick(creators);
    const doc = mdRepo.create({
      title: pick(['Análisis de sangre', 'Radiografía', 'Receta médica', 'Estudio cardiológico']),
      description: 'Documento de prueba para dashboard',
      fileContent: 'JVBERi0xLjQKJeLjz9MK', // tiny base64 placeholder
      fileName: `documento-${RUN_TAG}-${i}.pdf`,
      mimeType: 'application/pdf',
      fileSize: 10240 + i * 17,
      documentDate: createdAt,
      date: createdAt,
      createdAt,
      updatedAt: createdAt,
      createdById: c.id,
      createdByType: c.type,
    } as Partial<MedicalDocument>);
    await mdRepo.save(doc);
  }
  console.log(`Created ${TARGET_DOCS} medical documents.`);

  await ds.destroy();
  console.log('\nDone. Reload the dashboard to see populated KPIs and charts.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
