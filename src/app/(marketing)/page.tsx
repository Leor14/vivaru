import { redirect } from 'next/navigation';

/**
 * Root `/` redirects to `/mx` (Mexico landing).
 * Future: add country detection or a /co route for Colombia.
 */
export default function RootPage() {
  redirect('/mx');
}
