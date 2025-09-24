import { IsDateString, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMedEventDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  medId: number;

  // ISO 8601 string -> se transformará a Date en el service
  @IsDateString()
  date: string;
}
