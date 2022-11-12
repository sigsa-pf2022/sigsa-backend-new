import { IsNotEmpty } from 'class-validator';
export class CreateProfessionalSpecializationDto {
  @IsNotEmpty()
  name: string;

  description: string;
}
