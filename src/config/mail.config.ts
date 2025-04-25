import { ConfigService } from '@nestjs/config';

export interface MailConfig {
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export const getMailConfig = (configService: ConfigService): MailConfig => {
  return {
    user: configService.get<string>('MAIL_FROM_EMAIL', 'matiasbruno97@gmail.com'),
    pass: configService.get<string>('GMAIL_APP_PASSWORD'),
    fromEmail: configService.get<string>('MAIL_FROM_EMAIL', 'matiasbruno97@gmail.com'),
    fromName: configService.get<string>('MAIL_FROM_NAME', 'No Reply'),
  };
};
