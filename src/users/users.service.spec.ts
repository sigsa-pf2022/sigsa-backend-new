import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compareSync } from 'bcrypt';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { Role } from 'src/roles/enums/role.enum';
import { NormalUser } from './entities/normal-user.entity';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let normalUserRepo: MockRepository;
  let userRepo: MockRepository;

  beforeEach(async () => {
    normalUserRepo = mockRepository();
    userRepo = mockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(NormalUser), useValue: normalUserRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser (registro)', () => {
    it('normaliza el email, hashea la clave, fija rol user y genera código', async () => {
      const user: any = await service.createUser({
        email: ' Ana@Mail.COM ',
        password: 'secreta',
        firstName: 'Ana',
      } as any);

      expect(user.email).toBe('ana@mail.com');
      expect(user.password).not.toBe('secreta');
      expect(compareSync('secreta', user.password)).toBe(true);
      expect(user.role).toBe(Role.User);
      expect(user.verificationCode).toBeGreaterThanOrEqual(100000);
      expect(user.verificationCode).toBeLessThanOrEqual(999999);
    });

    it('nadie se registra como premium ni como admin mandándolo en el body', async () => {
      const user: any = await service.createUser({
        email: 'a@b.com',
        password: 'x',
        premium: true,
        role: Role.Admin,
      } as any);
      expect(user.premium).toBe(false);
      expect(user.role).toBe(Role.User);
    });
  });

  describe('búsquedas', () => {
    it('getUserByEmail y existingUser normalizan el email', async () => {
      await service.getUserByEmail('  Pedro@X.com');
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'pedro@x.com' } });
      await service.existingUser('A@B.com', '123');
      expect(userRepo.findOne).toHaveBeenLastCalledWith({ where: [{ email: 'a@b.com' }, { dni: '123' }] });
      await service.getUserStatus('C@D.com');
      expect(userRepo.findOne).toHaveBeenLastCalledWith({ where: { email: 'c@d.com' } });
    });

    it('getUserByDni sólo trae datos públicos; getFullUserByDni trae todo', async () => {
      await service.getUserByDni('30');
      expect(userRepo.findOne.mock.calls[0][0].select).toEqual({ id: true, firstName: true, lastName: true, dni: true });
      await service.getFullUserByDni('30');
      expect(userRepo.findOne.mock.calls[1][0]).toEqual({ where: { dni: '30' } });
    });

    it('getUserById saca el hash y tolera un usuario borrado', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, password: 'hash' });
      await expect(service.getUserById(1)).resolves.toEqual({ id: 1 });
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getUserById(2)).resolves.toBeNull();
    });

    it('getUsers pagina y getMonthlyUserQuantity sólo trae fechas', async () => {
      await service.getUsers(2, 5, 'An');
      expect(normalUserRepo.findAndCount.mock.calls[0][0]).toMatchObject({ take: 5, skip: 10 });
      expect(normalUserRepo.findAndCount.mock.calls[0][0].select).not.toHaveProperty('password');
      await service.getMonthlyUserQuantity();
      expect(normalUserRepo.find).toHaveBeenCalledWith({ select: { createdAt: true } });
    });
  });

  describe('updateUser ("Mis datos")', () => {
    it('sólo escribe los campos que llegaron', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, password: 'h', phone: '1' });
      const result = await service.updateUser(1, { phone: '1', address: undefined } as any);
      expect(userRepo.update).toHaveBeenCalledWith({ id: 1 }, { phone: '1' });
      expect(result).toEqual({ id: 1, phone: '1' });
    });

    it('sin cambios no toca la base', async () => {
      await service.updateUser(1, {} as any);
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('validateUser (códigos de verificación y recuperación)', () => {
    it('código correcto', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, verificationCode: 123456 });
      await expect(
        service.validateUser({ email: 'a@b.com', field: 'verificationCode', code: '123456' as any }),
      ).resolves.toMatchObject({ isCodeCorrect: true });
    });

    it('código incorrecto, sin código pendiente o email inexistente', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, recoveryPasswordToken: 111111 });
      await expect(
        service.validateUser({ email: 'a@b.com', field: 'recoveryPasswordToken', code: 222222 }),
      ).resolves.toMatchObject({ isCodeCorrect: false });

      userRepo.findOne.mockResolvedValue({ id: 1, recoveryPasswordToken: null });
      await expect(
        service.validateUser({ email: 'a@b.com', field: 'recoveryPasswordToken', code: 0 }),
      ).resolves.toMatchObject({ isCodeCorrect: false });

      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.validateUser({ email: 'x@b.com', field: 'verificationCode', code: 123456 }),
      ).resolves.toEqual({ user: null, isCodeCorrect: false });
    });
  });

  describe('contraseña y verificación de email', () => {
    it('resetPassword hashea la nueva y consume el token', async () => {
      await service.resetPassword({ password: 'nueva' }, { id: 1 } as any);
      const [criteria, changes] = userRepo.update.mock.calls[0];
      expect(criteria).toEqual({ id: 1 });
      expect(changes.recoveryPasswordToken).toBeNull();
      expect(compareSync('nueva', changes.password)).toBe(true);
    });

    it('setRecoveryPasswordToken genera un código de 6 dígitos', async () => {
      const saved: any = await service.setRecoveryPasswordToken({ id: 1 } as any);
      expect(String(saved.recoveryPasswordToken)).toMatch(/^\d{6}$/);
    });

    it('updateValidateStatus marca el email como verificado y borra el código', async () => {
      await service.updateValidateStatus(1);
      expect(userRepo.save).toHaveBeenCalledWith({ id: 1, emailVerified: true, verificationCode: null });
    });
  });
});
