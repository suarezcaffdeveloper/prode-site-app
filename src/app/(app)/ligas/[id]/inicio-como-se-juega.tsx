import { Card } from "@/components/ui/card";

const PASOS = [
  {
    titulo: "Elegí tu plan",
    texto: "Comprá un prode suelto o suscribite a un plan mensual con varios prodes.",
  },
  {
    titulo: "Cargá tus marcadores",
    texto: "Pronosticá el resultado exacto de cada partido antes del cierre de la fecha.",
  },
  {
    titulo: "Acertá todos y cobrá",
    texto: "Si clavás el marcador de todos los partidos de la fecha, te llevás el pozo.",
  },
];

export function InicioComoSeJuega() {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          REGLAS
        </p>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink-900">
          Cómo se juega
        </h2>
      </div>

      <Card className="flex flex-col gap-5 p-5">
        <ol className="flex flex-col gap-4">
          {PASOS.map((paso, indice) => (
            <li key={paso.titulo} className="flex items-start gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pitch-900 font-display text-sm font-bold text-lime-300"
                aria-hidden="true"
              >
                {indice + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">{paso.titulo}</p>
                <p className="text-sm text-ink-600">{paso.texto}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="rounded-lg bg-chalk-100 p-4 text-sm text-ink-600">
          El <strong className="text-ink-900">80% de lo recaudado</strong> en cada fecha va al
          pozo. Si nadie acierta todos los marcadores, el pozo se acumula y se suma al de la
          fecha siguiente.
        </p>
      </Card>
    </section>
  );
}
