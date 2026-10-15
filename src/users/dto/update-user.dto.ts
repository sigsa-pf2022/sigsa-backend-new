import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsImageDataUri } from '../validators/is-image-data-uri';

/**
 * Campos editables desde "Mis datos".
 * Quedan fuera a propósito: email y dni (identificadores únicos),
 * password (se cambia por el flujo de recuperación) y role.
 */
export class UpdateUserDto {
  /** Data URI de la foto de perfil, o null para borrarla. */
  @IsOptional()
  @IsImageDataUri()
  photo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsIn(['M', 'F', 'PNF'])
  gender?: string;

  @IsOptional()
  @IsDateString()
  birthday?: string;
}
