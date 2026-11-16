// Catálogo simulado del prototipo: 14 oficinas y 36 colaboradores ficticios (más la administradora).
// Ningún nombre corresponde a personas reales.

export interface OficinaSeed {
  clave: string;
  nombre: string;
  ciudad: string;
  zona: string;
  capacidad: number;
  atencionVirtual: boolean;
  abreSabado: boolean;
  codigoDigiturno?: number;
  personas: number;
  demandaPico: number; // llegadas por hora en la franja pico de un día típico (referencia para el generador)
}

export const OFICINAS_SEED: OficinaSeed[] = [
  { clave: "ctg-centro", nombre: "Cartagena Centro", ciudad: "Cartagena", zona: "Cartagena", capacidad: 8, atencionVirtual: true, abreSabado: true, codigoDigiturno: 8, personas: 6, demandaPico: 31 },
  { clave: "bocagrande", nombre: "Bocagrande", ciudad: "Cartagena", zona: "Cartagena", capacidad: 5, atencionVirtual: true, abreSabado: true, personas: 3, demandaPico: 10 },
  { clave: "ejecutivos", nombre: "Los Ejecutivos", ciudad: "Cartagena", zona: "Cartagena", capacidad: 4, atencionVirtual: true, abreSabado: true, personas: 3, demandaPico: 9 },
  { clave: "turbaco", nombre: "Turbaco", ciudad: "Turbaco", zona: "Bolívar", capacidad: 3, atencionVirtual: true, abreSabado: true, personas: 3, demandaPico: 7 },
  { clave: "arjona", nombre: "Arjona", ciudad: "Arjona", zona: "Bolívar", capacidad: 2, atencionVirtual: false, abreSabado: true, personas: 2, demandaPico: 3.3 },
  { clave: "magangue", nombre: "Magangué", ciudad: "Magangué", zona: "Bolívar", capacidad: 4, atencionVirtual: true, abreSabado: true, codigoDigiturno: 2, personas: 3, demandaPico: 11 },
  { clave: "carmen", nombre: "El Carmen de Bolívar", ciudad: "El Carmen de Bolívar", zona: "Bolívar", capacidad: 2, atencionVirtual: false, abreSabado: true, personas: 2, demandaPico: 3.3 },
  { clave: "sincelejo", nombre: "Sincelejo", ciudad: "Sincelejo", zona: "Sucre", capacidad: 6, atencionVirtual: true, abreSabado: true, personas: 3, demandaPico: 12 },
  { clave: "corozal", nombre: "Corozal", ciudad: "Corozal", zona: "Sucre", capacidad: 3, atencionVirtual: true, abreSabado: true, personas: 2, demandaPico: 2.2 },
  { clave: "tolu", nombre: "Tolú", ciudad: "Tolú", zona: "Sucre", capacidad: 2, atencionVirtual: true, abreSabado: false, personas: 1, demandaPico: 1.9 },
  { clave: "monteria", nombre: "Montería", ciudad: "Montería", zona: "Córdoba", capacidad: 6, atencionVirtual: true, abreSabado: true, codigoDigiturno: 10, personas: 3, demandaPico: 11.5 },
  { clave: "cerete", nombre: "Cereté", ciudad: "Cereté", zona: "Córdoba", capacidad: 2, atencionVirtual: false, abreSabado: true, personas: 2, demandaPico: 3.2 },
  { clave: "lorica", nombre: "Lorica", ciudad: "Lorica", zona: "Córdoba", capacidad: 3, atencionVirtual: false, abreSabado: false, personas: 1, demandaPico: 1.9 },
  { clave: "sahagun", nombre: "Sahagún", ciudad: "Sahagún", zona: "Córdoba", capacidad: 2, atencionVirtual: false, abreSabado: true, personas: 2, demandaPico: 2.9 },
];

export interface PersonaSeed {
  nombre: string;
  oficina: string; // clave
  horasSemana: number;
}

// Los primeros nombres coinciden con los personajes de los mockups.
export const PERSONAS_SEED: PersonaSeed[] = [
  { nombre: "Jorge Medina", oficina: "ctg-centro", horasSemana: 40 },
  { nombre: "Ana Cárdenas", oficina: "ctg-centro", horasSemana: 40 },
  { nombre: "Kevin Arrieta", oficina: "ctg-centro", horasSemana: 24 },
  { nombre: "Daniela Pérez", oficina: "ctg-centro", horasSemana: 40 },
  { nombre: "Andrés Julio", oficina: "ctg-centro", horasSemana: 40 },
  { nombre: "Valentina Orozco", oficina: "ctg-centro", horasSemana: 40 },
  { nombre: "Camilo Herrera", oficina: "bocagrande", horasSemana: 40 },
  { nombre: "Laura Villalba", oficina: "bocagrande", horasSemana: 40 },
  { nombre: "Mateo Salgado", oficina: "bocagrande", horasSemana: 40 },
  { nombre: "Isabel Torregrosa", oficina: "ejecutivos", horasSemana: 40 },
  { nombre: "Samuel Puello", oficina: "ejecutivos", horasSemana: 40 },
  { nombre: "Natalia Guerrero", oficina: "ejecutivos", horasSemana: 32 },
  { nombre: "Luis Barrios", oficina: "turbaco", horasSemana: 40 },
  { nombre: "Mariana Castilla", oficina: "turbaco", horasSemana: 40 },
  { nombre: "Felipe Ospino", oficina: "turbaco", horasSemana: 40 },
  { nombre: "Daniel Caraballo", oficina: "arjona", horasSemana: 40 },
  { nombre: "Juliana Marrugo", oficina: "arjona", horasSemana: 40 },
  { nombre: "Óscar Pineda", oficina: "magangue", horasSemana: 40 },
  { nombre: "Carolina Ávila", oficina: "magangue", horasSemana: 40 },
  { nombre: "Héctor Lambraño", oficina: "magangue", horasSemana: 40 },
  { nombre: "Rosa Mercado", oficina: "carmen", horasSemana: 40 },
  { nombre: "Tomás Pacheco", oficina: "carmen", horasSemana: 40 },
  { nombre: "Carlos Rúa", oficina: "sincelejo", horasSemana: 40 },
  { nombre: "Elena Montes", oficina: "sincelejo", horasSemana: 40 },
  { nombre: "Ricardo Vergara", oficina: "sincelejo", horasSemana: 40 },
  { nombre: "Paola Gómez", oficina: "corozal", horasSemana: 40 },
  { nombre: "Fernando Sierra", oficina: "corozal", horasSemana: 40 },
  { nombre: "Gloria Benítez", oficina: "tolu", horasSemana: 40 },
  { nombre: "Sofía Meza", oficina: "monteria", horasSemana: 40 },
  { nombre: "Alejandro Doria", oficina: "monteria", horasSemana: 40 },
  { nombre: "Lucía Petro", oficina: "monteria", horasSemana: 40 },
  { nombre: "Martín Arteaga", oficina: "cerete", horasSemana: 40 },
  { nombre: "Diana Polo", oficina: "cerete", horasSemana: 40 },
  { nombre: "Javier Lozano", oficina: "lorica", horasSemana: 40 },
  { nombre: "Patricia Galván", oficina: "sahagun", horasSemana: 40 },
  { nombre: "Esteban Ruiz", oficina: "sahagun", horasSemana: 40 },
];

export const ADMIN_SEED = { nombre: "Marta Ríos", correo: "marta.rios@surtigas.co" };

export const SERVICIOS_SEED = [
  { servicio: "PQR", parte: 0.46, ahtGeneral: 400, ahtPreferencial: 495 },
  { servicio: "Facturación y pagos", parte: 0.28, ahtGeneral: 260, ahtPreferencial: 330 },
  { servicio: "Radicación de cartas", parte: 0.14, ahtGeneral: 130, ahtPreferencial: 165 },
  { servicio: "Conexiones nuevas", parte: 0.12, ahtGeneral: 870, ahtPreferencial: 965 },
];

export function correoDe(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(" ");
  return `${limpio[0]}.${limpio[limpio.length - 1]}@surtigas.co`;
}
