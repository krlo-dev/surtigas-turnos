// Plantillas de correo. Estilo sobrio coherente con la app: hoja blanca, Poppins/Arial, azul Surtigas.

import { DIAS_CORTOS, diaSemana, fmtDiaMes, fmtRangoFechas, fmtRangoHoras, partes, MESES_LARGOS } from "../fechas";

const URL_APP = () => (process.env.APP_URL || process.env.AUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function marco(contenido: string, boton?: { texto: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#E9ECEF;padding:28px 12px;font-family:Poppins,Arial,Helvetica,sans-serif;color:#16202B">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;width:100%;background:#FFFFFF;border-radius:20px;padding:28px">
<tr><td><img src="${URL_APP()}/logo-surtigas.png" width="110" alt="Surtigas" style="display:block;margin-bottom:22px"/></td></tr>
<tr><td style="font-size:14px;line-height:1.6">${contenido}</td></tr>
${boton ? `<tr><td style="padding-top:20px"><a href="${boton.url}" style="display:inline-block;background:#3981C0;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:13px;padding:11px 18px;border-radius:12px">${esc(boton.texto)}</a></td></tr>` : ""}
<tr><td style="padding-top:26px;font-size:11px;color:#687180">Surtigas Turnos · prototipo con datos simulados</td></tr>
</table></td></tr></table></body></html>`;
}

const saludo = (nombre: string) => `<h1 style="font-size:20px;margin:0 0 6px;font-weight:600">Hola, ${esc(nombre.split(" ")[0])}</h1>`;

export interface DiaHorario {
  fecha: string;
  turnos: { inicio: number; fin: number; oficina: string }[];
  ausencia?: string;
}

export function correoHorarioSemanal(nombre: string, semana: number, lunes: string, oficina: string, dias: DiaHorario[]) {
  const domingo = dias[dias.length - 1]?.fecha ?? lunes;
  const filas = dias
    .filter((d) => d.turnos.length || d.ausencia)
    .map((d) => {
      const { dia } = partes(d.fecha);
      const valor = d.ausencia ? `<span style="color:#9C5214">${esc(d.ausencia)}</span>` : d.turnos.map((t) => `${fmtRangoHoras(t.inicio, t.fin)}${t.oficina !== oficina ? ` · ${esc(t.oficina)}` : ""}`).join("<br>");
      return `<tr><td style="padding:9px 0;border-top:1px solid #ECEEF2;font-weight:600;width:90px">${DIAS_CORTOS[diaSemana(d.fecha)]} ${dia}</td><td style="padding:9px 0;border-top:1px solid #ECEEF2">${valor}</td></tr>`;
    })
    .join("");
  const { mes, dia } = partes(lunes);
  const fin = partes(domingo);
  const rango = mes === fin.mes ? `del ${dia} al ${fin.dia} de ${MESES_LARGOS[mes]}` : `del ${dia} de ${MESES_LARGOS[mes]} al ${fin.dia} de ${MESES_LARGOS[fin.mes]}`;
  const html = marco(
    `${saludo(nombre)}<p style="margin:0 0 16px;color:#4B5563">Esta es tu semana ${rango} en ${esc(oficina)}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px">${filas || `<tr><td style="color:#687180">No tienes turnos asignados esta semana.</td></tr>`}</table>
<p style="margin:18px 0 0;font-size:12px;color:#687180">Si no puedes ir algún día, repórtalo en la plataforma para que tu administradora lo sepa al instante.</p>`,
    { texto: "Ver mi semana", url: `${URL_APP()}/colaborador` },
  );
  const texto = `Hola, ${nombre}. Tu horario de la semana ${semana} en ${oficina}:\n` +
    dias.filter((d) => d.turnos.length || d.ausencia).map((d) => `${DIAS_CORTOS[diaSemana(d.fecha)]} ${fmtDiaMes(d.fecha)}: ${d.ausencia ?? d.turnos.map((t) => fmtRangoHoras(t.inicio, t.fin)).join(", ")}`).join("\n");
  return { asunto: `Tu horario · semana ${semana}`, html, texto };
}

const TIPO_TEXTO = { EXCUSA: "una excusa", PERMISO: "un permiso", INCAPACIDAD: "una incapacidad" } as const;
const TIPO_NOMBRE = { EXCUSA: "excusa", PERMISO: "permiso", INCAPACIDAD: "incapacidad" } as const;

export function correoNuevaExcusa(admin: string, colaborador: string, oficina: string, tipo: keyof typeof TIPO_TEXTO, codigo: string, desde: string, hasta: string, motivo: string, turnos: number) {
  const html = marco(
    `${saludo(admin)}<p style="margin:0 0 14px;color:#4B5563"><b style="color:#16202B">${esc(colaborador)}</b> (${esc(oficina)}) reportó ${TIPO_TEXTO[tipo]} para el ${esc(fmtRangoFechas(desde, hasta))}. Libera ${turnos} ${turnos === 1 ? "turno" : "turnos"}.</p>
<div style="background:#E6F0FA;border-radius:4px 16px 16px 16px;padding:12px 14px;font-size:13px;color:#16202B">${esc(motivo)}</div>
<p style="margin:14px 0 0;font-size:12px;color:#687180">Solicitud ${codigo}. Al aprobarla, el motor te propone quién cubre.</p>`,
    { texto: "Revisar solicitud", url: `${URL_APP()}/admin/ausencias/${codigo}` },
  );
  return { asunto: `${colaborador} reportó ${TIPO_TEXTO[tipo]}`, html, texto: `${colaborador} reportó ${TIPO_TEXTO[tipo]} (${codigo}) para ${fmtRangoFechas(desde, hasta)}. Motivo: ${motivo}` };
}

export function correoResolucion(colaborador: string, tipo: keyof typeof TIPO_TEXTO, codigo: string, desde: string, hasta: string, aprobada: boolean, comentario: string | null, admin: string) {
  const estado = aprobada ? "fue aprobado" : "no fue aprobado";
  const html = marco(
    `${saludo(colaborador)}<p style="margin:0 0 14px;color:#4B5563">Tu ${TIPO_NOMBRE[tipo]} del ${esc(fmtRangoFechas(desde, hasta))} <b style="color:${aprobada ? "#5A6E1C" : "#B02E47"}">${aprobada ? "fue aprobada" : "fue rechazada"}</b>.</p>
${comentario ? `<div style="background:#E6F0FA;border-radius:4px 16px 16px 16px;padding:12px 14px;font-size:13px"><span style="font-size:11px;color:#687180">Comentario de ${esc(admin)}</span><br>${esc(comentario)}</div>` : ""}
<p style="margin:14px 0 0;font-size:12px;color:#687180">Solicitud ${codigo}.</p>`,
    { texto: "Ver mis solicitudes", url: `${URL_APP()}/colaborador/solicitudes` },
  );
  const asunto = `Tu ${TIPO_NOMBRE[tipo]} del ${fmtRangoFechas(desde, hasta)} ${aprobada ? "fue aprobad" + (tipo === "PERMISO" ? "o" : "a") : "no fue aprobad" + (tipo === "PERMISO" ? "o" : "a")}`;
  void estado;
  return { asunto, html, texto: `${asunto}.${comentario ? ` Comentario: ${comentario}` : ""}` };
}

export function correoCobertura(nombre: string, fecha: string, inicio: number, fin: number, oficina: string, cubreA: string, modalidad: string) {
  const dia = `${DIAS_CORTOS[diaSemana(fecha)]} ${fmtDiaMes(fecha)}`;
  const html = marco(
    `${saludo(nombre)}<p style="margin:0 0 14px;color:#4B5563">Te asignamos un turno para cubrir a ${esc(cubreA)}:</p>
<table role="presentation" style="font-size:13px"><tr><td style="font-weight:600;padding-right:16px">${dia}</td><td>${fmtRangoHoras(inicio, fin)} · ${esc(oficina)}${modalidad === "VIRTUAL" ? " · atención virtual" : ""}</td></tr></table>`,
    { texto: "Ver mi semana", url: `${URL_APP()}/colaborador` },
  );
  return { asunto: `Nuevo turno el ${dia}`, html, texto: `Te asignamos un turno el ${dia}, ${fmtRangoHoras(inicio, fin)} en ${oficina} para cubrir a ${cubreA}.` };
}

export function correoRecuperar(nombre: string, enlace: string) {
  const html = marco(
    `${saludo(nombre)}<p style="margin:0;color:#4B5563">Recibimos una solicitud para cambiar tu contraseña. El enlace vence en 30 minutos. Si no fuiste tú, ignora este correo.</p>`,
    { texto: "Crear contraseña nueva", url: enlace },
  );
  return { asunto: "Recupera tu acceso a Surtigas Turnos", html, texto: `Crea tu contraseña nueva aquí (vence en 30 minutos): ${enlace}` };
}

export function correoInvitacion(nombre: string, correo: string, enlace: string) {
  const html = marco(
    `${saludo(nombre)}<p style="margin:0;color:#4B5563">Ya tienes acceso a Surtigas Turnos con <b>${esc(correo)}</b>. Crea tu contraseña para ver tu semana y reportar ausencias.</p>`,
    { texto: "Crear mi contraseña", url: enlace },
  );
  return { asunto: "Tu acceso a Surtigas Turnos", html, texto: `Crea tu contraseña aquí: ${enlace}` };
}

export { URL_APP };
