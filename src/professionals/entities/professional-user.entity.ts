import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ProfessionalSpecialization } from './professional-specialization.entity';
import { State } from '../../geography/entities/state.entity';
import { IUser } from '../../users/abstract/IUser.abstract.entity';
import { Role } from '../../roles/enums/role.enum';

@Entity({ name: 'professionals_user' })
export class ProfessionalUser extends IUser {
  @ManyToMany(() => ProfessionalSpecialization)
  @JoinTable()
  specialization: ProfessionalSpecialization[];

  @Column({ name: 'license_number' })
  licenseNumber: number;

  @ManyToMany(() => State)
  @JoinTable()  
  jurisdiction: State[];

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.Professional,
  })
  role: Role;
}
