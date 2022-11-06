import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { mailConfigAsync } from 'src/config/mail.config';

@Module({
  imports: [
    MailerModule.forRootAsync(mailConfigAsync),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
