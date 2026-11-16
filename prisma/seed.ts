// Datos de demostración del prototipo. Uso: npm run db:seed  (borra y vuelve a crear los datos)

import { db } from "../src/lib/db";
import { sembrarDemo } from "../src/lib/datos/sembrar";

sembrarDemo((m) => console.log(m))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
