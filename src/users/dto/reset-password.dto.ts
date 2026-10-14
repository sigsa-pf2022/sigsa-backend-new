import { IsEmail, IsNotEmpty, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  /** El código que llegó por mail; sin él cualquiera podía cambiar la clave. */
  @IsNotEmpty()
  @Type(() => Number)
  @Min(100000)
  @Max(999999)
  code: number;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
