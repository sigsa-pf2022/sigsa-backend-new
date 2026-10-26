import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { ProfessionalsService } from 'src/professionals/professionals.service';
import { UsersService } from 'src/users/users.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let appointments: Record<string, jest.Mock>;
  let users: { getUserById: jest.Mock };
  let professionals: { getMyProfessionalById: jest.Mock; getProfessionalById: jest.Mock };
  let familyGroups: { getDependentById: jest.Mock };

  const me = { id: 1, premium: false };
  const req = { user: { id: '1' }, params: { id: '70' } } as any;
  const pro = { id: 40, firstName: 'Julia' };
  const myPro = { id: 8, firstName: 'Dr. Propio' };

  const httpError = async (promise: Promise<unknown>) => {
    const err = await promise.then(
      () => {
        throw new Error('Se esperaba un error');
      },
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    return [err.getStatus(), err.getResponse().message ?? err.getResponse()];
  };

  beforeEach(async () => {
    appointments = Object.fromEntries(
      [
        'getAppointmentsByUser',
        'getAppointmentsByDependent',
        'getAppointmentById',
        'cancelAppointment',
        'deleteAppointment',
        'confirmAppointment',
        'assertAppointmentsLimit',
        'createAppointmentWithMyProfessional',
        'createAppointmentWithProfessionalUser',
        'updateAppointmentWithMyProfessional',
        'updateAppointmentWithProfessionalUser',
      ].map((m) => [m, jest.fn(async () => undefined)]),
    );
    users = { getUserById: jest.fn(async () => me) };
    professionals = { getMyProfessionalById: jest.fn(async () => myPro), getProfessionalById: jest.fn(async () => pro) };
    familyGroups = { getDependentById: jest.fn(async () => ({ id: 10 })) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        { provide: AppointmentsService, useValue: appointments },
        { provide: UsersService, useValue: users },
        { provide: ProfessionalsService, useValue: professionals },
        { provide: FamilyGroupsService, useValue: familyGroups },
      ],
    }).compile();
    controller = module.get(AppointmentsController);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('consultas', () => {
    const appt = {
      id: 70,
      date: new Date('2026-10-30'),
      status: 'created',
      description: 'Control',
      myProfessional: null,
      professional: pro,
      takenChargeByUserId: 2,
      takenChargeBy: { id: 2 },
      takenChargeAt: new Date('2026-10-29'),
      canceledBy: null,
      canceledAt: null,
    };

    it('GET /appointments: los del usuario, con el profesional que corresponda', async () => {
      appointments.getAppointmentsByUser.mockResolvedValue([appt, { ...appt, id: 71, myProfessional: myPro }]);
      await expect(controller.getAppointmentsByUserId(req)).resolves.toEqual([
        { professional: pro, date: appt.date, id: 70, status: 'created' },
        { professional: myPro, date: appt.date, id: 71, status: 'created' },
      ]);
      expect(appointments.getAppointmentsByUser).toHaveBeenCalledWith(me);
    });

    it('GET /appointments/dependent/:id: 404 sin dependiente; si existe incluye quién se hizo cargo', async () => {
      familyGroups.getDependentById.mockResolvedValueOnce(null);
      await expect(httpError(controller.getAppointmentsByDependentId(10))).resolves.toEqual([
        HttpStatus.NOT_FOUND,
        'Dependiente no encontrado',
      ]);

      appointments.getAppointmentsByDependent.mockResolvedValue([{ ...appt, myProfessional: myPro }]);
      const [item] = await controller.getAppointmentsByDependentId(10);
      expect(item).toMatchObject({ professional: myPro, takenChargeByUserId: 2, takenChargeBy: { id: 2 }, description: 'Control' });
      expect(appointments.getAppointmentsByDependent).toHaveBeenCalledWith({ id: 10 });
    });

    it('GET /appointments/:id arma el detalle', async () => {
      appointments.getAppointmentById.mockResolvedValueOnce(appt);
      await expect(controller.getAppointment(70)).resolves.toMatchObject({
        id: 70,
        professional: pro,
        isMyProfessional: false,
        takenChargeByUserId: 2,
      });
      appointments.getAppointmentById.mockResolvedValueOnce({ ...appt, myProfessional: myPro });
      await expect(controller.getAppointment(71)).resolves.toMatchObject({ professional: myPro, isMyProfessional: true });
    });

    it('GET /appointments/:id con un id inexistente falla (ver informe: no responde 404)', async () => {
      appointments.getAppointmentById.mockResolvedValue(null);
      await expect(controller.getAppointment(999)).rejects.toThrow();
    });
  });

  describe('cancelar, borrar y confirmar', () => {
    it('pasan el id del turno y el del usuario como números', async () => {
      await controller.cancelAppointment(req);
      expect(appointments.cancelAppointment).toHaveBeenCalledWith(70, 1);
      await controller.deleteAppointment(req);
      expect(appointments.deleteAppointment).toHaveBeenCalledWith(70, 1);
      await controller.confirmAppointment(req);
      expect(appointments.confirmAppointment).toHaveBeenCalledWith('70');
    });

    it('propagan los errores del servicio', async () => {
      appointments.deleteAppointment.mockRejectedValue(new ConflictException('Alguien ya se hizo cargo'));
      await expect(controller.deleteAppointment(req)).rejects.toBeInstanceOf(ConflictException);
      appointments.cancelAppointment.mockRejectedValue(new Error('db'));
      await expect(controller.cancelAppointment(req)).rejects.toThrow('db');
    });
  });

  describe('POST /appointments/create', () => {
    it('sin creador explícito, el turno es del usuario y con profesional de la app', async () => {
      const dto: any = { date: '2026-10-30T10:00:00Z', description: 'Control', professional: { id: 40 } };
      appointments.createAppointmentWithProfessionalUser.mockResolvedValue({ id: 70, professional: pro, date: dto.date, description: 'Control' });

      await expect(controller.createAppointment(req, dto)).resolves.toEqual({
        status: HttpStatus.CREATED,
        appointment: { id: 70, professional: pro, date: dto.date, description: 'Control' },
      });
      expect(dto).toMatchObject({ createdById: 1, createdByType: 'user' });
      expect(appointments.assertAppointmentsLimit).toHaveBeenCalledWith(me, false);
      expect(professionals.getProfessionalById).toHaveBeenCalledWith(40);
      expect(appointments.createAppointmentWithProfessionalUser).toHaveBeenCalledWith(dto, me, pro, 1);
    });

    it('para un dependiente con "mi profesional"', async () => {
      const dto: any = { createdById: 10, createdByType: 'dependent', myProfessional: { id: 8 } };
      appointments.createAppointmentWithMyProfessional.mockResolvedValue({ id: 71, myProfessional: myPro });
      const result = await controller.createAppointment(req, dto);
      expect(result.appointment.professional).toBe(myPro);
      expect(familyGroups.getDependentById).toHaveBeenCalledWith(10);
      expect(appointments.assertAppointmentsLimit).toHaveBeenCalledWith({ id: 10 }, false);
      expect(appointments.createAppointmentWithMyProfessional).toHaveBeenCalledWith(dto, { id: 10 }, myPro, 1);
    });

    it('dependiente inexistente: 404', async () => {
      familyGroups.getDependentById.mockResolvedValue(null);
      await expect(
        httpError(controller.createAppointment(req, { createdById: 99, createdByType: 'dependent' } as any)),
      ).resolves.toEqual([HttpStatus.NOT_FOUND, 'Dependiente no encontrado']);
      expect(appointments.assertAppointmentsLimit).not.toHaveBeenCalled();
    });

    it('al llegar al límite del plan se propaga el mensaje y no se crea', async () => {
      appointments.assertAppointmentsLimit.mockRejectedValue(
        new BadRequestException('Alcanzaste el límite del plan gratuito: hasta 10 turnos activos.'),
      );
      await expect(controller.createAppointment(req, { professional: { id: 40 } } as any)).rejects.toThrow(
        'hasta 10 turnos activos',
      );
      expect(appointments.createAppointmentWithProfessionalUser).not.toHaveBeenCalled();
    });

    it('un error inesperado es 400 genérico', async () => {
      await expect(httpError(controller.createAppointment(req, {} as any))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'No se pudo crear el turno',
      ]);
    });
  });

  describe('PUT /appointments/:id', () => {
    it('con "mi profesional" o con profesional de la app', async () => {
      const dtoMy: any = { myProfessional: { id: 8 }, date: 'd' };
      await expect(controller.editAppointment(req, dtoMy)).resolves.toEqual({ status: HttpStatus.CREATED });
      expect(appointments.updateAppointmentWithMyProfessional).toHaveBeenCalledWith('70', { myProfessional: myPro, date: 'd' });

      const dtoPro: any = { professional: { id: 40 } };
      await controller.editAppointment(req, dtoPro);
      expect(appointments.updateAppointmentWithProfessionalUser).toHaveBeenCalledWith('70', { professional: pro });
    });

    it('cualquier error es 400', async () => {
      appointments.updateAppointmentWithMyProfessional.mockRejectedValue(new ForbiddenException());
      await expect(httpError(controller.editAppointment(req, { myProfessional: { id: 8 } } as any))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'No se pudo editar el turno',
      ]);
    });
  });
});
