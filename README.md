# Surtigas Turnos · “Más allá del turno”

Sistema de Gestión Inteligente de Turnos y Recursos para las oficinas de atención al cliente de Surtigas S.A. E.S.P. Prototipo TLR 6 del reto de innovación abierta “Más allá del turno” (Retos CUC, Universidad de la Costa), construido según el ERS v1.0.

Todos los datos del prototipo son simulados: oficinas, personas y demanda de Digiturno. El sistema está listo para importar el export real de Digiturno.

## Qué hace

| Requisito | Dónde está |
| --- | --- |
| RF-01, RF-02 Inicio de sesión y roles | `/entrar`, `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts` |
| RF-03 Malla vigente por oficina | `/admin/malla` |
| RF-04 Propuesta con teoría de colas y simulación | `/admin/malla/propuesta`, `src/lib/engine` |
| RF-05 Ajuste manual | Editor anclado de la malla (el turno queda como “ajuste manual”) |
| RF-06 Recálculo al aprobar una ausencia | `/admin/malla/recalculo`, `recalcularPorAusencia` en `src/lib/servicios/excusas.ts` |
| RF-07 Reportar excusa, permiso o incapacidad | `/colaborador/reportar` (con soporte en Vercel Blob) |
| RF-08 Aprobar o rechazar | `/admin/ausencias`, `/admin/ausencias/EX-####` |
| RF-09 Historial de estados | Tabla `HistorialExcusa`, línea de tiempo en el detalle |
| RF-10 Horario semanal por correo | Vercel Cron → `/api/cron/horario-semanal` (domingos 18:00 Colombia) |
| RF-11 Aviso inmediato a la administración | Al registrar una ausencia |
| RF-12 Aviso inmediato al colaborador | Al aprobar o rechazar |
| RF-13 Dashboard | `/admin` (se actualiza solo cada 60 s) |
| RF-14 Redistribución entre oficinas y ciudades | `/admin/apoyos` (en persona o virtual) |

Extras: importador del export de Digiturno (`/admin/datos`), gestión de oficinas y equipo, bitácora de correos con reintento, recuperación de contraseña e invitaciones, vista móvil para colaboradores y administración.

## Motor de asignación

`src/lib/engine` es TypeScript puro, sin dependencias de Next.js, Prisma ni Resend. Se expone con la interfaz `AssignmentEngine` (ERS 4.4):

1. **Demanda**: por oficina, día de la semana y hora se estiman las llegadas (λ), el tiempo medio de atención por fila y servicio y la paciencia de los usuarios, con las últimas N semanas del histórico (`src/lib/datos/perfil.ts`).
2. **Erlang C (M/M/c)**: para cada franja calcula cuántas personas se necesitan para atender al 80% de los usuarios en menos de 5 minutos, con tope en los puestos de la oficina (`erlang.ts`).
3. **Construcción de la malla**: plantillas de jornada completa y media jornada, reglas laborales (tope semanal de 42 h por la Ley 2101 de 2021, 12 h de descanso, sin choques, ausencias aprobadas excluidas, ajustes manuales intactos) y apoyos entre oficinas cuando falta gente (`motor.ts`, `plan.ts`).
4. **Simulación de eventos discretos**: cada malla se prueba con 30 réplicas de un día de atención, con fila preferencial prioritaria y abandono por impaciencia (`simulacion.ts`). Se comparan dos estrategias (Malla A y Malla B) y la administradora confirma.

Las estrategias se pueden extender sin tocar el motor (`EstrategiaMalla`), y las rutas solo dependen de `obtenerMotor()`.

## Stack

Next.js 15 (App Router) · TypeScript · Auth.js v5 · Prisma 6 sobre Neon (PostgreSQL) · Resend · Vercel Blob · Vercel Cron. Monolito modular con capas de presentación (`src/app`), aplicación (`src/lib/servicios`), dominio (`src/lib/engine`) e infraestructura (`src/lib/db.ts`, `src/lib/notificaciones`, `src/lib/almacenamiento.ts`).

Notas de implementación:

- Prisma usa `engineType = "client"` con el adaptador `@prisma/adapter-pg`: no necesita binarios nativos en las funciones serverless.
- Auth.js usa el proveedor de credenciales, que exige sesiones JWT; por eso no se usa el adaptador de base de datos de Auth.js. El rol viaja en el token y el middleware lo valida antes de cada ruta.
- `NotificationService` tiene tres piezas: la implementación con Resend, una de consola para desarrollo y un decorador que deja registro de cada envío en la tabla `Notificacion`.

## Correr en tu computador

Necesitas Node.js 20.9 o superior y una base de datos PostgreSQL (puede ser la misma de Neon).

```bash
npm install
cp .env.example .env        # en Windows: copy .env.example .env
# llena DATABASE_URL, DATABASE_URL_UNPOOLED y AUTH_SECRET
npm run db:migrate          # crea las tablas
npm run db:seed             # datos de demostración
npm run dev                 # http://localhost:3000
npm test                    # pruebas del motor y del importador
```

Sin `RESEND_API_KEY` los correos no salen: se escriben en la consola y quedan en la pantalla Correos. Sin Blob configurado, en local los soportes se guardan en la carpeta `.soportes/`.

### Cuentas de demostración

Contraseña de todas: `Surtigas2026` (cámbiala con `SEED_PASSWORD` antes de sembrar).

- Administradora: `marta.rios@surtigas.co`
- Colaborador: `jorge.medina@surtigas.co` (y los otros 35 colaboradores, con correo `nombre.apellido@surtigas.co`)

En el login, “ver como colaborador / administradora” llena estos datos. Pon `DEMO_PASSWORD_PUBLICA=false` para que no llene la contraseña.

## Desplegar en Vercel

1. Sube el proyecto a un repositorio de GitHub e impórtalo en Vercel (framework Next.js, sin cambios en los comandos: Vercel usa el script `vercel-build`, que aplica las migraciones antes de compilar).
2. En el proyecto de Vercel, pestaña **Storage**:
   - Crea o conecta una base **Neon**. La integración agrega `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
   - Crea un **Blob store** privado y conéctalo al proyecto. Vercel agrega `BLOB_STORE_ID` (o `<PREFIJO>_STORE_ID`) y la app se autentica con OIDC, sin token fijo.
3. En **Settings → Environment Variables** agrega:
   - `AUTH_SECRET` (genera uno con `npx auth secret`)
   - `CRON_SECRET` (cualquier texto largo y aleatorio)
   - `RESEND_API_KEY`, `CORREO_REMITENTE` y `CORREO_REDIRECCION` (tu correo: sin dominio verificado, Resend solo entrega a la dirección dueña de la cuenta, así que en la demo todos los correos llegan ahí y la app registra el destinatario real)
   - `APP_URL` con la URL de producción (opcional)
4. Despliega. Luego siembra los datos una vez desde tu computador apuntando a la base de Neon: `npm run db:seed` con la `.env` de producción.
5. Los cron jobs de `vercel.json` se activan solos en producción: el envío del horario (domingos 23:00 UTC, 18:00 en Colombia) y la actualización diaria de la simulación.

Mientras la simulación está activa, la app completa cada día la demanda simulada hasta la hora actual y arma la malla de la semana si falta, para que la demo siempre tenga datos “de hoy”.

## Importar el histórico real de Digiturno

Opción 1, en la app: **Datos Digiturno → Elige el export**. El archivo se lee en el navegador, se agrega por oficina, día, hora, fila y servicio, y al servidor solo llegan los totales. Antes de importar eliges a qué oficina de la app corresponde cada sede de Digiturno (por `IdOficina`).

Opción 2, por línea de comandos (útil para archivos muy grandes):

```bash
npm run importar -- "C:\ruta\al\export_digiturno.csv"
```

Columnas que se usan: `IdOficina`, `NombreOficina`, `Estado`, `TiempoInicioEspera` (o la segunda `Fecha`), `TiempoEspera`, `TiempoAtencion`, `NombreElementoNodoNivel2` (General o Preferencial), `NombreElementoNodoNivel3` (servicio), `NombreTerminal`, `IdUsuario` (solo para contar personas por hora), `NombreNivelGeografico2` y `NombreNivelGeografico3` (departamento y ciudad), `Abandonados` y `Cancelados`. Los nombres de operadores, datos de clientes, cédulas, teléfonos y correos nunca se guardan.

Al importar con “reemplazar el histórico simulado”, la simulación diaria se apaga y el motor trabaja solo con los datos reales.

## Diferencias con los mockups

- El tope semanal es 42 h (los mockups dicen 44 h): desde el 15 de julio de 2026 la jornada máxima legal en Colombia es de 42 horas. Se puede cambiar en los parámetros del motor.
- El “uso” de una oficina se calcula como personas que pide la fila según Erlang C sobre personas en turno (100% es justo lo necesario).
- Se agregaron las pantallas Datos Digiturno, Buscar, Perfil (móvil) y Ayuda.
