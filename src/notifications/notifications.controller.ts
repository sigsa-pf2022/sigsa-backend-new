 import { Body, Controller, Post, Req, UseGuards, UnauthorizedException, Delete, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { NotificationDeviceToken } from './entities/notification-device-token.entity';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    @InjectRepository(NotificationDeviceToken)
    private readonly deviceRepo: Repository<NotificationDeviceToken>,
  ) {}

  /**
   * Registra un dispositivo para recibir notificaciones push.
   * POST /notifications/devices
   * Body: { token: string, platform: 'android' | 'ios' | 'web' }
   */
  @UseGuards(JwtAuthGuard)
  @Post('devices')
  async registerDevice(@Body() dto: RegisterDeviceTokenDto, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    // Si el token ya existe, actualizar usuario y habilitar
    let existing = await this.deviceRepo.findOne({ where: { token: dto.token } });
    if (existing) {
      existing.userId = userId;
      existing.platform = dto.platform;
      existing.enabled = true;
      existing = await this.deviceRepo.save(existing);
      return { success: true, message: 'Dispositivo actualizado', id: existing.id };
    }

    // Crear nuevo registro
    const created = this.deviceRepo.create({
      token: dto.token,
      platform: dto.platform,
      userId,
      enabled: true,
    });
    const saved = await this.deviceRepo.save(created);
    return { success: true, message: 'Dispositivo registrado', id: saved.id };
  }

  /**
   * Elimina/deshabilita un dispositivo.
   * DELETE /notifications/devices/:token
   */
  @UseGuards(JwtAuthGuard)
  @Delete('devices/:token')
  async removeDevice(@Param('token') token: string, @Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const device = await this.deviceRepo.findOne({ where: { token, userId } });
    if (device) {
      device.enabled = false;
      await this.deviceRepo.save(device);
      return { success: true, message: 'Dispositivo deshabilitado' };
    }
    return { success: false, message: 'Dispositivo no encontrado' };
  }
}
