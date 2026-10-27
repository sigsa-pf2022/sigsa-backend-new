import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { subMonths } from 'date-fns';
import { MailService } from 'src/mail/mail.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let users: Record<string, jest.Mock>;
  let mail: { sendUserConfirmation: jest.Mock; sendUserRecoveryPassword: jest.Mock };

  const httpError = async (promise: Promise<unknown>) => {
    const err = await promise.then(
      () => {
        throw new Error('Se esperaba un error');
      },
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    const body = err.getResponse();
    return [err.getStatus(), typeof body === 'string' ? body : body.message];
  };

  beforeEach(async () => {
    users = Object.fromEntries(
      [
        'existingUser',
        'createUser',
        'getUserByEmail',
        'setRecoveryPasswordToken',
        'resetPassword',
        'validateUser',
        'updateValidateStatus',
        'getUserById',
        'getUsers',
        'getUserStatus',
        'getMonthlyUserQuantity',
        'updateUser',
        'getUserByDni',
      ].map((m) => [m, jest.fn(async () => null)]),
    );
    mail = { sendUserConfirmation: jest.fn(), sendUserRecoveryPassword: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: mail },
      ],
    }).compile();
    controller = module.get(UsersController);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('POST /users/create (registro)', () => {
    const dto: any = { email: 'ana@mail.com', dni: '30', password: 'x' };

    it('rechaza un email o DNI ya registrado sin crear ni mandar mail', async () => {
      users.existingUser.mockResolvedValue({ id: 1 });
      await expect(httpError(controller.createUser(dto))).resolves.toEqual([HttpStatus.BAD_REQUEST, 'Email inválido']);
      expect(users.existingUser).toHaveBeenCalledWith('ana@mail.com', '30');
      expect(users.createUser).not.toHaveBeenCalled();
      expect(mail.sendUserConfirmation).not.toHaveBeenCalled();
    });

    it('crea y manda el código de verificación', async () => {
      users.createUser.mockResolvedValue({ id: 2 });
      await expect(controller.createUser(dto)).resolves.toEqual({
        status: HttpStatus.CREATED,
        message: 'Usuario creado correctamente',
      });
      expect(mail.sendUserConfirmation).toHaveBeenCalledWith({ id: 2 });
    });
  });

  describe('recuperación de contraseña', () => {
    it('email inexistente: 404', async () => {
      await expect(httpError(controller.recoveryPasswordEmail({ email: 'x@y.com' }))).resolves.toEqual([
        HttpStatus.NOT_FOUND,
        'No existe una cuenta con ese email',
      ]);
      await expect(httpError(controller.recoveryPasswordEmail(undefined))).resolves.toEqual([
        HttpStatus.NOT_FOUND,
        'No existe una cuenta con ese email',
      ]);
      expect(users.getUserByEmail).toHaveBeenLastCalledWith('');
    });

    it('genera el código y lo manda por mail', async () => {
      users.getUserByEmail.mockResolvedValue({ id: 1 });
      await expect(controller.recoveryPasswordEmail({ email: 'ana@mail.com' })).resolves.toEqual({
        status: HttpStatus.OK,
        message: 'Email enviado',
      });
      expect(users.setRecoveryPasswordToken).toHaveBeenCalledWith({ id: 1 });
      expect(mail.sendUserRecoveryPassword).toHaveBeenCalledWith({ id: 1 });
    });

    it('un error al mandar el mail se propaga (no responde 200)', async () => {
      users.getUserByEmail.mockResolvedValue({ id: 1 });
      mail.sendUserRecoveryPassword.mockRejectedValue(new Error('smtp'));
      await expect(controller.recoveryPasswordEmail({ email: 'ana@mail.com' })).rejects.toThrow('smtp');
    });

    it.each([
      ['sin usuario', null],
      ['sin código pendiente', { id: 1, recoveryPasswordToken: null }],
      ['con otro código', { id: 1, recoveryPasswordToken: 111111 }],
    ])('reset-password rechaza %s', async (_caso, user) => {
      users.getUserByEmail.mockResolvedValue(user);
      await expect(
        httpError(controller.resetPassword({ email: 'a@b.com', code: 222222, password: 'nueva' } as any)),
      ).resolves.toEqual([HttpStatus.BAD_REQUEST, 'El código es inválido o ya fue usado']);
      expect(users.resetPassword).not.toHaveBeenCalled();
    });

    it('reset-password con el código correcto cambia la clave', async () => {
      const user = { id: 1, recoveryPasswordToken: 123456 };
      users.getUserByEmail.mockResolvedValue(user);
      const data: any = { email: 'a@b.com', code: '123456', password: 'nueva' };
      await expect(controller.resetPassword(data)).resolves.toEqual({
        status: HttpStatus.OK,
        message: 'Contraseña restablecida correctamente',
      });
      expect(users.resetPassword).toHaveBeenCalledWith(data, user);
    });
  });

  describe('POST /users/validate', () => {
    it('código incorrecto: 400', async () => {
      users.validateUser.mockResolvedValue({ user: null, isCodeCorrect: false });
      await expect(httpError(controller.validateUser({} as any))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'El código es incorrecto.',
      ]);
      expect(users.updateValidateStatus).not.toHaveBeenCalled();
    });

    it('código correcto: marca el email como verificado antes de responder', async () => {
      users.validateUser.mockResolvedValue({ user: { id: 1 }, isCodeCorrect: true });
      await expect(controller.validateUser({} as any)).resolves.toEqual({ status: HttpStatus.OK, message: 'Codigo correcto' });
      expect(users.updateValidateStatus).toHaveBeenCalledWith(1);
    });
  });

  describe('consultas', () => {
    it('GET /users devuelve el usuario del token', async () => {
      users.getUserById.mockResolvedValue({ id: 1 });
      await expect(controller.getUser({ user: { id: '1' } })).resolves.toEqual({ id: 1 });
      expect(users.getUserById).toHaveBeenCalledWith(1);
    });

    it('GET /users/all pagina para el backoffice', async () => {
      users.getUsers.mockResolvedValue([[{ id: 1 }], 12]);
      await expect(
        controller.getUsers({ query: { page: '1', take: '5', firstName: 'A', lastName: 'B' } }),
      ).resolves.toEqual({ data: [{ id: 1 }], count: 12, total: 12 });
      expect(users.getUsers).toHaveBeenCalledWith('1', '5', 'A', 'B');
    });

    it('GET /users/status: si el email existe devuelve si está verificado', async () => {
      await expect(httpError(controller.getUserStatus({ query: { email: 'x@y.com' } }))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'Incorrecta combinación de email/contraseña',
      ]);
      users.getUserStatus.mockResolvedValue({ emailVerified: false });
      await expect(controller.getUserStatus({ query: { email: 'a@b.com' } })).resolves.toBe(false);
    });

    it('GET /users/monthly-quantity: altas de los últimos 6 meses', async () => {
      const today = new Date();
      users.getMonthlyUserQuantity.mockResolvedValue([
        { createdAt: today },
        { createdAt: subMonths(today, 5) },
        { createdAt: subMonths(today, 7) },
      ]);
      await expect(controller.getMonthlyUserQuantity()).resolves.toEqual([1, 0, 0, 0, 0, 1]);
    });

    it('PATCH /users/me usa el id del token, no el del body', async () => {
      await controller.updateMe({ user: { id: '1' } }, { phone: '123', id: 99 } as any);
      expect(users.updateUser).toHaveBeenCalledWith(1, { phone: '123', id: 99 });
    });

    it('GET /users/:dni', async () => {
      await controller.getUserByDni({ params: { dni: '30' } });
      expect(users.getUserByDni).toHaveBeenCalledWith('30');
    });
  });
});
