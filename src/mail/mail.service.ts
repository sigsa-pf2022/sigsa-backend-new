import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { User } from 'src/users/user.entity';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendUserConfirmation(user: User) {
    await this.mailerService.sendMail({
      from: 'matiasbruno97@gmail.com',
      to: user.email,
      subject: 'Bienvendo a Sigsa! Confirma tu email para continuar...',
      template: './confirmation',
      context: {
        name: user.firstName,
        code: user.verificationCode,
      },
    });
  }

  async sendUserRecoveryPassword(user: User, ) {
    await this.mailerService.sendMail({
      from: 'matiasbruno97@gmail.com',
      to: user.email,
      subject: 'Recuperar contraseña',
      template: './recovery-password',
      context: {
        name: user.firstName,
        code: user.recoveryPasswordToken,
      },
    });
  }
}
