import { IsNotEmpty } from 'class-validator';
export class CreateMyProfessionalDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;
}
