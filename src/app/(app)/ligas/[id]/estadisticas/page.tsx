import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import {
  calcularEstadisticas,
  calcularTablaPosiciones,
  type EquipoRef,
  type PartidoFinalizado,
} from "@/lib/estadisticas";
import { TablaPosiciones } from "./tabla-posiciones";
import { EstadisticaCard, formatos } from "./estadistica-card";
import { FormaReciente } from "./forma-reciente";
import { EstadisticasHero } from "./estadisticas-hero";
import { RielSecciones } from "./riel-secciones";

type EquipoRow = { id: string; nombre: string; escudo_url: string | null };

type PartidoRow = {
  jornada: number;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number | null;
  goles_visitante: number | null;
};

function Seccion({
  id,
  eyebrow,
  titulo,
  descripcion,
  children,
}: {
  id: string;
  eyebrow: string;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-40 flex-col gap-4 lg:gap-6">
      <div>
        <h2 className="font-mono text-[13px] font-bold tracking-[0.25em] text-pitch-600 lg:hidden">
          {titulo.toUpperCase()}
        </h2>
        <div className="hidden lg:block">
          <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
            {eyebrow}
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">{titulo}</h2>
        </div>
        {descripcion && <p className="mt-1 text-xs text-ink-400 lg:text-sm">{descripcion}</p>}
      </div>
      {children}
    </section>
  );
}

function Bloque({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="flex scroll-mt-40 flex-col gap-3 lg:gap-5">
      <div className="flex items-center gap-4">
        <h3 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-ink-400 lg:text-xs lg:text-pitch-700">
          {titulo.toUpperCase()}
        </h3>
        <div className="hidden h-px flex-1 bg-line-strong lg:block" />
      </div>
      {children}
    </div>
  );
}

const grillaTarjetas = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6";
// Bloques de 4 tarjetas: 2 columnas en escritorio para no dejar una tarjeta sola en la segunda fila.
const grillaCuatro = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6";

export default async function EstadisticasLigaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: liga, error: ligaError } = await supabase
    .from("ligas")
    .select("id, nombre, activa")
    .eq("id", id)
    .single();

  if (ligaError) throw new Error(`No se pudo cargar la liga ${id}: ${ligaError.message}`);
  if (!liga || !liga.activa) notFound();

  const [equiposRes, partidosRes] = await Promise.all([
    supabase
      .from("equipos")
      .select("id, nombre, escudo_url")
      .eq("liga_id", id)
      .returns<EquipoRow[]>(),
    supabase
      .from("partidos")
      .select("jornada, equipo_local_id, equipo_visitante_id, goles_local, goles_visitante")
      .eq("liga_id", id)
      .eq("estado", "finalizado")
      .returns<PartidoRow[]>(),
  ]);

  if (equiposRes.error) {
    throw new Error(`No se pudieron cargar los equipos de la liga ${id}: ${equiposRes.error.message}`);
  }
  if (partidosRes.error) {
    throw new Error(`No se pudieron cargar los partidos de la liga ${id}: ${partidosRes.error.message}`);
  }

  const equipos: EquipoRef[] = (equiposRes.data ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    escudoUrl: e.escudo_url,
  }));

  const partidos: PartidoFinalizado[] = (partidosRes.data ?? []).flatMap((p) =>
    p.goles_local === null || p.goles_visitante === null
      ? []
      : [
          {
            jornada: p.jornada,
            equipoLocalId: p.equipo_local_id,
            equipoVisitanteId: p.equipo_visitante_id,
            golesLocal: p.goles_local,
            golesVisitante: p.goles_visitante,
          },
        ],
  );

  const tabla = calcularTablaPosiciones(equipos, partidos);
  const stats = calcularEstadisticas(equipos, partidos);
  const hayResultados = stats.partidosFinalizados > 0;
  const resumen = hayResultados
    ? {
        lider: tabla[0] ?? null,
        partidosJugados: stats.partidosFinalizados,
        jornadasJugadas: stats.jornadasConResultados,
        goles: partidos.reduce((total, p) => total + p.golesLocal + p.golesVisitante, 0),
      }
    : null;

  return (
    <div className="mx-auto flex w-full flex-col gap-10 lg:gap-12">
      <EstadisticasHero ligaNombre={liga.nombre} resumen={resumen} />

      {hayResultados && (
        <RielSecciones
          items={[
            { id: "tabla", etiqueta: "Tabla de posiciones" },
            { id: "ataque-defensa", etiqueta: "Ataque y defensa" },
            { id: "rachas", etiqueta: "Rachas" },
            { id: "local-visitante", etiqueta: "Local vs visitante" },
            { id: "tendencias", etiqueta: "Tendencias" },
          ]}
        />
      )}

      <div className="lg:hidden">
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Estadísticas
        </h1>
      </div>

      <Seccion
        id="tabla"
        eyebrow="POSICIONES"
        titulo="Tabla de posiciones"
        descripcion={
          hayResultados
            ? `Según ${stats.partidosFinalizados} ${stats.partidosFinalizados === 1 ? "partido finalizado" : "partidos finalizados"} en ${stats.jornadasConResultados} ${stats.jornadasConResultados === 1 ? "jornada" : "jornadas"}.`
            : "Se completa a medida que se cargan los resultados de cada jornada."
        }
      >
        {tabla.length === 0 ? (
          <Card className="p-8 text-center text-sm text-ink-600">
            Todavía no hay equipos cargados para esta liga.
          </Card>
        ) : (
          <TablaPosiciones filas={tabla} forma={stats.tendencias.forma} />
        )}
      </Seccion>

      <Seccion
        id="estadisticas"
        eyebrow="RENDIMIENTO"
        titulo="Estadísticas"
        descripcion="Datos de rendimiento de los equipos para ayudarte a armar tus prodes."
      >
        {!hayResultados ? (
          <Card className="p-8 text-center text-sm text-ink-600">
            Las estadísticas aparecen cuando se cargue el primer resultado.
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            <Bloque id="ataque-defensa" titulo="Ataque y defensa">
              <div className={grillaCuatro}>
                <EstadisticaCard
                  titulo="Equipo que más convierte"
                  retraso={0}
                  subtitulo="Promedio de goles a favor"
                  ranking={stats.ataqueDefensa.masConvierte}
                  formatoValor={formatos.promedio}
                />
                <EstadisticaCard
                  titulo="Menos goles recibidos"
                  retraso={80}
                  subtitulo="Promedio de goles en contra"
                  ranking={stats.ataqueDefensa.menosRecibidos}
                  formatoValor={formatos.promedio}
                />
                <EstadisticaCard
                  titulo="Vallas invictas"
                  retraso={0}
                  subtitulo="Partidos sin recibir goles"
                  ranking={stats.ataqueDefensa.vallasInvictas}
                />
                <EstadisticaCard
                  titulo="Partidos sin convertir"
                  retraso={80}
                  subtitulo="Partidos sin marcar goles"
                  ranking={stats.ataqueDefensa.sinConvertir}
                />
              </div>
            </Bloque>

            <Bloque id="rachas" titulo="Rachas">
              <div className={grillaCuatro}>
                <EstadisticaCard
                  titulo="Racha ganadora"
                  retraso={0}
                  subtitulo="Victorias consecutivas actuales"
                  ranking={stats.rachas.ganadora.ranking}
                  formatoValor={formatos.racha}
                  record={stats.rachas.ganadora.record}
                />
                <EstadisticaCard
                  titulo="Racha invicta"
                  retraso={80}
                  subtitulo="Partidos seguidos sin perder"
                  ranking={stats.rachas.invicta.ranking}
                  formatoValor={formatos.racha}
                  record={stats.rachas.invicta.record}
                />
                <EstadisticaCard
                  titulo="Racha sin ganar"
                  retraso={0}
                  subtitulo="Partidos seguidos sin ganar"
                  ranking={stats.rachas.sinGanar.ranking}
                  formatoValor={formatos.racha}
                  record={stats.rachas.sinGanar.record}
                />
                <EstadisticaCard
                  titulo="Racha de derrotas"
                  retraso={80}
                  subtitulo="Derrotas consecutivas actuales"
                  ranking={stats.rachas.derrotas.ranking}
                  formatoValor={formatos.racha}
                  record={stats.rachas.derrotas.record}
                />
              </div>
            </Bloque>

            <Bloque id="local-visitante" titulo="Local vs visitante">
              <div className={grillaTarjetas}>
                <EstadisticaCard
                  titulo="Mejor local"
                  retraso={0}
                  subtitulo="Aprovechamiento de puntos de local"
                  ranking={stats.localVisitante.mejorLocal}
                  formatoValor={formatos.porcentaje}
                />
                <EstadisticaCard
                  titulo="Mejor visitante"
                  retraso={80}
                  subtitulo="Aprovechamiento de puntos de visitante"
                  ranking={stats.localVisitante.mejorVisitante}
                  formatoValor={formatos.porcentaje}
                />
                <EstadisticaCard
                  titulo="Mayor diferencia local y visitante"
                  retraso={160}
                  subtitulo="Equipos que rinden distinto según la cancha"
                  ranking={stats.localVisitante.diferencia}
                  formatoValor={formatos.puntosPorcentuales}
                />
              </div>
            </Bloque>

            <Bloque id="tendencias" titulo="Tendencias para el prode">
              <div className={grillaTarjetas}>
                <EstadisticaCard
                  titulo="Equipo que más empata"
                  retraso={0}
                  subtitulo="Partidos empatados"
                  ranking={stats.tendencias.masEmpata}
                  formatoValor={formatos.partidos}
                />
                <EstadisticaCard
                  titulo="Partidos con 3 o más goles"
                  retraso={80}
                  subtitulo="Goles totales del partido"
                  ranking={stats.tendencias.masGoles}
                  formatoValor={formatos.partidos}
                />
                <EstadisticaCard
                  titulo="Ambos equipos convierten"
                  retraso={160}
                  subtitulo="Partidos donde los dos marcaron"
                  ranking={stats.tendencias.ambosConvierten}
                  formatoValor={formatos.partidos}
                />
              </div>
              <FormaReciente forma={stats.tendencias.forma} />
            </Bloque>
          </div>
        )}
      </Seccion>
    </div>
  );
}
