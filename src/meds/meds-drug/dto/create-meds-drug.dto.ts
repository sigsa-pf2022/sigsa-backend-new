import { IsNotEmpty } from 'class-validator';
export class CreateMedsDrugDto {
  @IsNotEmpty()
  name: string;
 
}
