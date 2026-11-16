import { ColasSimulacionEngine } from "./motor";
import type { AssignmentEngine } from "./tipos";

export * from "./tipos";
export { ColasSimulacionEngine } from "./motor";

let instancia: AssignmentEngine | null = null;

/** Punto único de construcción del motor: las rutas dependen de AssignmentEngine, no de la clase concreta. */
export function obtenerMotor(): AssignmentEngine {
  if (!instancia) instancia = new ColasSimulacionEngine();
  return instancia;
}
