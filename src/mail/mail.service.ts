import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/users/entities/user.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { getMailConfig } from 'src/config/mail.config';

@Injectable()
export class MailService {
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const config = getMailConfig(configService);
    this.fromEmail = config.fromEmail;
    this.fromName = config.fromName;

    // Create Gmail transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    // Verify transporter configuration
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(`SMTP connection error: ${error.message}`);
      } else {
        this.logger.log('SMTP server is ready to send emails');
      }
    });
  }

  private async loadTemplate(templateName: string, context: any): Promise<string> {
    try {
      const baseDir = path.join(process.cwd(), 'src', 'mail', 'templates');
      const templatePath = path.join(baseDir, `${templateName}.hbs`);
      
      this.logger.debug(`Loading template from: ${templatePath}`);
      this.logger.debug(`Current working directory: ${process.cwd()}`);
      this.logger.debug(`Directory exists: ${fs.existsSync(baseDir)}`);
      this.logger.debug(`Template exists: ${fs.existsSync(templatePath)}`);
      
      const template = fs.readFileSync(templatePath, 'utf-8');
      const compiledTemplate = Handlebars.compile(template);
      return compiledTemplate(context);
    } catch (error) {
      this.logger.error(`Error loading template: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  private async sendEmail(to: string, subject: string, html: string) {
    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.debug(`Email sent: ${info.messageId}`);
      this.logger.debug(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return info;
    } catch (error) {
      this.logger.error(`Error sending email: ${error.message}`);
      throw error;
    }
  }

  async sendUserConfirmation(user: User) {
    const html = await this.loadTemplate('confirmation', {
      name: user.firstName,
      code: user.verificationCode,
    });

    return this.sendEmail(
      user.email,
      'Bienvenido a Sigsa! Confirma tu email para continuar...',
      html
    );
  }

  async sendUserRecoveryPassword(user: User) {
    const html = await this.loadTemplate('recovery-password', {
      name: user.firstName,
      code: user.recoveryPasswordToken,
    });

    return this.sendEmail(
      user.email,
      'Recuperar contraseña',
      html
    );
  }
}
