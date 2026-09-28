import { BarChart3, Bell, Check, Target, Timer, Users } from "lucide-react";
import { EncabezadoSeccion } from "./encabezado-seccion";
import { Reveal } from "./reveal";
import { TarjetaFoco } from "./tarjeta-foco";

const FORMA: ("G" | "E" | "P")[][] = [
  ["G", "G", "E", "G", "P"],
  ["P", "E", "G", "G", "G"],
  ["E", "P", "P", "E", "G"],
];

const colorForma = {
  G: "bg-pitch-600 text-chalk-0",
  E: "bg-chalk-100 text-ink-600",
  P: "bg-coral-500 text-chalk-0",
};

function Icono({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pitch-900 text-lime-300 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-lime-400 group-hover:text-pitch-900">
      {children}
    </span>
  );
}

export function Beneficios() {
  return (
    <div>
      <EncabezadoSeccion
        etiqueta="POR QUÉ PRODE"
        titulo="Todo lo que necesitás para jugar la fecha"
        descripcion="Reglas simples, un pozo transparente y herramientas para que decidas mejor cada marcador."
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <TarjetaFoco className="h-full">
            <div className="flex h-full flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-sm flex-col gap-3">
                <Icono>
                  <Target className="h-6 w-6" aria-hidden="true" />
                </Icono>
                <h3 className="font-display text-2xl font-bold tracking-tight text-ink-900">
                  Marcador exacto, sin letra chica
                </h3>
                <p className="text-sm leading-relaxed text-ink-600">
                  No hay puntos por signo ni aciertos parciales: ganás cuando clavás el resultado de
                  todos los partidos de la fecha. Así de simple, así de emocionante.
                </p>
              </div>
              <div
                className="relative flex shrink-0 items-center justify-center self-center"
                aria-hidden="true"
              >
                <span className="absolute h-32 w-32 animate-pulse-ring rounded-full bg-lime-400/30" />
                <span className="relative flex items-center gap-2 rounded-2xl bg-pitch-900 px-6 py-4 font-display text-4xl font-bold text-lime-300 transition-transform duration-300 group-hover:scale-110">
                  2<span className="text-chalk-100/40">-</span>1
                  <span className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-lime-400 text-pitch-900 shadow-lg">
                    <Check className="h-4 w-4" />
                  </span>
                </span>
              </div>
            </div>
          </TarjetaFoco>
        </Reveal>

        <Reveal retraso={100}>
          <TarjetaFoco className="h-full">
            <div className="flex h-full flex-col gap-3 p-7">
              <Icono>
                <Bell className="h-6 w-6 origin-top animate-bell" aria-hidden="true" />
              </Icono>
              <h3 className="font-display text-xl font-bold tracking-tight text-ink-900">
                Te avisamos por email
              </h3>
              <p className="text-sm leading-relaxed text-ink-600">
                Si ganás una fecha, te llega un email con tus prodes ganadores y el monto que te
                corresponde.
              </p>
            </div>
          </TarjetaFoco>
        </Reveal>

        <Reveal retraso={50}>
          <TarjetaFoco className="h-full">
            <div className="flex h-full flex-col gap-3 p-7">
              <Icono>
                <Users className="h-6 w-6" aria-hidden="true" />
              </Icono>
              <h3 className="font-display text-xl font-bold tracking-tight text-ink-900">
                Subgrupos privados
              </h3>
              <p className="text-sm leading-relaxed text-ink-600">
                Creá tu grupo, compartí el código y compará resultados con tus amigos.
              </p>
              <div className="mt-auto flex gap-1.5 pt-2" aria-hidden="true">
                {"K7F2QM".split("").map((letra, i) => (
                  <span
                    key={i}
                    className="flex h-10 w-9 items-center justify-center rounded-lg bg-pitch-900 font-mono text-base font-semibold text-lime-300 transition-transform duration-300 group-hover:-translate-y-1.5"
                    style={{ transitionDelay: `${i * 45}ms` }}
                  >
                    {letra}
                  </span>
                ))}
              </div>
            </div>
          </TarjetaFoco>
        </Reveal>

        <Reveal retraso={150} className="lg:col-span-2">
          <TarjetaFoco className="h-full">
            <div className="flex h-full flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-sm flex-col gap-3">
                <Icono>
                  <BarChart3 className="h-6 w-6" aria-hidden="true" />
                </Icono>
                <h3 className="font-display text-2xl font-bold tracking-tight text-ink-900">
                  Estadísticas para decidir mejor
                </h3>
                <p className="text-sm leading-relaxed text-ink-600">
                  Tabla de posiciones, rachas, forma reciente y tendencias de cada equipo para
                  armar tu pronóstico con datos.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2.5" aria-hidden="true">
                {FORMA.map((fila, i) => (
                  <div key={i} className="flex gap-1.5">
                    {fila.map((resultado, j) => (
                      <span
                        key={j}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold transition-transform duration-300 group-hover:-translate-y-1 ${colorForma[resultado]}`}
                        style={{ transitionDelay: `${(i * 5 + j) * 25}ms` }}
                      >
                        {resultado}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </TarjetaFoco>
        </Reveal>

        <Reveal retraso={100} className="md:col-span-2 lg:col-span-3">
          <TarjetaFoco className="h-full">
            <div className="flex h-full flex-col gap-6 p-7 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-lg flex-col gap-3">
                <Icono>
                  <Timer className="h-6 w-6" aria-hidden="true" />
                </Icono>
                <h3 className="font-display text-2xl font-bold tracking-tight text-ink-900">
                  Cierre claro para todos
                </h3>
                <p className="text-sm leading-relaxed text-ink-600">
                  La carga cierra 30 minutos antes del primer partido de la fecha. Ves la cuenta
                  regresiva mientras cargás, y hasta ese momento podés editar tu prode.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3" aria-hidden="true">
                {[
                  { valor: "02", unidad: "HS" },
                  { valor: "14", unidad: "MIN" },
                  { valor: "35", unidad: "SEG" },
                ].map((bloque, i) => (
                  <div
                    key={bloque.unidad}
                    className="relative flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-pitch-900 transition-transform duration-300 group-hover:-translate-y-1.5"
                    style={{ transitionDelay: `${i * 60}ms` }}
                  >
                    <span className="font-display text-3xl font-bold tabular-nums text-lime-300">
                      {bloque.valor}
                    </span>
                    <span className="font-mono text-[10px] font-semibold tracking-widest text-chalk-100/60">
                      {bloque.unidad}
                    </span>
                    {i === 2 && (
                      <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-lime-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TarjetaFoco>
        </Reveal>
      </div>
    </div>
  );
}
