import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MedsDrug } from '../meds-drug/meds-drug.entity';
import { MedsMeasurementUnit } from '../meds-measurement-unit/meds-measurement-unit.entity';
import { MedsShape } from '../meds-shape/meds-shape.entity';
import { MedsType } from '../meds-type/meds-type.entity';

@Entity()
export class Meds {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  laboratory: string;

  @Column({ nullable: true })
  code: number;

  @Column()
  dosage: number;

  @ManyToOne(() => MedsDrug)
  @JoinColumn()
  drug: MedsDrug;

  @ManyToOne(() => MedsShape)
  @JoinColumn()
  shape: MedsShape;

  @ManyToOne(() => MedsType)
  @JoinColumn()
  type: MedsType;

  @ManyToOne(() => MedsMeasurementUnit)
  @JoinColumn()
  measurementUnit: MedsMeasurementUnit;

  @Column({ default: false })
  deleted: boolean;
}
