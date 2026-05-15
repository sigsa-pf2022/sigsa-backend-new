import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProfessionalUser } from './professional-user.entity';
import { PatientProfessionalStatus } from '../enums/patient-professional-status.enum';

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

  // Default ACCEPTED preserves existing user-type links; dependent links start as PENDING
  @Column({
    type: 'enum',
    enum: PatientProfessionalStatus,
    default: PatientProfessionalStatus.ACCEPTED,
  })
  status: PatientProfessionalStatus;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
