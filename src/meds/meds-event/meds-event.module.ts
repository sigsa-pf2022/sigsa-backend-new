import { Module } from '@nestjs/common';
import { MedsEventService } from './meds-event.service';
import { MedsEventController } from './meds-event.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedEvent } from './med-event.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedEvent]),
    UsersModule,
  ],
  controllers: [MedsEventController],
  providers: [MedsEventService],
})
export class MedsEventModule {}
