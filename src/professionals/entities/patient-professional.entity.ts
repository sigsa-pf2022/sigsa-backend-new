import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProfessionalUser } from './professional-user.entity';

@Entity()
@Unique(['professional', 'patientId', 'patientType'])
export class PatientProfessional {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProfessionalUser, { eager: false })
  @JoinColumn({ name: 'professional_id' })
  professional: ProfessionalUser;

  @Column({ name: 'professional_id' })
  professionalId: number;

  @Column()
  patientId: number;

  @Column({ type: 'enum', enum: ['user', 'dependent'] })
  patientType: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
