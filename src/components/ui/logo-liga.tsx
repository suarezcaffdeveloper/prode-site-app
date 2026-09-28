// Logo de una liga. Si todavía no se cargó ninguno, cae a un placeholder con
// la inicial del nombre, así el catálogo se ve parejo aunque haya ligas sin
// imagen. `className` define tamaño y radio; `fallbackClassName` el estilo del
// placeholder (que cambia según el fondo donde se use).

export function LogoLiga({
  url,
  nombre,
  className = "h-12 w-12 rounded-xl",
  fallbackClassName = "bg-pitch-900 text-xl text-lime-300",
}: {
  url?: string | null;
  nombre: string;
  className?: string;
  fallbackClassName?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa (Storage), sin dominio fijo para next/image.
      <img
        src={url}
        alt={`Logo de ${nombre}`}
        className={`shrink-0 border border-line bg-chalk-0 object-contain p-1 ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-display font-bold ${className} ${fallbackClassName}`}
      aria-hidden="true"
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}
