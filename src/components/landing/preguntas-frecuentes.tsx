"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

const PREGUNTAS = [
  {
    pregunta: "¿Cómo se gana el pozo?",
    respuesta:
      "Acertando el marcador exacto de todos los partidos de la fecha con un mismo prode. No hay puntos por signo ni aciertos parciales.",
  },
  {
    pregunta: "¿De cuánto es el pozo?",
    respuesta:
      "El 80% de lo recaudado por los prodes de esa fecha, más el pozo acumulado de fechas anteriores si nadie acertó. El 20% restante es de la plataforma.",
  },
  {
    pregunta: "¿Qué pasa si nadie acierta todos los partidos?",
    respuesta:
      "El pozo completo pasa a la fecha siguiente de la misma liga y se suma a lo que se recaude ahí.",
  },
  {
    pregunta: "¿Y si hay más de un ganador?",
    respuesta:
      "El pozo se reparte en partes iguales entre todos los prodes ganadores. Si un mismo jugador tiene dos prodes ganadores, cobra dos partes.",
  },
  {
    pregunta: "¿Puedo jugar más de un prode por fecha?",
    respuesta:
      "Sí. Con los planes de más prodes podés armar distintas combinaciones en la misma fecha. Cada prode cuenta por separado.",
  },
  {
    pregunta: "¿Hasta cuándo puedo cargar o editar mi prode?",
    respuesta:
      "Hasta 30 minutos antes del primer partido de la fecha. Ves la cuenta regresiva en la pantalla de pronósticos.",
  },
  {
    pregunta: "¿Los prodes vencen?",
    respuesta:
      "Los prodes sueltos no vencen: los usás cuando quieras. Los de los planes mensuales se usan durante el ciclo del plan.",
  },
  {
    pregunta: "¿Cómo me entero si gané?",
    respuesta:
      "Te avisamos por email con tus prodes ganadores y el monto que te corresponde. También lo ves en la app.",
  },
  {
    pregunta: "¿Puedo jugar con mis amigos?",
    respuesta:
      "Sí. Podés crear un subgrupo dentro de la liga y compartir el código de invitación para que se sumen los tuyos.",
  },
];

export function PreguntasFrecuentes() {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {PREGUNTAS.map((item, i) => {
        const estaAbierta = abierta === i;
        return (
          <div
            key={item.pregunta}
            className={`overflow-hidden rounded-2xl border bg-chalk-0 transition-all duration-300 ${
              estaAbierta
                ? "border-pitch-500/60 shadow-[0_14px_40px_rgba(20,83,45,0.1)]"
                : "border-line hover:-translate-y-0.5 hover:border-pitch-500/40"
            }`}
          >
            <h3>
              <button
                type="button"
                onClick={() => setAbierta(estaAbierta ? null : i)}
                aria-expanded={estaAbierta}
                aria-controls={`respuesta-${i}`}
                id={`pregunta-${i}`}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="font-display text-base font-semibold tracking-tight text-ink-900 sm:text-lg">
                  {item.pregunta}
                </span>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                    estaAbierta ? "rotate-45 bg-lime-400 text-pitch-900" : "bg-chalk-100 text-ink-600"
                  }`}
                  aria-hidden="true"
                >
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            </h3>
            <div
              id={`respuesta-${i}`}
              role="region"
              aria-labelledby={`pregunta-${i}`}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                estaAbierta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-sm leading-relaxed text-ink-600 sm:text-base">
                  {item.respuesta}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
