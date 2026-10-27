import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compareSync } from 'bcrypt';
import { Appointment } from 'src/appointments/appointment.entity';
import { mockQueryBuilder, MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { DocumentsService } from 'src/documents/documents.service';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { GroupEventAction } from 'src/group-events/enums/group-event-action.enum';
import { GroupEventsService } from 'src/group-events/group-events.service';
import { MedEvent } from 'src/meds/meds-event/med-event.entity';
import { MedsEventService } from 'src/meds/meds-event/meds-event.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { Role } from 'src/roles/enums/role.enum';
import { UsersService } from 'src/users/users.service';
import { Professionals } from './entities/my-professional.entity';
import { PatientProfessional } from './entities/patient-professional.entity';
import { ProfessionalNote } from './entities/professional-note.entity';
import { ProfessionalSpecialization } from './entities/professional-specialization.entity';
import { ProfessionalUser } from './entities/professional-user.entity';
import { PatientProfessionalStatus } from './enums/patient-professional-status.enum';
import { ProfessionalsService } from './professionals.service';

describe('ProfessionalsService', () => {
  let service: ProfessionalsService;
  let professionalRepo: MockRepository;
  let myProfessionalsRepo: MockRepository;
  let specializationsRepo: MockRepository;
  let linkRepo: MockRepository;
  let noteRepo: MockRepository;
  let appointmentRepo: MockRepository;
  let medEventRepo: MockRepository;
  let userLookupRepo: { findOne: jest.Mock };
  let documents: { getDocumentsByPatient: jest.Mock };
  let users: { getUserById: jest.Mock };
  let familyGroups: { getDependentById: jest.Mock; findByDependentId: jest.Mock };
  let notifications: { createForProfessionalLinkRequest: jest.Mock; createForProfessionalNote: jest.Mock };
  let medsEvents: { getMedTreatmentsByCreator: jest.Mock };
  let groupEvents: { log: jest.Mock };

  const HOUR = 3600_000;
  const PRO = 40;
  const dependent = { id: 10, firstName: 'Tito', lastName: 'Pérez', dni: '50', birthday: '2018-01-01', bloodType: 'A+' };
  const patientUser = { id: 1, firstName: 'Ana', lastName: 'Pérez', dni: '30', birthday: '1990-01-01', gender: 'F' };
  const group = { id: 100, createdBy: { id: 1 }, members: [{ id: 1 }, { id: 2 }] };
  const acceptedLink = (patientType = 'user', patientId = 1) => ({
    id: 500,
    professionalId: PRO,
    patientId,
    patientType,
    status: PatientProfessionalStatus.ACCEPTED,
    createdAt: new Date('2026-10-01'),
    resolvedAt: new Date('2026-10-02'),
  });

  beforeEach(async () => {
    professionalRepo = mockRepository();
    myProfessionalsRepo = mockRepository();
    specializationsRepo = mockRepository();
    linkRepo = mockRepository();
    noteRepo = mockRepository();
    appointmentRepo = mockRepository();
    medEventRepo = mockRepository();
    userLookupRepo = { findOne: jest.fn() };
    professionalRepo.manager = { getRepository: jest.fn(() => userLookupRepo) };
    documents = { getDocumentsByPatient: jest.fn() };
    users = { getUserById: jest.fn() };
    familyGroups = { getDependentById: jest.fn(), findByDependentId: jest.fn() };
    notifications = { createForProfessionalLinkRequest: jest.fn(), createForProfessionalNote: jest.fn() };
    medsEvents = { getMedTreatmentsByCreator: jest.fn(async () => []) };
    groupEvents = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalsService,
        { provide: getRepositoryToken(ProfessionalUser), useValue: professionalRepo },
        { provide: getRepositoryToken(Professionals), useValue: myProfessionalsRepo },
        { provide: getRepositoryToken(ProfessionalSpecialization), useValue: specializationsRepo },
        { provide: getRepositoryToken(PatientProfessional), useValue: linkRepo },
        { provide: getRepositoryToken(ProfessionalNote), useValue: noteRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(MedEvent), useValue: medEventRepo },
        { provide: DocumentsService, useValue: documents },
        { provide: UsersService, useValue: users },
        { provide: FamilyGroupsService, useValue: familyGroups },
        { provide: NotificationsService, useValue: notifications },
        { provide: MedsEventService, useValue: medsEvents },
        { provide: GroupEventsService, useValue: groupEvents },
      ],
    }).compile();

    service = module.get(ProfessionalsService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('"Mis profesionales" (límite del plan gratuito)', () => {
    const user = { id: 1, premium: false } as any;

    it('agrega mientras no llegó al tope', async () => {
      myProfessionalsRepo.count.mockResolvedValue(9);
      await expect(
        service.createMyProfessional({ firstName: 'Dra', lastName: 'Ruiz' } as any, user),
      ).resolves.toMatchObject({ createdBy: user, firstName: 'Dra' });
    });

    it('rechaza el undécimo', async () => {
      myProfessionalsRepo.count.mockResolvedValue(10);
      await expect(service.createMyProfessional({} as any, user)).rejects.toThrow(
        'Alcanzaste el límite del plan gratuito: hasta 10 profesionales en "Mis profesionales".',
      );
      expect(myProfessionalsRepo.save).not.toHaveBeenCalled();
    });

    it('un premium no tiene tope', async () => {
      myProfessionalsRepo.count.mockResolvedValue(30);
      await expect(service.createMyProfessional({} as any, { ...user, premium: true })).resolves.toBeDefined();
    });

    it('consultas', async () => {
      await service.getMyProfessionalById(3);
      await service.getMyProfessionalsByUser(user);
      await service.getMyProfessionals();
      expect(myProfessionalsRepo.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(myProfessionalsRepo.find).toHaveBeenCalledWith({ where: { createdBy: { id: 1 } } });
    });
  });

  describe('searchProfessionals', () => {
    it('pone primero a los vinculados, filtra y conserva el orden de la página', async () => {
      linkRepo.find.mockResolvedValue([{ professionalId: 8 }]);
      const qb = mockQueryBuilder({ getCount: 2, getRawMany: [{ id: '8' }, { id: '5' }] });
      professionalRepo.createQueryBuilder.mockReturnValue(qb);
      professionalRepo.find.mockResolvedValue([
        { id: 5, firstName: 'Bruno', lastName: 'Álvarez', licenseNumber: 'MP5', specialization: [] },
        { id: 8, firstName: 'Julia', lastName: 'Ruiz', licenseNumber: 'MP8', specialization: [{ id: 1 }] },
      ]);

      const result = await service.searchProfessionals({
        userId: 1,
        patient: { id: 10, type: 'dependent' },
        search: 'ruiz',
        specializationId: 1,
        page: 0,
      });

      expect(linkRepo.find.mock.calls[0][0].where).toEqual({
        patientId: 10,
        patientType: 'dependent',
        status: PatientProfessionalStatus.ACCEPTED,
      });
      expect(qb.where).toHaveBeenCalledWith('p.id != :userId', { userId: 1 });
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
      expect(qb.setParameter).toHaveBeenCalledWith('linkedIds', [8]);
      expect(qb.limit).toHaveBeenCalledWith(20);
      expect(result.total).toBe(2);
      expect(result.data.map((p) => [p.id, p.linked])).toEqual([
        [8, true],
        [5, false],
      ]);
    });

    it('sin resultados no carga profesionales', async () => {
      professionalRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder());
      await expect(
        service.searchProfessionals({ userId: 1, patient: { id: 1, type: 'user' } }),
      ).resolves.toEqual({ data: [], total: 0 });
      expect(professionalRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('assertBelongsToDependentGroup', () => {
    it('404 si el dependiente no tiene grupo', async () => {
      await expect(service.assertBelongsToDependentGroup(1, 10)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('acepta al responsable y a los integrantes, rechaza al resto', async () => {
      familyGroups.findByDependentId.mockResolvedValue({ id: 100, createdBy: { id: 1 }, members: [{ id: 2 }] });
      await expect(service.assertBelongsToDependentGroup(1, 10)).resolves.toBeUndefined();
      await expect(service.assertBelongsToDependentGroup(2, 10)).resolves.toBeUndefined();
      await expect(service.assertBelongsToDependentGroup(3, 10)).rejects.toBeInstanceOf(ForbiddenException);
      familyGroups.findByDependentId.mockResolvedValue({ id: 100, createdBy: null, members: null });
      await expect(service.assertBelongsToDependentGroup(3, 10)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('backoffice: profesionales y especialidades', () => {
    it('listados paginados y consultas', async () => {
      await service.getProfessionalsDashboard(1, 5, 'Ju', undefined);
      expect(professionalRepo.findAndCount.mock.calls[0][0]).toMatchObject({ take: 5, skip: 5 });
      await service.getProfessionalsSpecializations(0, 10, 'false', 'Card');
      expect(specializationsRepo.findAndCount.mock.calls[0][0]).toMatchObject({ take: 10, skip: 0 });
      await service.getAllProfessionalsSpecializations();
      await service.getProfessionalsSpecializationById(2);
      await service.getProfessionalsSpecializationByName('Cardiología');
      await service.getProfessionalById(4);
      await service.getMonthlyProfessionalsQuantity();
      expect(specializationsRepo.findOneBy).toHaveBeenCalledWith({ id: 2 });
      expect(specializationsRepo.findOneBy).toHaveBeenCalledWith({ name: 'Cardiología' });
      expect(professionalRepo.findOne).toHaveBeenCalledWith({ where: { id: 4 } });
    });

    it('alta, edición y baja lógica de especialidades', async () => {
      await service.createSpecialization({ name: 'Pediatría' } as any);
      expect(specializationsRepo.save).toHaveBeenCalledWith({ name: 'Pediatría' });
      await service.updateSpecialization(2, { name: 'X', description: 'Y', extra: 'no' });
      expect(specializationsRepo.update).toHaveBeenCalledWith({ id: 2 }, { name: 'X', description: 'Y' });
      await service.toggleStatusSpecialization(2, true);
      expect(specializationsRepo.update).toHaveBeenCalledWith({ id: 2 }, { deleted: true });
    });

    it('createProfessional rechaza email o DNI repetido', async () => {
      userLookupRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.createProfessional({ email: 'A@x.com', dni: '1', password: 'x' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userLookupRepo.findOne).toHaveBeenCalledWith({ where: [{ email: 'a@x.com' }, { dni: '1' }] });
    });

    it('createProfessional normaliza el email, hashea la clave y asigna el rol', async () => {
      const saved: any = await service.createProfessional({
        email: '  Julia@Mail.com ',
        dni: '1',
        password: 'secreta',
      } as any);
      expect(saved.email).toBe('julia@mail.com');
      expect(saved.role).toBe(Role.Professional);
      expect(saved.password).not.toBe('secreta');
      expect(compareSync('secreta', saved.password)).toBe(true);
      expect(saved.verificationCode).toBeGreaterThanOrEqual(100000);
    });
  });

  describe('linkPatient (solicitud de vinculación)', () => {
    it('no duplica una solicitud existente', async () => {
      linkRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.linkPatient(PRO, { patientId: 1, patientType: 'user' } as any),
      ).rejects.toThrow('El paciente ya está vinculado');
    });

    it('dependiente inexistente: 404', async () => {
      await expect(
        service.linkPatient(PRO, { patientId: 10, patientType: 'dependent' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('dependiente: queda PENDIENTE y se avisa al grupo', async () => {
      familyGroups.getDependentById.mockResolvedValue(dependent);
      familyGroups.findByDependentId.mockResolvedValue(group);
      linkRepo.save.mockImplementation(async (l) => ({ ...l, id: 77 }));
      professionalRepo.findOne.mockResolvedValue({ firstName: 'Julia', lastName: 'Ruiz' });

      const saved = await service.linkPatient(PRO, { patientId: 10, patientType: 'dependent' } as any);

      expect(saved).toMatchObject({ id: 77, status: PatientProfessionalStatus.PENDING, patientType: 'dependent' });
      expect(notifications.createForProfessionalLinkRequest).toHaveBeenCalledWith({
        patientProfessionalId: 77,
        memberUserIds: [1, 2],
        payload: { professionalName: 'Julia Ruiz', dependentName: 'Tito Pérez' },
      });
    });

    it('dependiente sin grupo o sin integrantes: se guarda sin avisar', async () => {
      familyGroups.getDependentById.mockResolvedValue(dependent);
      await service.linkPatient(PRO, { patientId: 10, patientType: 'dependent' } as any);
      familyGroups.findByDependentId.mockResolvedValue({ id: 1, members: null });
      await service.linkPatient(PRO, { patientId: 10, patientType: 'dependent' } as any);
      expect(linkRepo.save).toHaveBeenCalledTimes(2);
      expect(notifications.createForProfessionalLinkRequest).not.toHaveBeenCalled();
    });

    it('profesional no encontrado: el aviso dice "Un profesional"', async () => {
      familyGroups.getDependentById.mockResolvedValue(dependent);
      familyGroups.findByDependentId.mockResolvedValue(group);
      await service.linkPatient(PRO, { patientId: 10, patientType: 'dependent' } as any);
      await service.linkPatient(PRO, { patientId: 1, patientType: 'user' } as any);
      const calls = notifications.createForProfessionalLinkRequest.mock.calls;
      expect(calls[0][0].payload.professionalName).toBe('Un profesional');
      expect(calls[1][0].payload.professionalName).toBe('Un profesional');
    });

    it('titular: también queda PENDIENTE hasta que lo acepte y se le avisa sólo a él', async () => {
      linkRepo.save.mockImplementation(async (l) => ({ ...l, id: 78 }));
      professionalRepo.findOne.mockResolvedValue({ firstName: 'Julia', lastName: 'Ruiz' });

      const saved = await service.linkPatient(PRO, { patientId: 1, patientType: 'user' } as any);

      expect(saved.status).toBe(PatientProfessionalStatus.PENDING);
      expect(notifications.createForProfessionalLinkRequest).toHaveBeenCalledWith({
        patientProfessionalId: 78,
        memberUserIds: [1],
        payload: { professionalName: 'Julia Ruiz' },
      });
    });

    it('titular: si falla el aviso la solicitud igual queda creada', async () => {
      notifications.createForProfessionalLinkRequest.mockRejectedValue(new Error('fcm'));
      await expect(
        service.linkPatient(PRO, { patientId: 1, patientType: 'user' } as any),
      ).resolves.toMatchObject({ status: PatientProfessionalStatus.PENDING });
    });
  });

  describe('unlinkPatient', () => {
    it('404 si no hay vínculo', async () => {
      await expect(service.unlinkPatient(PRO, 1, 'user')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('borra el vínculo', async () => {
      const link = acceptedLink();
      linkRepo.findOne.mockResolvedValue(link);
      await service.unlinkPatient(PRO, 1, 'user');
      expect(linkRepo.remove).toHaveBeenCalledWith(link);
    });
  });

  describe('assertAcceptedLink (consentimiento)', () => {
    it('exige el tipo de paciente para no confundir usuario 7 con dependiente 7', async () => {
      await expect(service.assertAcceptedLink(PRO, 7, undefined)).rejects.toBeInstanceOf(BadRequestException);
      expect(linkRepo.findOne).not.toHaveBeenCalled();
    });

    it('sin vínculo: prohibido', async () => {
      await expect(service.assertAcceptedLink(PRO, 7, 'user')).rejects.toThrow('No tiene vínculo con este paciente');
    });

    it('vínculo pendiente o rechazado: prohibido', async () => {
      linkRepo.findOne.mockResolvedValue({ ...acceptedLink(), status: PatientProfessionalStatus.PENDING });
      await expect(service.assertAcceptedLink(PRO, 1, 'user')).rejects.toThrow(
        'La vinculación aún no fue aprobada por el responsable',
      );
      linkRepo.findOne.mockResolvedValue({ ...acceptedLink(), status: PatientProfessionalStatus.REJECTED });
      await expect(service.assertAcceptedLink(PRO, 1, 'user')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('vínculo aceptado: pasa', async () => {
      linkRepo.findOne.mockResolvedValue(acceptedLink('dependent', 10));
      await expect(service.assertAcceptedLink(PRO, 10, 'dependent')).resolves.toMatchObject({ id: 500 });
      expect(linkRepo.findOne).toHaveBeenCalledWith({
        where: { professionalId: PRO, patientId: 10, patientType: 'dependent' },
      });
    });

    it('getPatientDocuments sólo con vínculo aceptado', async () => {
      await expect(service.getPatientDocuments(PRO, 1, 'user')).rejects.toBeInstanceOf(ForbiddenException);
      expect(documents.getDocumentsByPatient).not.toHaveBeenCalled();
      linkRepo.findOne.mockResolvedValue(acceptedLink());
      await service.getPatientDocuments(PRO, 1, 'user');
      expect(documents.getDocumentsByPatient).toHaveBeenCalledWith(1, 'user');
    });
  });

  describe('getPatients', () => {
    it('aceptados con resumen; pendientes de dependientes sin resumen', async () => {
      linkRepo.find.mockResolvedValue([
        acceptedLink('user', 1),
        { ...acceptedLink('dependent', 10), id: 501 },
        { ...acceptedLink('dependent', 11), id: 502, status: PatientProfessionalStatus.PENDING },
        { ...acceptedLink('user', 99), id: 503 },
        { ...acceptedLink('dependent', 98), id: 504 },
      ]);
      users.getUserById.mockImplementation(async (id) => (id === 1 ? patientUser : null));
      familyGroups.getDependentById.mockImplementation(async (id) =>
        id === 10 ? dependent : id === 11 ? { firstName: 'Lola', lastName: 'Pérez' } : null,
      );
      const next = new Date(Date.now() + 24 * HOUR);
      appointmentRepo.findOne.mockImplementation(async ({ where }) =>
        where.createdById === 1 ? { date: next } : null,
      );
      const qb = mockQueryBuilder({ getRawOne: { count: '3' } });
      medEventRepo.createQueryBuilder.mockReturnValue(qb);

      const { patients, pendingRequests } = await service.getPatients(PRO);

      expect(patients).toHaveLength(4);
      expect(patients[0]).toMatchObject({
        firstName: 'Ana',
        lastName: 'Pérez',
        nextAppointmentDate: next,
        activeTreatmentsCount: 3,
      });
      expect(patients[1]).toMatchObject({ firstName: 'Tito', nextAppointmentDate: null });
      // Paciente borrado: queda con nombre vacío en vez de romper.
      expect(patients[2]).toMatchObject({ firstName: '', lastName: '' });
      expect(pendingRequests).toEqual([expect.objectContaining({ id: 502, firstName: 'Lola' })]);
      // Un paciente titular que además es profesional guarda sus eventos como 'professional'.
      expect(qb.andWhere).toHaveBeenCalledWith('e.createdByType IN (:...types)', {
        types: ['user', 'professional'],
      });
      expect(appointmentRepo.findOne.mock.calls[1][0].where.createdByType.value).toEqual(['dependent']);
    });

    it('sin fila de conteo cuenta 0 tratamientos', async () => {
      linkRepo.find.mockResolvedValue([acceptedLink()]);
      medEventRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder({ getRawOne: undefined }));
      const { patients } = await service.getPatients(PRO);
      expect(patients[0].activeTreatmentsCount).toBe(0);
    });
  });

  describe('getPatientSummary (seguimiento del paciente)', () => {
    it('sin vínculo aceptado no muestra nada', async () => {
      await expect(service.getPatientSummary(PRO, 1, 'user')).rejects.toBeInstanceOf(ForbiddenException);
      expect(medsEvents.getMedTreatmentsByCreator).not.toHaveBeenCalled();
    });

    it('paciente inexistente: 404', async () => {
      linkRepo.findOne.mockResolvedValue(acceptedLink());
      await expect(service.getPatientSummary(PRO, 1, 'user')).rejects.toBeInstanceOf(NotFoundException);
      linkRepo.findOne.mockResolvedValue(acceptedLink('dependent', 10));
      await expect(service.getPatientSummary(PRO, 10, 'dependent')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('arma la ficha: adherencia del período, tratamientos, próximo turno y notas', async () => {
      linkRepo.findOne.mockResolvedValue(acceptedLink());
      users.getUserById.mockResolvedValue(patientUser);
      const ago = (h: number) => new Date(Date.now() - h * HOUR);
      medsEvents.getMedTreatmentsByCreator.mockResolvedValue([
        {
          seriesId: 'curso',
          doses: [
            { status: EventStatus.CONFIRMED, date: ago(10) },
            { status: EventStatus.DISCARDED, date: ago(5) },
            { status: EventStatus.CREATED, date: ago(-5) },
          ],
        },
        {
          seriesId: 'terminado-hace-poco',
          doses: [{ status: EventStatus.CONFIRMED, date: ago(24 * 10) }],
        },
        {
          seriesId: 'viejo',
          doses: [{ status: EventStatus.CONFIRMED, date: ago(24 * 60) }],
        },
        {
          seriesId: 'cancelado',
          doses: [{ status: EventStatus.CANCELED, date: ago(1) }],
        },
      ]);
      appointmentRepo.findOne.mockResolvedValue({
        id: 70,
        date: ago(-48),
        description: 'Control',
        status: EventStatus.CREATED,
        professional: { id: PRO, firstName: 'Julia', lastName: 'Ruiz' },
      });
      noteRepo.find.mockResolvedValue([
        { id: 1, content: 'Tomar con comida', patientId: 1, patientType: 'user', createdAt: ago(1), professional: { id: PRO, firstName: 'Julia', lastName: 'Ruiz', licenseNumber: 'MP8', password: 'hash' } },
        { id: 2, content: 'Sin firma', patientId: 1, patientType: 'user', createdAt: ago(2), professional: null },
      ]);

      const summary = await service.getPatientSummary(PRO, 1, 'user');

      expect(summary.patient).toEqual({ ...patientUser, type: 'user' });
      expect(summary.linkedSince).toEqual(new Date('2026-10-02'));
      expect(summary.activeTreatments.map((t) => [t.seriesId, t.inProgress])).toEqual([
        ['curso', true],
        ['terminado-hace-poco', false],
      ]);
      expect(summary.activeTreatments[0]).not.toHaveProperty('doses');
      expect(summary.overallAdherence).toEqual({ taken: 2, omitted: 1, pending: 1, pct: 67 });
      expect(summary.nextAppointment).toMatchObject({ id: 70, withMe: true, professional: { id: PRO } });
      expect(summary.lastNotes[0].professional).toEqual({ id: PRO, firstName: 'Julia', lastName: 'Ruiz', licenseNumber: 'MP8' });
      expect(summary.lastNotes[1].professional).toBeNull();
      expect(noteRepo.find.mock.calls[0][0]).toMatchObject({ take: 3 });
    });

    it('dependiente: ficha con datos del dependiente; turno con otro profesional o sin turno', async () => {
      linkRepo.findOne.mockResolvedValue({ ...acceptedLink('dependent', 10), resolvedAt: null });
      familyGroups.getDependentById.mockResolvedValue(dependent);
      appointmentRepo.findOne.mockResolvedValue({
        id: 71,
        date: new Date(),
        myProfessional: { id: 3, firstName: 'Otro', lastName: 'Médico' },
      });

      const summary = await service.getPatientSummary(PRO, 10, 'dependent');

      expect(summary.patient).toMatchObject({ type: 'dependent', bloodType: 'A+' });
      expect(summary.linkedSince).toEqual(new Date('2026-10-01'));
      expect(summary.nextAppointment).toMatchObject({ withMe: false, professional: { id: 3 } });
      expect(summary.overallAdherence.pct).toBeNull();

      appointmentRepo.findOne.mockResolvedValue({ id: 72, date: new Date() });
      expect((await service.getPatientSummary(PRO, 10, 'dependent')).nextAppointment.professional).toBeNull();
      appointmentRepo.findOne.mockResolvedValue(null);
      expect((await service.getPatientSummary(PRO, 10, 'dependent')).nextAppointment).toBeNull();
    });
  });

  describe('notas del profesional', () => {
    const savedNote = (overrides = {}) => ({ id: 9, createdAt: new Date(), ...overrides });

    beforeEach(() => {
      noteRepo.save.mockImplementation(async (n) => savedNote(n));
      professionalRepo.findOne.mockResolvedValue({ id: PRO, firstName: 'Julia', lastName: 'Ruiz', licenseNumber: 'MP8' });
    });

    it('sin vínculo aceptado no se puede dejar una nota', async () => {
      await expect(service.createPatientNote(PRO, 1, 'user', 'x')).rejects.toBeInstanceOf(ForbiddenException);
      expect(noteRepo.save).not.toHaveBeenCalled();
    });

    it('titular: guarda y avisa sólo al paciente', async () => {
      linkRepo.findOne.mockResolvedValue(acceptedLink());
      users.getUserById.mockResolvedValue(patientUser);

      const note = await service.createPatientNote(PRO, 1, 'user', 'Tomar con comida');

      expect(note).toMatchObject({ id: 9, content: 'Tomar con comida', professional: { id: PRO, licenseNumber: 'MP8' } });
      expect(notifications.createForProfessionalNote).toHaveBeenCalledWith({
        noteId: 9,
        groupId: null,
        memberUserIds: [1],
        payload: { professionalName: 'Julia Ruiz', excerpt: 'Tomar con comida' },
      });
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('dependiente: avisa a todo el grupo con un extracto y registra el texto completo', async () => {
      linkRepo.findOne.mockResolvedValue(acceptedLink('dependent', 10));
      familyGroups.getDependentById.mockResolvedValue(dependent);
      familyGroups.findByDependentId.mockResolvedValue({ id: 100, createdBy: { id: 5 }, members: [{ id: 1 }, { id: 5 }] });
      const largo = 'a'.repeat(130);

      await service.createPatientNote(PRO, 10, 'dependent', largo);

      const aviso = notifications.createForProfessionalNote.mock.calls[0][0];
      expect(aviso.memberUserIds).toEqual([5, 1]);
      expect(aviso.payload.excerpt).toBe(`${'a'.repeat(117)}...`);
      expect(aviso.payload).toMatchObject({ dependentName: 'Tito Pérez', dependentId: 10 });
      expect(groupEvents.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GroupEventAction.PROFESSIONAL_NOTE,
          actorUserId: PRO,
          payload: expect.objectContaining({ content: largo }),
        }),
      );
    });

    it('dependiente sin grupo: se guarda sin avisar; un error al avisar no pierde la nota', async () => {
      linkRepo.findOne.mockResolvedValue(acceptedLink('dependent', 10));
      familyGroups.getDependentById.mockResolvedValue(dependent);
      professionalRepo.findOne.mockResolvedValue(null);
      await service.createPatientNote(PRO, 10, 'dependent', 'x');
      expect(notifications.createForProfessionalNote).not.toHaveBeenCalled();

      familyGroups.findByDependentId.mockResolvedValue({ id: 100, createdBy: null, members: null });
      notifications.createForProfessionalNote.mockRejectedValue(new Error('fcm'));
      await expect(service.createPatientNote(PRO, 10, 'dependent', 'x')).resolves.toMatchObject({ id: 9 });
      expect(notifications.createForProfessionalNote.mock.calls[0][0]).toMatchObject({
        memberUserIds: [],
        payload: { professionalName: 'Un profesional' },
      });
    });

    it('getPatientNotes exige vínculo y trae sólo las de este profesional', async () => {
      await expect(service.getPatientNotes(PRO, 1, 'user')).rejects.toBeInstanceOf(ForbiddenException);
      linkRepo.findOne.mockResolvedValue(acceptedLink());
      noteRepo.find.mockResolvedValue([savedNote({ professional: null })]);
      await expect(service.getPatientNotes(PRO, 1, 'user')).resolves.toHaveLength(1);
      expect(noteRepo.find.mock.calls[0][0].where).toEqual({ professionalId: PRO, patientId: 1, patientType: 'user' });
    });

    it('getReceivedNotes: las propias, o las del dependiente si es del grupo', async () => {
      await service.getReceivedNotes(1);
      expect(noteRepo.find.mock.calls[0][0].where).toEqual({ patientId: 1, patientType: 'user' });

      familyGroups.findByDependentId.mockResolvedValue(group);
      await service.getReceivedNotes(2, 10);
      expect(noteRepo.find.mock.calls[1][0].where).toEqual({ patientId: 10, patientType: 'dependent' });

      await expect(service.getReceivedNotes(99, 10)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getAgenda', () => {
    it('valida el rango de fechas', async () => {
      await expect(service.getAgenda(PRO, 'basura')).rejects.toThrow('Las fechas del rango no son válidas');
      await expect(service.getAgenda(PRO, '2026-10-20', '2026-10-10')).rejects.toThrow(
        'La fecha final es anterior a la inicial',
      );
    });

    it('sin pacientes vinculados devuelve vacío sin consultar turnos', async () => {
      await expect(service.getAgenda(PRO)).resolves.toEqual([]);
      expect(appointmentRepo.find).not.toHaveBeenCalled();
    });

    it('sólo muestra turnos de pacientes con vínculo aceptado', async () => {
      linkRepo.find.mockResolvedValue([acceptedLink('user', 1), acceptedLink('dependent', 10), acceptedLink('user', 99)]);
      appointmentRepo.find.mockResolvedValue([
        { id: 1, date: new Date(), createdByType: 'user', createdById: 1, description: 'a', status: 'created' },
        { id: 2, date: new Date(), createdByType: 'professional', createdById: 1 },
        { id: 3, date: new Date(), createdByType: 'dependent', createdById: 10 },
        { id: 4, date: new Date(), createdByType: 'user', createdById: 2 },
        { id: 5, date: new Date(), createdByType: 'user', createdById: 99 },
      ]);
      users.getUserById.mockImplementation(async (id) => (id === 1 ? patientUser : null));
      familyGroups.getDependentById.mockResolvedValue(dependent);

      const agenda = await service.getAgenda(PRO, '2026-10-01', '2026-10-31');

      expect(agenda.map((a) => a.id)).toEqual([1, 2, 3, 5]);
      expect(agenda[0]).toMatchObject({ patientName: 'Ana Pérez', patientType: 'user', isDependent: false });
      expect(agenda[1].patientName).toBe('Ana Pérez');
      expect(agenda[2]).toMatchObject({ patientName: 'Tito Pérez', isDependent: true });
      // Paciente que ya no existe: nombre genérico en vez de romper la agenda.
      expect(agenda[3].patientName).toBe('Paciente');
    });
  });
});
