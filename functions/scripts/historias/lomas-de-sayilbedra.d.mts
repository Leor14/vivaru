// Tipos de `lomas-de-sayilbedra.mjs`, para las pruebas de `functions/tests/` (como `seed-data-*.d.mts`).
// Si cambia la forma de lo que exporta el guion, cambia esto: el typecheck de functions lo vigila.

export declare const HISTORIA: string;
export declare const NOMBRE: string;
export declare const SECCIONES: string[];
export declare const CASAS_POR_SECCION: number;
export declare const DOMINIO_INERTE: string;
export declare const INICIO: string;
export declare const APERTURA: string;

export declare const CASAS_DEMO: {
  resCorriente: string;
  resMoroso: string;
  consejero: string;
  consejeroSinAcceso: string;
};
export declare const CORREOS_CON_ACCESO: {
  resCorriente: string;
  resMoroso: string;
  consejero: string;
  porteria: string;
};

export declare function idDe(tenantId: string, local: string): string;
export declare function slugDeUnidad(displayName: string): string;
export declare function slugDeCorreo(texto: string): string;
export declare function repartirIndivisos(superficies: number[]): number[];
export declare function digitoDeControlClabe(diecisiete: string): number;
export declare function clabeImposible(diecisiete: string): string;

export type Cohorte = "puntual" | "tardio" | "moroso" | "adelantado" | "multiple" | "revertido";

export interface Casa {
  id: string;
  clave: string;
  displayName: string;
  tower: string;
  type: "house";
  areaSqm: number;
  coefficient: number;
  cohorte: Cohorte;
  alquilada: boolean;
  ownerIds: string[];
  residentIds: string[];
}

export interface Persona {
  id: string;
  casaId: string;
  fullName: string;
  email: string;
  roleType: "owner_occupant" | "tenant" | "investor" | "other";
  tower: string;
  titular: boolean;
}

export interface Cuenta {
  clave: string;
  email: string;
  fullName: string;
  personaId: string | null;
  casaId: string | null;
  role: "resident" | "security_guard";
  acceso: boolean;
  consejo: boolean;
}

export interface Area {
  id: string;
  clave: string;
  name: string;
  category: string;
  availableWeekdays: number[];
  operatingHoursStart: string;
  operatingHoursEnd: string;
  slotDurationMinutes: number;
  maxReservationsPerSlot: number;
  maxReservationDurationMinutes: number;
  maxReservationsPerUnitPerMonth: number;
  usageRules: string;
  blockOnDebt: boolean;
  autoApprove: boolean;
  minAdvanceMinutes: number;
  reservationSlots: string[];
}

export interface Proveedor {
  id: string;
  clave: string;
  legalName: string;
  defaultCategory: string;
}

export interface CuentaBancaria {
  id: string;
  clave: string;
  label: string;
  bankName: string;
  accountNumber: string;
  saldoApertura: number;
}

export interface Padron {
  casas: Casa[];
  personas: Persona[];
  cuentas: Cuenta[];
  areas: Area[];
  proveedores: Proveedor[];
  bancos: CuentaBancaria[];
  servicioMedido: { id: string; clave: string; name: string; unit: string; rate: number; accountCode: string };
  caja: { id: string; clave: string; name: string; limit: number };
  ajustes: {
    agrupaciones: string[];
    tenantName: string;
    brandColor: string;
    residentModules: Record<string, boolean>;
    reservationPolicy: { blockOnDebt: boolean };
    fiscalProfile: Record<string, unknown>;
  };
}

export declare const AREAS: Omit<Area, "id">[];
export declare const PROVEEDORES: Omit<Proveedor, "id">[];
export declare const CUENTAS_BANCARIAS: Omit<CuentaBancaria, "id">[];

export declare function construirPadron(tenantId: string): Padron;

export interface Evento {
  fecha: string;
  hora: string;
  tipo: string;
  clave: string;
  datos: Record<string, unknown>;
}

export declare function construirHistoria(entrada: { tenantId: string; hoy: string }): {
  historia: string;
  tenantId: string;
  hoy: string;
  padron: Padron;
  eventos: Evento[];
};
