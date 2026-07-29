import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Campos editables desde "Mis datos".
 * Quedan fuera a propósito: email y dni (identificadores únicos),
 * password (se cambia por el flujo de recuperación) y role.
 */
export class UpdateUserDto {
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
