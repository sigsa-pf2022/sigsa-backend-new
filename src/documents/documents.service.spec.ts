import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { User } from 'src/users/entities/user.entity';
import { DocumentsService } from './documents.service';
import { MedicalDocument } from './medical-document.entity';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repo: MockRepository;
  let familyGroups: { getFamilyGroupById: jest.Mock };

  const user = Object.assign(new User(), { id: 1 });
  const dependent = Object.assign(new Dependent(), { id: 10 });
  const dto = {
    title: 'Análisis',
    description: 'Sangre',
    fileContent: 'data:image/png;base64,AAA',
    fileName: 'a.png',
    mimeType: 'image/png',
    fileSize: 3,
    documentDate: '2026-10-01',
    date: '2026-10-02',
  };

  beforeEach(async () => {
    repo = mockRepository();
    familyGroups = { getFamilyGroupById: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: getRepositoryToken(MedicalDocument), useValue: repo },
        { provide: NotificationsService, useValue: {} },
        { provide: FamilyGroupsService, useValue: familyGroups },
      ],
    }).compile();
    service = module.get(DocumentsService);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('createDocument', () => {
    it('guarda el documento del usuario con las fechas convertidas', async () => {
      repo.save.mockImplementation(async (d) => ({ ...d, id: 5 }));
      const saved = await service.createDocument(dto as any, user);
      expect(saved).toMatchObject({ id: 5, createdById: 1, createdByType: 'user', title: 'Análisis' });
      expect(saved.documentDate).toEqual(new Date('2026-10-01'));
      expect(saved.date).toEqual(new Date('2026-10-02'));
    });

    it('para un dependiente queda como "dependent", aun sin archivo', async () => {
      const saved = await service.createDocument({ ...dto, fileContent: undefined } as any, dependent);
      expect(saved.createdByType).toBe('dependent');
    });
  });

  describe('listados (sin los cancelados)', () => {
    it('del usuario, del dependiente y del paciente para el profesional', async () => {
      await service.getDocumentsByUser(user);
      await service.getDocumentsByDependent(dependent);
      await service.getDocumentsByPatient(10, 'dependent');
      const [byUser, byDependent, byPatient] = repo.find.mock.calls.map((c) => c[0]);
      expect(byUser.where).toMatchObject({ createdById: 1, createdByType: 'user' });
      expect(byDependent.where).toMatchObject({ createdById: 10, createdByType: 'dependent' });
      expect(byPatient.where).toMatchObject({ createdById: 10, createdByType: 'dependent' });
      for (const call of [byUser, byDependent, byPatient]) {
        expect(call.where.status.value).toBe(EventStatus.CANCELED);
      }
      // El profesional no recibe el contenido del archivo en el listado.
      expect(byPatient.select).not.toContain('fileContent');
      expect(byUser.select).toContain('fileContent');
    });

    it('getDocumentById carga el contenido explícitamente', async () => {
      repo.findOne.mockResolvedValue({ id: 5, fileContent: 'AAA' });
      await expect(service.getDocumentById(5)).resolves.toEqual({ id: 5, fileContent: 'AAA' });
      expect(repo.findOne.mock.calls[0][0].select.fileContent).toBe(true);
      repo.findOne.mockResolvedValue(null);
      await expect(service.getDocumentById(6)).resolves.toBeNull();
    });
  });

  describe('updateDocument', () => {
    it('documento inexistente', async () => {
      await expect(service.updateDocument(5, {} as any)).rejects.toThrow('Documento no encontrado');
    });

    it('cambia sólo lo que llega y reemplaza el archivo si viene uno nuevo', async () => {
      repo.findOne.mockResolvedValue({ id: 5, title: 'Viejo', description: 'd', fileName: 'a.png', fileSize: 3 });
      const saved: any = await service.updateDocument(5, {
        title: 'Nuevo',
        description: '',
        documentDate: '2026-10-05',
        date: '2026-10-06',
        status: EventStatus.CONFIRMED,
        fileContent: 'BBB',
        fileName: 'b.pdf',
        mimeType: 'application/pdf',
        fileSize: 0,
      } as any);
      expect(saved).toMatchObject({
        title: 'Nuevo',
        description: '',
        status: EventStatus.CONFIRMED,
        fileContent: 'BBB',
        fileName: 'b.pdf',
        mimeType: 'application/pdf',
        fileSize: 0,
      });
      expect(saved.documentDate).toEqual(new Date('2026-10-05'));
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('sin archivo nuevo conserva el anterior aunque lleguen nombre o tipo', async () => {
      repo.findOne.mockResolvedValue({ id: 5, title: 'T', fileName: 'a.png' });
      const saved: any = await service.updateDocument(5, { fileName: 'b.pdf' } as any);
      expect(saved).toMatchObject({ title: 'T', fileName: 'a.png' });

      repo.findOne.mockResolvedValue({ id: 5, fileName: 'a.png', mimeType: 'image/png', fileSize: 3 });
      const soloContenido: any = await service.updateDocument(5, { fileContent: 'CCC' } as any);
      expect(soloContenido).toMatchObject({ fileContent: 'CCC', fileName: 'a.png', mimeType: 'image/png', fileSize: 3 });
    });
  });

  describe('deleteDocument / cancelDocument', () => {
    it('documento inexistente', async () => {
      await expect(service.deleteDocument(5)).rejects.toThrow('Documento no encontrado');
      await expect(service.cancelDocument(5)).rejects.toThrow('Documento no encontrado');
    });

    it('borrar lo elimina; cancelar lo marca', async () => {
      repo.findOne.mockResolvedValue({ id: 5 });
      await service.deleteDocument(5);
      expect(repo.remove).toHaveBeenCalledWith({ id: 5 });
      repo.findOne.mockResolvedValue({ id: 6 });
      await expect(service.cancelDocument(6)).resolves.toMatchObject({ id: 6, status: EventStatus.CANCELED });
    });
  });

  describe('getDocumentsByGroupMembers', () => {
    it('grupo inexistente', async () => {
      await expect(service.getDocumentsByGroupMembers(1)).rejects.toThrow('Grupo familiar no encontrado');
    });

    it('con grupo devuelve los documentos no cancelados', async () => {
      familyGroups.getFamilyGroupById.mockResolvedValue({ id: 1 });
      repo.find.mockResolvedValue([{ id: 1 }]);
      await expect(service.getDocumentsByGroupMembers(1)).resolves.toEqual([{ id: 1 }]);
    });
  });
});
