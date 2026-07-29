import { IsDateString, IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Tope de tomas por tratamiento, para no inundar el scheduler. */
export const MAX_DOSES_PER_TREATMENT = 180;

export class CreateMedEventDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  medId: number;

  // ISO 8601 string -> se transformará a Date en el service
  // Es la primera (o única) toma.
  @IsDateString()
  date: string;

  /**
   * Horas entre tomas. Si viene junto con `durationDays` se genera un
   * tratamiento periódico; si no, es una toma única.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  intervalHours?: number;

  /** Duración del tratamiento, en días. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  durationDays?: number;
}
