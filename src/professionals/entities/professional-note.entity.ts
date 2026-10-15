import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProfessionalUser } from './professional-user.entity';

/**
 * Indicación que un profesional le deja a un paciente vinculado ("bajar la
 * sal", "repetir el análisis en 30 días"). El paciente —o el grupo, si es un
 * dependiente— la recibe por push y la ve en "Indicaciones".
 */
@Entity('professional_notes')
@Index(['patientId', 'patientType'])
export class ProfessionalNote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProfessionalUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professional_id' })
  professional: ProfessionalUser;

  @Column({ name: 'professional_id' })
  professionalId: number;

  @Column()
  patientId: number;

  @Column({ type: 'enum', enum: ['user', 'dependent'] })
  patientType: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
