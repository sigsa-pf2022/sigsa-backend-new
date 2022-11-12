import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';

export class CreateAppointmentDTO {
  professional?: ProfessionalUser;
  myProfessional?: Professionals;
  comments: string;
  date: string;
}
