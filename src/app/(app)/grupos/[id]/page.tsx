import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/usuario-actual";
import { obtenerGrupo } from "@/lib/grupo-actual";
import { Card } from "@/components/ui/card";
import {
  calcularDetalleJornada,
  calcularTablaGrupo,
  horaCierreJornada,
  type PartidoPuntuable,
  type PronosticoGrupo,
} from "@/lib/puntos-grupo";
import { RielSecciones } from "../../ligas/[id]/estadisticas/riel-secciones";
import { renombrarGrupo, echarMiembro, eliminarGrupo } from "./actions";
import { RenombrarForm, EliminarGrupoBoton } from "./gestion-creador";
import { GrupoHero } from "./grupo-hero";
import { TablaGrupo } from "./tabla-grupo";
import { JornadasGrupo, type EquiposPartido } from "./jornadas-grupo";
import { MiembrosGrupo, type MiembroConMembresia } from "./miembros-grupo";
import { ComoSePuntua } from "./como-se-puntua";
import { AvisoCarton } from "./aviso-carton";

type MiembroRow = {
  usuario_id: string;
  membresia_id: string;
  nombre: string | null;
  unido_en: string;
  es_creador: boolean;
  suscripcion_activa: boolean;
};

type PronosticoRow = {
  usuario_id: string;
  jornada: number;
  carton_id: string;
  partido_id: string;
  goles_local_prediccion: number;
  goles_visitante_prediccion: number;
};

type EquipoRef = { nombre: string; escudo_url: string | null };

type PartidoRow = {
  id: string;
  jornada: number;
  fecha_hora: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: "pendiente" | "finalizado";
  equipo_local: EquipoRef;
  equipo_visitante: EquipoRef;
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

export default async function GrupoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jornada?: string }>;
}) {
  const { id } = await params;
  const { jornada: jornadaParam } = await searchParams;
  const supabase = await createClient();

  // grupo (memoizado, compartido con el layout) y usuario son independientes.
  const [grupo, user] = await Promise.all([obtenerGrupo(id), getAuthUser()]);

  if (!grupo) notFound();

  const usuarioId = user!.id;
  const esCreador = usuarioId === grupo.creador_id;

  const [ligaRes, miembrosRes, pronosticosRes, partidosRes, activaRes] = await Promise.all([
    supabase.from("ligas").select("nombre").eq("id", grupo.liga_id).single(),
    supabase.rpc("miembros_grupo", { p_grupo_id: id }),
    supabase.rpc("pronosticos_grupo", { p_grupo_id: id }),
    supabase
      .from("partidos")
      .select(
        `id, jornada, fecha_hora, goles_local, goles_visitante, estado,
         equipo_local:equipo_local_id (nombre, escudo_url),
         equipo_visitante:equipo_visitante_id (nombre, escudo_url)`,
      )
      .eq("liga_id", grupo.liga_id)
      .order("jornada", { ascending: true })
      .returns<PartidoRow[]>(),
    supabase.rpc("jornada_activa", { p_liga_id: grupo.liga_id }),
  ]);

  // miembros_grupo devuelve "no_autorizado" a quien no es miembro del subgrupo.
  if (miembrosRes.error) notFound();
  if (pronosticosRes.error) {
    throw new Error(`No se pudieron cargar los pronósticos del subgrupo ${id}: ${pronosticosRes.error.message}`);
  }
  if (partidosRes.error) {
    throw new Error(`No se pudieron cargar los partidos de la liga ${grupo.liga_id}: ${partidosRes.error.message}`);
  }

  const ligaNombre = ligaRes.data?.nombre ?? "Liga";

  const miembros: MiembroConMembresia[] = ((miembrosRes.data ?? []) as MiembroRow[]).map((m) => ({
    usuarioId: m.usuario_id,
    membresiaId: m.membresia_id,
    nombre: m.nombre?.trim() || "Jugador",
    unidoEn: m.unido_en,
    esCreador: m.es_creador,
    activo: m.suscripcion_activa,
  }));

  const pronosticos: PronosticoGrupo[] = ((pronosticosRes.data ?? []) as PronosticoRow[]).map((p) => ({
    usuarioId: p.usuario_id,
    jornada: p.jornada,
    cartonId: p.carton_id,
    partidoId: p.partido_id,
    golesLocal: p.goles_local_prediccion,
    golesVisitante: p.goles_visitante_prediccion,
  }));

  const partidosRows = partidosRes.data ?? [];
  const partidos: PartidoPuntuable[] = partidosRows.map((p) => ({
    id: p.id,
    jornada: p.jornada,
    fechaHora: p.fecha_hora,
    finalizado: p.estado === "finalizado",
    golesLocal: p.goles_local,
    golesVisitante: p.goles_visitante,
  }));

  const equiposPorPartido: Record<string, EquiposPartido> = {};
  for (const p of partidosRows) {
    equiposPorPartido[p.id] = {
      local: { nombre: p.equipo_local.nombre, escudoUrl: p.equipo_local.escudo_url },
      visitante: { nombre: p.equipo_visitante.nombre, escudoUrl: p.equipo_visitante.escudo_url },
    };
  }

  const tabla = calcularTablaGrupo(miembros, pronosticos, partidos);
  const jornadasJugadas = new Set(
    partidos.filter((p) => p.finalizado).map((p) => p.jornada),
  ).size;
  const miFila = tabla.find((f) => f.usuarioId === usuarioId);
  const lider = tabla[0]?.pos === 1 && tabla[0].jornadasJugadas > 0 ? tabla[0] : null;

  // Solo las fechas ya cerradas se pueden ver: antes del cierre los prodes
  // ajenos son privados (pronosticos_grupo tampoco los devuelve).
  const ahora = Date.now();
  const partidosPorJornada = new Map<number, PartidoPuntuable[]>();
  for (const partido of partidos) {
    const lista = partidosPorJornada.get(partido.jornada) ?? [];
    lista.push(partido);
    partidosPorJornada.set(partido.jornada, lista);
  }
  const jornadasCerradas = [...partidosPorJornada.entries()]
    .filter(([, lista]) => {
      const cierre = horaCierreJornada(lista);
      return cierre !== null && cierre <= ahora;
    })
    .map(([jornada]) => jornada)
    .sort((a, b) => a - b);

  const jornadaParamNum = Number(jornadaParam);
  const jornadaSeleccionada = jornadasCerradas.includes(jornadaParamNum)
    ? jornadaParamNum
    : (jornadasCerradas.at(-1) ?? null);
  const detalle =
    jornadaSeleccionada !== null
      ? calcularDetalleJornada(jornadaSeleccionada, miembros, pronosticos, partidos, ahora)
      : null;

  // Fecha abierta: qué prode del usuario compite (RLS: solo ve los propios).
  const activa =
    (activaRes.data as { jornada: number; hora_cierre: string | null }[] | null)?.[0] ?? null;
  const fechaAbierta =
    activa && activa.hora_cierre && new Date(activa.hora_cierre).getTime() > ahora
      ? activa.jornada
      : null;
  const miMembresia = miembros.find((m) => m.usuarioId === usuarioId);
  let misCartones: { esPrincipal: boolean }[] = [];
  if (fechaAbierta !== null && miMembresia?.activo) {
    const { data } = await supabase
      .from("cartones")
      .select("es_principal")
      .eq("liga_id", grupo.liga_id)
      .eq("jornada", fechaAbierta)
      .eq("usuario_id", usuarioId)
      .order("created_at", { ascending: true });
    misCartones = (data ?? []).map((c) => ({ esPrincipal: c.es_principal }));
  }

  const hayResultados = jornadasJugadas > 0;

  return (
    <div className="mx-auto flex w-full flex-col gap-10 lg:gap-12">
      <GrupoHero
        ligaId={grupo.liga_id}
        ligaNombre={ligaNombre}
        nombre={grupo.nombre}
        codigo={grupo.codigo_invitacion}
        resumen={{
          totalMiembros: miembros.length,
          miPosicion: hayResultados ? (miFila?.pos ?? null) : null,
          miPuntos: miFila?.pts ?? 0,
          lider: lider ? { nombre: lider.nombre, pts: lider.pts } : null,
          jornadasJugadas,
        }}
      />

      <RielSecciones
        descripcion="Secciones del subgrupo"
        items={[
          { id: "tabla", etiqueta: "Tabla de posiciones" },
          { id: "jornadas", etiqueta: "Fecha por fecha" },
          { id: "miembros", etiqueta: "Miembros" },
          { id: "reglas", etiqueta: "Cómo se puntúa" },
        ]}
      />

      {fechaAbierta !== null && miMembresia?.activo && (
        <AvisoCarton
          ligaId={grupo.liga_id}
          jornada={fechaAbierta}
          cartones={misCartones}
        />
      )}

      <Seccion
        id="tabla"
        eyebrow="POSICIONES"
        titulo="Tabla de posiciones"
        descripcion={
          hayResultados
            ? `Según ${jornadasJugadas} ${jornadasJugadas === 1 ? "fecha con resultados" : "fechas con resultados"}. Cada miembro compite con un solo prode por fecha.`
            : "Se completa a medida que se cargan los resultados de cada fecha."
        }
      >
        <TablaGrupo filas={tabla} usuarioActualId={usuarioId} />
      </Seccion>

      <Seccion
        id="jornadas"
        eyebrow="FECHA POR FECHA"
        titulo="Los prodes de cada fecha"
        descripcion="Desde que cierra la fecha ves el prode de cada miembro contra el resultado real."
      >
        <JornadasGrupo
          grupoId={grupo.id}
          jornadas={jornadasCerradas}
          detalle={detalle}
          equipos={equiposPorPartido}
          usuarioActualId={usuarioId}
        />
      </Seccion>

      <Seccion
        id="miembros"
        eyebrow="EL GRUPO"
        titulo="Miembros"
        descripcion={`${miembros.length} ${miembros.length === 1 ? "miembro" : "miembros"} en el subgrupo.`}
      >
        <MiembrosGrupo
          miembros={miembros}
          usuarioActualId={usuarioId}
          esCreador={esCreador}
          echar={(membresiaId) => echarMiembro.bind(null, grupo.id, membresiaId)}
        />
      </Seccion>

      <Seccion id="reglas" eyebrow="REGLAS" titulo="Cómo se puntúa">
        <ComoSePuntua />
      </Seccion>

      {esCreador && (
        <Card className="flex flex-col gap-6 p-6">
          <div>
            <p className="mb-3 text-sm font-semibold text-ink-900">Renombrar subgrupo</p>
            <RenombrarForm
              nombreActual={grupo.nombre}
              action={renombrarGrupo.bind(null, grupo.id)}
            />
          </div>
          <div className="border-t border-line pt-6">
            <p className="mb-3 text-sm font-semibold text-coral-700">Zona de riesgo</p>
            <EliminarGrupoBoton action={eliminarGrupo.bind(null, grupo.id, grupo.liga_id)} />
          </div>
        </Card>
      )}
    </div>
  );
}
