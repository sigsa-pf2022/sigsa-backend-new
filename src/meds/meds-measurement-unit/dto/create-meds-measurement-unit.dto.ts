import { IsNotEmpty } from 'class-validator';
export class CreateMedsMeasurementUnitDto {
  @IsNotEmpty()
  name: string;
 
}
