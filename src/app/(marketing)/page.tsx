import { permanentRedirect } from 'next/navigation';

/**
 * `/` lleva al landing de México.
 *
 * `permanentRedirect` y no `redirect`: el segundo emite **307 (temporal)**, que
 * le dice a Google que no consolide autoridad en el destino. La raíz es la URL
 * que más enlaces recibe de todo el sitio, así que estaba tirando esa señal.
 * `permanentRedirect` emite 308 y sí la transfiere.
 *
 * Pendiente: detección de país o una ruta `/co` para Colombia.
 */
export default function RootPage() {
  permanentRedirect('/mx');
}
