import { IsIn, IsNotEmpty, IsNumber } from 'class-validator';

export class CreatePatientProfessionalDto {
  @IsNumber()
  @IsNotEmpty()
  patientId: number;

  @IsIn(['user', 'dependent'])
  @IsNotEmpty()
  patientType: string;
}
