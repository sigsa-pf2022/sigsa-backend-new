import { Module } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { ProfessionalsController } from './professionals.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Professional } from './professional.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Professional]), UsersModule],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
  controllers: [ProfessionalsController],
})
export class ProfessionalsModule {}
