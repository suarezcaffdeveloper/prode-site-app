import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";

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
    <section className="flex flex-col gap-3 lg:gap-5">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          REGLAS
        </p>
        <h2 className="font-display text-xl font-bold tracking-tight text-ink-900 lg:text-2xl">
          Cómo se juega
        </h2>
      </div>

      <Card className="flex flex-col gap-5 p-5 lg:grid lg:grid-cols-[3fr_1.1fr] lg:items-stretch lg:gap-10 lg:p-8">
        <ol className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-8">
          {PASOS.map((paso, indice) => (
            <li key={paso.titulo} className="relative">
              <Reveal
                soloEscritorio
                retraso={indice * 120}
                className="flex items-start gap-3 lg:flex-col lg:gap-4"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pitch-900 font-display text-sm font-bold text-lime-300 lg:h-12 lg:w-12 lg:text-lg"
                  aria-hidden="true"
                >
                  {indice + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900 lg:text-lg lg:font-bold">
                    {paso.titulo}
                  </p>
                  <p className="text-sm text-ink-600 lg:mt-1 lg:text-base lg:leading-relaxed">
                    {paso.texto}
                  </p>
                </div>
              </Reveal>
              {indice < PASOS.length - 1 && (
                <span
                  className="absolute left-16 top-6 -right-6 hidden border-t border-dashed border-line-strong lg:block"
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>

        <p className="rounded-lg bg-chalk-100 p-4 text-sm text-ink-600 lg:flex lg:flex-col lg:justify-center lg:gap-2 lg:rounded-2xl lg:p-6 lg:text-base lg:leading-relaxed">
          <span className="hidden font-display text-4xl font-bold leading-none text-pitch-700 lg:block">
            80%
          </span>
          <span>
            El <strong className="text-ink-900">80% de lo recaudado</strong> en cada fecha va al
            pozo. Si nadie acierta todos los marcadores, el pozo se acumula y se suma al de la
            fecha siguiente.
          </span>
        </p>
      </Card>
    </section>
  );
}
