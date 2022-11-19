import { IsEmail, IsNotEmpty } from 'class-validator';
import { State } from 'src/geography/entities/state.entity';
import { ProfessionalSpecialization } from '../entities/professional-specialization.entity';
export class CreateProfessionalDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  birthday: Date;

  @IsNotEmpty()
  dni: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  gender: string;

  @IsNotEmpty()
  jurisdiction: State[];

  @IsNotEmpty()
  licenseNumber: number;

  @IsNotEmpty()
  password: string;
  
  @IsNotEmpty()
  specialization: ProfessionalSpecialization[];
}
