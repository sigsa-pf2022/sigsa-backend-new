import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import process from 'process';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { typeOrmConfigAsync } from './config/typeorm.config';
import { FamilyGroupsModule } from './family-groups/family-groups.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { ClinicsModule } from './clinics/clinics.module';
import { GeographyModule } from './geography/geography.module';
import { HttpModule } from '@nestjs/axios';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(typeOrmConfigAsync),
    AppointmentsModule,
    AuthModule,
    FamilyGroupsModule,
    ProfessionalsModule,
    ClinicsModule,
    GeographyModule,
    HttpModule,
    EventsModule,
  ],
})
export class AppModule {}
