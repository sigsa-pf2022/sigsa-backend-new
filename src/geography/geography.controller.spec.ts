import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GeographyController } from './geography.controller';
import { GeographyService } from './geography.service';

describe('GeographyController', () => {
  let controller: GeographyController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = Object.fromEntries(
      ['getCountries', 'getCountryById', 'getStatesByCountry', 'getStateById', 'getCitiesByState'].map((m) => [
        m,
        jest.fn(async () => null),
      ]),
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeographyController],
      providers: [{ provide: GeographyService, useValue: service }],
    }).compile();

    controller = module.get<GeographyController>(GeographyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /countries', async () => {
    service.getCountries.mockResolvedValue([{ id: 1 }]);
    await expect(controller.getCountries()).resolves.toEqual([{ id: 1 }]);
  });

  it('GET /states/:countryId: 400 si el país no existe; si existe devuelve sus provincias', async () => {
    const err = await controller.getStatesByCountry({ params: { countryId: '9' } }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);

    service.getCountryById.mockResolvedValue({ id: 1 });
    service.getStatesByCountry.mockResolvedValue([{ id: 5 }]);
    await expect(controller.getStatesByCountry({ params: { countryId: '1' } })).resolves.toEqual([{ id: 5 }]);
    expect(service.getStatesByCountry).toHaveBeenCalledWith({ id: 1 });
  });

  it('GET /cityies/:stateId: 400 si la provincia no existe; si existe devuelve sus ciudades', async () => {
    const err = await controller.getCitiesByState({ params: { stateId: '9' } }).catch((e) => e);
    expect(err.getResponse()).toEqual({ message: 'No se encontro la provincia seleccionada', status: 'error' });

    service.getStateById.mockResolvedValue({ id: 5 });
    service.getCitiesByState.mockResolvedValue([{ id: 50 }]);
    await expect(controller.getCitiesByState({ params: { stateId: '5' } })).resolves.toEqual([{ id: 50 }]);
  });
});
