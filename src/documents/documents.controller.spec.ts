import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { UsersService } from 'src/users/users.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let documents: Record<
    | 'getDocumentsByUser'
    | 'getDocumentsByDependent'
    | 'getDocumentById'
    | 'createDocument'
    | 'updateDocument'
    | 'deleteDocument'
    | 'cancelDocument',
    jest.Mock
  >;
  let users: { getUserById: jest.Mock };
  let familyGroups: { getDependentById: jest.Mock };

  const req = { user: { id: 1 } };
  const doc = {
    id: 5,
    title: 'Análisis',
    description: 'Sangre',
    fileName: 'a.png',
    mimeType: 'image/png',
    fileSize: 3,
    fileContent: 'AAA',
    documentDate: new Date('2026-10-01'),
    date: new Date('2026-10-02'),
    status: 'created',
    createdAt: new Date('2026-10-03'),
    updatedAt: new Date('2026-10-04'),
  };
  const listItem = {
    id: 5,
    title: 'Análisis',
    description: 'Sangre',
    fileName: 'a.png',
    mimeType: 'image/png',
    fileSize: 3,
    documentDate: doc.documentDate,
    date: doc.date,
    status: 'created',
    createdAt: doc.createdAt,
  };

  /** Status HTTP y mensaje del error que recibe el cliente. */
  const httpError = async (promise: Promise<unknown>) => {
    const err = await promise.then(
      () => {
        throw new Error('Se esperaba un error');
      },
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    return [err.getStatus(), err.getResponse().message];
  };

  beforeEach(async () => {
    documents = {
      getDocumentsByUser: jest.fn(async () => [doc]),
      getDocumentsByDependent: jest.fn(async () => [doc]),
      getDocumentById: jest.fn(async () => doc),
      createDocument: jest.fn(async () => doc),
      updateDocument: jest.fn(async () => doc),
      deleteDocument: jest.fn(),
      cancelDocument: jest.fn(),
    };
    users = { getUserById: jest.fn(async () => ({ id: 1 })) };
    familyGroups = { getDependentById: jest.fn(async () => ({ id: 10 })) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: documents },
        { provide: UsersService, useValue: users },
        { provide: FamilyGroupsService, useValue: familyGroups },
      ],
    }).compile();
    controller = module.get(DocumentsController);
  });

  it('GET /documents: los del usuario del token, sin el contenido del archivo', async () => {
    await expect(controller.getDocumentsByUserId(req)).resolves.toEqual([listItem]);
    expect(users.getUserById).toHaveBeenCalledWith(1);
    expect(documents.getDocumentsByUser).toHaveBeenCalledWith({ id: 1 });
  });

  it('GET /documents/dependent/:id: 404 si no existe el dependiente', async () => {
    familyGroups.getDependentById.mockResolvedValue(null);
    await expect(httpError(controller.getDocumentsByDependentId(10))).resolves.toEqual([
      HttpStatus.NOT_FOUND,
      'Dependiente no encontrado',
    ]);
    expect(documents.getDocumentsByDependent).not.toHaveBeenCalled();
  });

  it('GET /documents/dependent/:id: lista los del dependiente', async () => {
    await expect(controller.getDocumentsByDependentId(10)).resolves.toEqual([listItem]);
    expect(documents.getDocumentsByDependent).toHaveBeenCalledWith({ id: 10 });
  });

  it('GET /documents/:id y /download: 404 si no existe', async () => {
    documents.getDocumentById.mockResolvedValue(null);
    await expect(httpError(controller.getDocument(5))).resolves.toEqual([HttpStatus.NOT_FOUND, 'Documento no encontrado']);
    await expect(httpError(controller.downloadDocument(5))).resolves.toEqual([HttpStatus.NOT_FOUND, 'Documento no encontrado']);
  });

  it('GET /documents/:id y /download devuelven el documento y el archivo', async () => {
    await expect(controller.getDocument(5)).resolves.toBe(doc);
    await expect(controller.downloadDocument(5)).resolves.toEqual({
      fileContent: 'AAA',
      fileName: 'a.png',
      mimeType: 'image/png',
    });
    expect(documents.getDocumentById).toHaveBeenCalledWith(5);
  });

  it('POST /documents crea para el usuario del token', async () => {
    const dto = { title: 'Análisis' } as any;
    await expect(controller.createDocument(dto, req)).resolves.toEqual({
      message: 'Documento creado exitosamente',
      status: 'success',
      data: { id: 5, title: 'Análisis', documentDate: doc.documentDate },
    });
    expect(documents.createDocument).toHaveBeenCalledWith(dto, { id: 1 });
  });

  it('POST /documents/dependent/:id: 404 sin dependiente; si existe crea para él', async () => {
    familyGroups.getDependentById.mockResolvedValueOnce(null);
    await expect(httpError(controller.createDocumentForDependent({} as any, 10))).resolves.toEqual([
      HttpStatus.NOT_FOUND,
      'Dependiente no encontrado',
    ]);
    await expect(controller.createDocumentForDependent({ title: 'x' } as any, 10)).resolves.toMatchObject({
      status: 'success',
      data: { id: 5 },
    });
    expect(documents.createDocument).toHaveBeenCalledWith({ title: 'x' }, { id: 10 });
  });

  it.each([
    ['updateDocument', 'updateDocument', [5, { title: 'x' }], 'Documento actualizado exitosamente'],
    ['deleteDocument', 'deleteDocument', [5], 'Documento eliminado exitosamente'],
    ['cancelDocument', 'cancelDocument', [5], 'Documento cancelado exitosamente'],
  ])('%s delega y responde éxito; un error del servicio se vuelve 400', async (method, serviceMethod, args, message) => {
    await expect((controller as any)[method](...args)).resolves.toMatchObject({ message, status: 'success' });
    expect(documents[serviceMethod]).toHaveBeenCalledWith(...args);

    documents[serviceMethod].mockRejectedValue(new Error('Documento no encontrado'));
    await expect(httpError((controller as any)[method](...args))).resolves.toEqual([
      HttpStatus.BAD_REQUEST,
      'Documento no encontrado',
    ]);
  });
});
