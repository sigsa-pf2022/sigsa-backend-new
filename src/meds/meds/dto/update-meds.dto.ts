import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateMedsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  laboratory?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  code?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  dosage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  drug?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  shape?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  type?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  measurementUnit?: number;
}
