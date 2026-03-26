import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalDocument } from './medical-document.entity';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { UsersModule } from 'src/users/users.module';
import { FamilyGroupsModule } from 'src/family-groups/family-groups.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalDocument]),
    UsersModule,
    FamilyGroupsModule,
    NotificationsModule,
  ],
  providers: [DocumentsService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
