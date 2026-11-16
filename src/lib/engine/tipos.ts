// Contratos del motor de asignación (ERS 4.2 y 4.4).
// El motor es TypeScript puro: no conoce Prisma, Next.js ni Resend. Recibe datos y devuelve propuestas.

export type DiaISO = string; // YYYY-MM-DD

export interface OficinaMotor {
  id: string;
  nombre: string;
  ciudad: string;
  zona: string;
  capacidad: number; // puestos de atención
  atencionVirtual: boolean;
  horaApertura: number;
  horaCierre: number;
  abreSabado: boolean;
  horaCierreSabado: number;
}

export interface PersonaMotor {
  id: string;
  nombre: string;
  oficinaId: string;
  horasSemana: number;
}

export type TipoTurnoMotor = "MOTOR" | "MANUAL" | "COBERTURA" | "APOYO";

export interface TurnoMotor {
  id?: string;
  usuarioId: string;
  oficinaId: string;
  fecha: DiaISO;
  inicio: number; // minutos desde medianoche
  fin: number;
  tipo: TipoTurnoMotor;
  virtual: boolean;
  nota?: string;
  cubreA?: string;
}

export interface AusenciaMotor {
  usuarioId: string;
  desde: DiaISO;
  hasta: DiaISO;
  inicio?: number | null; // si es solo unas horas
  fin?: number | null;
}

export interface ServicioDemanda {
  servicio: string;
  ahtGeneralSeg: number;
  ahtPreferencialSeg: number;
  parte: number; // proporción de turnos
}

/** Perfil de demanda de una oficina, estimado del histórico (Digiturno o sintético). */
export interface PerfilDemanda {
  oficinaId: string;
  /** llegadas promedio por hora: lambda[díaSemana 0..6][hora 0..23] */
  lambda: number[][];
  ahtSeg: number;
  ahtGeneralSeg: number;
  ahtPreferencialSeg: number;
  partePreferencial: number;
  pacienciaSeg: number;
  servicios: ServicioDemanda[];
  semanasHistorico: number;
  turnosPorSemana: number;
}

export interface ParametrosMotor {
  servicioObjetivo: number; // 0.8 = 80 %
  tiempoObjetivoSeg: number; // 300 = 5 min
  semanasHistorico: number;
  replicas: number;
  semilla: number;
  prioridadPreferencial: boolean;
  respetarPuestos: boolean;
  excluirAusencias: boolean;
  permitirApoyosEntreCiudades: boolean;
  respetarAjustesManuales: boolean;
  maxHorasSemana: number;
  descansoMinHoras: number;
}

export const PARAMETROS_POR_DEFECTO: ParametrosMotor = {
  servicioObjetivo: 0.8,
  tiempoObjetivoSeg: 300,
  semanasHistorico: 8,
  replicas: 30,
  semilla: 20261025,
  prioridadPreferencial: true,
  respetarPuestos: true,
  excluirAusencias: true,
  permitirApoyosEntreCiudades: true,
  respetarAjustesManuales: true,
  maxHorasSemana: 42, // jornada máxima legal en Colombia desde el 15 de julio de 2026 (Ley 2101 de 2021)
  descansoMinHoras: 12,
};

export interface EntradaMotor {
  semanaInicio: DiaISO; // lunes
  oficinas: OficinaMotor[];
  personas: PersonaMotor[];
  ausencias: AusenciaMotor[];
  turnosFijos: TurnoMotor[]; // ajustes manuales y apoyos ya confirmados que el motor no mueve
  demanda: Record<string, PerfilDemanda>;
  parametros: ParametrosMotor;
}

export interface FranjaResultado {
  hora: number;
  llegadas: number;
  requeridas: number;
  asignadas: number;
  nivelServicio: number; // Erlang C con las asignadas
  esperaSeg: number;
}

export interface FranjaCorta {
  oficinaId: string;
  fecha: DiaISO;
  hora: number;
  faltan: number;
  llegadas: number;
  asignadas: number;
  esperaSeg: number;
}

export interface KpisMalla {
  nivelServicio: number;
  esperaPromSeg: number;
  abandono: number;
  turnos: number;
  personas: number;
  horas: number;
}

export interface AlternativaMalla {
  id: "A" | "B";
  nombre: string;
  estrategia: string;
  turnos: TurnoMotor[];
  kpis: KpisMalla;
  franjas: Record<string, Record<DiaISO, FranjaResultado[]>>; // oficina -> día -> franjas
  franjasCortas: FranjaCorta[];
  kpisPorOficina: Record<string, KpisMalla>;
}

export interface ResultadoPropuesta {
  semanaInicio: DiaISO;
  alternativas: AlternativaMalla[];
  elegida: "A" | "B";
  generadoEn: string;
}

/** Un turno que queda libre por una ausencia aprobada (RF-06). */
export interface TurnoLiberado {
  turnoId: string;
  usuarioId: string;
  nombre: string;
  oficinaId: string;
  fecha: DiaISO;
  inicio: number;
  fin: number;
}

export interface CandidatoCobertura {
  usuarioId: string;
  nombre: string;
  oficinaOrigenId: string;
  modalidad: "MISMA_OFICINA" | "PRESENCIAL" | "VIRTUAL";
  trasladaTurnoId?: string; // si se mueve un turno existente de otra oficina
  minutosViaje?: number;
  horasAntes: number;
  horasDespues: number;
  usoOrigen?: number;
  razon: string;
}

export interface CoberturaPropuesta {
  liberado: TurnoLiberado;
  candidato: CandidatoCobertura | null;
}

export interface ImpactoDia {
  fecha: DiaISO;
  oficinaId: string;
  servicioSin: number;
  esperaSin: number;
  servicioCon: number;
  esperaCon: number;
}

export interface ResultadoCobertura {
  coberturas: CoberturaPropuesta[];
  impacto: ImpactoDia[];
  verificaciones: { texto: string; ok: boolean }[];
  explicacion: string;
}

export interface EntradaCobertura {
  liberados: TurnoLiberado[];
  turnosSemana: TurnoMotor[];
  oficinas: OficinaMotor[];
  personas: PersonaMotor[];
  ausencias: AusenciaMotor[];
  demanda: Record<string, PerfilDemanda>;
  parametros: ParametrosMotor;
}

export interface SugerenciaApoyo {
  usuarioId: string;
  nombre: string;
  turnoId?: string;
  fecha: DiaISO;
  inicio: number;
  fin: number;
  desdeOficinaId: string;
  haciaOficinaId: string;
  usoDesde: number;
  usoHacia: number;
  modalidad: "PRESENCIAL" | "VIRTUAL";
  minutosViaje?: number;
  esperaAntesSeg: number;
  esperaDespuesSeg: number;
  razon: string;
}

export interface EntradaApoyos {
  dias: DiaISO[];
  desdeMinuto?: number; // para "hoy": solo franjas desde esta hora
  turnos: TurnoMotor[];
  oficinas: OficinaMotor[];
  personas: PersonaMotor[];
  ausencias: AusenciaMotor[];
  demanda: Record<string, PerfilDemanda>;
  parametros: ParametrosMotor;
}

// Segregación de interfaces (ISP): cada consumidor depende solo de la capacidad que usa.
export interface GeneradorMalla {
  proponerSemana(entrada: EntradaMotor): ResultadoPropuesta;
}

export interface CalculadorCobertura {
  cubrirAusencia(entrada: EntradaCobertura): ResultadoCobertura;
}

export interface SugeridorRedistribucion {
  sugerirApoyos(entrada: EntradaApoyos): SugerenciaApoyo[];
}

/** AssignmentEngine del ERS: la abstracción de la que dependen las rutas de la API (DIP). */
export interface AssignmentEngine extends GeneradorMalla, CalculadorCobertura, SugeridorRedistribucion {
  readonly nombre: string;
}
