import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';

export class EditAppointmentDto {
  professional?: ProfessionalUser;
  myProfessional?: Professionals;
  description: string;
  date: string;
}
