import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Appointment } from 'src/appointments/appointment.entity';
import { mockQueryBuilder, MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { MedicalDocument } from 'src/documents/medical-document.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { FamilyGroup } from 'src/family-groups/entities/family-group.entity';
import { MedEvent } from 'src/meds/meds-event/med-event.entity';
import { PatientProfessional } from 'src/professionals/entities/patient-professional.entity';
import { ProfessionalSpecialization } from 'src/professionals/entities/professional-specialization.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { PatientProfessionalStatus } from 'src/professionals/enums/patient-professional-status.enum';
import { NormalUser } from 'src/users/entities/normal-user.entity';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repos: Record<string, MockRepository>;
  let query: jest.Mock;

  // Fechas locales: los buckets se arman en hora local.
  const from = new Date(2026, 9, 1);
  const to = new Date(2026, 9, 3, 23, 59);

  /** Responde cada consulta SQL cruda según qué tabla o qué cálculo pide. */
  const answers = (map: Array<[RegExp, any[]]>) =>
    query.mockImplementation(async (sql: string) => map.find(([re]) => re.test(sql))?.[1] ?? []);

  beforeEach(async () => {
    const entities = {
      NormalUser,
      ProfessionalUser,
      FamilyGroup,
      Dependent,
      PatientProfessional,
      Appointment,
      MedEvent,
      MedicalDocument,
      ProfessionalSpecialization,
    };
    repos = {};
    for (const name of Object.keys(entities)) {
      repos[name] = mockRepository();
      (repos[name] as any).metadata = { tableName: name.toLowerCase() };
    }
    query = jest.fn(async () => []);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        ...Object.entries(entities).map(([name, entity]) => ({
          provide: getRepositoryToken(entity),
          useValue: repos[name],
        })),
        { provide: DataSource, useValue: { query } },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  describe('getOverview', () => {
    it('junta totales del período, activos y dependientes con profesional', async () => {
      Object.values(repos).forEach((r, i) => r.count.mockResolvedValue(i + 1));
      answers([[/COUNT\(DISTINCT id\)/, [{ count: '4' }]]]);
      repos.PatientProfessional.createQueryBuilder.mockReturnValue(mockQueryBuilder({ getRawOne: { count: '2' } }));

      const result = await service.getOverview(from, to);

      expect(result).toEqual({
        totalUsers: 1,
        totalProfessionals: 2,
        totalFamilyGroups: 3,
        totalDependents: 4,
        totalPatientLinks: 5,
        totalAppointments: 6,
        totalMedEvents: 7,
        totalDocuments: 8,
        activeUsers: 4,
        activeDependents: 4,
        dependentsWithProfessionalLink: 2,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const activeCalls = query.mock.calls.filter(([sql]) => /COUNT\(DISTINCT id\)/.test(sql));
      expect(activeCalls.map(([, params]) => params[0])).toEqual(['user', 'dependent']);
    });

    it('sin filas cuenta 0', async () => {
      const result = await service.getOverview(from, to);
      expect(result).toMatchObject({ activeUsers: 0, dependentsWithProfessionalLink: 0 });
    });
  });

  describe('getEventsByPeriod', () => {
    it('hasta 31 días agrupa por día y rellena con ceros', async () => {
      answers([
        [/"appointment"/, [{ bucket: '2026-10-02', c: '3' }]],
        [/"medevent"/, [{ bucket: '2026-10-01', c: '1' }]],
      ]);
      await expect(service.getEventsByPeriod(from, to)).resolves.toEqual({
        granularity: 'day',
        labels: ['01/10', '02/10', '03/10'],
        appointments: [0, 3, 0],
        medEvents: [1, 0, 0],
        documents: [0, 0, 0],
      });
    });

    it('hasta 120 días agrupa por semana desde el lunes', async () => {
      // 1/10/2026 es jueves: la primera semana empieza el lunes 28/9.
      const result = await service.getEventsByPeriod(from, new Date(2026, 10, 15));
      expect(result.granularity).toBe('week');
      expect(result.labels[0]).toBe('28/09');
      expect(result.labels[1]).toBe('05/10');
    });

    it('una semana que arranca en domingo retrocede al lunes anterior', async () => {
      const result = await service.getEventsByPeriod(new Date(2026, 9, 4), new Date(2026, 11, 1));
      expect(result.labels[0]).toBe('28/09');
    });

    it('más de 120 días agrupa por mes', async () => {
      answers([[/"medicaldocument"/, [{ bucket: '2026-11', c: '7' }]]]);
      const result = await service.getEventsByPeriod(from, new Date(2027, 2, 10));
      expect(result.granularity).toBe('month');
      expect(result.labels).toEqual(['Oct 2026', 'Nov 2026', 'Dic 2026', 'Ene 2027', 'Feb 2027', 'Mar 2027']);
      expect(result.documents).toEqual([0, 7, 0, 0, 0, 0]);
      expect(query.mock.calls[0][0]).toContain("'YYYY-MM'");
    });

    it('corta la serie en 401 buckets como resguardo', async () => {
      const result = await service.getEventsByPeriod(new Date(2026, 0, 1), new Date(2026, 0, 1));
      expect(result.labels).toHaveLength(1);
      const buckets = (service as any).buildBuckets(new Date(2000, 0, 1), new Date(2030, 0, 1), 'day');
      expect(buckets).toHaveLength(401);
    });
  });

  describe('rankings', () => {
    it('top especialidades y top medicamentos convierten los conteos', async () => {
      const specQb = mockQueryBuilder({ getRawMany: [{ name: 'Pediatría', count: '5' }] });
      specQb.innerJoin = jest.fn(() => specQb);
      specQb.groupBy = jest.fn(() => specQb);
      specQb.addGroupBy = jest.fn(() => specQb);
      repos.Appointment.createQueryBuilder.mockReturnValue(specQb);
      await expect(service.getTopSpecializations(from, to)).resolves.toEqual({ labels: ['Pediatría'], counts: [5] });
      expect(specQb.andWhere).toHaveBeenCalledWith('spec.deleted = :d', { d: false });
      expect(specQb.limit).toHaveBeenCalledWith(5);

      const medQb = mockQueryBuilder({ getRawMany: [{ name: 'Ibuprofeno', count: '2' }, { name: 'Amoxi', count: '1' }] });
      medQb.innerJoin = jest.fn(() => medQb);
      medQb.groupBy = jest.fn(() => medQb);
      medQb.addGroupBy = jest.fn(() => medQb);
      repos.MedEvent.createQueryBuilder.mockReturnValue(medQb);
      await expect(service.getTopMeds(from, to)).resolves.toEqual({ labels: ['Ibuprofeno', 'Amoxi'], counts: [2, 1] });
      // Un tratamiento cuenta una vez por serie.
      expect(medQb.addSelect.mock.calls[0][0]).toContain('seriesId');
    });
  });

  describe('getFamilyGroupsDistribution', () => {
    it('cuenta al responsable sin duplicarlo y promedia', async () => {
      repos.FamilyGroup.find.mockResolvedValue([
        { createdBy: { id: 1 }, members: [{ id: 1 }, { id: 2 }] },
        { createdBy: { id: 3 }, members: [{ id: 4 }, { id: 5 }] },
        { createdBy: null, members: null },
        { createdBy: { id: 6 }, members: [{ id: 6 }, { id: 7 }] },
      ]);
      await expect(service.getFamilyGroupsDistribution(from, to)).resolves.toEqual({
        averageSize: 1.75,
        distribution: [
          { members: 0, count: 1 },
          { members: 2, count: 2 },
          { members: 3, count: 1 },
        ],
      });
    });

    it('sin grupos el promedio es 0', async () => {
      await expect(service.getFamilyGroupsDistribution(from, to)).resolves.toEqual({ averageSize: 0, distribution: [] });
    });
  });

  it('getPatientsLinkStatus reparte por estado e ignora estados desconocidos en el detalle', async () => {
    const qb = mockQueryBuilder({
      getRawMany: [
        { status: PatientProfessionalStatus.ACCEPTED, count: '3' },
        { status: PatientProfessionalStatus.PENDING, count: '2' },
        { status: PatientProfessionalStatus.REJECTED, count: '1' },
        { status: 'OTRO', count: '4' },
      ],
    });
    qb.groupBy = jest.fn(() => qb);
    repos.PatientProfessional.createQueryBuilder.mockReturnValue(qb);
    await expect(service.getPatientsLinkStatus(from, to)).resolves.toEqual({
      accepted: 3,
      pending: 2,
      rejected: 1,
      total: 10,
    });
  });

  describe('getCareCoordination ("Me hago cargo")', () => {
    it('cobertura, tiempos de respuesta y serie por tipo', async () => {
      answers([
        [/AS taken/, [{ total: '8', taken: '6' }]],
        [/PERCENTILE_CONT/, [{ median: '4.26', p90: '30.04', n: '5' }]],
        [
          /group_event_log/,
          [
            { bucket: '2026-10-01', target: 'appointment', c: '2' },
            { bucket: '2026-10-03', target: 'med_event', c: '3' },
            { bucket: '2026-10-03', target: 'member', c: '9' },
          ],
        ],
      ]);

      await expect(service.getCareCoordination(from, to)).resolves.toEqual({
        coverage: { totalDependentEvents: 8, takenCharge: 6, rate: 75 },
        responseMinutes: { median: 4.3, p90: 30, sampleSize: 5 },
        byType: { appointment: 2, medEvent: 3 },
        series: {
          granularity: 'day',
          labels: ['01/10', '02/10', '03/10'],
          appointments: [2, 0, 0],
          medEvents: [0, 0, 3],
        },
      });
    });

    it('sin datos: tasa 0 y tiempos null', async () => {
      answers([[/PERCENTILE_CONT/, [{ median: null, p90: null, n: '0' }]]]);
      const result = await service.getCareCoordination(from, new Date(2027, 5, 1));
      expect(result.coverage).toEqual({ totalDependentEvents: 0, takenCharge: 0, rate: 0 });
      expect(result.responseMinutes).toEqual({ median: null, p90: null, sampleSize: 0 });
      expect(result.series.granularity).toBe('month');
    });

    it('con muestra pero percentiles nulos devuelve null', async () => {
      answers([[/PERCENTILE_CONT/, [{ median: null, p90: undefined, n: '2' }]]]);
      const result = await service.getCareCoordination(from, to);
      expect(result.responseMinutes).toEqual({ median: null, p90: null, sampleSize: 2 });
    });
  });
});
