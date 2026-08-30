# SIGSA — Estado para la demo en vivo

Diagnóstico previo a la reunión con los directores de tesis (Ing. Villafañe / Ing. Cassani).
Fecha del relevamiento: **2026-08-12**. Rama: `feature/final-polish` en los tres repos.

Verificado ejecutando: build de los tres proyectos, arranque del backend, consultas a la base
y llamadas reales a la API (incluido el circuito completo de "me hago cargo").

---

## TL;DR — lo que hay que hacer sí o sí antes de la reunión

| # | Bloqueante | Esfuerzo |
|---|-----------|----------|
| 1 | `apiUrl` apunta a `localhost` → **el emulador no conecta con el backend** | 1 min |
| 2 | **No hay ningún evento futuro en la base** → "Próximos eventos" vacío y nada de qué hacerse cargo | 5–10 min |
| 3 | El dashboard del backoffice abre en "Último mes" → **casi todo en cero** | 1 min (o 1 línea) |

Nada más es bloqueante. El resto del sistema está sólido.

---

## 1. Inventario de funcionalidades

### Backend (NestJS) — compila limpio, arranca limpio

| Módulo | Estado | Depende de |
|---|---|---|
| `auth` — JWT, login, registro, verificación de mail, recuperación de contraseña | Completo | SMTP (conecta OK: *"SMTP server is ready"*) |
| `users` — CRUD, `PATCH /users/me`, foto de perfil | Completo | — |
| `family-groups` — grupos, dependientes, alta/baja de miembros, foto del grupo, solicitudes de profesionales, búsqueda de dependiente por DNI | Completo | — |
| `group-events` — "me hago cargo", historial del grupo | **Completo, verificado end-to-end** | — |
| `appointments` — CRUD, cancelar, confirmar, por dependiente | Completo | — |
| `meds-event` — toma única + **tratamientos periódicos** (`seriesId`, `doseIndex`, `totalDoses`, `intervalHours`), cancelar tratamiento | Completo | — |
| `meds` + catálogos (drug, shape, type, measurement-unit) | Completo | Catálogo cargado (5/12/5/5/5 filas) |
| `documents` — CRUD con contenido base64, miniaturas, reemplazo de archivo | Completo | — |
| `notifications` — tokens de dispositivo, scheduler (cron 1/min), push FCM v1, lógica grupal, lead times (15 min turnos / 5 min medicamentos) | Completo | **FCM + internet** |
| `professionals` — usuarios profesionales, especializaciones, vinculación paciente-profesional | Completo | — |
| `analytics` — 5 endpoints con filtro de rango | Completo | **Sin guard de auth** (ver §3) |
| `geography` — países / provincias / ciudades | Parcial | `cities` está vacía, pero **ningún cliente la consume** → inocuo |
| `clinics`, `tasks` | Completo / auxiliar | — |

### Mobile (Ionic + Angular) — compila limpio

Welcome · Login · Registro (3 pasos: personal / usuario / profesional) · Recuperación de contraseña ·
Tabs (home, medicamentos, turnos, grupos) · Perfil + **Mis datos** editable + foto ·
Grupos (listado, alta de grupo+dependiente, home del grupo, miembros, agregar miembros, **historial**, solicitudes de profesionales) ·
Turnos (crear / editar / ver + **Me hago cargo**) · Medicamentos (crear con periodicidad / editar / ver + **Me hago cargo** + tomas de la serie) ·
Documentos (crear / editar / ver) · Doctores · Pacientes ·
Push con botones nativos de acción.

- No quedó **ningún dato falso en uso**: los `FAKE_*` sólo sobreviven como imports muertos en `group-home.page.ts`.
- `getUserByDNI()` en `personal-data.page.ts:221` lanza `Method not implemented` — **es código muerto**, el botón llama a `navigate()`. El registro funciona.

### Backoffice (Angular 13 + Chart.js) — compila y sirve OK en modo dev

Dashboard analítico · Medicamentos (Listado, Tipos, Formas, Unidad de Medida, Drogas) ·
Profesionales (Listado, Especializaciones con filtros) · Usuarios (Listado).

Todos los ABM responden y traen datos. La paginación es **0-indexada**.

---

## 2. Flujo grupo + dependiente (el plato fuerte)

### Terminado end-to-end

1. **Alta de grupo con dependiente** — `POST /family-groups/create`: nombre, datos del dependiente y miembros por DNI. El creador se agrega solo.
2. **Gestión de miembros** — agregar / quitar, con registro en el historial.
3. **Home del grupo** — ficha del dependiente (nacimiento, DNI, grupo sanguíneo), próximos eventos, solapas de turnos / medicamentos / documentos, FAB para crear los tres.
4. **Creación de un evento para el dependiente** → genera notificación para **todos** los integrantes (`createdBy` + `members`) y una entrada `event_created` en el historial.
5. **"Me hago cargo"** — botón dentro del turno y del medicamento, y botones nativos en la notificación push.
6. **Historial del grupo** — quién hizo qué, con nombre y **foto** del actor. Control de pertenencia: 403 si no sos del grupo.

### Verificado contra la API real (grupo de prueba, datos ya limpiados)

```
1) POST /meds-event/dependent/24            → 201, medEvent 172
2) POST /group-events/events/med_event/172/respond {take_charge}
                                            → 201 {"status":"taken_charge","takenChargeByName":"Carlos Méndez"}
3) idem, otra vez                           → 409 "Carlos Méndez ya se hizo cargo"
4) GET /group-events/17/history             → 2 entradas, con actorName y actorPhoto
```

La carrera entre dos integrantes está bien resuelta: gana el primero, al resto se les cancela
el recordatorio y les llega un aviso de quién se hizo cargo.

### Arreglado durante este relevamiento

**El push de "X se hizo cargo" no abría nada al tocarlo.** El front resuelve el destino con
`data.originalType`, pero el scheduler nunca mandaba ese campo: la navegación cortaba en seco.
Corregido en `src/notifications/scheduler/notification-scheduler.service.ts` (`buildData`).
Es exactamente el paso final del flujo que vas a mostrar. Backend recompilado y OK.

### Limitaciones a tener en cuenta (no rompen, pero pueden aparecer en las preguntas)

- **No hay bandeja de notificaciones in-app.** `NotificationsController` sólo registra dispositivos;
  no existe un `GET /notifications`. Se llega a "Me hago cargo" (a) desde el push o
  (b) navegando grupo → solapa → ítem → Ver. Si un director pregunta *"¿dónde veo mis notificaciones?"*,
  hoy la respuesta es el sistema operativo. Vale la pena tener la respuesta preparada.
- El botón **sólo aparece si viene el query param `groupId`**, es decir, si entraste desde el home
  del grupo. Si abrís el mismo medicamento desde la solapa personal, no se ve. **Importante para el guion.**
- "Descartar" es individual, no afecta al grupo (decisión de diseño).
- No hay "deshacer" sobre un evento ya tomado.

### Datos de prueba que conviene tener cargados

Hoy en la base: 48 usuarios, 24 dependientes, 17 grupos familiares.

El grupo de demo es el **grupo 1 "familia"**, dependiente **patricia coppola**,
creado por `1999pedromartinez@gmail.com` (id 1), con **2 integrantes**: Pedro (id 1) y pedra (id 2).

Para que el flujo se vea completo hace falta:

| Necesidad | Estado hoy | Qué hacer |
|---|---|---|
| Un grupo con dependiente y ≥2 integrantes | **Listo** (grupo 1) | — |
| Al menos 1 evento **futuro** del dependiente | **Falta — no hay ninguno en toda la base** | Crear 2–3 en vivo o por API |
| Historial con actividad previa | **Listo** — 4 entradas, incluidas 2 de "se hizo cargo" | — |
| Un segundo integrante que reciba el push | **Falta** — el usuario 2 no tiene dispositivo registrado | Ver §4 |

> Nota sobre "un usuario con dos dependientes": el modelo es `FamilyGroup 1—1 Dependent`.
> Dos dependientes = **dos grupos familiares**. Hoy el usuario 1 tiene uno solo. Si querés mostrar
> el listado de grupos con más de una tarjeta, creá un segundo grupo antes de la reunión
> (es el mismo flujo de alta, ~2 min, y de paso lo mostrás en vivo).

---

## 3. Backoffice como valor para el stakeholder

### Qué hay y funciona

Con un rango de **un año** los cinco endpoints devuelven datos ricos:

| Panel | Contenido real |
|---|---|
| KPIs | 35 usuarios · 34 activos · 13 profesionales · 17 grupos · 24 dependientes · 8 dependientes con profesional vinculado · 113 turnos · 149 recordatorios · 80 documentos · 34 vinculaciones |
| Eventos por período | Serie mensual de 13 puntos, con curva creciente y pico en May 2026 (turnos 43 / medicamentos 63 / documentos 40) |
| Top especialidades | Pediatría 35 · Cardiología 29 · Dermatología 17 · Clínica médica 14 · Ginecología 6 |
| Distribución de grupos | Tamaño promedio **2,12**; distribución 1→5, 2→7, 3→3, 4→2 |
| Estado de vinculaciones | 22 aceptadas · 8 pendientes · 4 rechazadas |

Es material genuinamente presentable: hay ranking, hay tendencia y hay distribución. Es la mejor
respuesta a *"¿qué le aporta esto a un stakeholder?"* — mostrale la adopción, la carga de eventos
y el tamaño de los grupos.

### El problema: el rango por defecto

El dashboard abre en **"Último mes"** y en esa ventana casi todo da **cero**
(usuarios 0, turnos 0, documentos 0, grupos 0; sólo 17 recordatorios), porque los datos
cargados llegan hasta el 2026-07-29 y la métrica se calcula sobre `createdAt`.

**Dos salidas, elegí una:**

- **La de 1 clic:** apenas abrís el dashboard, tocá **"Último año"**. Todo se puebla.
- **La de 1 línea:** en `home.component.ts:23` cambiar `preset: 'month'` por `preset: 'year'`
  (y el `@Input() value` por defecto en `date-range-selector.component.ts:62`) para que abra
  ya poblado y no dependa de que te acuerdes en vivo. **Recomendado**: en una demo no querés
  que la primera pantalla del backoffice sean seis ceros.

### Qué NO mostrar del backoffice

- **No tiene login.** No hay guard, no hay interceptor, no se manda `Authorization` en ningún lado;
  y `/api/analytics/*` responde 200 sin token. Si preguntan por seguridad, mejor tenerlo asumido
  como trabajo pendiente que ser descubierto en vivo.
- **No abras las DevTools sobre el listado de profesionales**: `/professionals/dashboard`
  devuelve el hash bcrypt de la contraseña en el JSON.
- **No navegues a `/modules` a mano**: redirige a `meds_list`, que no es una ruta definida → pantalla en blanco.
  Usá siempre el sidebar.
- `ng build` de producción está roto (`Invalid version: "15.2-15.3"`, cosa de esbuild/browserslist).
  Irrelevante para la demo local, que va con `npm start`.

---

## 4. Riesgos de la demo en vivo

### 🔴 Crítico — el emulador no va a conectar

`sigsa-frontend/src/environments/environment.ts` tiene:

```ts
apiUrl: 'http://localhost:3000/api',        // browser local
```

En un emulador Android, `localhost` **es el emulador**, no tu Mac. La app no va a poder hablar
con el backend: pantallas vacías o error en el login.

El propio archivo ya tiene la línea correcta comentada:

```ts
apiUrl: 'http://10.0.2.2:3000/api',         // emulador Android
```

- **Emulador Android** → `http://10.0.2.2:3000/api`
- **Dispositivo físico en la red** → `http://192.168.0.38:3000/api` (esa es tu IP hoy; confirmala el día de la demo, cambia con la red)

Después: `ionic build && npx cap sync android && npx cap run android --target emulator-5554`.

> No lo cambié yo porque el valor correcto depende de si vas con emulador o con teléfono.

**No compiles con `--configuration production`**: `environment.prod.ts` apunta a `192.168.0.138`
(IP vieja) y además a **otro proyecto de Firebase** (`sigsa-2022`, cuando el backend usa `sigsa-eeebc`),
con lo cual el push directamente no llegaría.

### 🔴 Crítico — no hay eventos futuros

Consultado sobre la base: **0 turnos futuros y 0 recordatorios futuros**. Todo es pasado
(lo último, 2026-07-29). Como `getNextMedsEventsByDependent` filtra por `date > NOW()`:

- "Próximos eventos" aparece **vacío** en el home personal y en el del grupo.
- No hay nada de qué "hacerse cargo" salvo que lo crees en el momento.

**Mitigación (elegí):**
- **Crear los eventos en vivo** — es lo que yo haría: la creación es parte de lo que querés mostrar,
  y de paso el evento queda disponible para el "me hago cargo" dos minutos después.
- **Precargarlos por API** antes de la reunión, para tener red de seguridad: 2 turnos y
  1 tratamiento para la dependiente del grupo 1, con fecha de mañana.

### 🟡 CORS — está bien para el emulador

`src/main.ts` tiene la lista hardcodeada, pero **la app nativa no tiene problema**: Capacitor
en Android usa origen `http://localhost`, que **sí está permitido**.

Sí hay dos detalles:
- Tu IP actual (`192.168.0.38`) **no** está en la lista (están `192.168.0.138` y `192.168.0.12`).
  Sólo importa si demostrás desde el **navegador** servido en la LAN; la app nativa no se ve afectada.
- El backoffice arranca con `npm start` en el **puerto 8100**, el mismo que `ionic serve`.
  Si levantás los dos a la vez, chocan. Corré el backoffice en 4200 (`ng serve --port 4200`,
  ya está permitido en CORS) o no los sirvas simultáneamente.

### 🟡 FCM y conexión inestable

`firebase-service-account.json` está presente y **Firebase Admin inicializa correctamente**
(no está en modo simulación). Pero el push **necesita internet**: si el wifi de la sala falla,
las notificaciones no llegan.

**Mitigación:** el botón **"Me hago cargo" dentro de la app no depende de FCM**, sólo del backend
local. Si el push no llega, entrás por grupo → solapa → ítem → Ver → Me hago cargo, y el flujo se
ve igual de completo. **Tené ese camino ensayado como plan B.**

Además: **sólo el usuario 1 (Pedro) tiene un dispositivo registrado.** El usuario 2 (pedra) no tiene
ninguno, así que no vas a poder mostrar "al otro integrante le llega el aviso" salvo que lo loguees
en un segundo emulador y dejes que registre su token.

### 🟡 Aviso — al arrancar el backend se dispara la cola atrasada

Cuando levanté el backend para verificar, el scheduler **drenó el backlog y envió 13 push reales
a tu dispositivo** de una sentada (notificaciones viejas vencidas desde julio). Ya está drenado,
así que no te va a volver a pasar el día de la demo — pero tenelo presente si restaurás una base vieja.

Quedan **2 notificaciones trabadas** (`event_taken_charge` dirigidas al usuario 2, que no tiene
dispositivo): el scheduler las reintenta cada minuto y loguea un warning. Es ruido inofensivo,
pero si compartís la consola del backend, van a aparecer.

### 🟢 Base de datos

- PostgreSQL 17 corriendo (instalación EDB en `/Library/PostgreSQL/17`), base `sigsa_db`, 26 tablas.
- `synchronize: true` → el esquema se aplica solo al arrancar; `group_event_log` ya existe.
- **`npm run seed` está roto**: apunta a `./src/data-source.ts` y el archivo está en `./data-source.ts`.
  Los catálogos ya están cargados, así que no lo necesitás; pero no lo corras a último momento
  esperando que funcione.
- **`npm run seed:analytics-data` sí funciona** y es la herramienta correcta para poblar el dashboard:
  genera ~35 usuarios, 12 profesionales, 15 grupos, 90 turnos, 110 recordatorios y 70 documentos con
  fechas relativas a hoy (50% dentro de los últimos 30 días), con lo cual **el rango "Último mes"
  dejaría de dar cero**.
  Dos advertencias: (a) crea duplicados en cada corrida, y (b) sus eventos son de usuarios sembrados,
  **no** del grupo 1 — no te resuelve el problema de "Próximos eventos" en la app.

---

## 5. Checklist priorizado

### Listo para mostrar tal cual

- Login, registro y recuperación de contraseña
- Alta de grupo familiar con dependiente; alta y baja de integrantes
- Home del grupo con ficha del dependiente y las tres solapas
- Creación de turnos, medicamentos (con periodicidad) y documentos, propios y del dependiente
- **"Me hago cargo" completo**, con resolución de carrera y aviso al resto
- **Historial del grupo** con nombre y foto de quien hizo cada acción
- Fotos de perfil, de grupo y "Mis datos" editable
- Vinculación paciente-profesional y solicitudes
- Backoffice: dashboard (en rango anual) y los ABM de medicamentos, profesionales y usuarios

### Arreglo rápido antes de la demo

| Qué | Esfuerzo | Por qué |
|---|---|---|
| `apiUrl` → `http://10.0.2.2:3000/api` + `ionic build && npx cap sync android` | 1 min + build | Sin esto **no hay demo** |
| Crear 2–3 eventos futuros para patricia coppola | 5–10 min | Sin esto "Próximos eventos" está vacío |
| Dashboard: abrir en "Último año" (1 clic) o cambiar el preset por defecto | 1 min | Evita que el backoffice abra en ceros |
| *(Opcional)* Segundo grupo familiar para el usuario 1 | 2 min | Muestra el listado de grupos con contenido |
| *(Opcional)* Segundo emulador logueado como `pedrix004@gmail.com` | 10 min | Único modo de mostrar el push al otro integrante |
| *(Ya hecho)* `originalType` en el push de "se hizo cargo" | — | Corregido |

### Mejor no mostrar / esquivar en el guion

- Bandeja de notificaciones in-app: **no existe**. No prometas la pantalla.
- Abrir un medicamento del dependiente **desde la solapa personal**: no aparece "Me hago cargo".
  Entrá siempre desde el home del grupo.
- DevTools sobre el listado de profesionales del backoffice (hash de contraseña en el JSON).
- Navegación manual a `/modules` en el backoffice (pantalla en blanco).
- `ng build` de producción de cualquiera de los dos frontends.
- La solapa de ciudades / geografía: la tabla `cities` está vacía.

---

## 6. Orden sugerido del recorrido

Arranca fuerte por lo visual, cierra por lo conceptual.

**1. Apertura — login y home personal** *(2 min)*
Entrá con la cuenta de Pedro. Foto de perfil, "Mis datos". Sirve para mostrar que es un producto
terminado, no una maqueta.

**2. Caso de uso individual — crear un recordatorio** *(4 min)*
Creá un medicamento **con tratamiento periódico** ("cada 8 hs durante 5 días"). Es lo más
visualmente contundente que tenés: se generan las tomas y se ven agrupadas. Dejá la fecha de la
primera toma **a 6–7 minutos** de ese momento: la vas a necesitar más adelante.

**3. Documentos y turnos** *(3 min)*
Rápido: subí un documento con miniatura y mostrá un turno. Demuestra amplitud del dominio.

**4. Grupo + dependiente — el núcleo** *(8 min)*
- Listado de grupos → home del grupo "familia" → ficha de patricia coppola.
- Creá un **turno para la dependiente** en vivo. Señalá que la notificación se dispara para
  **todos** los integrantes: ahí está el aporte real del sistema.
- Entrá al evento y tocá **"Me hago cargo"**. Mostrá que queda sellado con tu nombre y la hora.
- Volvé a intentarlo (o hacelo desde la otra cuenta si tenés el segundo emulador):
  aparece *"Pedro Martinez ya se hizo cargo"*. **Ese conflicto resuelto es el mejor momento de la demo** —
  es la prueba de que el problema de coordinación familiar está realmente modelado, no dibujado.
- Cerrá con el **historial del grupo**: quién creó qué y quién se hizo cargo, con las fotos.

**5. Push en vivo** *(2 min, opcional)*
Si a esta altura cae la toma que programaste en el paso 2, va a llegar el push con los botones
nativos. Si el wifi falla, saltealo sin dramatizar: ya mostraste el mecanismo completo desde la app.

**6. Cierre — backoffice** *(5 min)*
Cambiá a "Último año" **antes** de compartir la pantalla. Recorré: KPIs de adopción → eventos por
mes (la tendencia) → top de especialidades → tamaño promedio de grupo (2,12) → estado de vinculaciones.
Este es el momento de responder la pregunta del stakeholder: el sistema no sólo sirve a la familia,
también da visibilidad agregada sobre adopción, carga asistencial y demanda por especialidad.

**Total ~25 min**, dejando aire para preguntas.

> Consejo de guion: si preguntan por seguridad del backoffice o por la bandeja de notificaciones,
> reconocelo como pendiente identificado y seguí. Son los dos huecos reales y es mejor nombrarlos
> vos que dejar que los encuentren.
