import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('/api');
  app.enableCors({
    origin: [
      'http://192.168.0.12:8101',
      'http://localhost:8100',
      'http://localhost:4200',
    ],
    credentials: true,
  });
  await app.listen(3000);
}
bootstrap();
