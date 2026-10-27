import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { MedsService } from './meds.service';
import { Meds } from './meds.entity';

describe('MedsService', () => {
  let service: MedsService;
  let repo: MockRepository;

  beforeEach(async () => {
    repo = mockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MedsService, { provide: getRepositoryToken(Meds), useValue: repo }],
    }).compile();

    service = module.get<MedsService>(MedsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getAllMeds trae las relaciones del catálogo', async () => {
    await service.getAllMeds();
    expect(repo.find).toHaveBeenCalledWith({
      relations: { drug: true, shape: true, type: true, measurementUnit: true },
    });
  });

  it('getMeds pagina y filtra por nombre, relaciones y baja lógica', async () => {
    await service.getMeds('1', '20', { name: 'ibu', drug: '3', type: '', deleted: 'false' });
    const args = repo.findAndCount.mock.calls[0][0];
    expect(args).toMatchObject({ take: 20, skip: 20, order: { name: 'ASC' } });
    expect(args.where).toMatchObject({ deleted: false, drug: { id: 3 } });
    expect(args.where).not.toHaveProperty('type');
    // Sin filtro, el listado excluye los dados de baja.
    await service.getMeds(undefined, undefined);
    expect(repo.findAndCount.mock.calls[1][0].where).toEqual({ deleted: false });
  });

  it('getMedById y getMedByName', async () => {
    await service.getMedById(3);
    expect(repo.findOne.mock.calls[0][0].where).toEqual({ id: 3 });
    await service.getMedByName('Ibuprofeno');
    expect(repo.findOneBy).toHaveBeenCalledWith({ name: 'Ibuprofeno' });
  });

  describe('createMed', () => {
    const dto: any = { name: 'Ibuprofeno', laboratory: 'Lab', code: 1, dosage: 400, drug: 1, shape: 2, type: 3, measurementUnit: 4 };

    it('guarda con las relaciones por id', async () => {
      await service.createMed(dto);
      expect(repo.save).toHaveBeenCalledWith({
        name: 'Ibuprofeno',
        laboratory: 'Lab',
        code: 1,
        dosage: 400,
        drug: { id: 1 },
        shape: { id: 2 },
        type: { id: 3 },
        measurementUnit: { id: 4 },
      });
    });

    it('un nombre repetido (23505) es 409; otro error de base, 500', async () => {
      repo.save.mockRejectedValueOnce({ code: '23505' });
      await expect(service.createMed(dto)).rejects.toThrow(new ConflictException('El nombre ya existe'));
      repo.save.mockRejectedValueOnce(new Error('db'));
      await expect(service.createMed(dto)).rejects.toThrow(new InternalServerErrorException('Error al crear medicamento'));
    });
  });

  describe('updateMed', () => {
    it('404 si no existe', async () => {
      await expect(service.updateMed(3, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('actualiza las relaciones que llegan y devuelve el medicamento actualizado', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 3 }).mockResolvedValueOnce({ id: 3, name: 'Nuevo' });
      await expect(
        service.updateMed('3' as any, { name: 'Nuevo', drug: 1, shape: 2, type: 3, measurementUnit: 4 } as any),
      ).resolves.toEqual({ id: 3, name: 'Nuevo' });
      expect(repo.update).toHaveBeenCalledWith(
        { id: 3 },
        { name: 'Nuevo', drug: { id: 1 }, shape: { id: 2 }, type: { id: 3 }, measurementUnit: { id: 4 } },
      );
    });

    it('sin relaciones sólo cambia los campos simples', async () => {
      repo.findOne.mockResolvedValue({ id: 3 });
      await service.updateMed(3, { dosage: 500 } as any);
      expect(repo.update).toHaveBeenCalledWith({ id: 3 }, { dosage: 500 });
    });

    it('un nombre repetido es 409; otro error, 500', async () => {
      repo.findOne.mockResolvedValue({ id: 3 });
      repo.update.mockRejectedValueOnce({ code: '23505' });
      await expect(service.updateMed(3, { name: 'X' } as any)).rejects.toBeInstanceOf(ConflictException);
      repo.update.mockRejectedValueOnce(new Error('db'));
      await expect(service.updateMed(3, { name: 'X' } as any)).rejects.toThrow('Error al actualizar medicamento');
    });
  });

  it('deleteMed es una baja lógica', async () => {
    await service.deleteMed(3);
    expect(repo.update).toHaveBeenCalledWith({ id: 3 }, { deleted: true });
  });
});
