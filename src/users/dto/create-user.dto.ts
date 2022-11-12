import { IsNotEmpty, MinLength, IsEmail, IsDateString } from 'class-validator';
import { Role } from 'src/roles/enums/role.enum';
export class CreateUserDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  gender: string;

  @IsNotEmpty()
  dni: string;

  @IsNotEmpty()
  @IsDateString()
  birthday: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
