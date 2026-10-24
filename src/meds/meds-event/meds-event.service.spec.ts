import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ADHERENCE_GRACE_HOURS,
  computeAdherence,
  MedsEventService,
} from './meds-event.service';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { MedEvent } from './med-event.entity';
import { Meds } from '../meds/meds.entity';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { GroupEventsService } from 'src/group-events/group-events.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { GroupEventAction } from 'src/group-events/enums/group-event-action.enum';
import { flushPromises, MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { MAX_DOSES_PER_TREATMENT } from './dto/create-med-event.dto';

describe('MedsEventService', () => {
  let service: MedsEventService;
  let medEventRepo: MockRepository;
  let medsRepo: MockRepository;
  let familyGroups: { findByDependentId: jest.Mock };
  let notifications: {
    createForMedEventGroup: jest.Mock;
    cancelForReferences: jest.Mock;
    deleteForReferences: jest.Mock;
  };
  let groupEvents: { log: jest.Mock; assertMembership: jest.Mock };

  const HOUR = 3600_000;
  const user = Object.assign(new User(), { id: 1, firstName: 'Ana', lastName: 'Pérez' });
  const professional = Object.assign(new ProfessionalUser(), { id: 2 });
  const dependent = Object.assign(new Dependent(), { id: 10, firstName: 'Tito', lastName: 'Pérez' });
  const group = {
    id: 100,
    createdBy: { id: 1 },
    members: [{ id: 1 }, { id: 3 }],
    dependent: { firstName: 'Tito', lastName: 'Pérez' },
  };

  beforeEach(async () => {
    medEventRepo = mockRepository();
    medsRepo = mockRepository();
    familyGroups = { findByDependentId: jest.fn() };
    notifications = {
      createForMedEventGroup: jest.fn(),
      cancelForReferences: jest.fn(),
      deleteForReferences: jest.fn(),
    };
    groupEvents = { log: jest.fn(), assertMembership: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedsEventService,
        { provide: getRepositoryToken(MedEvent), useValue: medEventRepo },
        { provide: getRepositoryToken(Meds), useValue: medsRepo },
        { provide: FamilyGroupsService, useValue: familyGroups },
        { provide: NotificationsService, useValue: notifications },
        { provide: GroupEventsService, useValue: groupEvents },
      ],
    }).compile();

    service = module.get<MedsEventService>(MedsEventService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assertMedsLimit (plan gratuito)', () => {
    const doses = (n: number, seriesId?: string) =>
      Array.from({ length: n }, (_, i) => ({ id: i + 1, seriesId }));

    it('cuenta un tratamiento una sola vez aunque tenga muchas tomas', async () => {
      medEventRepo.find.mockResolvedValue([
        ...doses(30, 'serie-a'),
        ...Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, seriesId: null })),
      ]);
      // 1 tratamiento + 8 tomas únicas = 9 < 10
      await expect(service.assertMedsLimit(user, false)).resolves.toBeUndefined();
    });

    it('rechaza al llegar a 10 medicamentos activos', async () => {
      medEventRepo.find.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({ id: i, seriesId: `s-${i}` })),
      );
      await expect(service.assertMedsLimit(user, false)).rejects.toThrow(
        'Alcanzaste el límite del plan gratuito: hasta 10 medicamentos activos.',
      );
    });

    it('no limita a un usuario premium', async () => {
      medEventRepo.find.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({ id: i, seriesId: null })),
      );
      await expect(service.assertMedsLimit(user, true)).resolves.toBeUndefined();
    });

    it('cuenta por creador y tipo: dependiente y profesional', async () => {
      await service.assertMedsLimit(dependent, false);
      expect(medEventRepo.find.mock.calls[0][0].where).toMatchObject({
        createdById: 10,
        createdByType: 'dependent',
      });
      await service.assertMedsLimit(professional, false);
      expect(medEventRepo.find.mock.calls[1][0].where).toMatchObject({
        createdById: 2,
        createdByType: 'professional',
      });
    });
  });

  describe('listados', () => {
    it.each([
      ['getMedsEventsByUser', user, 'user'],
      ['getMedsEventsByDependent', dependent, 'dependent'],
      ['getNextMedsEventsByUser', professional, 'professional'],
      ['getNextMedsEventsByDependent', dependent, 'dependent'],
      ['getMedsEventsByCreator', dependent, 'dependent'],
      ['getNextMedsEventsByCreator', user, 'user'],
    ])('%s filtra por el creador correcto', async (method, creator, type) => {
      await (service as any)[method](creator);
      expect(medEventRepo.find.mock.calls[0][0].where).toMatchObject({
        createdById: creator.id,
        createdByType: type,
      });
    });

    it('getMedEventById no trae datos sensibles de las relaciones', async () => {
      await service.getMedEventById(7);
      const args = medEventRepo.findOne.mock.calls[0][0];
      expect(args.where).toEqual({ id: 7 });
      expect(args.select.takenChargeBy).toEqual({ id: true, firstName: true, lastName: true });
    });
  });

  describe('createMedEvent', () => {
    it('rechaza una fecha inválida', async () => {
      await expect(
        service.createMedEvent(user, { date: 'no-es-fecha', medId: 1 } as any),
      ).rejects.toThrow('Fecha inválida');
    });

    it('toma única de un usuario: guarda una fila y lo notifica sólo a él', async () => {
      medEventRepo.save.mockImplementation(async (e) => ({ ...e, id: 50 }));
      medsRepo.findOne.mockResolvedValue({ id: 1, name: 'Ibuprofeno' });

      const saved = await service.createMedEvent(user, {
        date: '2026-10-25T10:00:00Z',
        medId: 1,
      } as any);
      await flushPromises();

      expect(saved).toMatchObject({ id: 50, createdById: 1, createdByType: 'user' });
      expect(notifications.createForMedEventGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          medEventId: 50,
          groupId: null,
          memberUserIds: [1],
          payload: { medName: 'Ibuprofeno', dependentName: null, dependentId: null },
        }),
      );
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('tratamiento: una toma por intervalo con el mismo seriesId y devuelve la primera', async () => {
      medEventRepo.save.mockImplementation(async (list) =>
        list.map((e, i) => ({ ...e, id: 200 + i })),
      );

      const first = await service.createMedEvent(user, {
        date: '2026-10-25T08:00:00Z',
        medId: 1,
        intervalHours: 8,
        durationDays: 2,
      } as any);
      await flushPromises();

      const doses = medEventRepo.save.mock.calls[0][0];
      expect(doses).toHaveLength(6);
      expect(new Set(doses.map((d) => d.seriesId)).size).toBe(1);
      expect(doses.map((d) => d.doseIndex)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(doses[5].date.getTime() - doses[0].date.getTime()).toBe(5 * 8 * HOUR);
      expect(doses.every((d) => d.totalDoses === 6 && d.intervalHours === 8)).toBe(true);
      expect(first.id).toBe(200);
      expect(notifications.createForMedEventGroup).toHaveBeenCalledTimes(6);
    });

    it('rechaza un tratamiento más corto que la frecuencia', async () => {
      await expect(
        service.createMedEvent(user, {
          date: '2026-10-25T08:00:00Z',
          medId: 1,
          intervalHours: 48,
          durationDays: 1,
        } as any),
      ).rejects.toThrow('La duración es menor a la frecuencia elegida');
    });

    it('rechaza un tratamiento con más tomas que el máximo', async () => {
      await expect(
        service.createMedEvent(user, {
          date: '2026-10-25T08:00:00Z',
          medId: 1,
          intervalHours: 1,
          durationDays: 30,
        } as any),
      ).rejects.toThrow(`El tratamiento supera el máximo de ${MAX_DOSES_PER_TREATMENT} tomas`);
    });

    it('dependiente: notifica a todo el grupo sin repetir y registra el tratamiento una sola vez', async () => {
      familyGroups.findByDependentId.mockResolvedValue(group);
      medsRepo.findOne.mockResolvedValue({ id: 1, name: 'Amoxicilina' });
      medEventRepo.save.mockImplementation(async (list) =>
        list.map((e, i) => ({ ...e, id: 300 + i })),
      );

      await service.createMedEvent(
        dependent,
        { date: '2026-10-25T08:00:00Z', medId: 1, intervalHours: 12, durationDays: 1 } as any,
        3,
      );
      await flushPromises();

      expect(notifications.createForMedEventGroup).toHaveBeenCalledTimes(2);
      expect(notifications.createForMedEventGroup.mock.calls[0][0]).toMatchObject({
        groupId: 100,
        memberUserIds: [1, 3],
        payload: { medName: 'Amoxicilina', dependentName: 'Tito Pérez', dependentId: 10 },
      });
      expect(groupEvents.log).toHaveBeenCalledTimes(1);
      expect(groupEvents.log).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 100,
          actorUserId: 3,
          action: GroupEventAction.EVENT_CREATED,
          targetId: 300,
          payload: expect.objectContaining({ totalDoses: 2, intervalHours: 12 }),
        }),
      );
    });

    it('dependiente con toma única: registra la creación en el historial', async () => {
      familyGroups.findByDependentId.mockResolvedValue(group);
      medEventRepo.save.mockImplementation(async (e) => ({ ...e, id: 9 }));

      await service.createMedEvent(dependent, { date: '2026-10-25T08:00:00Z', medId: 1 } as any);
      await flushPromises();

      expect(groupEvents.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: null,
          payload: expect.objectContaining({ medName: 'Medicamento' }),
        }),
      );
      expect(groupEvents.log.mock.calls[0][0].payload).not.toHaveProperty('totalDoses');
    });

    it('dependiente sin grupo: guarda pero no notifica', async () => {
      familyGroups.findByDependentId.mockResolvedValue(null);
      await service.createMedEvent(dependent, { date: '2026-10-25T08:00:00Z', medId: 1 } as any);
      await flushPromises();
      expect(medEventRepo.save).toHaveBeenCalled();
      expect(notifications.createForMedEventGroup).not.toHaveBeenCalled();
    });

    it('grupo sin integrantes: no hay a quién notificar', async () => {
      familyGroups.findByDependentId.mockResolvedValue({ id: 1, createdBy: null, members: null });
      await service.createMedEvent(dependent, { date: '2026-10-25T08:00:00Z', medId: 1 } as any);
      await flushPromises();
      expect(notifications.createForMedEventGroup).not.toHaveBeenCalled();
    });

    it('un error al notificar no rompe la creación', async () => {
      notifications.createForMedEventGroup.mockRejectedValue(new Error('FCM caído'));
      medEventRepo.save.mockImplementation(async (e) => ({ ...e, id: 1 }));
      await expect(
        service.createMedEvent(user, { date: '2026-10-25T08:00:00Z', medId: 1 } as any),
      ).resolves.toMatchObject({ id: 1 });
      await flushPromises();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getMedTreatmentsByCreator', () => {
    const at = (h: number) => new Date(Date.now() + h * HOUR);

    it('agrupa por serie, calcula próxima toma, adherencia y ordena', async () => {
      medEventRepo.find.mockResolvedValue([
        // Tratamiento terminado (todo en el pasado)
        { id: 1, seriesId: 'viejo', date: at(-100), status: EventStatus.CONFIRMED, totalDoses: 2 },
        { id: 2, seriesId: 'viejo', date: at(-90), status: EventStatus.DISCARDED, totalDoses: 2 },
        // Tratamiento en curso
        { id: 3, seriesId: 'curso', date: at(-10), status: EventStatus.CONFIRMED, totalDoses: 3 },
        { id: 4, seriesId: 'curso', date: at(5), status: EventStatus.CREATED, totalDoses: 3 },
        { id: 5, seriesId: 'curso', date: at(2), status: EventStatus.CREATED, totalDoses: 3 },
        // Toma única próxima, más cercana que la del tratamiento
        { id: 6, seriesId: null, date: at(1), status: EventStatus.CREATED },
        // Toma única ya pasada, más reciente que el tratamiento viejo
        { id: 7, seriesId: null, date: at(-20), status: EventStatus.CONFIRMED },
      ]);

      const result = await service.getMedTreatmentsByCreator(user);

      expect(result.map((g) => g.seriesId ?? `single-${g.doses[0].id}`)).toEqual([
        'single-6',
        'curso',
        'single-7',
        'viejo',
      ]);
      const curso = result[1];
      expect(curso.nextDose.id).toBe(5);
      expect(curso.confirmedDoses).toBe(1);
      expect(curso.adherence).toEqual({ taken: 1, omitted: 0, pending: 2, pct: 100 });
      expect(result[0].totalDoses).toBe(1);
      expect(result[3].adherence.pct).toBe(50);
      expect(result[3].nextDose).toBeNull();
    });

    it('ajusta inicio y fin aunque las tomas no lleguen ordenadas', async () => {
      const a = at(-5);
      const b = at(-50);
      const c = at(10);
      medEventRepo.find.mockResolvedValue([
        { id: 1, seriesId: 's', date: a, status: EventStatus.CREATED },
        { id: 2, seriesId: 's', date: b, status: EventStatus.CREATED },
        { id: 3, seriesId: 's', date: c, status: EventStatus.CREATED },
      ]);
      const [g] = await service.getMedTreatmentsByCreator(dependent);
      expect(g.startsAt).toBe(b);
      expect(g.endsAt).toBe(c);
    });

    it('con dos tratamientos terminados pone primero el más reciente', async () => {
      medEventRepo.find.mockResolvedValue([
        { id: 1, seriesId: 'a', date: at(-100), status: EventStatus.CONFIRMED },
        { id: 2, seriesId: 'b', date: at(-10), status: EventStatus.CONFIRMED },
      ]);
      const result = await service.getMedTreatmentsByCreator(user);
      expect(result.map((g) => g.seriesId)).toEqual(['b', 'a']);
    });
  });

  describe('cancelTreatment', () => {
    it('no hace nada si no quedan tomas futuras', async () => {
      medEventRepo.find.mockResolvedValue([{ id: 1, date: new Date(Date.now() - HOUR) }]);
      await expect(service.cancelTreatment('s', user, 1)).resolves.toEqual({ canceled: 0 });
      expect(medEventRepo.update).not.toHaveBeenCalled();
    });

    it('cancela sólo las futuras, apaga sus avisos y lo registra una vez', async () => {
      const future1 = { id: 2, date: new Date(Date.now() + HOUR), createdByType: 'dependent', createdById: 10 };
      const future2 = { id: 3, date: new Date(Date.now() + 2 * HOUR), createdByType: 'dependent', createdById: 10 };
      medEventRepo.find.mockResolvedValue([
        { id: 1, date: new Date(Date.now() - HOUR) },
        future1,
        future2,
      ]);
      medEventRepo.findOne.mockResolvedValue({ ...future1, med: { name: 'Amoxicilina' } });
      familyGroups.findByDependentId.mockResolvedValue(group);

      await expect(service.cancelTreatment('s', dependent, 3)).resolves.toEqual({ canceled: 2 });

      const [criteria, changes] = medEventRepo.update.mock.calls[0];
      expect(criteria.id.value).toEqual([2, 3]);
      expect(changes).toMatchObject({ status: EventStatus.CANCELED, canceledByUserId: 3 });
      expect(notifications.cancelForReferences).toHaveBeenCalledWith(NotificationType.MEDICATION, [2, 3]);
      expect(groupEvents.log).toHaveBeenCalledTimes(1);
      expect(groupEvents.log.mock.calls[0][0]).toMatchObject({
        action: GroupEventAction.EVENT_CANCELED,
        payload: { medName: 'Amoxicilina', dependentName: 'Tito Pérez', treatment: true, canceledDoses: 2 },
      });
    });

    it('sin actor queda registrado como null y un error al cancelar avisos no corta', async () => {
      medEventRepo.find.mockResolvedValue([{ id: 2, date: new Date(Date.now() + HOUR), createdByType: 'user', createdById: 1 }]);
      notifications.cancelForReferences.mockRejectedValue(new Error('x'));
      await expect(service.cancelTreatment('s', user)).resolves.toEqual({ canceled: 1 });
      expect(medEventRepo.update.mock.calls[0][1].canceledByUserId).toBeNull();
      // Un evento propio no va al historial de ningún grupo
      expect(groupEvents.log).not.toHaveBeenCalled();
    });
  });

  describe('deleteMedEvent', () => {
    it('404 si no existe', async () => {
      await expect(service.deleteMedEvent(1, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no deja borrar si alguien ya se hizo cargo de alguna toma de la serie', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, seriesId: 's', createdByType: 'user', createdById: 1 });
      medEventRepo.find.mockResolvedValue([
        { id: 1, seriesId: 's' },
        { id: 2, seriesId: 's', takenChargeByUserId: 3 },
      ]);
      await expect(service.deleteMedEvent(1, 1)).rejects.toBeInstanceOf(ConflictException);
      expect(medEventRepo.remove).not.toHaveBeenCalled();
    });

    it('un usuario no puede borrar el recordatorio de otro', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'user', createdById: 1 });
      await expect(service.deleteMedEvent(1, 99)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('evento de dependiente sin grupo: prohibido', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'dependent', createdById: 10 });
      familyGroups.findByDependentId.mockResolvedValue(null);
      await expect(service.deleteMedEvent(1, 1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('evento de dependiente: exige ser del grupo', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'dependent', createdById: 10 });
      familyGroups.findByDependentId.mockResolvedValue(group);
      groupEvents.assertMembership.mockRejectedValue(new ForbiddenException());
      await expect(service.deleteMedEvent(1, 99)).rejects.toBeInstanceOf(ForbiddenException);
      expect(groupEvents.assertMembership).toHaveBeenCalledWith(100, 99);
    });

    it('borra la serie entera, la registra y limpia sus notificaciones', async () => {
      const doses = [
        { id: 1, seriesId: 's', createdByType: 'dependent', createdById: 10, med: { name: 'Amoxi' }, date: new Date() },
        { id: 2, seriesId: 's', createdByType: 'dependent', createdById: 10 },
      ];
      medEventRepo.findOne.mockResolvedValue(doses[0]);
      medEventRepo.find.mockResolvedValue(doses);
      familyGroups.findByDependentId.mockResolvedValue(group);

      await expect(service.deleteMedEvent(1, 3)).resolves.toEqual({ deleted: 2 });

      expect(groupEvents.log.mock.calls[0][0]).toMatchObject({
        action: GroupEventAction.EVENT_DELETED,
        payload: { medName: 'Amoxi', treatment: true, deletedDoses: 2 },
      });
      expect(notifications.deleteForReferences).toHaveBeenCalledWith(
        [NotificationType.MEDICATION, NotificationType.EVENT_TAKEN_CHARGE, NotificationType.EVENT_DECLINED],
        [1, 2],
      );
      expect(medEventRepo.remove).toHaveBeenCalledWith(doses);
    });

    it('toma única propia: borra aunque falle la limpieza de avisos', async () => {
      const dose = { id: 5, createdByType: 'user', createdById: 1 };
      medEventRepo.findOne.mockResolvedValue(dose);
      notifications.deleteForReferences.mockRejectedValue(new Error('x'));
      await expect(service.deleteMedEvent(5, 1)).resolves.toEqual({ deleted: 1 });
      expect(medEventRepo.remove).toHaveBeenCalledWith([dose]);
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('el historial no se escribe si el grupo desapareció, y un error al loguear no corta', async () => {
      const dose = { id: 5, createdByType: 'dependent', createdById: 10 };
      medEventRepo.findOne.mockResolvedValue(dose);
      familyGroups.findByDependentId
        .mockResolvedValueOnce(group) // assertCanDelete
        .mockRejectedValueOnce(new Error('db')); // logDeletion
      await expect(service.deleteMedEvent(5, 1)).resolves.toEqual({ deleted: 1 });
    });
  });

  describe('confirmMedEvent / skipMedEvent (registro de tomas)', () => {
    it('404 si la toma no existe', async () => {
      await expect(service.confirmMedEvent(1, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('un usuario sólo marca sus propias tomas', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'user', createdById: 1 });
      await expect(service.confirmMedEvent(1, 2)).rejects.toThrow('No podés modificar este recordatorio');
    });

    it('la toma de un dependiente sólo la marca alguien del grupo', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'dependent', createdById: 10 });
      familyGroups.findByDependentId.mockResolvedValue(group);
      await expect(service.skipMedEvent(1, 99)).rejects.toThrow(
        'No pertenecés al grupo de este dependiente',
      );
    });

    it('dependiente sin grupo: nadie puede marcar', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'dependent', createdById: 10 });
      familyGroups.findByDependentId.mockResolvedValue(null);
      await expect(service.confirmMedEvent(1, 1)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('no se marca una toma cancelada', async () => {
      medEventRepo.findOne.mockResolvedValue({
        id: 1,
        createdByType: 'user',
        createdById: 1,
        status: EventStatus.CANCELED,
      });
      await expect(service.confirmMedEvent(1, 1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('"La tomé": queda confirmada; propia no va al historial', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'user', createdById: 1 });
      await expect(service.confirmMedEvent(1, 1)).resolves.toEqual({ status: EventStatus.CONFIRMED });
      expect(medEventRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ status: EventStatus.CONFIRMED }));
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('"No la tomé" de un dependiente por un integrante: discarded y en el historial', async () => {
      medEventRepo.findOne.mockResolvedValue({
        id: 1,
        createdByType: 'dependent',
        createdById: 10,
        med: { name: 'Amoxi' },
        date: new Date(),
      });
      familyGroups.findByDependentId.mockResolvedValue(group);

      await expect(service.skipMedEvent(1, 3)).resolves.toEqual({ status: EventStatus.DISCARDED });
      expect(groupEvents.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 3,
          action: GroupEventAction.EVENT_SKIPPED,
          payload: expect.objectContaining({ medName: 'Amoxi', dependentName: 'Tito Pérez' }),
        }),
      );
    });

    it('el responsable del grupo también puede marcar, y un error del historial no corta', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'dependent', createdById: 10 });
      familyGroups.findByDependentId
        .mockResolvedValueOnce({ id: 100, createdBy: { id: 7 }, members: [] })
        .mockRejectedValueOnce(new Error('db'));
      await expect(service.confirmMedEvent(1, 7)).resolves.toEqual({ status: EventStatus.CONFIRMED });
    });

    it('si el grupo ya no existe al registrar, no se loguea', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'dependent', createdById: 10 });
      familyGroups.findByDependentId
        .mockResolvedValueOnce({ id: 100, createdBy: { id: 7 }, members: [] })
        .mockResolvedValueOnce(null);
      await service.confirmMedEvent(1, 7);
      expect(groupEvents.log).not.toHaveBeenCalled();
    });
  });

  describe('cancelMedEvent / updateMedEvent', () => {
    it('cancela, apaga el aviso y registra quién fue', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'dependent', createdById: 10, med: null });
      familyGroups.findByDependentId.mockResolvedValue({ ...group, dependent: null });

      await service.cancelMedEvent(1, 3);

      expect(medEventRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: EventStatus.CANCELED, canceledByUserId: 3 }),
      );
      expect(notifications.cancelForReferences).toHaveBeenCalledWith(NotificationType.MEDICATION, [1]);
      expect(groupEvents.log.mock.calls[0][0].payload).toMatchObject({
        medName: 'Medicamento',
        dependentName: null,
      });
    });

    it('si el evento no existe igual actualiza, pero no registra nada', async () => {
      await service.cancelMedEvent(1);
      expect(medEventRepo.update.mock.calls[0][1].canceledByUserId).toBeNull();
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('logCancellation: sin grupo no registra; con error no corta', async () => {
      medEventRepo.findOne.mockResolvedValue({ id: 1, createdByType: 'dependent', createdById: 10 });
      familyGroups.findByDependentId.mockResolvedValueOnce(null);
      await service.cancelMedEvent(1, 3);
      familyGroups.findByDependentId.mockRejectedValueOnce(new Error('db'));
      await service.cancelMedEvent(1, 3);
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('updateMedEvent traduce medId a la relación', async () => {
      await service.updateMedEvent(1, { medId: 4, date: '2026-10-25' } as any);
      expect(medEventRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ date: '2026-10-25', med: { id: 4 } }),
      );
      await service.updateMedEvent(2, { date: '2026-10-26' } as any);
      expect(medEventRepo.update.mock.calls[1][1]).not.toHaveProperty('med');
    });
  });
});

describe('computeAdherence', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  it('cuenta confirmadas como tomadas y discarded como omitidas', () => {
    const result = computeAdherence(
      [
        { status: EventStatus.CONFIRMED, date: hoursAgo(10) },
        { status: EventStatus.CONFIRMED, date: hoursAgo(5) },
        { status: EventStatus.DISCARDED, date: hoursAgo(3) },
      ],
      now,
    );
    expect(result).toEqual({ taken: 2, omitted: 1, pending: 0, pct: 67 });
  });

  it('da por omitida una toma abierta recién pasadas las 2 h de gracia', () => {
    const result = computeAdherence(
      [
        { status: EventStatus.CREATED, date: hoursAgo(ADHERENCE_GRACE_HOURS + 0.1) },
        { status: EventStatus.SENDED, date: hoursAgo(3) },
        { status: EventStatus.CREATED, date: hoursAgo(ADHERENCE_GRACE_HOURS - 0.1) },
        { status: EventStatus.SENDED, date: hoursAgo(1) },
        { status: EventStatus.CREATED, date: hoursAgo(-5) },
      ],
      now,
    );
    expect(result).toEqual({ taken: 0, omitted: 2, pending: 3, pct: 0 });
  });

  it('ignora las canceladas', () => {
    const result = computeAdherence(
      [
        { status: EventStatus.CANCELED, date: hoursAgo(10) },
        { status: EventStatus.CANCELED, date: hoursAgo(-10) },
        { status: EventStatus.CONFIRMED, date: hoursAgo(4) },
      ],
      now,
    );
    expect(result).toEqual({ taken: 1, omitted: 0, pending: 0, pct: 100 });
  });

  it('devuelve pct null cuando no hay nada que medir', () => {
    expect(computeAdherence([], now)).toEqual({ taken: 0, omitted: 0, pending: 0, pct: null });
    expect(
      computeAdherence(
        [
          { status: EventStatus.CREATED, date: hoursAgo(-1) },
          { status: EventStatus.CANCELED, date: hoursAgo(20) },
        ],
        now,
      ),
    ).toEqual({ taken: 0, omitted: 0, pending: 1, pct: null });
  });

  it('acepta fechas como string (vienen así del JSON)', () => {
    const result = computeAdherence(
      [{ status: EventStatus.CREATED, date: hoursAgo(24).toISOString() }],
      now,
    );
    expect(result.omitted).toBe(1);
  });
});
