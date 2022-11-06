import { IsDateString } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

@Entity({ name: 'dependent' })
export class Dependent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name', type: 'varchar', length: '255' })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: '255' })
  lastName: string;

  @Column({ type: 'varchar', length: '255' })
  dni: string;

  @Column({
    name: 'blood_type',
    type: 'enum',
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  })
  bloodType: BloodType;

  @Column({ type: 'datetime' })
  @IsDateString()
  birthday: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
