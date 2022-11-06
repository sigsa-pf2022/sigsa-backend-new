import { IsNotEmpty, IsDateString } from 'class-validator';
import { BloodType } from '../entities/dependent.entity';
export class CreateDependentDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  @IsDateString()
  birthday: string;

  @IsNotEmpty()
  dni: string;

  @IsNotEmpty()
  bloodType: BloodType;
}
