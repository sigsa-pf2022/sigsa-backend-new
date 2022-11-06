import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { FamilyGroupsModule } from './family-groups/family-groups.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'owner',
      password: '0wn3r',
      database: 'sigsa_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      // dropSchema: true,
    }),
    AppointmentsModule,
    AuthModule,
    FamilyGroupsModule,
  ],
})
export class AppModule {}
