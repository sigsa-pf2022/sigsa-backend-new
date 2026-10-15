import {
  IsIn,
  IsNotEmpty,
  IsEmail,
  Min,
  Max,
} from 'class-validator';
export class ValidateUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  /** Qué código se valida: el de alta de cuenta o el de recuperar contraseña. */
  @IsNotEmpty()
  @IsIn(['verificationCode', 'recoveryPasswordToken'])
  field: 'verificationCode' | 'recoveryPasswordToken';

  @IsNotEmpty()
  @Min(100000)
  @Max(999999)
  code: number;
}
