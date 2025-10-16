import { Injectable } from '@nestjs/common';
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
  constructor(
    @InjectRepository(NotificationDeviceToken)
    private readonly deviceRepo: Repository<NotificationDeviceToken>,
  ) {}

  async sendToUsers(userIds: number[], payload: PushPayload): Promise<{ sent: number; failed: number; }> {
    if (!userIds.length) return { sent: 0, failed: 0 };

    const devices = await this.deviceRepo.find({ where: { userId: In(userIds), enabled: true } });
    if (!devices.length) return { sent: 0, failed: 0 };

    const tokens = devices.map(d => d.token);
    // Si no hay FCM_SERVER_KEY configurada, simular envío
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      console.warn('[NotificationsPushService] FCM_SERVER_KEY no definida, simulando envío. Tokens:', tokens.length);
      return { sent: tokens.length, failed: 0 };
    }

    const chunks: string[][] = [];
    const CHUNK_SIZE = 500; // límite práctico para registration_ids
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
            console.error('[FCM] Error HTTP', res.status, res.statusText);
            failed += batch.length;
            continue;
        }
        const json: any = await res.json();
        // json.results array
        json.results?.forEach((r, idx) => {
          if (r.error) {
            failed += 1;
            // Deshabilitar tokens inválidos
            if (['NotRegistered','InvalidRegistration','MismatchSenderId'].includes(r.error)) {
              const token = batch[idx];
              this.deviceRepo.update({ token }, { enabled: false }).catch(()=>{});
            }
          } else {
            sent += 1;
          }
        });
      } catch (err) {
        console.error('[FCM] Excepción enviando batch:', err);
        failed += batch.length;
      }
    }
    return { sent, failed };
  }
}
