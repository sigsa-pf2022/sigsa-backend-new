import { IsNotEmpty, IsDateString } from 'class-validator';
export class CreateFamilyGroupDto {
  @IsNotEmpty()
  name: string;

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
  bloodType: string;

  @IsNotEmpty()
  members: any[];
}
