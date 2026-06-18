import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class EditDocumentDTO {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  status?: string;

  // Reemplazo de archivo (opcional, al editar la imagen del documento)
  @IsOptional()
  @IsString()
  fileContent?: string; // Base64

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;
}
