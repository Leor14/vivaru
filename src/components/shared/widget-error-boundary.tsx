"use client";

import { Component, type ReactNode } from "react";

/**
 * Aísla un widget/tablero/sección para que un error de render NO tumbe toda la
 * ruta /admin (cuyo error.tsx muestra "No pudimos cargar el workspace"). Si el
 * hijo lanza, se muestra un fallback discreto y el resto de la página sigue viva.
 *
 * Regla del proyecto: toda sección de dashboard/tablero que consuma datos del
 * tenant (especialmente charts de recharts) debe ir envuelta en este boundary.
 */
type Props = { children: ReactNode; label?: string };
type State = { hasError: boolean };

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Telemetría ligera; no rompe el render.
    console.error("[widget-error-boundary]", this.props.label ?? "", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--slate-600)]">
          No se pudo cargar {this.props.label ?? "esta sección"}. Recarga la página o inténtalo más tarde.
        </div>
      );
    }
    return this.props.children;
  }
}
