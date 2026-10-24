/**
 * Dobles de prueba para los repositorios de TypeORM. Sólo se usan desde los
 * `*.spec.ts`: dejan que cada prueba configure lo que devuelve la "base" sin
 * levantar Postgres.
 */
export type MockRepository = {
  [K in
    | 'find'
    | 'findOne'
    | 'findOneBy'
    | 'findAndCount'
    | 'count'
    | 'create'
    | 'save'
    | 'update'
    | 'remove'
    | 'createQueryBuilder']: jest.Mock;
} & { manager?: any };

/** Query builder encadenable: cada método devuelve el mismo objeto. */
export function mockQueryBuilder(result: {
  getMany?: any[];
  getCount?: number;
  getRawMany?: any[];
  getRawOne?: any;
} = {}) {
  const qb: any = {};
  for (const method of [
    'leftJoinAndSelect',
    'innerJoin',
    'where',
    'andWhere',
    'select',
    'addSelect',
    'setParameter',
    'orderBy',
    'addOrderBy',
    'offset',
    'limit',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getMany = jest.fn(async () => result.getMany ?? []);
  qb.getCount = jest.fn(async () => result.getCount ?? 0);
  qb.getRawMany = jest.fn(async () => result.getRawMany ?? []);
  qb.getRawOne = jest.fn(async () => result.getRawOne);
  return qb;
}

export function mockRepository(): MockRepository {
  return {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    findOneBy: jest.fn(async () => null),
    findAndCount: jest.fn(async () => [[], 0]),
    count: jest.fn(async () => 0),
    // `create` devuelve lo que recibe y `save` lo devuelve tal cual, como hace
    // TypeORM salvo por el id generado.
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => entity),
    update: jest.fn(async () => ({ affected: 1 })),
    remove: jest.fn(async (entity) => entity),
    createQueryBuilder: jest.fn(() => mockQueryBuilder()),
  };
}

/** Deja correr las promesas que el código dispara sin esperar. */
export const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
