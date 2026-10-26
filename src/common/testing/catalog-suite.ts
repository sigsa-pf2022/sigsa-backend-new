import { HttpException, HttpStatus, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockRepository } from './mock-repository';

/**
 * Los catálogos del backoffice (droga, forma, tipo, unidad de medida) son el
 * mismo CRUD con distinto nombre. Esta suite prueba servicio y controlador de
 * cualquiera de ellos a partir de sus nombres.
 */
export function describeCatalog(config: {
  name: string;
  entity: Type<unknown>;
  service: Type<any>;
  controller: Type<any>;
  /** Sufijo de los métodos: 'Drug' → getAllDrugs, getDrugs, getDrugById... */
  singular: string;
  plural: string;
  duplicateMessage: string;
  /** Tipos además filtra por descripción. */
  filtersByDescription?: boolean;
}) {
  const { singular: S, plural: P } = config;

  describe(`${config.name} (servicio)`, () => {
    let service: any;
    let repo: ReturnType<typeof mockRepository>;

    beforeEach(async () => {
      repo = mockRepository();
      const module = await Test.createTestingModule({
        providers: [config.service, { provide: getRepositoryToken(config.entity), useValue: repo }],
      }).compile();
      service = module.get(config.service);
    });

    it('lista todo ordenado por nombre', async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      await expect(service[`getAll${P}`]()).resolves.toEqual([{ id: 1 }]);
      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });

    it('pagina y filtra por nombre y baja lógica', async () => {
      await service[`get${P}`]('2', '5', 'true', 'para', 'oral');
      const args = repo.findAndCount.mock.calls[0][0];
      expect(args).toMatchObject({ take: 5, skip: 10, order: { name: 'ASC' } });
      expect(args.where.deleted).toBe(true);
      expect(args.where.name).toBeDefined();
      expect(args.where.description !== undefined).toBe(!!config.filtersByDescription);

      // Sin filtro, el listado excluye los dados de baja.
      await service[`get${P}`](undefined, undefined, undefined, undefined);
      expect(repo.findAndCount.mock.calls[1][0]).toMatchObject({ take: 10, skip: 0 });
      expect(repo.findAndCount.mock.calls[1][0].where).toEqual({ deleted: false });
    });

    it('busca por id y por nombre', async () => {
      await service[`get${S}ById`](3);
      await service[`get${S}ByName`]('Comprimido');
      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 3 });
      expect(repo.findOneBy).toHaveBeenCalledWith({ name: 'Comprimido' });
    });

    it('crea, renombra y da de baja lógica', async () => {
      await expect(service[`create${S}`]({ name: 'Nuevo' })).resolves.toEqual({ name: 'Nuevo' });
      await service[`update${S}`](3, { name: 'Otro', deleted: true });
      expect(repo.update).toHaveBeenCalledWith({ id: 3 }, { name: 'Otro' });
      await service[`delete${S}`](3);
      expect(repo.update).toHaveBeenLastCalledWith({ id: 3 }, { deleted: true });
    });
  });

  describe(`${config.name} (controlador)`, () => {
    let controller: any;
    let service: Record<string, jest.Mock>;
    const methods = [`getAll${P}`, `get${P}`, `get${S}ById`, `get${S}ByName`, `create${S}`, `update${S}`, `delete${S}`];

    beforeEach(async () => {
      service = Object.fromEntries(methods.map((m) => [m, jest.fn(async () => null)]));
      const module = await Test.createTestingModule({
        controllers: [config.controller],
        providers: [{ provide: config.service, useValue: service }],
      }).compile();
      controller = module.get(config.controller);
    });

    it('GET all y GET paginado', async () => {
      service[`getAll${P}`].mockResolvedValue([{ id: 1 }]);
      await expect(controller[`getAll${P}`]()).resolves.toEqual([{ id: 1 }]);
      service[`get${P}`].mockResolvedValue([[{ id: 1 }], 9]);
      await expect(
        controller[`get${P}`]({ query: { page: '1', take: '5', deleted: 'false', name: 'x', description: 'd' } }),
      ).resolves.toEqual({ data: [{ id: 1 }], count: 9, total: 9 });
      expect(service[`get${P}`]).toHaveBeenCalledWith(
        '1',
        '5',
        'false',
        'x',
        ...(config.filtersByDescription ? ['d'] : []),
      );
    });

    it('POST rechaza un nombre repetido con 400', async () => {
      service[`get${S}ByName`].mockResolvedValue({ id: 1 });
      const err = await controller[`create${S}`]({}, { name: 'Repetido' }).catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(err.getResponse()).toEqual({ message: config.duplicateMessage, status: 'error' });
      expect(service[`create${S}`]).not.toHaveBeenCalled();
    });

    it('POST crea si el nombre es nuevo', async () => {
      service[`create${S}`].mockResolvedValue({ id: 2 });
      await expect(controller[`create${S}`]({}, { name: 'Nuevo' })).resolves.toEqual({ id: 2 });
      expect(service[`create${S}`]).toHaveBeenCalledWith({ name: 'Nuevo' });
    });

    it('GET/PUT/DELETE por id delegan con el id de la ruta', async () => {
      const req = { params: { id: '3' } };
      await controller[`get${S}ById`](req);
      expect(service[`get${S}ById`]).toHaveBeenCalledWith('3');
      await controller[`update${S}`](req, { name: 'x' });
      expect(service[`update${S}`]).toHaveBeenCalledWith('3', { name: 'x' });
      await controller[`delete${S}`](req);
      expect(service[`delete${S}`]).toHaveBeenCalledWith('3');
    });

    it('propaga los errores del servicio', async () => {
      service[`delete${S}`].mockRejectedValue(new Error('db'));
      await expect(controller[`delete${S}`]({ params: { id: '3' } })).rejects.toThrow('db');
    });
  });
}
