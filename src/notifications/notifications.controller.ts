import { Body, Controller, Post, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDeviceToken } from './entities/notification-device-token.entity';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

// NOTA: Asumimos que la request ya trae user (middleware/guard de auth). Si tu auth usa un decorador, se puede refactorizar.

@Controller('notifications')
export class NotificationsController {
  constructor(
    @InjectRepository(NotificationDeviceToken)
    private readonly deviceRepo: Repository<NotificationDeviceToken>,
  ) {}

  @Post('devices')
  async registerDevice(@Body() dto: RegisterDeviceTokenDto, @Req() req: any) {
    const userId = req.user?.id; // Ajustar según implementación real
    if (!userId) {
      // En un proyecto real lanzarías UnauthorizedException
      throw new Error('Usuario no autenticado (ajusta guard/auth)');
    }

    let existing = await this.deviceRepo.findOne({ where: { token: dto.token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = dto.platform;
      existing.enabled = true;
      existing = await this.deviceRepo.save(existing);
      return { updated: true, id: existing.id };
    }

    const created = this.deviceRepo.create({
      token: dto.token,
      platform: dto.platform,
      userId,
      enabled: true,
    });
    const saved = await this.deviceRepo.save(created);
    return { created: true, id: saved.id };
  }
}
