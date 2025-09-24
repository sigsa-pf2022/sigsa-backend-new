import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class UpdateMedEventDto {
  @IsOptional()
  @IsInt()
  medId?: number;

  @IsOptional()
  @IsDateString()
  date?: string;
}
