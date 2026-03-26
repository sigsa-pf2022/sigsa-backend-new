import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDocumentDTO {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  fileContent: string; // Base64 encoded file

  @IsNotEmpty()
  @IsString()
  fileName: string;

  @IsNotEmpty()
  @IsString()
  mimeType: string;

  @IsNotEmpty()
  @IsNumber()
  fileSize: number;

  @IsNotEmpty()
  @IsDateString()
  documentDate: string;

  @IsNotEmpty()
  @IsDateString()
  date: string; // For NotificationEvent compatibility
}
