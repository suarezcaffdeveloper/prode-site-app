import { Reveal } from "./reveal";

export function EncabezadoSeccion({
  etiqueta,
  titulo,
  descripcion,
  invertido = false,
  centrado = true,
}: {
  etiqueta: string;
  titulo: React.ReactNode;
  descripcion?: string;
  invertido?: boolean;
  centrado?: boolean;
}) {
  return (
    <Reveal
      className={`mb-12 flex max-w-2xl flex-col gap-3 ${centrado ? "mx-auto items-center text-center" : ""}`}
    >
      <p
        className={`font-mono text-xs font-semibold tracking-[0.3em] ${
          invertido ? "text-lime-400" : "text-pitch-600"
        }`}
      >
        {etiqueta}
      </p>
      <h2
        className={`font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl ${
          invertido ? "text-chalk-0" : "text-ink-900"
        }`}
      >
        {titulo}
      </h2>
      {descripcion && (
        <p className={`text-base leading-relaxed ${invertido ? "text-chalk-100/70" : "text-ink-600"}`}>
          {descripcion}
        </p>
      )}
    </Reveal>
  );
}
