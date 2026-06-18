import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { MedicalDocument } from './medical-document.entity';
import { CreateDocumentDTO } from './dto/create-document.dto';
import { EditDocumentDTO } from './dto/edit-document.dto';
import { User } from 'src/users/entities/user.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(MedicalDocument)
    private documentRepository: Repository<MedicalDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly familyGroupsService: FamilyGroupsService,
  ) {}

  // Helper para determinar el tipo de creador
  private getCreatorType(creator: User | Dependent): string {
    if (creator instanceof Dependent) {
      return 'dependent';
    } else {
      return 'user';
    }
  }

  async createDocument(
    documentDto: CreateDocumentDTO,
    creator: User | Dependent,
  ) {
    console.log('Creating document with fileContent length:', documentDto.fileContent?.length || 0);
    
    const newDocument = this.documentRepository.create({
      createdById: creator.id,
      createdByType: this.getCreatorType(creator),
      title: documentDto.title,
      description: documentDto.description,
      fileContent: documentDto.fileContent,
      fileName: documentDto.fileName,
      mimeType: documentDto.mimeType,
      fileSize: documentDto.fileSize,
      documentDate: new Date(documentDto.documentDate),
      date: new Date(documentDto.date),
    });

    const saved = await this.documentRepository.save(newDocument);
    console.log('Document saved with ID:', saved.id, 'fileContent length:', saved.fileContent?.length || 0);
    
    await this.tryCreateNotificationForDocument(saved, creator);
    return saved;
  }

  async getDocumentsByUser(user: User) {
    return this.documentRepository.find({
      where: {
        createdById: user.id,
        createdByType: 'user',
        status: Not(EventStatus.CANCELED),
      },
      order: {
        documentDate: 'DESC',
      },
      select: [
        'id',
        'title',
        'description',
        'fileName',
        'mimeType',
        'fileSize',
        'fileContent', // necesario para renderizar el thumbnail de imágenes en el listado
        'documentDate',
        'date',
        'status',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async getDocumentsByDependent(dependent: Dependent) {
    return this.documentRepository.find({
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
        status: Not(EventStatus.CANCELED),
      },
      order: {
        documentDate: 'DESC',
      },
      select: [
        'id',
        'title',
        'description',
        'fileName',
        'mimeType',
        'fileSize',
        'fileContent', // necesario para renderizar el thumbnail de imágenes en el listado
        'documentDate',
        'date',
        'status',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async getDocumentsByPatient(patientId: number, patientType: string) {
    return this.documentRepository.find({
      where: {
        createdById: patientId,
        createdByType: patientType,
        status: Not(EventStatus.CANCELED),
      },
      order: {
        documentDate: 'DESC',
      },
      select: [
        'id',
        'title',
        'description',
        'fileName',
        'mimeType',
        'fileSize',
        'documentDate',
        'date',
        'status',
        'createdAt',
        'updatedAt',
      ],
    });
  }

  async getDocumentById(id: number) {
    // IMPORTANTE: Incluir fileContent explícitamente porque TypeORM no carga campos TEXT grandes por defecto
    const doc = await this.documentRepository.findOne({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        fileContent: true, // CRÍTICO: Sin esto TypeORM no carga el campo
        documentDate: true,
        date: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        createdByType: true,
      },
    });
    console.log('getDocumentById:', id, 'found:', !!doc, 'hasFileContent:', !!doc?.fileContent, 'length:', doc?.fileContent?.length || 0);
    return doc;
  }

  async updateDocument(id: number, editDto: EditDocumentDTO) {
    const document = await this.getDocumentById(id);
    if (!document) {
      throw new Error('Documento no encontrado');
    }

    if (editDto.title) document.title = editDto.title;
    if (editDto.description !== undefined) document.description = editDto.description;
    if (editDto.documentDate) document.documentDate = new Date(editDto.documentDate);
    if (editDto.date) document.date = new Date(editDto.date);
    if (editDto.status) document.status = editDto.status;

    // Reemplazo de la imagen/archivo (opcional)
    if (editDto.fileContent) {
      document.fileContent = editDto.fileContent;
      if (editDto.fileName) document.fileName = editDto.fileName;
      if (editDto.mimeType) document.mimeType = editDto.mimeType;
      if (editDto.fileSize !== undefined) document.fileSize = editDto.fileSize;
    }

    document.updatedAt = new Date();
    return this.documentRepository.save(document);
  }

  async deleteDocument(id: number) {
    const document = await this.getDocumentById(id);
    if (!document) {
      throw new Error('Documento no encontrado');
    }
    return this.documentRepository.remove(document);
  }

  async cancelDocument(id: number) {
    const document = await this.getDocumentById(id);
    if (!document) {
      throw new Error('Documento no encontrado');
    }
    document.status = EventStatus.CANCELED;
    document.updatedAt = new Date();
    return this.documentRepository.save(document);
  }

  // Notificaciones para documentos (simplificado - se puede expandir después)
  private async tryCreateNotificationForDocument(
    document: MedicalDocument,
    creator: User | Dependent,
  ) {
    try {
      // TODO: Implementar notificaciones cuando se defina la estructura para documentos
      console.log(`Documento creado: ${document.title} por ${creator.id}`);
    } catch (error) {
      console.error('Error creating notification for document:', error);
    }
  }

  async getDocumentsByGroupMembers(groupId: number) {
    const group = await this.familyGroupsService.getFamilyGroupById(groupId);
    if (!group) {
      throw new Error('Grupo familiar no encontrado');
    }

    // Por ahora solo devolvemos los documentos del creador del grupo
    // Se puede expandir para incluir dependientes
    const documents = await this.documentRepository.find({
      where: {
        status: Not(EventStatus.CANCELED),
      },
      order: {
        documentDate: 'DESC',
      },
      select: [
        'id',
        'title',
        'description',
        'fileName',
        'mimeType',
        'fileSize',
        'fileContent', // necesario para renderizar el thumbnail de imágenes en el listado
        'documentDate',
        'date',
        'status',
        'createdAt',
        'updatedAt',
      ],
    });

    return documents;
  }
}
