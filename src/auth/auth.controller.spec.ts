import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: { login: jest.Mock };

  beforeEach(async () => {
    auth = { login: jest.fn(async () => ({ access_token: 'jwt', user: { id: 1 } })) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /auth/login firma el token del usuario que validó LocalStrategy', async () => {
    await expect(controller.login({ user: { id: 1 } })).resolves.toEqual({ access_token: 'jwt', user: { id: 1 } });
    expect(auth.login).toHaveBeenCalledWith({ id: 1 });
  });

  it('propaga los errores del servicio', async () => {
    auth.login.mockRejectedValue(new Error('jwt'));
    await expect(controller.login({ user: { id: 1 } })).rejects.toThrow('jwt');
  });
});
