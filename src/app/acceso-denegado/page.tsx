import { LockKeyhole } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { cerrarSesion } from "@/app/acciones/sesion";

export const metadata = { title: "Acceso restringido" };

export default async function AccesoDenegado() {
  const s = await auth();
  const nombre = s?.user?.name ?? "tu cuenta";
  const esColab = s?.user?.rol === "COLABORADOR";
  return (
    <div className="acceso" style={{ gridTemplateColumns: "1fr", placeItems: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
        <Image src="/logo-surtigas.svg" alt="Surtigas" width={100} height={45} style={{ margin: "0 auto 46px" }} />
        <span className="icono-circulo naranja" style={{ width: 68, height: 68, margin: "0 auto 22px" }}>
          <LockKeyhole />
        </span>
        <h1 className="titulo-pagina">Esta parte es solo para administración</h1>
        <p className="sub" style={{ marginTop: 10 }}>
          Entraste como <b style={{ color: "var(--ink)", fontWeight: 600 }}>{nombre}</b>{esColab ? ", colaborador" : ""}. Desde tu cuenta puedes ver tu semana y reportar ausencias.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 26 }}>
          <Link href="/" className="btn btn-primario">
            Ir a mi semana
          </Link>
          <form action={cerrarSesion}>
            <button className="btn btn-quieto">Cambiar de cuenta</button>
          </form>
        </div>
      </div>
    </div>
  );
}
