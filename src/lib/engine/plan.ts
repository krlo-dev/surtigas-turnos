// Estado mutable de una malla en construcción: horas por persona, turnos por día y reglas laborales.

import { diaSemana, sumarDias } from "../fechas";
import { horasTrabajadas } from "./oficinas";
import type { AusenciaMotor, DiaISO, ParametrosMotor, PersonaMotor, TurnoMotor } from "./tipos";

export class EstadoPlan {
  readonly turnos: TurnoMotor[] = [];
  private horas = new Map<string, number>();
  private porDia = new Map<string, TurnoMotor[]>();

  constructor(
    private readonly personas: PersonaMotor[],
    private readonly ausencias: AusenciaMotor[],
    private readonly par: ParametrosMotor,
    iniciales: TurnoMotor[] = [],
  ) {
    for (const t of iniciales) this.agregar(t);
  }

  private clave(usuarioId: string, fecha: DiaISO) {
    return `${usuarioId}|${fecha}`;
  }

  agregar(t: TurnoMotor) {
    this.turnos.push(t);
    this.horas.set(t.usuarioId, (this.horas.get(t.usuarioId) ?? 0) + horasTrabajadas(t.inicio, t.fin));
    const k = this.clave(t.usuarioId, t.fecha);
    this.porDia.set(k, [...(this.porDia.get(k) ?? []), t]);
  }

  quitar(t: TurnoMotor) {
    const i = this.turnos.indexOf(t);
    if (i >= 0) this.turnos.splice(i, 1);
    this.horas.set(t.usuarioId, (this.horas.get(t.usuarioId) ?? 0) - horasTrabajadas(t.inicio, t.fin));
    const k = this.clave(t.usuarioId, t.fecha);
    this.porDia.set(k, (this.porDia.get(k) ?? []).filter((x) => x !== t));
  }

  horasDe(usuarioId: string) {
    return this.horas.get(usuarioId) ?? 0;
  }

  turnosDe(usuarioId: string, fecha: DiaISO) {
    return this.porDia.get(this.clave(usuarioId, fecha)) ?? [];
  }

  topeHoras(p: PersonaMotor) {
    return Math.min(p.horasSemana, this.par.maxHorasSemana);
  }

  ausente(usuarioId: string, fecha: DiaISO, inicio: number, fin: number): boolean {
    if (!this.par.excluirAusencias) return false;
    return this.ausencias.some((a) => {
      if (a.usuarioId !== usuarioId || fecha < a.desde || fecha > a.hasta) return false;
      if (a.inicio == null || a.fin == null) return true;
      return a.inicio < fin && inicio < a.fin;
    });
  }

  /** Verifica todas las reglas para asignar un turno nuevo a la persona. */
  puedeTomar(p: PersonaMotor, fecha: DiaISO, inicio: number, fin: number, permitirOtroTurnoDia = false): boolean {
    if (diaSemana(fecha) === 0) return false;
    if (this.ausente(p.id, fecha, inicio, fin)) return false;
    const mismos = this.turnosDe(p.id, fecha);
    if (mismos.length && !permitirOtroTurnoDia) return false;
    if (mismos.some((t) => t.inicio < fin && inicio < t.fin)) return false;
    if (this.horasDe(p.id) + horasTrabajadas(inicio, fin) > this.topeHoras(p) + 1e-9) return false;
    const descanso = this.par.descansoMinHoras * 60;
    const antes = this.turnosDe(p.id, sumarDias(fecha, -1));
    if (antes.some((t) => 24 * 60 - t.fin + inicio < descanso)) return false;
    const despues = this.turnosDe(p.id, sumarDias(fecha, 1));
    if (despues.some((t) => 24 * 60 - fin + t.inicio < descanso)) return false;
    return true;
  }

  verificar(): { maxHoras: boolean; descanso: boolean; sinChoques: boolean } {
    let maxHoras = true;
    let descanso = true;
    let sinChoques = true;
    for (const p of this.personas) if (this.horasDe(p.id) > this.par.maxHorasSemana + 1e-9) maxHoras = false;
    for (const [k, lista] of this.porDia) {
      const [uid, fecha] = k.split("|");
      for (let i = 0; i < lista.length; i++)
        for (let j = i + 1; j < lista.length; j++)
          if (lista[i].inicio < lista[j].fin && lista[j].inicio < lista[i].fin) sinChoques = false;
      for (const sig of this.turnosDe(uid, sumarDias(fecha, 1)))
        for (const t of lista) if (24 * 60 - t.fin + sig.inicio < this.par.descansoMinHoras * 60) descanso = false;
    }
    return { maxHoras, descanso, sinChoques };
  }
}
