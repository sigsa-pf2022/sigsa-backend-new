import { ChildEntity, Column, JoinTable, ManyToMany } from 'typeorm';
import { ProfessionalSpecialization } from './professional-specialization.entity';
import { State } from '../../geography/entities/state.entity';
import { User } from '../../users/entities/user.entity';

@ChildEntity()
export class ProfessionalUser extends User {
  @ManyToMany(() => ProfessionalSpecialization)
  @JoinTable()
  specialization: ProfessionalSpecialization[];

  @Column({ name: 'license_number' })
  licenseNumber: number;

  @ManyToMany(() => State)
  @JoinTable()  
  jurisdiction: State[];
}
