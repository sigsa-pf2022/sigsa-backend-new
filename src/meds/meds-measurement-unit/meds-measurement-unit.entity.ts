import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class MedsMeasurementUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ default: false })
  deleted: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
