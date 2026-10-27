import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

const sendMail = jest.fn();
const verify = jest.fn();

// El constructor arma un transporter de Gmail y llama a verify(): sin este mock
// la prueba intentaría conectarse por SMTP.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ verify, sendMail })),
  getTestMessageUrl: jest.fn(() => false),
}));

describe('MailService', () => {
  let service: MailService;
  const env: Record<string, string> = {
    MAIL_FROM_EMAIL: 'sigsa@mail.com',
    GMAIL_APP_PASSWORD: 'clave-app',
    MAIL_FROM_NAME: 'SIGSA',
  };

  beforeEach(async () => {
    sendMail.mockReset().mockResolvedValue({ messageId: 'abc' });
    verify.mockReset();
    (nodemailer.createTransport as jest.Mock).mockClear();
    for (const level of ['log', 'error', 'debug'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: { get: jest.fn((key, def) => env[key] ?? def) } },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('arma el transporter de Gmail con las credenciales del .env', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: { user: 'sigsa@mail.com', pass: 'clave-app' },
    });
  });

  it('verificar la conexión SMTP no rompe el arranque, falle o no', () => {
    const callback = verify.mock.calls[0][0];
    expect(() => callback(new Error('auth'), false)).not.toThrow();
    expect(() => callback(null, true)).not.toThrow();
    expect(Logger.prototype.error).toHaveBeenCalledWith('SMTP connection error: auth');
    expect(Logger.prototype.log).toHaveBeenCalledWith('SMTP server is ready to send emails');
  });

  it('confirmación de cuenta: manda el código con la plantilla', async () => {
    await expect(
      service.sendUserConfirmation({ email: 'ana@mail.com', firstName: 'Ana', verificationCode: 123456 } as any),
    ).resolves.toEqual({ messageId: 'abc' });

    const mail = sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({
      from: '"SIGSA" <sigsa@mail.com>',
      to: 'ana@mail.com',
      subject: 'Bienvenido a Sigsa! Confirma tu email para continuar...',
    });
    expect(mail.html).toContain('123456');
    expect(mail.html).toContain('Ana');
  });

  it('recuperación de contraseña: manda el código de recuperación', async () => {
    await service.sendUserRecoveryPassword({ email: 'ana@mail.com', firstName: 'Ana', recoveryPasswordToken: 654321 } as any);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe('Recuperar contraseña');
    expect(mail.html).toContain('654321');
  });

  it('si falla el envío, el error se propaga', async () => {
    sendMail.mockRejectedValue(new Error('smtp caído'));
    await expect(service.sendUserConfirmation({ email: 'a@b.com' } as any)).rejects.toThrow('smtp caído');
  });

  it('si falta la plantilla, el error se propaga sin intentar enviar', async () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });
    await expect(service.sendUserRecoveryPassword({ email: 'a@b.com' } as any)).rejects.toThrow('ENOENT');
    expect(sendMail).not.toHaveBeenCalled();
  });
});
