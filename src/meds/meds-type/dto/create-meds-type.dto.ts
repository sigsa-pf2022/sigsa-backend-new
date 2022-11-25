import { IsNotEmpty } from 'class-validator';
export class CreateMedsTypeDto {
  @IsNotEmpty()
  name: string;
 
  @IsNotEmpty()
  description: string;
 
}
