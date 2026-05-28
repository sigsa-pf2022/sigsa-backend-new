import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { NormalUser } from 'src/users/entities/normal-user.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { FamilyGroup } from 'src/family-groups/entities/family-group.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { PatientProfessional } from 'src/professionals/entities/patient-professional.entity';
import { PatientProfessionalStatus } from 'src/professionals/enums/patient-professional-status.enum';
import { Appointment } from 'src/appointments/appointment.entity';
import { MedEvent } from 'src/meds/meds-event/med-event.entity';
import { MedicalDocument } from 'src/documents/medical-document.entity';
import { ProfessionalSpecialization } from 'src/professionals/entities/professional-specialization.entity';

const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export type BucketGranularity = 'day' | 'week' | 'month';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(NormalUser)
    private nuRepo: Repository<NormalUser>,
    @InjectRepository(ProfessionalUser)
    private puRepo: Repository<ProfessionalUser>,
    @InjectRepository(FamilyGroup)
    private fgRepo: Repository<FamilyGroup>,
    @InjectRepository(Dependent)
    private depRepo: Repository<Dependent>,
    @InjectRepository(PatientProfessional)
    private ppRepo: Repository<PatientProfessional>,
    @InjectRepository(Appointment)
    private apptRepo: Repository<Appointment>,
    @InjectRepository(MedEvent)
    private mevRepo: Repository<MedEvent>,
    @InjectRepository(MedicalDocument)
    private mdRepo: Repository<MedicalDocument>,
    @InjectRepository(ProfessionalSpecialization)
    private specRepo: Repository<ProfessionalSpecialization>,
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(from: Date, to: Date) {
    const [
      totalUsers,
      totalProfessionals,
      totalFamilyGroups,
      totalDependents,
      totalAppointments,
      totalMedEvents,
      totalDocuments,
      totalPatientLinks,
      activeUsers,
      activeDependents,
      dependentsWithProfessionalLink,
    ] = await Promise.all([
      this.nuRepo.count({ where: { createdAt: Between(from, to) } }),
      this.puRepo.count({ where: { createdAt: Between(from, to) } }),
      this.fgRepo.count({ where: { createdAt: Between(from, to) } }),
      this.depRepo.count({ where: { createdAt: Between(from, to) } }),
      this.apptRepo.count({ where: { createdAt: Between(from, to) } }),
      this.mevRepo.count({ where: { createdAt: Between(from, to) } }),
      this.mdRepo.count({ where: { createdAt: Between(from, to) } }),
      this.ppRepo.count({ where: { createdAt: Between(from, to) } }),
      this.countDistinctActiveCreators('user', from, to),
      this.countDistinctActiveCreators('dependent', from, to),
      this.countDependentsWithAcceptedLink(from, to),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalProfessionals,
      totalFamilyGroups,
      totalDependents,
      activeDependents,
      dependentsWithProfessionalLink,
      totalAppointments,
      totalMedEvents,
      totalDocuments,
      totalPatientLinks,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  async getEventsByPeriod(from: Date, to: Date) {
    const rangeDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    const granularity: BucketGranularity =
      rangeDays <= 31 ? 'day' : rangeDays <= 120 ? 'week' : 'month';

    const buckets = this.buildBuckets(from, to, granularity);

    const [appMap, medMap, docMap] = await Promise.all([
      this.queryBucketedCount(this.apptRepo.metadata.tableName, from, to, granularity),
      this.queryBucketedCount(this.mevRepo.metadata.tableName, from, to, granularity),
      this.queryBucketedCount(this.mdRepo.metadata.tableName, from, to, granularity),
    ]);

    return {
      granularity,
      labels: buckets.map((b) => b.label),
      appointments: buckets.map((b) => appMap.get(b.key) ?? 0),
      medEvents: buckets.map((b) => medMap.get(b.key) ?? 0),
      documents: buckets.map((b) => docMap.get(b.key) ?? 0),
    };
  }

  async getTopSpecializations(from: Date, to: Date) {
    // "Most active specialties in the period" = count appointments in the
    // range, grouped by the appointment's professional's specialization.
    const rows = await this.apptRepo
      .createQueryBuilder('a')
      .innerJoin('a.professional', 'p')
      .innerJoin('p.specialization', 'spec')
      .where('a.createdAt BETWEEN :from AND :to', { from, to })
      .andWhere('spec.deleted = :d', { d: false })
      .select('spec.name', 'name')
      .addSelect('COUNT(a.id)', 'count')
      .groupBy('spec.id')
      .addGroupBy('spec.name')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany<{ name: string; count: string }>();

    return {
      labels: rows.map((r) => r.name),
      counts: rows.map((r) => parseInt(r.count, 10)),
    };
  }

  async getFamilyGroupsDistribution(from: Date, to: Date) {
    const groups = await this.fgRepo.find({
      where: { createdAt: Between(from, to) },
      relations: { members: true, createdBy: true },
    });

    const sizeFreq = new Map<number, number>();
    let totalSize = 0;
    for (const g of groups) {
      const ids = new Set<number>();
      if (g.createdBy?.id) ids.add(g.createdBy.id);
      (g.members || []).forEach((m) => m?.id && ids.add(m.id));
      const size = ids.size;
      sizeFreq.set(size, (sizeFreq.get(size) ?? 0) + 1);
      totalSize += size;
    }
    const averageSize = groups.length
      ? +(totalSize / groups.length).toFixed(2)
      : 0;
    const distribution = Array.from(sizeFreq.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([members, count]) => ({ members, count }));

    return { averageSize, distribution };
  }

  async getPatientsLinkStatus(from: Date, to: Date) {
    const rows = await this.ppRepo
      .createQueryBuilder('pp')
      .select('pp.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('pp.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('pp.status')
      .getRawMany<{ status: string; count: string }>();

    const result = { accepted: 0, pending: 0, rejected: 0, total: 0 };
    for (const r of rows) {
      const n = parseInt(r.count, 10);
      result.total += n;
      if (r.status === PatientProfessionalStatus.ACCEPTED) result.accepted = n;
      else if (r.status === PatientProfessionalStatus.PENDING) result.pending = n;
      else if (r.status === PatientProfessionalStatus.REJECTED) result.rejected = n;
    }
    return result;
  }

  private async countDistinctActiveCreators(
    creatorType: 'user' | 'dependent',
    from: Date,
    to: Date,
  ): Promise<number> {
    const apptT = this.apptRepo.metadata.tableName;
    const medT = this.mevRepo.metadata.tableName;
    const docT = this.mdRepo.metadata.tableName;
    // Each entity has its own per-table enum for "createdByType"; cast to text
    // before UNION to avoid Postgres type mismatch.
    const rows: { count: string }[] = await this.dataSource.query(
      `SELECT COUNT(DISTINCT id) AS count FROM (
         SELECT "createdById" AS id FROM "${apptT}"
           WHERE "createdByType"::text = $1
             AND "createdAt" BETWEEN $2 AND $3
             AND "createdById" IS NOT NULL
         UNION
         SELECT "createdById" AS id FROM "${medT}"
           WHERE "createdByType"::text = $1
             AND "createdAt" BETWEEN $2 AND $3
             AND "createdById" IS NOT NULL
         UNION
         SELECT "createdById" AS id FROM "${docT}"
           WHERE "createdByType"::text = $1
             AND "createdAt" BETWEEN $2 AND $3
             AND "createdById" IS NOT NULL
       ) AS u`,
      [creatorType, from.toISOString(), to.toISOString()],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  private async countDependentsWithAcceptedLink(from: Date, to: Date): Promise<number> {
    const row = await this.ppRepo
      .createQueryBuilder('pp')
      .select('COUNT(DISTINCT pp.patientId)', 'count')
      .where('pp.patientType = :pt', { pt: 'dependent' })
      .andWhere('pp.status = :st', { st: PatientProfessionalStatus.ACCEPTED })
      .andWhere('pp.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne<{ count: string }>();
    return parseInt(row?.count ?? '0', 10);
  }

  private buildBuckets(
    from: Date,
    to: Date,
    granularity: BucketGranularity,
  ): { key: string; label: string }[] {
    const buckets: { key: string; label: string }[] = [];
    const cursor = this.truncDate(from, granularity);
    const endTrunc = this.truncDate(to, granularity);
    while (cursor.getTime() <= endTrunc.getTime()) {
      buckets.push({
        key: this.bucketKey(cursor, granularity),
        label: this.bucketLabel(cursor, granularity),
      });
      this.advanceCursor(cursor, granularity);
      // Safety cap to avoid runaway loops
      if (buckets.length > 400) break;
    }
    return buckets;
  }

  private truncDate(d: Date, g: BucketGranularity): Date {
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (g === 'day') return dt;
    if (g === 'week') {
      // ISO week starts on Monday: shift back to Monday
      const dow = dt.getDay(); // 0 = Sunday
      const offset = dow === 0 ? -6 : 1 - dow;
      dt.setDate(dt.getDate() + offset);
      return dt;
    }
    // month
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private advanceCursor(c: Date, g: BucketGranularity): void {
    if (g === 'day') c.setDate(c.getDate() + 1);
    else if (g === 'week') c.setDate(c.getDate() + 7);
    else c.setMonth(c.getMonth() + 1);
  }

  private bucketKey(d: Date, g: BucketGranularity): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (g === 'month') return `${y}-${m}`;
    return `${y}-${m}-${day}`;
  }

  private bucketLabel(d: Date, g: BucketGranularity): string {
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS_ES[d.getMonth()];
    if (g === 'day') return `${day}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (g === 'week') return `${day}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${month} ${d.getFullYear()}`;
  }

  private async queryBucketedCount(
    tableName: string,
    from: Date,
    to: Date,
    g: BucketGranularity,
  ): Promise<Map<string, number>> {
    const format =
      g === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const truncUnit = g; // 'day' | 'week' | 'month'
    const rows: { bucket: string; c: string }[] = await this.dataSource.query(
      `SELECT TO_CHAR(DATE_TRUNC('${truncUnit}', "createdAt"), '${format}') AS bucket,
              COUNT(*) AS c
         FROM "${tableName}"
        WHERE "createdAt" BETWEEN $1 AND $2
        GROUP BY 1`,
      [from.toISOString(), to.toISOString()],
    );
    return new Map(rows.map((r) => [r.bucket, parseInt(r.c, 10)]));
  }
}
