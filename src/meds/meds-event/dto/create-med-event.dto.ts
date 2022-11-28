import { Meds } from 'src/meds/meds/meds.entity';

export class CreateMedEventDto {
  med: Meds;
  date: string;
}
