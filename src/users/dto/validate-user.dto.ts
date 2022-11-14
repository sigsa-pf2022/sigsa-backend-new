import {
  IsNotEmpty,
  IsEmail,
  Min,
  Max,
} from 'class-validator';
export class ValidateUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  field: string;

  @IsNotEmpty()
  @Min(100000)
  @Max(999999)
  code: number;
}
