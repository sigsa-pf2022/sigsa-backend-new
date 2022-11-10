import { Entity,Column, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'professionals_specialization' })
export class ProfessionalSpecialization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}