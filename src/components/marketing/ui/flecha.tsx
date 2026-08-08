import { cn } from "@/lib/utils/cn";

/**
 * La flecha de los CTA, con el empujón al pasar el puntero.
 *
 * Estaba repetida en seis sitios como `<span aria-hidden className="ml-0.5">→</span>`
 * —y en el hero ni siquiera eso: iba suelta dentro del texto, donde no se puede
 * animar sin envolverla—. Aquí es una sola definición.
 *
 * **Dos variantes de grupo a propósito.** El botón compartido de marketing se
 * marca como `group/button`, que en Tailwind NO coincide con el selector de
 * `group-hover:` —ese busca la clase `group` a secas—. Enlaces como el de
 * `ImpactBand` no usan ese botón y llevan `group` normal. Declarar las dos hace
 * que la flecha funcione en ambos contextos sin que quien la use tenga que
 * saberlo.
 *
 * `motion-reduce` no se limita a quitar la transición: también anula el
 * desplazamiento. Si solo se quitara la transición, la flecha daría el salto de
 * 4 px igual, solo que de golpe.
 */
export function Flecha({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-0.5 inline-block will-change-transform",
        "transition-transform duration-fast ease-out-brand",
        "group-hover/button:translate-x-1 group-hover:translate-x-1",
        "motion-reduce:transition-none",
        "motion-reduce:group-hover/button:translate-x-0 motion-reduce:group-hover:translate-x-0",
        className,
      )}
    >
      →
    </span>
  );
}
