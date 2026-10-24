import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

// El constructor arma un transporter de Gmail y llama a verify(): sin este mock
// la prueba intentaría conectarse por SMTP.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ verify: jest.fn(), sendMail: jest.fn() })),
}));

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: { get: jest.fn((_key, def) => def) } },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
