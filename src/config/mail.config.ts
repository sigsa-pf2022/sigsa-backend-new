import { MailerOptions } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailerAsyncOptions } from '@nestjs-modules/mailer/dist/interfaces/mailer-async-options.interface';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';

export default class MailConfig {
  static getMailConfig(configService: ConfigService): MailerOptions {
    const url = __dirname.split('/');
    url.pop();
    url.pop();
    url.push('mail');
    const dir = url.join('/');
    return {
      transport: {
        host: configService.get('MAILER_HOST'),
        port: 465,
        secure: true,
        auth: {
          user: configService.get('MAILER_USER'),
          pass: configService.get('MAILER_PASSWORD'),
        },
      },
      defaults: {
        from: '"No Reply" <noreply@example.com>',
      },
      template: {
        dir: join(dir, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    };
  }
}

export const mailConfigAsync: MailerAsyncOptions = {
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService): Promise<MailerOptions> =>
    MailConfig.getMailConfig(configService),
  inject: [ConfigService],
};
