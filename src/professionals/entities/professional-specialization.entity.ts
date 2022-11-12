import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'professionals_specialization' })
export class ProfessionalSpecialization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @Column({ default: false })
  deleted: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
