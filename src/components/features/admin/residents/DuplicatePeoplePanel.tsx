"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase/client";
import { dismissDuplicatePeopleGroupCallable, mergePeopleCallable } from "@/lib/firebase/callables";
import {
  cuentasDistintas,
  detectarDuplicados,
  ETIQUETA_DE_REGLA,
  type GrupoDeDuplicados,
} from "@/features/residents/duplicados";
import { contarReferencias } from "@/features/residents/referencias-a-persona";
import type { PersonItem, UnitItem } from "@/features/admin/services";

/**
 * `PRD-V-FEAT-005` — revisar duplicados del padrón.
 *
 * **El paso que no se puede saltar es la vista previa.** El administrador tiene que ver, antes de
 * confirmar, qué se repunta y qué se pierde, porque lo que se pierde no se recupera solo. La
 * fusión la decide siempre una persona: no hay «fusionar todo» y no lo habrá — un padrón mal
 * fusionado es peor que uno duplicado, porque **el duplicado se ve y la fusión mala no**.
 */

/**
 * Concordancia de número. **Existe porque la pantalla decía «las 1 referencias»**, visto en
 * producción — y dos líneas más arriba, «listado en 1 unidad(es)». El paréntesis es el atajo con
 * el que se escriben los plurales cuando nadie mira el caso de uno, y aquí el caso de uno es el
 * más frecuente: la mayoría de los registros duplicados cuelga de una sola cosa.
 */
function plural(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

type Props = {
  tenantId?: string;
  people: PersonItem[];
  units: UnitItem[];
};

type Descarte = { claveDelGrupo: string };

export function DuplicatePeoplePanel({ tenantId, people, units }: Props) {
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState<string | null>(null);
  const [survivorPorGrupo, setSurvivorPorGrupo] = useState<Record<string, string>>({});
  const [motivoPorGrupo, setMotivoPorGrupo] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Los descartes vivos. **Se guardan contra la huella de los ids**, así que si mañana entra un
  // cuarto homónimo la huella cambia y el grupo vuelve a salir solo (`CA7`).
  useEffect(() => {
    if (!tenantId || !db) return;
    return onSnapshot(
      query(collection(db, "personMergeDecisions"), where("tenantId", "==", tenantId), where("tipo", "==", "descarte")),
      (snap) => setDescartadas(new Set(snap.docs.map((d) => (d.data() as Descarte).claveDelGrupo))),
      () => setDescartadas(new Set()),
    );
  }, [tenantId]);

  // **Los paquetes, porque `CA4` pide un NÚMERO antes de confirmar.** Se leen aquí y no se
  // deducen: `packages` es la colección con más referencias a persona del producto —y con los dos
  // campos que ningún nombre delata—, así que sin ella la vista previa contaría de menos.
  const [paquetes, setPaquetes] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    if (!tenantId || !db) return;
    return onSnapshot(
      query(collection(db, "packages"), where("tenantId", "==", tenantId)),
      (snap) => setPaquetes(snap.docs.map((d) => d.data())),
      () => setPaquetes([]),
    );
  }, [tenantId]);

  const grupos = useMemo(
    () => detectarDuplicados(people).filter((g) => !descartadas.has(g.clave)),
    [people, descartadas],
  );

  const porId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const unidadPorId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  /**
   * Lo que cuelga de cada registro (`CA3`).
   *
   * **Las unidades entran por sus ARRAYS, y esa es la trampa que ya mordió una vez**: buscar
   * campos escalares dijo que ninguno de los siete «David Carmona» estaba referenciado, y dos lo
   * estaban desde `units.ownerIds`.
   */
  const referenciasDe = (personaId: string) => {
    const enUnidades = units.filter(
      (u) => (u.ownerIds ?? []).includes(personaId) || (u.residentIds ?? []).includes(personaId),
    );
    const enPaquetes = contarReferencias(paquetes, "packages", personaId);
    const persona = porId.get(personaId);
    const suUnidad = persona?.unitId ? unidadPorId.get(persona.unitId) : undefined;
    return { enUnidades, enPaquetes, suUnidad, total: enUnidades.length + enPaquetes };
  };

  if (!tenantId) return null;

  /**
   * `CA8` — **un padrón limpio se dice, no se deja en blanco.** Devolver `null` aquí, como hace
   * el panel de unidades duplicadas, ahorra una tarjeta y cuesta la pregunta que el administrador
   * se hace igual: «¿esto está bien o no ha cargado?».
   */
  if (grupos.length === 0) {
    return (
      <Card className="soft-panel">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[var(--success-600,#1D9E75)]" aria-hidden />
          <CardTitle>El padrón está limpio</CardTitle>
        </div>
        <CardDescription className="mt-1">
          No hay personas que parezcan duplicadas: ningún par comparte documento, correo ni nombre.
        </CardDescription>
      </Card>
    );
  }

  async function fusionar(grupo: GrupoDeDuplicados) {
    const survivorId = survivorPorGrupo[grupo.clave] ?? grupo.ids[0];
    const motivo = (motivoPorGrupo[grupo.clave] ?? "").trim();
    if (!motivo) {
      toast.error("Escribe por qué son la misma persona.");
      return;
    }
    setOcupado(grupo.clave);
    try {
      const res = await mergePeopleCallable({
        tenantId: tenantId!,
        survivorId,
        mergedIds: grupo.ids.filter((id) => id !== survivorId),
        motivo,
      });
      // Mismo criterio que la vista previa: nada de «(s)». Es el mensaje que confirma una
      // operación que no se deshace sola, y se lee una sola vez.
      toast.success(
        `${plural(res.fusionadas, "registro archivado", "registros archivados")} y ` +
          `${plural(res.repuntadas, "referencia reasignada", "referencias reasignadas")}.`,
      );
      setAbierto(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron fusionar las personas.");
    } finally {
      setOcupado(null);
    }
  }

  async function descartar(grupo: GrupoDeDuplicados) {
    const motivo = (motivoPorGrupo[grupo.clave] ?? "").trim();
    if (!motivo) {
      toast.error("Escribe por qué NO son la misma persona.");
      return;
    }
    setOcupado(grupo.clave);
    try {
      await dismissDuplicatePeopleGroupCallable({ tenantId: tenantId!, ids: grupo.ids, motivo });
      toast.success("Marcado como personas distintas. Volverá a aparecer si el grupo cambia.");
      setAbierto(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo descartar el grupo.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Card className="soft-panel border border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
        <CardTitle>Personas que parecen duplicadas</CardTitle>
      </div>
      <CardDescription className="mt-1">
        {grupos.length} grupo{grupos.length !== 1 ? "s" : ""} por revisar. Fusionar reasigna todo lo que cuelga del
        registro que se archiva; no se borra nada.
      </CardDescription>

      <div className="mt-4 space-y-3">
        {grupos.map((grupo) => {
          const personas = grupo.ids.map((id) => porId.get(id)).filter(Boolean) as PersonItem[];
          const survivorId = survivorPorGrupo[grupo.clave] ?? grupo.ids[0];
          const cuentas = cuentasDistintas(personas);
          const estaAbierto = abierto === grupo.clave;

          return (
            <div key={grupo.clave} className="rounded-2xl border border-[var(--slate-200)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--slate-900)]">
                    {personas[0]?.fullName ?? "—"} · {grupo.ids.length} registros
                  </p>
                  {/* `R8`: el porqué va siempre delante. La regla de nombre es la más débil. */}
                  <p className="mt-1 text-xs text-[var(--slate-600)]">
                    {grupo.motivos.map((m) => `${ETIQUETA_DE_REGLA[m.regla]} (${m.valor})`).join(" · ")}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setAbierto(estaAbierto ? null : grupo.clave)}>
                  {estaAbierto ? "Cerrar" : "Revisar"}
                </Button>
              </div>

              {estaAbierto ? (
                <div className="mt-4 space-y-3">
                  {personas.map((persona) => {
                    const { enUnidades, enPaquetes, suUnidad } = referenciasDe(persona.id);
                    return (
                      <label
                        key={persona.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--slate-200)] p-3 hover:bg-[var(--slate-50)]"
                      >
                        <input
                          type="radio"
                          name={`survivor-${grupo.clave}`}
                          className="mt-1"
                          checked={survivorId === persona.id}
                          onChange={() => setSurvivorPorGrupo((s) => ({ ...s, [grupo.clave]: persona.id }))}
                        />
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="text-sm font-medium text-[var(--slate-900)]">{persona.fullName}</p>
                          <p className="text-[var(--slate-600)]">
                            {persona.documentNumber || "sin documento"} · {persona.email || "sin correo"}
                          </p>
                          <p className="mt-1 text-[var(--slate-500)]">
                            {suUnidad ? `Unidad ${suUnidad.displayName}` : "Sin unidad"}
                            {enUnidades.length > 0 ? ` · listado en ${plural(enUnidades.length, "unidad", "unidades")}` : ""}
                            {enPaquetes > 0 ? ` · ${plural(enPaquetes, "paquete", "paquetes")}` : ""}
                            {persona.authUid ? " · tiene cuenta de acceso" : ""}
                          </p>
                        </div>
                        {survivorId === persona.id ? (
                          <span className="shrink-0 rounded-full bg-[var(--brand-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand-700)]">
                            se conserva
                          </span>
                        ) : null}
                      </label>
                    );
                  })}

                  {/* La vista previa, que es el paso que no se puede saltar (`CA4`). */}
                  <div className="rounded-xl bg-[var(--slate-50)] p-3 text-xs text-[var(--slate-700)]">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Users className="h-3.5 w-3.5" aria-hidden /> Al confirmar
                    </p>
                    <p className="mt-1">
                      Se conserva <strong>{porId.get(survivorId)?.fullName ?? survivorId}</strong> con sus datos.{" "}
                      {(() => {
                        const otros = grupo.ids.filter((id) => id !== survivorId);
                        const refs = otros.reduce((total, id) => total + referenciasDe(id).total, 0);
                        return (
                          <>
                            {otros.length === 1
                              ? "El otro registro se archiva"
                              : `Los otros ${otros.length} registros se archivan`}{" "}
                            con tu motivo.{" "}
                            {refs === 0 ? (
                              <>
                                <strong>No hay nada que mover</strong>: no cuelga ninguna referencia de{" "}
                                {otros.length === 1 ? "él" : "ellos"}.
                              </>
                            ) : (
                              <>
                                {/* Con una sola, el número sobra: «La 1 referencia» no es español. */}
                                {refs === 1 ? "La" : "Las"}{" "}
                                <strong>{refs === 1 ? "referencia" : `${refs} referencias`}</strong> que{" "}
                                {refs === 1 ? "cuelga" : "cuelgan"} de {otros.length === 1 ? "él" : "ellos"} —paquetes
                                y unidades— {refs === 1 ? "pasa" : "pasan"} a apuntar al que se conserva.
                              </>
                            )}
                          </>
                        );
                      })()}
                    </p>
                    {/* Lo que se PIERDE, que es la mitad que se olvida contar. */}
                    <p className="mt-1 text-[var(--slate-600)]">
                      Se pierden los datos propios de los archivados que no coincidan con los del que se conserva
                      (documento, correo, teléfono). Quedan guardados y la fusión se puede deshacer.
                    </p>
                    {cuentas.length > 1 ? (
                      <p className="mt-2 font-medium text-[var(--danger-700)]">
                        Hay {cuentas.length} cuentas de acceso distintas en este grupo. Retira el acceso de la que no
                        se conserva antes de fusionar: si no, alguien se queda sin entrar a lo suyo.
                      </p>
                    ) : null}
                  </div>

                  <textarea
                    value={motivoPorGrupo[grupo.clave] ?? ""}
                    onChange={(e) => setMotivoPorGrupo((s) => ({ ...s, [grupo.clave]: e.target.value }))}
                    placeholder="Por qué son (o no son) la misma persona. Queda escrito en la decisión."
                    rows={2}
                    className="w-full rounded-xl border border-[var(--slate-300)] p-2.5 text-xs"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={ocupado === grupo.clave || cuentas.length > 1}
                      onClick={() => fusionar(grupo)}
                    >
                      Fusionar en el seleccionado
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ocupado === grupo.clave}
                      onClick={() => descartar(grupo)}
                    >
                      No son la misma persona
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
