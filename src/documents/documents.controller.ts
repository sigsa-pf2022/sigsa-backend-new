import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UsersService } from 'src/users/users.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { DocumentsService } from './documents.service';
import { CreateDocumentDTO } from './dto/create-document.dto';
import { EditDocumentDTO } from './dto/edit-document.dto';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private userService: UsersService,
    private familyGroupsService: FamilyGroupsService,
  ) {}

  @Get()
  async getDocumentsByUserId(@Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    const documents = await this.documentsService.getDocumentsByUser(user);
    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      documentDate: doc.documentDate,
      date: doc.date,
      status: doc.status,
      createdAt: doc.createdAt,
    }));
  }

  @Get('dependent/:id')
  async getDocumentsByDependentId(
    @Param('id', ParseIntPipe) dependentId: number,
  ) {
    const dependent = await this.familyGroupsService.getDependentById(
      dependentId,
    );
    if (!dependent) {
      throw new HttpException(
        {
          message: 'Dependiente no encontrado',
          status: 'error',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const documents = await this.documentsService.getDocumentsByDependent(
      dependent,
    );
    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      documentDate: doc.documentDate,
      date: doc.date,
      status: doc.status,
      createdAt: doc.createdAt,
    }));
  }

  @Get(':id')
  async getDocument(@Param('id', ParseIntPipe) id: number) {
    const document = await this.documentsService.getDocumentById(id);
    if (!document) {
      throw new HttpException(
        {
          message: 'Documento no encontrado',
          status: 'error',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return document;
  }

  @Get(':id/download')
  async downloadDocument(@Param('id', ParseIntPipe) id: number) {
    const document = await this.documentsService.getDocumentById(id);
    if (!document) {
      throw new HttpException(
        {
          message: 'Documento no encontrado',
          status: 'error',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    // Retorna el contenido base64 para descarga/visualización
    return {
      fileContent: document.fileContent,
      fileName: document.fileName,
      mimeType: document.mimeType,
    };
  }

  @Post()
  async createDocument(@Body() documentDto: CreateDocumentDTO, @Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    const document = await this.documentsService.createDocument(
      documentDto,
      user,
    );
    return {
      message: 'Documento creado exitosamente',
      status: 'success',
      data: {
        id: document.id,
        title: document.title,
        documentDate: document.documentDate,
      },
    };
  }

  @Post('dependent/:id')
  async createDocumentForDependent(
    @Body() documentDto: CreateDocumentDTO,
    @Param('id', ParseIntPipe) dependentId: number,
  ) {
    const dependent = await this.familyGroupsService.getDependentById(
      dependentId,
    );
    if (!dependent) {
      throw new HttpException(
        {
          message: 'Dependiente no encontrado',
          status: 'error',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const document = await this.documentsService.createDocument(
      documentDto,
      dependent,
    );
    return {
      message: 'Documento creado exitosamente',
      status: 'success',
      data: {
        id: document.id,
        title: document.title,
        documentDate: document.documentDate,
      },
    };
  }

  @Put(':id')
  async updateDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() editDto: EditDocumentDTO,
  ) {
    try {
      const document = await this.documentsService.updateDocument(id, editDto);
      return {
        message: 'Documento actualizado exitosamente',
        status: 'success',
        data: document,
      };
    } catch (error) {
      throw new HttpException(
        {
          message: error.message,
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async deleteDocument(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.documentsService.deleteDocument(id);
      return {
        message: 'Documento eliminado exitosamente',
        status: 'success',
      };
    } catch (error) {
      throw new HttpException(
        {
          message: error.message,
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('cancel/:id')
  async cancelDocument(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.documentsService.cancelDocument(id);
      return {
        message: 'Documento cancelado exitosamente',
        status: 'success',
      };
    } catch (error) {
      throw new HttpException(
        {
          message: error.message,
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
