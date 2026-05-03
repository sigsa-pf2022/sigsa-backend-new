# SIGSA Backend — Documentación para Claude

## Stack
- NestJS + TypeORM + PostgreSQL
- Firebase Admin SDK (FCM v1) para push notifications
- `synchronize: true` — el esquema de DB se aplica automáticamente al arrancar

## Estructura clave

```
src/
├── appointments/       # Turnos médicos
├── meds/
│   ├── meds/          # Catálogo de medicamentos
│   └── meds-event/    # Recordatorios de toma de medicamento
├── family-groups/      # Grupos familiares y dependientes
├── notifications/
│   ├── entities/      # Notification, NotificationRecipient, NotificationDeviceToken
│   ├── push/          # NotificationsPushService (Firebase Admin)
│   ├── scheduler/     # NotificationSchedulerService (cron cada minuto)
│   └── notifications.service.ts  # createForAppointmentGroup / createForMedEventGroup
├── tasks/             # TasksService (cron auxiliar)
└── auth/              # JWT auth
```

## Sistema de notificaciones push

### Flujo
1. Se crea un turno o recordatorio → se genera un registro en `notifications` con sus `notification_recipients`
2. El scheduler corre cada minuto y busca notificaciones `CREATED` cuyo trigger time ya pasó
3. Envía push via FCM a todos los dispositivos registrados de los recipients
4. Marca recipients como `DELIVERED`

### Lógica grupal
- Si el creator es un **Dependent** → busca el FamilyGroup → notifica a `createdBy` + todos los `members`
- Si el creator es un **User** → notifica solo a ese usuario

### Lead time
- Turnos (appointments): 15 minutos antes
- Medicamentos (med events): 5 minutos antes

### Firebase
- Proyecto: `sigsa-eeebc`
- Credenciales: `firebase-service-account.json` en la raíz (NO commitear — está en .gitignore)
- Si el archivo no existe, el sistema corre en **modo simulación** (loguea sin enviar)

### Endpoints de dispositivos
- `POST /notifications/devices` — registrar token FCM (requiere JWT)
- `DELETE /notifications/devices/:token` — deshabilitar token

## Configuración local
```bash
npm install
npm run start:dev
```
Requiere PostgreSQL corriendo en localhost:5432, base de datos `sigsa_db`.

## CORS permitidos
`http://localhost`, `http://localhost:8100`, `http://localhost:4200`, `capacitor://localhost`, `ionic://localhost`, IPs de red local (ver `src/main.ts`)

## Problemas conocidos / decisiones
- `ScheduleModule.forRoot()` debe estar solo en `app.module.ts`. Si se duplica en `tasks.module.ts` los crons corren dos veces.
- La API heredada de FCM (legacy) está deprecada. Se usa FCM v1 via `firebase-admin`.
- Node.js debe ser v18+ para `firebase-admin` v13+. Con v16 usar `firebase-admin@11`.
