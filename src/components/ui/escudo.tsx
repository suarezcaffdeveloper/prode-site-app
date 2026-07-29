// Escudo de un equipo. Si todavía no se cargó ninguno, cae a un placeholder
// con la inicial del nombre para no romper el render de listados y fixture
// (ver Risks de la spec 02).

export function Escudo({
  url,
  nombre,
  className = "h-10 w-10",
}: {
  url?: string | null;
  nombre: string;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa (Storage), sin dominio fijo para next/image.
      <img
        src={url}
        alt={nombre}
        className={`shrink-0 rounded-full border border-line object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-pitch-900 font-display font-bold text-lime-300 ${className}`}
      aria-hidden="true"
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}
