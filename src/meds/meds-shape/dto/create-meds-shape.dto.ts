import { IsNotEmpty } from 'class-validator';
export class CreateMedsShapeDto {
  @IsNotEmpty()
  name: string;
 
}
