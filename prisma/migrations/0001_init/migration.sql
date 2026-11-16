-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "EstadoTurno" AS ENUM ('CONFIRMADO', 'PROPUESTO', 'MANUAL', 'LIBERADO');

-- CreateEnum
CREATE TYPE "OrigenTurno" AS ENUM ('MOTOR', 'MANUAL', 'COBERTURA', 'APOYO');

-- CreateEnum
CREATE TYPE "TipoExcusa" AS ENUM ('EXCUSA', 'PERMISO', 'INCAPACIDAD');

-- CreateEnum
CREATE TYPE "EstadoExcusa" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "Jornada" AS ENUM ('TODO_EL_DIA', 'UNAS_HORAS');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('HORARIO_SEMANAL', 'NUEVA_EXCUSA', 'RESOLUCION_EXCUSA', 'COBERTURA', 'RECUPERAR_CLAVE', 'INVITACION');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('PENDIENTE', 'ENVIADO', 'ERROR');

-- CreateEnum
CREATE TYPE "Fila" AS ENUM ('GENERAL', 'PREFERENCIAL');

-- CreateEnum
CREATE TYPE "TipoCorrida" AS ENUM ('PROPUESTA', 'RECALCULO');

-- CreateEnum
CREATE TYPE "EstadoCorrida" AS ENUM ('BORRADOR', 'CONFIRMADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "EstadoApoyo" AS ENUM ('SUGERIDO', 'APLICADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "Oficina" (
    "id" TEXT NOT NULL,
    "codigoDigiturno" INTEGER,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "atencionVirtual" BOOLEAN NOT NULL DEFAULT false,
    "horaApertura" INTEGER NOT NULL DEFAULT 8,
    "horaCierre" INTEGER NOT NULL DEFAULT 17,
    "abreSabado" BOOLEAN NOT NULL DEFAULT true,
    "horaCierreSabado" INTEGER NOT NULL DEFAULT 12,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Oficina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'COLABORADOR',
    "oficinaId" TEXT,
    "horasSemana" INTEGER NOT NULL DEFAULT 40,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicio" INTEGER NOT NULL,
    "horaFin" INTEGER NOT NULL,
    "estado" "EstadoTurno" NOT NULL DEFAULT 'CONFIRMADO',
    "origen" "OrigenTurno" NOT NULL DEFAULT 'MOTOR',
    "virtual" BOOLEAN NOT NULL DEFAULT false,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "nota" TEXT,
    "corridaId" TEXT,
    "excusaId" TEXT,
    "cubreA" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Excusa" (
    "id" TEXT NOT NULL,
    "codigo" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoExcusa" NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "jornada" "Jornada" NOT NULL DEFAULT 'TODO_EL_DIA',
    "horaInicio" INTEGER,
    "horaFin" INTEGER,
    "motivo" TEXT NOT NULL,
    "soporteUrl" TEXT,
    "soporteNombre" TEXT,
    "soporteBytes" INTEGER,
    "estado" "EstadoExcusa" NOT NULL DEFAULT 'PENDIENTE',
    "revisadoPorId" TEXT,
    "comentarioResolucion" TEXT,
    "canal" TEXT NOT NULL DEFAULT 'web',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMP(3),

    CONSTRAINT "Excusa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialExcusa" (
    "id" TEXT NOT NULL,
    "excusaId" TEXT NOT NULL,
    "estado" "EstadoExcusa" NOT NULL,
    "evento" TEXT NOT NULL,
    "nota" TEXT,
    "autorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialExcusa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "destinatarioId" TEXT,
    "correoDestino" TEXT NOT NULL,
    "enviadoA" TEXT,
    "asunto" TEXT NOT NULL,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'PENDIENTE',
    "error" TEXT,
    "proveedorId" TEXT,
    "semana" INTEGER,
    "referencia" TEXT,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandaHora" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" INTEGER NOT NULL,
    "fila" "Fila" NOT NULL,
    "servicio" TEXT NOT NULL,
    "llegadas" INTEGER NOT NULL,
    "atendidos" INTEGER NOT NULL,
    "abandonados" INTEGER NOT NULL,
    "cancelados" INTEGER NOT NULL,
    "sumaEsperaSeg" INTEGER NOT NULL,
    "sumaAtencionSeg" INTEGER NOT NULL,
    "atencionesConTiempo" INTEGER NOT NULL,
    "enObjetivo" INTEGER NOT NULL DEFAULT 0,
    "fuente" TEXT NOT NULL DEFAULT 'sintetico',

    CONSTRAINT "DemandaHora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperacionHora" (
    "id" TEXT NOT NULL,
    "oficinaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" INTEGER NOT NULL,
    "operadores" INTEGER NOT NULL,
    "terminales" INTEGER NOT NULL,

    CONSTRAINT "OperacionHora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Importacion" (
    "id" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "filas" INTEGER NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "oficinas" INTEGER NOT NULL,
    "autorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Importacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Corrida" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "tipo" "TipoCorrida" NOT NULL,
    "estado" "EstadoCorrida" NOT NULL DEFAULT 'BORRADOR',
    "semanaInicio" DATE NOT NULL,
    "parametros" JSONB NOT NULL,
    "resultado" JSONB NOT NULL,
    "excusaId" TEXT,
    "autorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Corrida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apoyo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "desdeOficinaId" TEXT NOT NULL,
    "haciaOficinaId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicio" INTEGER NOT NULL,
    "horaFin" INTEGER NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "estado" "EstadoApoyo" NOT NULL DEFAULT 'SUGERIDO',
    "razon" TEXT NOT NULL,
    "usoDesde" INTEGER NOT NULL,
    "usoHacia" INTEGER NOT NULL,
    "esperaAntes" INTEGER,
    "esperaDespues" INTEGER,
    "turnoId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Apoyo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRecuperacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expira" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRecuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Oficina_codigoDigiturno_key" ON "Oficina"("codigoDigiturno");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Turno_fecha_oficinaId_idx" ON "Turno"("fecha", "oficinaId");

-- CreateIndex
CREATE INDEX "Turno_usuarioId_fecha_idx" ON "Turno"("usuarioId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Excusa_codigo_key" ON "Excusa"("codigo");

-- CreateIndex
CREATE INDEX "Excusa_estado_idx" ON "Excusa"("estado");

-- CreateIndex
CREATE INDEX "Notificacion_tipo_fechaEnvio_idx" ON "Notificacion"("tipo", "fechaEnvio");

-- CreateIndex
CREATE INDEX "DemandaHora_oficinaId_fecha_idx" ON "DemandaHora"("oficinaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "DemandaHora_oficinaId_fecha_hora_fila_servicio_key" ON "DemandaHora"("oficinaId", "fecha", "hora", "fila", "servicio");

-- CreateIndex
CREATE UNIQUE INDEX "OperacionHora_oficinaId_fecha_hora_key" ON "OperacionHora"("oficinaId", "fecha", "hora");

-- CreateIndex
CREATE UNIQUE INDEX "Corrida_numero_key" ON "Corrida"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "TokenRecuperacion_tokenHash_key" ON "TokenRecuperacion"("tokenHash");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turno" ADD CONSTRAINT "Turno_corridaId_fkey" FOREIGN KEY ("corridaId") REFERENCES "Corrida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excusa" ADD CONSTRAINT "Excusa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excusa" ADD CONSTRAINT "Excusa_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialExcusa" ADD CONSTRAINT "HistorialExcusa_excusaId_fkey" FOREIGN KEY ("excusaId") REFERENCES "Excusa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialExcusa" ADD CONSTRAINT "HistorialExcusa_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandaHora" ADD CONSTRAINT "DemandaHora_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperacionHora" ADD CONSTRAINT "OperacionHora_oficinaId_fkey" FOREIGN KEY ("oficinaId") REFERENCES "Oficina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Corrida" ADD CONSTRAINT "Corrida_excusaId_fkey" FOREIGN KEY ("excusaId") REFERENCES "Excusa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Corrida" ADD CONSTRAINT "Corrida_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apoyo" ADD CONSTRAINT "Apoyo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apoyo" ADD CONSTRAINT "Apoyo_desdeOficinaId_fkey" FOREIGN KEY ("desdeOficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apoyo" ADD CONSTRAINT "Apoyo_haciaOficinaId_fkey" FOREIGN KEY ("haciaOficinaId") REFERENCES "Oficina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenRecuperacion" ADD CONSTRAINT "TokenRecuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

