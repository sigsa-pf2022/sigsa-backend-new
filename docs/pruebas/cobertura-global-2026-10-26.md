# Cobertura global de pruebas unitarias — 2026-10-26

Rama `chore/pruebas-cobertura`, comando `npm run test:cov` (Jest 28 + ts-jest). Reemplaza como referencia a `cobertura-2026-10-26.md`, que medía sólo los servicios con reglas de negocio y sin exclusiones.

## Resultado

| | Total | Pasan | Fallan |
|---|---|---|---|
| Suites | 53 | 53 | 0 |
| Pruebas | 520 | 520 | 0 |

## Cobertura global

| | Líneas | Sentencias | Ramas | Funciones |
|---|---|---|---|---|
| Antes (mismas exclusiones, 31 suites / 236 pruebas) | 52.63 | 53.41 | 51.16 | 44.02 |
| **Ahora** | **99.91** (2333/2335) | **99.84** (2570/2574) | **92.22** (1305/1415) | **99.62** (525/527) |

Ningún archivo medido queda por debajo del 80 % en ninguna de las cuatro métricas.

## Exclusiones (`collectCoverageFrom` en `package.json`)

Rutas relativas a `src/` (el `rootDir` de Jest). Los `*.spec.ts` Jest los excluye solo.

| Patrón | Qué deja afuera | Por qué |
|---|---|---|
| `!**/*.module.ts` | 21 módulos de Nest | Sólo declaran imports, providers y controllers: no tienen lógica propia. |
| `!**/*.dto*.ts` | 25 DTOs y `meds/meds/dto/update-meds.dto copy.ts` | Clases con decoradores de `class-validator`, sin código ejecutable. El patrón lleva `*` después de `.dto` para incluir la copia `update-meds.dto copy.ts`, que es un DTO duplicado que nadie importa. |
| `!**/*.entity.ts` | 28 entidades de TypeORM | Definición del esquema con decoradores. |
| `!**/*.interface.ts` | (hoy ninguno) | Tipos sin código en ejecución. |
| `!**/*.enum.ts` | 7 enums | Constantes. |
| `!main.ts` | arranque de la app | Levanta el servidor HTTP y CORS; se prueba arrancando la app, no con unitarias. |
| `!**/migrations/**` | (hoy ninguna) | El esquema se sincroniza con `synchronize: true`. |
| `!database/seeder/**` | 7 seeders de `typeorm-extension` | Carga inicial de países, provincias, ciudades, especialidades y catálogos. |
| `!scripts/**` | `seed-demo-data`, `seed-analytics-data`, `fix-specializations` y `scripts/demo/*` | Scripts de línea de comandos que se corren a mano con `ts-node` contra la base: carga de datos de la demo y de analytics, más un arreglo puntual de especialidades y la limpieza y verificación de la demo. No forman parte de la app en ejecución. |
| `!config/**` | `env.config.ts`, `mail.config.ts`, `typeorm.config.ts` | Leen variables de entorno y arman la configuración. |
| `!common/testing/**` | `mock-repository.ts`, `catalog-suite.ts` | Código de apoyo de las pruebas, no de producción. |

Siguen medidos todos los servicios, controllers, guards, strategies, decoradores, validadores, el polyfill de `crypto` y los helpers de `common/`, `events/utils/`, `users/utils/` y `notifications/utils/`.

## Archivos que estaban por debajo del 80 % (antes de esta tanda)

Ordenados de menor a mayor cobertura de líneas.

| Archivo | Líneas | Sentencias |
|---|---|---|
| `analytics/analytics.controller.ts` | 0 | 0 |
| `analytics/analytics.service.ts` | 0 | 0 |
| `appointments/appointments.controller.ts` | 0 | 0 |
| `bootstrap/crypto.polyfill.ts` | 0 | 0 |
| `documents/documents.controller.ts` | 0 | 0 |
| `family-groups/family-groups.controller.ts` | 0 | 0 |
| `group-events/group-events.controller.ts` | 0 | 0 |
| `notifications/notifications.controller.ts` | 0 | 0 |
| `notifications/push/notifications-push.service.ts` | 0 | 0 |
| `notifications/scheduler/notification-scheduler.service.ts` | 0 | 0 |
| `professionals/professionals.controller.ts` | 0 | 0 |
| `roles/decorators/roles.decorator.ts` | 0 | 0 |
| `tasks/tasks.service.ts` | 0 | 0 |
| `documents/documents.service.ts` | 15 | 15.71 |
| `events/events.service.ts` | 15.21 | 16.98 |
| `notifications/notifications.service.ts` | 18 | 18.96 |
| `meds/meds/meds.service.ts` | 22.58 | 23.68 |
| `meds/meds-event/meds-event.controller.ts` | 32.43 | 33.33 |
| `mail/mail.service.ts` | 34.88 | 37.77 |
| `users/users.controller.ts` | 36.36 | 38.23 |
| `meds/meds-drug/meds-drug.service.ts` | 46.66 | 52.94 |
| `meds/meds-measurement-unit/meds-measurement-unit.service.ts` | 46.66 | 52.94 |
| `meds/meds-shape/meds-shape.service.ts` | 46.66 | 52.94 |
| `meds/meds-type/meds-type.service.ts` | 46.66 | 52.94 |
| `geography/geography.controller.ts` | 47.05 | 52.63 |
| `users/validators/is-image-data-uri.ts` | 54.54 | 42.85 |
| `events/events.controller.ts` | 55 | 59.09 |
| `meds/meds/meds.controller.ts` | 56.52 | 60 |
| `meds/meds-drug/meds-drug.controller.ts` | 56.52 | 60 |
| `meds/meds-measurement-unit/meds-measurement-unit.controller.ts` | 56.52 | 60 |
| `meds/meds-shape/meds-shape.controller.ts` | 56.52 | 60 |
| `meds/meds-type/meds-type.controller.ts` | 56.52 | 60 |
| `geography/geography.service.ts` | 66.66 | 70.58 |

## Cobertura por archivo (ahora)

| Archivo | Líneas | Sentencias | Ramas | Funciones |
|---|---|---|---|---|
| `analytics/analytics.controller.ts` | 100 | 100 | 100 | 100 |
| `analytics/analytics.service.ts` | 100 | 100 | 95.41 | 100 |
| `appointments/appointments.controller.ts` | 100 | 100 | 95.23 | 100 |
| `appointments/appointments.service.ts` | 100 | 100 | 83.62 | 100 |
| `auth/auth.controller.ts` | 100 | 100 | 100 | 100 |
| `auth/auth.service.ts` | 100 | 100 | 100 | 100 |
| `auth/constants/jwt.constant.ts` | 100 | 100 | 100 | 100 |
| `auth/guards/jwt.guard.ts` | 100 | 100 | 100 | 100 |
| `auth/guards/local.guard.ts` | 100 | 100 | 100 | 100 |
| `auth/utils/jwt.strategy.ts` | 100 | 100 | 100 | 100 |
| `auth/utils/local.strategy.ts` | 100 | 100 | 100 | 100 |
| `bootstrap/crypto.polyfill.ts` | 100 | 100 | 100 | 100 |
| `clinics/clinics.controller.ts` | 100 | 100 | 100 | 100 |
| `clinics/clinics.service.ts` | 100 | 100 | 100 | 100 |
| `common/list-query.ts` | 96.42 | 96.66 | 100 | 88.88 |
| `common/plan-limits.ts` | 100 | 100 | 100 | 100 |
| `documents/documents.controller.ts` | 100 | 100 | 100 | 100 |
| `documents/documents.service.ts` | 98.33 | 98.57 | 100 | 100 |
| `events/events.controller.ts` | 100 | 100 | 100 | 100 |
| `events/events.service.ts` | 100 | 100 | 86.44 | 100 |
| `events/utils/sort-by-relevance.ts` | 100 | 100 | 100 | 100 |
| `events/utils/upcoming-window.ts` | 100 | 100 | 100 | 100 |
| `family-groups/family-groups.controller.ts` | 100 | 100 | 90.47 | 100 |
| `family-groups/family-groups.service.ts` | 100 | 100 | 97.63 | 100 |
| `geography/geography.controller.ts` | 100 | 100 | 100 | 100 |
| `geography/geography.service.ts` | 100 | 100 | 100 | 100 |
| `group-events/group-events.controller.ts` | 100 | 100 | 100 | 100 |
| `group-events/group-events.service.ts` | 100 | 100 | 88.43 | 100 |
| `mail/mail.service.ts` | 100 | 100 | 100 | 100 |
| `meds/meds-drug/meds-drug.controller.ts` | 100 | 100 | 100 | 100 |
| `meds/meds-drug/meds-drug.service.ts` | 100 | 100 | 100 | 100 |
| `meds/meds-event/meds-event.controller.ts` | 100 | 100 | 86.95 | 100 |
| `meds/meds-event/meds-event.service.ts` | 100 | 99.57 | 87.78 | 100 |
| `meds/meds-measurement-unit/meds-measurement-unit.controller.ts` | 100 | 100 | 100 | 100 |
| `meds/meds-measurement-unit/meds-measurement-unit.service.ts` | 100 | 100 | 100 | 100 |
| `meds/meds-shape/meds-shape.controller.ts` | 100 | 100 | 100 | 100 |
| `meds/meds-shape/meds-shape.service.ts` | 100 | 100 | 100 | 100 |
| `meds/meds-type/meds-type.controller.ts` | 100 | 100 | 100 | 100 |
| `meds/meds-type/meds-type.service.ts` | 100 | 100 | 100 | 100 |
| `meds/meds/meds.controller.ts` | 100 | 100 | 100 | 100 |
| `meds/meds/meds.service.ts` | 100 | 100 | 87.5 | 100 |
| `notifications/notifications.controller.ts` | 100 | 100 | 91.66 | 100 |
| `notifications/notifications.service.ts` | 100 | 100 | 93.54 | 100 |
| `notifications/push/notifications-push.service.ts` | 100 | 100 | 89.47 | 100 |
| `notifications/scheduler/notification-scheduler.service.ts` | 100 | 100 | 92.94 | 100 |
| `notifications/utils/title-case.ts` | 100 | 100 | 100 | 100 |
| `professionals/professionals.controller.ts` | 100 | 100 | 100 | 100 |
| `professionals/professionals.service.ts` | 100 | 99.6 | 95.62 | 98.3 |
| `roles/decorators/roles.decorator.ts` | 100 | 100 | 100 | 100 |
| `roles/guards/role.guards.ts` | 100 | 100 | 100 | 100 |
| `tasks/tasks.service.ts` | 100 | 100 | 100 | 100 |
| `users/users.controller.ts` | 100 | 100 | 100 | 100 |
| `users/users.service.ts` | 100 | 100 | 100 | 100 |
| `users/utils/normalize-email.ts` | 100 | 100 | 100 | 100 |
| `users/utils/random-number.ts` | 100 | 100 | 100 | 100 |
| `users/validators/is-image-data-uri.ts` | 100 | 100 | 100 | 100 |

## Posibles bugs detectados (sin corregir)

Ordenados por gravedad. Ninguno se corrigió: las pruebas cubren el comportamiento actual.

1. **Datos sensibles de otros usuarios en las respuestas de grupos.** `GET /family-groups/:id` no verifica que quien pide sea integrante, y devuelve `members` y `createdBy` como filas completas de `User`: incluye `password` (hash), `verificationCode` y `recoveryPasswordToken`. No hay serializer ni `@Exclude`. `GET /family-groups/my-groups` devuelve lo mismo para los integrantes del propio grupo. Con el `recoveryPasswordToken` a la vista, cualquier usuario autenticado podría pedir la recuperación de clave de otro, leer el código y cambiarle la contraseña. Lo encontré leyendo el código durante las pruebas; no lo probé contra la base.
2. **El backend se cae si falla el envío de mail al registrarse.** `POST /users/create` y `POST /professionals` llaman a `mailService.sendUserConfirmation()` sin `await` ni `catch`. Si el SMTP falla, la promesa rechazada queda sin manejar y Node 16 termina el proceso (comprobado con `node -e`).
3. **Endpoints de dependientes sin control de pertenencia al grupo.** Cualquier usuario autenticado que conozca el id de un dependiente puede listar y crear sus turnos, recordatorios y documentos, y cancelar sus tratamientos (`appointments`, `meds-event`, `documents`, `events`, rutas `dependent/:id`). `GET/PUT/DELETE /documents/:id` y `/download` tampoco verifican de quién es el documento.
4. **Notificaciones trabadas en `CREATED` que pueden frenar el scheduler.** `recomputeNotificationStatus` no asigna estado en dos casos. Uno: todos los destinatarios siguen pendientes porque no tienen dispositivos. Otro: no quedan pendientes, hay entregados y además alguien respondió (por ejemplo, un integrante dijo "No puedo" antes de la push). En ambos casos la notificación queda en `CREATED` y se vuelve a levantar cada 5 s. El barrido toma 50 por fecha ascendente, así que con 50 trabadas las más nuevas no se despachan nunca. Confirmado con una prueba temporal.
5. **500 en vez de 404 con ids inexistentes.** `GET /appointments/:id` y `GET /meds/:id` acceden a propiedades del resultado sin chequear `null`.
6. **Errores 403/404 respondidos como 400.** `GET /professionals/patients/:id/documents` convierte la falta de consentimiento (403) en 400; `POST/DELETE /professionals/patients` hacen lo mismo con 404.
7. **`DocumentsService.getDocumentsByGroupMembers`** devuelve todos los documentos no cancelados de todos los usuarios. Hoy nadie lo llama: es un problema latente.
8. **Mensajes de duplicado copiados.** Los catálogos de drogas y de medicamentos responden "Ya existe una forma de medicamento…", y el de tipos dice "Ya existe una tipo…".

Siguen vigentes los tres hallazgos de `cobertura-2026-10-26.md`: pendientes de titulares invisibles para el profesional, solicitud rechazada que bloquea una nueva y acciones de cancelar/editar sin control de autor.
