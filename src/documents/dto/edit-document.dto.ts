import { IsDateString, IsOptional, IsString } from 'class-validator';

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
}
