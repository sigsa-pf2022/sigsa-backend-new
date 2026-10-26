# Cobertura de pruebas unitarias — 2026-10-26

Rama `chore/pruebas-cobertura`, comando `npm run test:cov` (Jest 28 + ts-jest).

## Resultado

| | Total | Pasan | Fallan |
|---|---|---|---|
| Suites | 31 | 31 | 0 |
| Pruebas | 236 | 236 | 0 |

## Estado inicial (rama `dev`)

De 24 suites fallaban 21. Ninguna prueba se borró: todas testeaban clases que existen.

| Suite | Causa |
|---|---|
| `auth.controller`, `events.controller`, `geography.controller`, `meds.controller`, `meds-drug.controller`, `meds-event.controller`, `meds-shape.controller`, `meds-type.controller`, `users.controller` | Faltaban los servicios inyectados en el módulo de prueba |
| `auth.service`, `events.service` | Faltaban los servicios inyectados (`UsersService`/`JwtService`, `AppointmentsService`/`MedsEventService`) |
| `geography.service`, `meds.service`, `meds-drug.service`, `meds-measurement-unit.service`, `meds-shape.service`, `meds-type.service`, `users.service` | Faltaban los repositorios (`getRepositoryToken`) |
| `mail.service` | Faltaba `ConfigService`; además el constructor intenta conectarse por SMTP (se mockeó `nodemailer`) |
| `meds-measurement-unit.controller` | No compilaba: importaba `MedsMeasurementUnit` en vez de `MedsMeasurementUnitController` |

## Cobertura de los servicios con reglas de negocio

| Regla | Archivo | Líneas | Sentencias | Ramas | Funciones |
|---|---|---|---|---|---|
| Adherencia, registro de tomas, tratamientos periódicos, límite de medicamentos | `meds-event.service.ts` | 100 | 99.57 | 87.78 | 100 |
| Grupos: quitar integrantes, reasignar administrador, solicitudes, límite de grupos | `family-groups.service.ts` | 100 | 100 | 97.63 | 100 |
| "Me hago cargo", "No puedo", historial, pertenencia al grupo | `group-events.service.ts` | 100 | 100 | 88.43 | 100 |
| Vinculación y consentimiento profesional-paciente, límite de profesionales | `professionals.service.ts` | 100 | 99.6 | 95.62 | 98.3 |
| Turnos, límite de turnos | `appointments.service.ts` | 100 | 100 | 83.62 | 100 |
| Topes del plan gratuito | `plan-limits.ts` | 100 | 100 | 100 | 100 |
| Autenticación | `auth.service.ts` | 100 | 100 | 100 | 100 |
| Registro, códigos, contraseña | `users.service.ts` | 100 | 100 | 100 | 100 |
| Roles | `role.guards.ts` | 100 | 100 | 100 | 100 |
| Secreto JWT | `jwt.constant.ts` | 100 | 100 | 100 | 100 |
| Estrategias de passport | `jwt.strategy.ts` | 100 | 100 | 100 | 100 |
| | `local.strategy.ts` | 100 | 100 | 100 | 100 |

## Resto de los servicios (fuera del alcance)

| Archivo | Líneas | Sentencias | Ramas | Funciones |
|---|---|---|---|---|
| `clinics.service.ts` | 100 | 100 | 100 | 100 |
| `geography.service.ts` | 66.66 | 70.58 | 100 | 16.66 |
| `meds-drug.service.ts` | 46.66 | 52.94 | 100 | 12.5 |
| `meds-measurement-unit.service.ts` | 46.66 | 52.94 | 100 | 12.5 |
| `meds-shape.service.ts` | 46.66 | 52.94 | 100 | 12.5 |
| `meds-type.service.ts` | 46.66 | 52.94 | 100 | 12.5 |
| `mail.service.ts` | 34.88 | 37.77 | 0 | 16.66 |
| `meds.service.ts` | 22.58 | 23.68 | 0 | 12.5 |
| `notifications.service.ts` | 18 | 18.96 | 0 | 0 |
| `documents.service.ts` | 15 | 15.71 | 0 | 0 |
| `events.service.ts` | 15.21 | 16.98 | 0 | 5.26 |
| `analytics.service.ts` | 0 | 0 | 0 | 0 |
| `notifications-push.service.ts` | 0 | 0 | 0 | 0 |
| `notification-scheduler.service.ts` | 0 | 0 | 0 | 0 |
| `tasks.service.ts` | 0 | 0 | 100 | 0 |

## Cobertura global

| Líneas | Sentencias | Ramas | Funciones |
|---|---|---|---|
| 42.85 | 42.85 | 42.34 | 36.87 |

La cifra global incluye todo `src` (`collectCoverageFrom: **/*.(t|j)s`): `main.ts`, módulos, DTOs, entidades, scripts de seed y los servicios de la tabla anterior.

## Posibles bugs detectados (sin corregir)

1. `ProfessionalsService.getPatients` sólo devuelve en `pendingRequests` las solicitudes a dependientes. Desde que las solicitudes a titulares también quedan pendientes (commit `5b9e434`), el profesional no las ve en su pantalla de pacientes.
2. `ProfessionalsService.linkPatient` rechaza una nueva solicitud si ya existe un vínculo, aunque esté `REJECTED`, con el mensaje "El paciente ya está vinculado".
3. `cancelMedEvent`, `updateMedEvent`, `cancelAppointment`, `confirmAppointment` y las ediciones de turnos no validan quién las ejecuta (el propio código lo advierte en un comentario).
