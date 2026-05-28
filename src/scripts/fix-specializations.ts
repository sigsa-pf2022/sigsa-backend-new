/* eslint-disable no-console */
// One-off fix: expand the specializations catalog and redistribute existing
// professionals across them so the top-specializations chart shows a ranking.
//
// Safe to re-run: specializations are upserted by unique name, and we only
// touch professional<->specialization links for profs that currently have 0
// or 1 specialization (i.e. recently seeded ones).

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

import { ProfessionalSpecialization } from '../professionals/entities/professional-specialization.entity';
import { ProfessionalUser } from '../professionals/entities/professional-user.entity';

dotenv.config();

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

// A curated subset of specializations chosen to keep the chart readable.
const CURATED_SPECS = [
  'Pediatría',
  'Cardiologia',
  'Clinica medica',
  'Dermatologia',
  'Ginecologia',
  'Oftalmología',
  'Traumatología',
  'Endocrinologia',
  'Neurología',
  'Psiquiatría',
];

// How many professionals to assign to each (drives the top-5 ranking).
const ASSIGNMENT_PLAN: Record<string, number> = {
  'Pediatría': 4,
  'Cardiologia': 3,
  'Clinica medica': 2,
  'Dermatologia': 2,
  'Ginecologia': 1,
  'Oftalmología': 1,
};

async function main(): Promise<void> {
  await ds.initialize();
  console.log('DB connected.');

  const specRepo = ds.getRepository(ProfessionalSpecialization);
  const profRepo = ds.getRepository(ProfessionalUser);

  // Upsert curated specializations
  for (const name of CURATED_SPECS) {
    const existing = await specRepo.findOne({ where: { name } });
    if (!existing) {
      await specRepo.save(specRepo.create({ name }));
      console.log(`  + ${name}`);
    }
  }
  const allSpecs = await specRepo.find({ where: { deleted: false } });
  console.log(`Catalog now has ${allSpecs.length} specializations.`);

  // Find all professionals and rewrite their specialization assignment.
  const profs = await profRepo.find({ relations: { specialization: true } });
  console.log(`Found ${profs.length} professionals.`);

  // Sort professionals deterministically (oldest first) so the assignment is reproducible.
  profs.sort((a, b) => a.id - b.id);

  // Flatten plan into an ordered list of spec names matching plan counts.
  const planQueue: string[] = [];
  for (const name of CURATED_SPECS) {
    const n = ASSIGNMENT_PLAN[name] ?? 0;
    for (let i = 0; i < n; i++) planQueue.push(name);
  }

  let profIdx = 0;
  for (const specName of planQueue) {
    if (profIdx >= profs.length) break;
    const prof = profs[profIdx++];
    const spec = allSpecs.find((s) => s.name === specName);
    if (!spec) continue;
    // Only mutate profs that have 0 or 1 specialization (skip real users).
    if ((prof.specialization?.length ?? 0) > 1) continue;
    prof.specialization = [spec];
    await profRepo.save(prof);
  }
  console.log(`Assigned specializations to ${Math.min(profIdx, profs.length)} professionals.`);

  await ds.destroy();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});
