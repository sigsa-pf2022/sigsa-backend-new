import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ProfessionalSpecialization } from './professional-specialization.entity';
import { State } from 'src/geography/entities/state.entity';
import { IUser } from 'src/users/abstract/IUser.abstract.entity';
import { Role } from 'src/roles/enums/role.enum';

@Entity({ name: 'professionals_user' })
export class ProfessionalUser extends IUser{
  @ManyToOne(() => ProfessionalSpecialization, { nullable: true })
  @JoinColumn()
  specialization: ProfessionalSpecialization;

  @Column({name: "registration_number"})
  registrationNumber: number;

  @ManyToOne(()=> State)
  @JoinColumn()
  jurisdiction: State

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.Professional,
  })
  role: Role;
}