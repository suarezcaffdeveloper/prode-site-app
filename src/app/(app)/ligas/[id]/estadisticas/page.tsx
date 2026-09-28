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

type EquipoRow = { id: string; nombre: string; escudo_url: string | null };

type PartidoRow = {
  jornada: number;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number | null;
  goles_visitante: number | null;
};

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-mono text-[13px] font-bold tracking-[0.25em] text-pitch-600">
          {titulo.toUpperCase()}
        </h2>
        {descripcion && <p className="mt-1 text-xs text-ink-400">{descripcion}</p>}
      </div>
      {children}
    </section>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono text-[11px] font-semibold tracking-[0.25em] text-ink-400">
        {titulo.toUpperCase()}
      </h3>
      {children}
    </div>
  );
}

const grillaTarjetas = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

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

  return (
    <div className="mx-auto flex w-full flex-col gap-10">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.3em] text-pitch-600">
          {liga.nombre.toUpperCase()}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Estadísticas
        </h1>
      </div>

      <Seccion
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
          <TablaPosiciones filas={tabla} />
        )}
      </Seccion>

      <Seccion
        titulo="Estadísticas"
        descripcion="Datos de rendimiento de los equipos para ayudarte a armar tus prodes."
      >
        {!hayResultados ? (
          <Card className="p-8 text-center text-sm text-ink-600">
            Las estadísticas aparecen cuando se cargue el primer resultado.
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            <Bloque titulo="Ataque y defensa">
              <div className={grillaTarjetas}>
                <EstadisticaCard
                  titulo="Equipo que más convierte"
                  subtitulo="Promedio de goles a favor"
                  ranking={stats.ataqueDefensa.masConvierte}
                  formatoValor={formatos.promedio}
                />
                <EstadisticaCard
                  titulo="Menos goles recibidos"
                  subtitulo="Promedio de goles en contra"
                  ranking={stats.ataqueDefensa.menosRecibidos}
                  formatoValor={formatos.promedio}
                />
                <EstadisticaCard
                  titulo="Vallas invictas"
                  subtitulo="Partidos sin recibir goles"
                  ranking={stats.ataqueDefensa.vallasInvictas}
                />
                <EstadisticaCard
                  titulo="Partidos sin convertir"
                  subtitulo="Partidos sin marcar goles"
                  ranking={stats.ataqueDefensa.sinConvertir}
                />
              </div>
            </Bloque>

            <Bloque titulo="Rachas">
              <div className={grillaTarjetas}>
                <EstadisticaCard
                  titulo="Racha ganadora"
                  subtitulo="Victorias consecutivas actuales"
                  ranking={stats.rachas.ganadora.ranking}
                  formatoValor={formatos.racha}
                  record={stats.rachas.ganadora.record}
                />
                <EstadisticaCard
                  titulo="Racha invicta"
                  subtitulo="Partidos seguidos sin perder"
                  ranking={stats.rachas.invicta.ranking}
                  formatoValor={formatos.racha}
                  record={stats.rachas.invicta.record}
                />
                <EstadisticaCard
                  titulo="Racha sin ganar"
                  subtitulo="Partidos seguidos sin ganar"
                  ranking={stats.rachas.sinGanar.ranking}
                  formatoValor={formatos.racha}
                  record={stats.rachas.sinGanar.record}
                />
                <EstadisticaCard
                  titulo="Racha de derrotas"
                  subtitulo="Derrotas consecutivas actuales"
                  ranking={stats.rachas.derrotas.ranking}
                  formatoValor={formatos.racha}
                  record={stats.rachas.derrotas.record}
                />
              </div>
            </Bloque>

            <Bloque titulo="Local vs visitante">
              <div className={grillaTarjetas}>
                <EstadisticaCard
                  titulo="Mejor local"
                  subtitulo="Aprovechamiento de puntos de local"
                  ranking={stats.localVisitante.mejorLocal}
                  formatoValor={formatos.porcentaje}
                />
                <EstadisticaCard
                  titulo="Mejor visitante"
                  subtitulo="Aprovechamiento de puntos de visitante"
                  ranking={stats.localVisitante.mejorVisitante}
                  formatoValor={formatos.porcentaje}
                />
                <EstadisticaCard
                  titulo="Mayor diferencia local y visitante"
                  subtitulo="Equipos que rinden distinto según la cancha"
                  ranking={stats.localVisitante.diferencia}
                  formatoValor={formatos.puntosPorcentuales}
                />
              </div>
            </Bloque>

            <Bloque titulo="Tendencias para el prode">
              <div className={grillaTarjetas}>
                <EstadisticaCard
                  titulo="Equipo que más empata"
                  subtitulo="Partidos empatados"
                  ranking={stats.tendencias.masEmpata}
                  formatoValor={formatos.partidos}
                />
                <EstadisticaCard
                  titulo="Partidos con 3 o más goles"
                  subtitulo="Goles totales del partido"
                  ranking={stats.tendencias.masGoles}
                  formatoValor={formatos.partidos}
                />
                <EstadisticaCard
                  titulo="Ambos equipos convierten"
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
