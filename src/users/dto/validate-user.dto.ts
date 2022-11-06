import {
  IsNotEmpty,
  MinLength,
  IsEmail,
  MaxLength,
  IsNumberString,
} from 'class-validator';
export class ValidateUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  @IsNumberString()
  veficationCode: string;
}
