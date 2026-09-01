/**
 * Sonda del mapeador determinístico — AI-ONB-001, exploración.
 *
 * NO es corpus: son encabezados PLAUSIBLES construidos a mano a partir de los
 * formatos típicos de padrones LATAM. Mide qué resuelve hoy `suggestMapping`
 * y qué deja sin salida, campo a campo.
 */
import {
  suggestMapping,
  missingRequired,
  mappingIssues,
  type ImportEntity,
} from "../../src/lib/import/field-catalog";
import { ALIAS_DE_TIPO } from "../../src/lib/units/tipos";

// **Los tipos salen de la tabla REAL y no de una copia.** El 1 de septiembre de
// 2026 esta lista era una copia a mano, y en cuanto `parqueadero` y `bodega`
// pasaron a ser tipos válidos la sonda siguió enseñando un bloqueo que el
// producto ya no hace: un instrumento que mide otra cosa es peor que ninguno.
const ACEPTADOS_UNIDAD = {
  "unit.type": Object.keys(ALIAS_DE_TIPO),
  "unit.status": ["active", "activo", "activa", "inactive", "inactivo", "inactiva"],
};
const ACEPTADOS_PERSONA = {
  "person.role": ["owner_occupant", "propietario", "propietario residente", "dueno", "owner", "tenant", "inquilino", "arrendatario", "residente", "investor", "inversionista", "propietario no residente", "other", "otro", "otra"],
};

type Caso = {
  nombre: string;
  entidad: ImportEntity;
  headers: string[];
  rows: Record<string, string>[];
  notas?: string;
};

const CASOS: Caso[] = [
  {
    nombre: "P1 · Nombre partido en dos columnas (muy común en CO)",
    entidad: "person",
    headers: ["Nombres", "Apellidos", "Correo", "Unidad", "Rol"],
    rows: [
      { Nombres: "Ana María", Apellidos: "Pérez Ruiz", Correo: "ana@x.com", Unidad: "T1-101", Rol: "propietario" },
      { Nombres: "Luis", Apellidos: "Gómez", Correo: "luis@x.com", Unidad: "T1-102", Rol: "inquilino" },
      { Nombres: "Carla", Apellidos: "Soto", Correo: "carla@x.com", Unidad: "T1-103", Rol: "propietario" },
    ],
    notas: "Aunque mapee «Nombres», el apellido se pierde: no hay unión de columnas.",
  },
  {
    nombre: "P2 · Torre y Apto separados, cédula como C.C.",
    entidad: "person",
    headers: ["Torre", "Apto", "Nombre Completo", "C.C.", "Correo", "Cel"],
    rows: [
      { Torre: "1", Apto: "101", "Nombre Completo": "Ana Pérez", "C.C.": "51234567", Correo: "ana@x.com", Cel: "3001112233" },
      { Torre: "1", Apto: "102", "Nombre Completo": "Luis Gómez", "C.C.": "79876543", Correo: "luis@x.com", Cel: "3004445566" },
      { Torre: "2", Apto: "201", "Nombre Completo": "Carla Soto", "C.C.": "1020304050", Correo: "carla@x.com", Cel: "3007778899" },
    ],
    notas: "La unidad real es Torre+Apto combinados; «Apto» no es alias de unitLabel.",
  },
  {
    nombre: "P3 · Padrón mixto unidades+personas en una hoja (formato Habitanto)",
    entidad: "person",
    headers: ["Inmueble", "Coeficiente", "Propietario", "Teléfono", "Email", "Estado de cuenta"],
    rows: [
      { Inmueble: "T1-101", Coeficiente: "1,25%", Propietario: "Ana Pérez", "Teléfono": "3001112233", Email: "ana@x.com", "Estado de cuenta": "$0" },
      { Inmueble: "T1-102", Coeficiente: "1,25%", Propietario: "Luis Gómez", "Teléfono": "3004445566", Email: "luis@x.com", "Estado de cuenta": "$120.000" },
      { Inmueble: "T2-201", Coeficiente: "2,10%", Propietario: "Carla Soto", "Teléfono": "3007778899", Email: "carla@x.com", "Estado de cuenta": "$0" },
    ],
    notas: "«Propietario» es el NOMBRE de la persona, no el rol. Sin columna de rol.",
  },
  {
    nombre: "P4 · Encabezados con el rol en el NOMBRE de columna",
    entidad: "person",
    headers: ["Depto", "Propietario(a)", "Arrendatario(a)", "Contacto"],
    rows: [
      { Depto: "101", "Propietario(a)": "Ana Pérez", "Arrendatario(a)": "", Contacto: "ana@x.com" },
      { Depto: "102", "Propietario(a)": "", "Arrendatario(a)": "Luis Gómez", Contacto: "luis@x.com" },
      { Depto: "201", "Propietario(a)": "Carla Soto", "Arrendatario(a)": "", Contacto: "carla@x.com" },
    ],
    notas: "El rol vive en QUÉ columna está lleno el nombre — estructura, no valor.",
  },
  {
    nombre: "U1 · Parqueaderos y bodegas (tipos fuera del vocabulario)",
    entidad: "unit",
    headers: ["Unidad", "Agrupación", "Tipo", "Estado"],
    rows: [
      { Unidad: "PQ-001", "Agrupación": "Sótano 1", Tipo: "parqueadero", Estado: "activo" },
      { Unidad: "PQ-002", "Agrupación": "Sótano 1", Tipo: "parqueadero", Estado: "activo" },
      { Unidad: "BD-001", "Agrupación": "Sótano 2", Tipo: "bodega", Estado: "activo" },
    ],
    notas: "Bloqueaba el archivo ENTERO hasta el 1 sep 2026; desde que parqueadero y bodega son tipos, entra.",
  },
  {
    nombre: "U2 · Vocabulario de estado real (ocupado/arrendado)",
    entidad: "unit",
    headers: ["Inmueble", "Bloque", "Uso", "Ocupación"],
    rows: [
      { Inmueble: "A-101", Bloque: "A", Uso: "apartamento", "Ocupación": "ocupado" },
      { Inmueble: "A-102", Bloque: "A", Uso: "apartamento", "Ocupación": "arrendado" },
      { Inmueble: "B-201", Bloque: "B", Uso: "casa", "Ocupación": "desocupado" },
    ],
    notas: "«Ocupación» no encaja con activo/inactivo: es OTRO eje semántico.",
  },
  {
    nombre: "U3 · Unidad en una sola celda combinada",
    entidad: "unit",
    headers: ["Ubicación", "Clase", "Situación"],
    rows: [
      { "Ubicación": "Torre 1 - Apto 101", Clase: "apartamento", "Situación": "activo" },
      { "Ubicación": "Torre 1 - Apto 102", Clase: "apartamento", "Situación": "activo" },
      { "Ubicación": "Torre 2 - Apto 201", Clase: "casa", "Situación": "activo" },
    ],
    notas: "Mapeable, pero torre y nombre viajan juntos en una celda: partirlos no existe.",
  },
  {
    nombre: "P5 · Encabezados mexicanos con «Mail» y «Móvil»",
    entidad: "person",
    headers: ["No. Depto", "Nombre", "Mail", "Móvil", "RFC", "Calidad"],
    rows: [
      { "No. Depto": "EA-101", Nombre: "Ana Pérez", Mail: "ana@x.com", "Móvil": "5544332211", RFC: "PEAN850312AB1", Calidad: "propietario" },
      { "No. Depto": "EA-102", Nombre: "Luis Gómez", Mail: "luis@x.com", "Móvil": "5544332212", RFC: "GOSL900211CD2", Calidad: "inquilino" },
      { "No. Depto": "EA-103", Nombre: "Carla Soto", Mail: "carla@x.com", "Móvil": "5544332213", RFC: "SOCA910101EF3", Calidad: "propietario" },
    ],
    notas: "«Mail» lo rescataba la VARIEDAD, o sea la suerte: el mismo empate elegía el RUT en un padrón chileno. Desde el 1 sep es alias.",
  },
];

function etiqueta(v: string | null): string {
  return v === null ? "∅" : `«${v}»`;
}

for (const caso of CASOS) {
  const accepted = caso.entidad === "unit" ? ACEPTADOS_UNIDAD : ACEPTADOS_PERSONA;
  const m = suggestMapping(caso.headers, caso.entidad, { rows: caso.rows, accepted });
  const faltan = missingRequired(m, caso.entidad);
  const avisos = mappingIssues(caso.rows, caso.entidad, m, accepted);

  console.log(`\n═══ ${caso.nombre}`);
  if (caso.notas) console.log(`    (${caso.notas})`);
  for (const [campo, header] of Object.entries(m)) {
    const aviso = avisos[campo];
    console.log(`    ${campo.padEnd(22)} ← ${etiqueta(header)}${aviso ? `   ⚠ ${aviso.nivel}: ${aviso.mensaje}` : ""}`);
  }
  console.log(
    faltan.length === 0
      ? "    ✔ ningún obligatorio sin mapear"
      : `    ✘ OBLIGATORIOS SIN MAPEAR: ${faltan.map((f) => f.label).join(", ")}`,
  );
}
