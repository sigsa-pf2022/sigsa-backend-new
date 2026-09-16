import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { NotificationDeviceToken } from '../entities/notification-device-token.entity';
import * as admin from 'firebase-admin';
import * as path from 'path';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsPushService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsPushService.name);
  private firebaseReady = false;

  constructor(
    @InjectRepository(NotificationDeviceToken)
    private readonly deviceRepo: Repository<NotificationDeviceToken>,
  ) {}

  onModuleInit() {
    try {
      const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
        });
      }
      this.firebaseReady = true;
      this.logger.log('Firebase Admin inicializado correctamente');
    } catch (err) {
      this.logger.warn(`Firebase Admin no pudo inicializarse: ${err.message}. Las notificaciones push estarán en modo simulación.`);
    }
  }

  async sendToUsers(userIds: number[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
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

    if (!this.firebaseReady) {
      this.logger.log('═══════════════════════════════════════════════════════');
      this.logger.log('📢 [SIMULACIÓN] Notificación Push (Firebase no configurado)');
      this.logger.log(`   Usuarios: [${userIds.join(', ')}]`);
      this.logger.log(`   Dispositivos: ${devices.length}`);
      this.logger.log(`   Título: ${payload.title}`);
      this.logger.log(`   Cuerpo: ${payload.body}`);
      if (payload.data) this.logger.log(`   Data: ${JSON.stringify(payload.data)}`);
      this.logger.log('═══════════════════════════════════════════════════════');
      return { sent: tokens.length, failed: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        // Android muestra el banner ("heads-up") según la importancia del canal
        // al que va la notificación, y ese canal lo elige este `channelId`. Sin
        // el bloque, el push caía en el canal fallback de Firebase, de
        // importancia 3: sonaba pero no se dibujaba arriba, había que abrir el
        // centro de notificaciones para verlo.
        //
        // `priority: 'high'` es lo que además le pide a FCM entregarlo en el
        // momento y no diferirlo si el equipo está en reposo.
        //
        // El id tiene que coincidir con el canal que crea la app
        // (`NOTIFICATION_CHANNEL_ID` en local-notifications.service.ts) y con la
        // meta-data `default_notification_channel_id` del AndroidManifest.
        android: {
          priority: 'high',
          notification: {
            channelId: 'sigsa_reminders',
            priority: 'high',
            defaultSound: true,
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      let sent = 0;
      let failed = 0;

      response.responses.forEach((r, idx) => {
        if (r.success) {
          sent++;
        } else {
          failed++;
          const errorCode = r.error?.code;
          if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(errorCode)) {
            const token = tokens[idx];
            this.deviceRepo.update({ token }, { enabled: false }).catch(() => {});
            this.logger.warn(`Token inválido deshabilitado: ${token.substring(0, 20)}...`);
          } else {
            this.logger.error(`[FCM] Error enviando a token ${idx}: ${r.error?.message}`);
          }
        }
      });

      this.logger.log(`[FCM] Resultado: ${sent} enviados, ${failed} fallidos`);
      return { sent, failed };
    } catch (err) {
      this.logger.error('[FCM] Excepción enviando notificaciones:', err);
      return { sent: 0, failed: tokens.length };
    }
  }
}
