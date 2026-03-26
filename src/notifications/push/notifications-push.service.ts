import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { NotificationDeviceToken } from '../entities/notification-device-token.entity';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsPushService {
  private readonly logger = new Logger(NotificationsPushService.name);

  constructor(
    @InjectRepository(NotificationDeviceToken)
    private readonly deviceRepo: Repository<NotificationDeviceToken>,
  ) {}

  async sendToUsers(userIds: number[], payload: PushPayload): Promise<{ sent: number; failed: number; }> {
    if (!userIds.length) {
      this.logger.warn('sendToUsers llamado sin userIds');
      return { sent: 0, failed: 0 };
    }

    const devices = await this.deviceRepo.find({ where: { userId: In(userIds), enabled: true } });
    if (!devices.length) {
      this.logger.warn(`No hay dispositivos registrados para usuarios: ${userIds.join(', ')}`);
      return { sent: 0, failed: 0 };
    }

    const tokens = devices.map(d => d.token);
    const serverKey = process.env.FCM_SERVER_KEY;

    // MODO SIMULACIÓN: Si no hay FCM_SERVER_KEY, loguear y simular
    if (!serverKey) {
      this.logger.log('═══════════════════════════════════════════════════════');
      this.logger.log('📢 [SIMULACIÓN] Notificación Push (FCM_SERVER_KEY no configurada)');
      this.logger.log(`   Usuarios: [${userIds.join(', ')}]`);
      this.logger.log(`   Dispositivos: ${devices.length}`);
      this.logger.log(`   Título: ${payload.title}`);
      this.logger.log(`   Cuerpo: ${payload.body}`);
      if (payload.data) this.logger.log(`   Data: ${JSON.stringify(payload.data)}`);
      this.logger.log('═══════════════════════════════════════════════════════');
      return { sent: tokens.length, failed: 0 };
    }

    // MODO REAL: Enviar via FCM
    const chunks: string[][] = [];
    const CHUNK_SIZE = 500;
    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      chunks.push(tokens.slice(i, i + CHUNK_SIZE));
    }

    let sent = 0; let failed = 0;
    for (const batch of chunks) {
      try {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${serverKey}`,
          },
          body: JSON.stringify({
            registration_ids: batch,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data || {},
          }),
        });

        if (!res.ok) {
          this.logger.error(`[FCM] Error HTTP ${res.status}: ${res.statusText}`);
          failed += batch.length;
          continue;
        }

        const json: any = await res.json();
        json.results?.forEach((r, idx) => {
          if (r.error) {
            failed += 1;
            // Deshabilitar tokens inválidos
            if (['NotRegistered', 'InvalidRegistration', 'MismatchSenderId'].includes(r.error)) {
              const token = batch[idx];
              this.deviceRepo.update({ token }, { enabled: false }).catch(() => {});
              this.logger.warn(`Token inválido deshabilitado: ${token.substring(0, 20)}...`);
            }
          } else {
            sent += 1;
          }
        });

        this.logger.log(`[FCM] Batch enviado: ${sent} exitosos, ${failed} fallidos`);
      } catch (err) {
        this.logger.error('[FCM] Excepción enviando batch:', err);
        failed += batch.length;
      }
    }
    return { sent, failed };
  }
}
