import { BadRequestException, ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { subMonths } from 'date-fns';
import { MailService } from 'src/mail/mail.service';
import { UsersService } from 'src/users/users.service';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';

describe('ProfessionalsController', () => {
  let controller: ProfessionalsController;
  let service: Record<string, jest.Mock>;
  let users: { getUserById: jest.Mock };
  let mail: { sendUserConfirmation: jest.Mock };
  const req = { user: { id: 40 }, query: {}, params: {} } as any;

  /** Status HTTP y cuerpo del error. */
  const httpError = async (promise: Promise<unknown>) => {
    const err = await promise.then(
      () => {
        throw new Error('Se esperaba un error');
      },
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    return [err.getStatus(), err.getResponse()];
  };

  beforeEach(async () => {
    service = Object.fromEntries(
      [
        'createMyProfessional',
        'createProfessional',
        'getMyProfessionalsByUser',
        'assertBelongsToDependentGroup',
        'searchProfessionals',
        'getProfessionalsDashboard',
        'getProfessionalsSpecializations',
        'getAllProfessionalsSpecializations',
        'getProfessionalsSpecializationById',
        'getProfessionalsSpecializationByName',
        'createSpecialization',
        'updateSpecialization',
        'toggleStatusSpecialization',
        'linkPatient',
        'unlinkPatient',
        'getPatients',
        'getAgenda',
        'getReceivedNotes',
        'getPatientSummary',
        'getPatientNotes',
        'createPatientNote',
        'getPatientDocuments',
        'getMonthlyProfessionalsQuantity',
      ].map((m) => [m, jest.fn(async () => ({ id: 1 }))]),
    );
    users = { getUserById: jest.fn(async () => ({ id: 40 })) };
    mail = { sendUserConfirmation: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfessionalsController],
      providers: [
        { provide: ProfessionalsService, useValue: service },
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    controller = module.get(ProfessionalsController);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('"Mis profesionales"', () => {
    it('crea para el usuario del token', async () => {
      service.createMyProfessional.mockResolvedValue({ id: 9 });
      await expect(controller.createMyProfessional({ firstName: 'A' } as any, req)).resolves.toEqual({
        status: HttpStatus.CREATED,
        id: 9,
      });
      expect(service.createMyProfessional).toHaveBeenCalledWith({ firstName: 'A' }, { id: 40 });
    });

    it('el límite del plan se propaga tal cual; otros errores son 400 genérico', async () => {
      service.createMyProfessional.mockRejectedValueOnce(new BadRequestException('Alcanzaste el límite del plan gratuito'));
      await expect(controller.createMyProfessional({} as any, req)).rejects.toThrow('Alcanzaste el límite del plan gratuito');

      service.createMyProfessional.mockRejectedValueOnce(new Error('db'));
      await expect(httpError(controller.createMyProfessional({} as any, req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'No se pudo crear el profesional', status: 'error' },
      ]);
    });

    it('lista los del usuario', async () => {
      service.getMyProfessionalsByUser.mockResolvedValue([{ id: 1 }]);
      await expect(controller.getFamilyGroupsByUserId(req)).resolves.toEqual([{ id: 1 }]);
      expect(service.getMyProfessionalsByUser).toHaveBeenCalledWith({ id: 40 });
    });
  });

  describe('alta de profesional', () => {
    it('crea y manda el mail de confirmación', async () => {
      service.createProfessional.mockResolvedValue({ id: 50, email: 'p@x.com' });
      await expect(controller.createProfessional({ email: 'p@x.com' } as any)).resolves.toEqual({
        status: HttpStatus.CREATED,
        id: 50,
      });
      expect(mail.sendUserConfirmation).toHaveBeenCalledWith({ id: 50, email: 'p@x.com' });
    });

    it('cualquier error se responde como 400 sin mandar mail', async () => {
      service.createProfessional.mockRejectedValue(new BadRequestException('Ya existe una cuenta con ese email o DNI'));
      await expect(httpError(controller.createProfessional({} as any))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'No se pudo crear el profesional', status: 'error' },
      ]);
      expect(mail.sendUserConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('buscador de profesionales', () => {
    it('para el propio usuario', async () => {
      await controller.getProfessionals(req, 'ruiz', '3', undefined, '1', '20');
      expect(service.assertBelongsToDependentGroup).not.toHaveBeenCalled();
      expect(service.searchProfessionals).toHaveBeenCalledWith({
        userId: 40,
        patient: { id: 40, type: 'user' },
        search: 'ruiz',
        specializationId: 3,
        page: '1',
        take: '20',
      });
    });

    it('para un dependiente exige pertenecer a su grupo', async () => {
      await controller.getProfessionals(req, undefined, 'abc', '10');
      expect(service.assertBelongsToDependentGroup).toHaveBeenCalledWith(40, 10);
      expect(service.searchProfessionals.mock.calls[0][0]).toMatchObject({
        patient: { id: 10, type: 'dependent' },
        specializationId: undefined,
      });

      service.assertBelongsToDependentGroup.mockRejectedValue(new ForbiddenException());
      await expect(controller.getProfessionals(req, undefined, undefined, '10')).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.searchProfessionals).toHaveBeenCalledTimes(1);
    });
  });

  describe('backoffice', () => {
    it('dashboard y especialidades paginadas', async () => {
      const r = { ...req, query: { page: '1', take: '5', firstName: 'Ju', lastName: 'Ru', deleted: 'false', name: 'P', description: 'D' } };
      service.getProfessionalsDashboard.mockResolvedValue([[{ id: 1 }, { id: 2 }], 7]);
      await expect(controller.getProfessionalsDashboard(r)).resolves.toEqual({ data: [{ id: 1 }, { id: 2 }], total: 7, count: 2 });
      expect(service.getProfessionalsDashboard).toHaveBeenCalledWith('1', '5', 'Ju', 'Ru');

      service.getProfessionalsSpecializations.mockResolvedValue([[{ id: 1 }], 1]);
      await expect(controller.getProfessionalsSpecializations(r)).resolves.toEqual({ data: [{ id: 1 }], total: 1, count: 1 });
      expect(service.getProfessionalsSpecializations).toHaveBeenCalledWith('1', '5', 'false', 'P', 'D');
    });

    it('consultas de especialidades', async () => {
      service.getAllProfessionalsSpecializations.mockResolvedValue([{ id: 1 }]);
      await expect(controller.getAllProfessionalsSpecializations()).resolves.toEqual([{ id: 1 }]);
      await controller.getProfessionalsSpecializationById({ params: { id: '3' } });
      expect(service.getProfessionalsSpecializationById).toHaveBeenCalledWith('3');
    });

    it('no crea una especialidad con nombre repetido', async () => {
      service.getProfessionalsSpecializationByName.mockResolvedValueOnce({ id: 1 });
      await expect(httpError(controller.createSpecialization(req, { name: 'Pediatría' } as any))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'Ya existe una especializacion con ese nombre', status: 'error' },
      ]);
      expect(service.createSpecialization).not.toHaveBeenCalled();

      service.getProfessionalsSpecializationByName.mockResolvedValueOnce(null);
      await controller.createSpecialization(req, { name: 'Nueva' } as any);
      expect(service.createSpecialization).toHaveBeenCalledWith({ name: 'Nueva' });
    });

    it('editar, recuperar y dar de baja especialidades', async () => {
      const r = { params: { id: '3' } };
      await controller.updateSpecialization(r, { name: 'X' });
      expect(service.updateSpecialization).toHaveBeenCalledWith('3', { name: 'X' });
      await controller.recoverSpecialization(r);
      expect(service.toggleStatusSpecialization).toHaveBeenCalledWith('3', false);
      await controller.deleteSpecialization(r);
      expect(service.toggleStatusSpecialization).toHaveBeenLastCalledWith('3', true);
    });

    it('altas de profesionales de los últimos 6 meses, mes a mes', async () => {
      const today = new Date();
      service.getMonthlyProfessionalsQuantity.mockResolvedValue([
        { createdAt: today },
        { createdAt: today },
        { createdAt: subMonths(today, 2) },
        { createdAt: subMonths(today, 12) },
      ]);
      await expect(controller.getMonthlyUserQuantity()).resolves.toEqual([0, 0, 0, 1, 0, 2]);
    });
  });

  describe('vinculación con pacientes', () => {
    const dto = { patientId: 1, patientType: 'user' } as any;

    it('linkPatient delega con el profesional del token', async () => {
      service.linkPatient.mockResolvedValue({ id: 77 });
      await expect(controller.linkPatient(dto, req)).resolves.toEqual({ status: HttpStatus.CREATED, id: 77 });
      expect(service.linkPatient).toHaveBeenCalledWith(40, dto);
    });

    it('linkPatient responde 400 con el mensaje del servicio', async () => {
      service.linkPatient.mockRejectedValueOnce(new BadRequestException('El paciente ya está vinculado'));
      await expect(httpError(controller.linkPatient(dto, req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'El paciente ya está vinculado', status: 'error' },
      ]);
      service.linkPatient.mockRejectedValueOnce({});
      await expect(httpError(controller.linkPatient(dto, req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'No se pudo vincular al paciente', status: 'error' },
      ]);
    });

    it('unlinkPatient delega y convierte los errores en 400', async () => {
      await expect(controller.unlinkPatient(1, 'user', req)).resolves.toEqual({
        status: HttpStatus.OK,
        message: 'Paciente desvinculado',
      });
      expect(service.unlinkPatient).toHaveBeenCalledWith(40, 1, 'user');

      service.unlinkPatient.mockRejectedValueOnce(new NotFoundException('El vínculo no existe'));
      await expect(httpError(controller.unlinkPatient(1, 'user', req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'El vínculo no existe', status: 'error' },
      ]);
      service.unlinkPatient.mockRejectedValueOnce({});
      await expect(httpError(controller.unlinkPatient(1, 'user', req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'No se pudo desvincular al paciente', status: 'error' },
      ]);
    });

    it('pacientes, agenda, ficha, notas y documentos usan el profesional del token', async () => {
      await controller.getPatients(req);
      expect(service.getPatients).toHaveBeenCalledWith(40);
      await controller.getAgenda(req, '2026-10-01', '2026-10-31');
      expect(service.getAgenda).toHaveBeenCalledWith(40, '2026-10-01', '2026-10-31');
      await controller.getPatientSummary(10, 'dependent', req);
      expect(service.getPatientSummary).toHaveBeenCalledWith(40, 10, 'dependent');
      await controller.getPatientNotes(10, 'dependent', req);
      expect(service.getPatientNotes).toHaveBeenCalledWith(40, 10, 'dependent');
      service.createPatientNote.mockResolvedValue({ id: 9 });
      await expect(controller.createPatientNote(10, 'dependent', { content: 'Dar con comida' } as any, req)).resolves.toEqual({
        status: HttpStatus.CREATED,
        note: { id: 9 },
      });
      expect(service.createPatientNote).toHaveBeenCalledWith(40, 10, 'dependent', 'Dar con comida');
      service.getPatientDocuments.mockResolvedValue([{ id: 1 }]);
      await expect(controller.getPatientDocuments(10, 'dependent', req)).resolves.toEqual([{ id: 1 }]);
    });

    it('sin consentimiento, la ficha y las notas propagan el 403', async () => {
      service.getPatientSummary.mockRejectedValue(new ForbiddenException('La vinculación aún no fue aprobada'));
      await expect(controller.getPatientSummary(10, 'dependent', req)).rejects.toBeInstanceOf(ForbiddenException);
      service.createPatientNote.mockRejectedValue(new ForbiddenException());
      await expect(controller.createPatientNote(10, 'dependent', { content: 'x' } as any, req)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('documentos sin consentimiento: el 403 se responde como 400 con el mensaje', async () => {
      service.getPatientDocuments.mockRejectedValueOnce(new ForbiddenException('No tiene vínculo con este paciente'));
      await expect(httpError(controller.getPatientDocuments(10, 'user', req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'No tiene vínculo con este paciente', status: 'error' },
      ]);
      service.getPatientDocuments.mockRejectedValueOnce({});
      await expect(httpError(controller.getPatientDocuments(10, 'user', req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        { message: 'No se pudieron obtener los documentos', status: 'error' },
      ]);
    });

    it('notas recibidas: propias o de un dependiente', async () => {
      await controller.getReceivedNotes(req);
      expect(service.getReceivedNotes).toHaveBeenCalledWith(40, undefined);
      await controller.getReceivedNotes(req, '10');
      expect(service.getReceivedNotes).toHaveBeenLastCalledWith(40, 10);
      await controller.getReceivedNotes(req, '-1');
      expect(service.getReceivedNotes).toHaveBeenLastCalledWith(40, undefined);
    });
  });
});
