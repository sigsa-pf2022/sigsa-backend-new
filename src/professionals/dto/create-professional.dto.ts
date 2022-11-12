import { IsNotEmpty } from 'class-validator';
export class CreateProfessionalDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  field: string;

  @IsNotEmpty()
  clinic: string;

  @IsNotEmpty()
  streetName: string;

  @IsNotEmpty()
  streetNumber: number;
}
