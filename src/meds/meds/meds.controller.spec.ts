import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MedsController } from './meds.controller';
import { MedsService } from './meds.service';

describe('MedsController', () => {
  let controller: MedsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = Object.fromEntries(
      ['getAllMeds', 'getMeds', 'getMedByName', 'createMed', 'getMedById', 'updateMed'].map((m) => [m, jest.fn(async () => null)]),
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsController],
      providers: [{ provide: MedsService, useValue: service }],
    }).compile();

    controller = module.get<MedsController>(MedsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /meds/all', async () => {
    service.getAllMeds.mockResolvedValue([{ id: 1 }]);
    await expect(controller.getAllMeds()).resolves.toEqual([{ id: 1 }]);
  });

  it('GET /meds pasa paginación y filtros', async () => {
    service.getMeds.mockResolvedValue([[{ id: 1 }], 4]);
    const query = { page: '1', take: '5', name: 'ibu', drug: '1', type: '2', shape: '3', measurementUnit: '4', deleted: 'false' };
    await expect(controller.getMeds({ query })).resolves.toEqual({ data: [{ id: 1 }], count: 4, total: 4 });
    expect(service.getMeds).toHaveBeenCalledWith('1', '5', {
      name: 'ibu',
      drug: '1',
      type: '2',
      shape: '3',
      measurementUnit: '4',
      deleted: 'false',
    });
  });

  it('POST /meds rechaza un nombre repetido y crea si es nuevo', async () => {
    service.getMedByName.mockResolvedValueOnce({ id: 1 });
    const err = await controller.createMed({}, { name: 'Ibuprofeno' } as any).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(service.createMed).not.toHaveBeenCalled();

    service.createMed.mockResolvedValue({ id: 2 });
    await expect(controller.createMed({}, { name: 'Nuevo' } as any)).resolves.toEqual({ id: 2 });
  });

  it('GET /meds/:id aplana las relaciones a ids para el formulario', async () => {
    service.getMedById.mockResolvedValue({
      id: 3,
      name: 'Ibuprofeno',
      shape: { id: 1 },
      type: { id: 2 },
      measurementUnit: { id: 3 },
      drug: { id: 4 },
    });
    await expect(controller.getMedById({ params: { id: '3' } })).resolves.toEqual({
      id: 3,
      name: 'Ibuprofeno',
      shape: 1,
      type: 2,
      measurementUnit: 3,
      drug: 4,
    });
  });

  it('GET /meds/:id con un id inexistente falla (ver informe: no responde 404)', async () => {
    await expect(controller.getMedById({ params: { id: '999' } })).rejects.toThrow();
  });

  it('PUT /meds/:id delega y propaga errores', async () => {
    await controller.updateMed({ params: { id: '3' } }, { name: 'X' } as any);
    expect(service.updateMed).toHaveBeenCalledWith('3', { name: 'X' });
    service.updateMed.mockRejectedValue(new Error('El nombre ya existe'));
    await expect(controller.updateMed({ params: { id: '3' } }, {} as any)).rejects.toThrow('El nombre ya existe');
  });
});
