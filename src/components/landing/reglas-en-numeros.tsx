import { PLANES } from "@/lib/planes";
import { Contador } from "./contador";
import { Reveal } from "./reveal";

const precioMinimoPorProde = Math.round(
  Math.min(...PLANES.map((plan) => plan.precio / plan.cantidadCreditos)),
);

const DATOS = [
  {
    valor: <Contador hasta={80} sufijo="%" />,
    texto: "de lo recaudado en cada fecha va al pozo",
  },
  {
    valor: <Contador hasta={100} sufijo="%" />,
    texto: "del pozo pasa a la fecha siguiente si nadie acierta",
  },
  {
    valor: <Contador hasta={30} sufijo=" min" />,
    texto: "antes del primer partido cierra la carga de prodes",
  },
  {
    valor: <Contador hasta={precioMinimoPorProde} prefijo="$" />,
    texto: "por prode en el plan más conveniente",
  },
];

export function ReglasEnNumeros() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-6 py-14 lg:grid-cols-4">
      {DATOS.map((dato, i) => (
        <Reveal key={dato.texto} retraso={i * 90} className="group flex flex-col gap-2 text-center">
          <p className="font-display text-4xl font-bold tracking-tight text-pitch-700 transition-transform duration-300 group-hover:scale-110 sm:text-5xl">
            {dato.valor}
          </p>
          <p className="mx-auto max-w-[14rem] text-sm leading-snug text-ink-600">{dato.texto}</p>
        </Reveal>
      ))}
    </div>
  );
}
