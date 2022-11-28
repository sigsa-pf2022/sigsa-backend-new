import { IsNotEmpty, IsOptional } from 'class-validator';
import { MedsDrug } from 'src/meds/meds-drug/meds-drug.entity';
import { MedsMeasurementUnit } from 'src/meds/meds-measurement-unit/meds-measurement-unit.entity';
import { MedsShape } from 'src/meds/meds-shape/meds-shape.entity';
import { MedsType } from 'src/meds/meds-type/meds-type.entity';
export class UpdateMedsDto {
  @IsNotEmpty()
  name: string;
  @IsOptional()
  laboratory: string;
  @IsOptional()
  code: number;
  @IsNotEmpty()
  dosage: number;

  @IsNotEmpty()
  drug: MedsDrug;
  @IsNotEmpty()
  shape: MedsShape;

  @IsNotEmpty()
  type: MedsType;

  @IsNotEmpty()
  measurementUnit: MedsMeasurementUnit;
}
