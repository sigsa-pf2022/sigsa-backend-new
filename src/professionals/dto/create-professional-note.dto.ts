import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProfessionalNoteDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'La indicación no puede estar vacía' })
  @MaxLength(1000, { message: 'La indicación no puede superar los 1000 caracteres' })
  content: string;
}
