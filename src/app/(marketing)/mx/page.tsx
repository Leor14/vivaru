import { permanentRedirect } from 'next/navigation';

/**
 * `/mx` ya no sirve el landing: lo sirve la raíz.
 *
 * Se invirtió la redirección en agosto de 2026, cuando la estrategia pasó de
 * México solo a México, Colombia y Ecuador con un copy neutro. El porqué está
 * en `(marketing)/page.tsx`.
 *
 * **Esta ruta no se borra, y no es un detalle.** `/mx` es la única URL con
 * contenido que ha existido del sitio: es la que está enlazada desde fuera, la
 * que la gente compartió y la que Google conoce. Borrarla convertiría todo eso
 * en 404 y tiraría la poca autoridad acumulada. Con 308 se transfiere.
 *
 * `permanentRedirect` y no `redirect`: el segundo emite 307 (temporal), que le
 * dice a Google que NO consolide autoridad en el destino, que es justo lo
 * contrario de lo que se busca al mover una página. Mismo motivo por el que la
 * raíz ya usaba 308 cuando redirigía hacia aquí.
 */
export default function MxPage() {
  permanentRedirect('/');
}
