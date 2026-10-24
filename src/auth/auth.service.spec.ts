import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcrypt';
import { Role } from 'src/roles/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: { getUserByEmail: jest.Mock };
  let jwt: { sign: jest.Mock };

  const hash = hashSync('correcta', 4);
  const storedUser = () => ({
    id: 1,
    email: 'ana@mail.com',
    password: hash,
    emailVerified: true,
    role: Role.User,
  });

  /** Lo que el front recibe en el cuerpo del error. */
  const errorBody = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(400);
      return (err as HttpException).getResponse();
    }
    throw new Error('Se esperaba un error');
  };

  beforeEach(async () => {
    users = { getUserByEmail: jest.fn() };
    jwt = { sign: jest.fn(() => 'token-firmado') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('email inexistente: mismo mensaje que clave incorrecta, para no revelar cuentas', async () => {
      users.getUserByEmail.mockResolvedValue(null);
      await expect(errorBody(service.validateUser('nadie@mail.com', 'x'))).resolves.toEqual({
        message: 'Incorrecta combinación de email/contraseña',
        status: 'invalid',
      });
    });

    it('clave incorrecta', async () => {
      users.getUserByEmail.mockResolvedValue(storedUser());
      await expect(errorBody(service.validateUser('ana@mail.com', 'otra'))).resolves.toEqual({
        message: 'Incorrecta combinación de email/contraseña',
        status: 'invalid',
      });
    });

    it('clave correcta pero email sin validar', async () => {
      users.getUserByEmail.mockResolvedValue({ ...storedUser(), emailVerified: false });
      await expect(errorBody(service.validateUser('ana@mail.com', 'correcta'))).resolves.toEqual({
        message: 'El correo ingresado no ha sido validado',
        status: 'email-not-verified',
      });
    });

    it('credenciales válidas: devuelve el usuario sin el hash', async () => {
      users.getUserByEmail.mockResolvedValue(storedUser());
      const user = await service.validateUser('ana@mail.com', 'correcta');
      expect(user).toMatchObject({ id: 1, email: 'ana@mail.com' });
      expect(user).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('firma un token con id, email y rol', async () => {
      const user = { id: 3, email: 'pro@mail.com', role: Role.Professional } as any;
      await expect(service.login(user)).resolves.toEqual({ access_token: 'token-firmado', user });
      expect(jwt.sign).toHaveBeenCalledWith({ email: 'pro@mail.com', id: 3, role: Role.Professional });
    });
  });
});
