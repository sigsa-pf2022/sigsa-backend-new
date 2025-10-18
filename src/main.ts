import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Aumentar límite de payload para documentos Base64 (50MB)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  app.setGlobalPrefix('/api');
  app.enableCors({
    origin: [
      'http://192.168.0.12:8101',
      'http://localhost:8100',
      'http://localhost:4200',
      'http://localhost:54229', // back-office dev origin
    ],
    credentials: true,
  });
  await app.listen(3000);
}
bootstrap();
