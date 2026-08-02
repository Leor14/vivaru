/**
 * Catálogo de países: código ISO, nombre en español e indicativo telefónico.
 *
 * Los nombres se generaron con `Intl.DisplayNames` en español para no teclear
 * doscientos a mano; los indicativos van en la tabla porque no hay API estándar
 * que los dé. La lista es estática a propósito: `Intl` existe en el navegador,
 * pero el conjunto de códigos no, y hace falta para pintar el selector.
 *
 * Las banderas NO se guardan: se derivan del código ISO con los caracteres
 * indicadores regionales (ver `flagFor`). Así no hay imágenes que cargar ni
 * datos que mantener.
 */

export type Country = {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** Indicativo telefónico, sin el «+». */
  dial: string;
};

/** Mercados donde opera Vivaru. Se ofrecen primero en el selector. */
export const PRIMARY_COUNTRIES = ["MX", "CO", "EC"] as const;

export const COUNTRIES: Country[] = [
  { code: "AF", name: "Afganistán", dial: "93" },
  { code: "AL", name: "Albania", dial: "355" },
  { code: "DE", name: "Alemania", dial: "49" },
  { code: "AD", name: "Andorra", dial: "376" },
  { code: "AO", name: "Angola", dial: "244" },
  { code: "AI", name: "Anguila", dial: "1" },
  { code: "AG", name: "Antigua y Barbuda", dial: "1" },
  { code: "SA", name: "Arabia Saudí", dial: "966" },
  { code: "DZ", name: "Argelia", dial: "213" },
  { code: "AR", name: "Argentina", dial: "54" },
  { code: "AM", name: "Armenia", dial: "374" },
  { code: "AW", name: "Aruba", dial: "297" },
  { code: "AU", name: "Australia", dial: "61" },
  { code: "AT", name: "Austria", dial: "43" },
  { code: "AZ", name: "Azerbaiyán", dial: "994" },
  { code: "BS", name: "Bahamas", dial: "1" },
  { code: "BD", name: "Bangladés", dial: "880" },
  { code: "BB", name: "Barbados", dial: "1" },
  { code: "BH", name: "Baréin", dial: "973" },
  { code: "BE", name: "Bélgica", dial: "32" },
  { code: "BZ", name: "Belice", dial: "501" },
  { code: "BJ", name: "Benín", dial: "229" },
  { code: "BM", name: "Bermudas", dial: "1" },
  { code: "BY", name: "Bielorrusia", dial: "375" },
  { code: "BO", name: "Bolivia", dial: "591" },
  { code: "BA", name: "Bosnia y Herzegovina", dial: "387" },
  { code: "BW", name: "Botsuana", dial: "267" },
  { code: "BR", name: "Brasil", dial: "55" },
  { code: "BN", name: "Brunéi", dial: "673" },
  { code: "BG", name: "Bulgaria", dial: "359" },
  { code: "BF", name: "Burkina Faso", dial: "226" },
  { code: "BI", name: "Burundi", dial: "257" },
  { code: "BT", name: "Bután", dial: "975" },
  { code: "CV", name: "Cabo Verde", dial: "238" },
  { code: "KH", name: "Camboya", dial: "855" },
  { code: "CM", name: "Camerún", dial: "237" },
  { code: "CA", name: "Canadá", dial: "1" },
  { code: "BQ", name: "Caribe neerlandés", dial: "599" },
  { code: "QA", name: "Catar", dial: "974" },
  { code: "TD", name: "Chad", dial: "235" },
  { code: "CZ", name: "Chequia", dial: "420" },
  { code: "CL", name: "Chile", dial: "56" },
  { code: "CN", name: "China", dial: "86" },
  { code: "CY", name: "Chipre", dial: "357" },
  { code: "VA", name: "Ciudad del Vaticano", dial: "39" },
  { code: "CO", name: "Colombia", dial: "57" },
  { code: "KM", name: "Comoras", dial: "269" },
  { code: "CG", name: "Congo", dial: "242" },
  { code: "KP", name: "Corea del Norte", dial: "850" },
  { code: "KR", name: "Corea del Sur", dial: "82" },
  { code: "CR", name: "Costa Rica", dial: "506" },
  { code: "CI", name: "Côte d’Ivoire", dial: "225" },
  { code: "HR", name: "Croacia", dial: "385" },
  { code: "CU", name: "Cuba", dial: "53" },
  { code: "CW", name: "Curazao", dial: "599" },
  { code: "DK", name: "Dinamarca", dial: "45" },
  { code: "DM", name: "Dominica", dial: "1" },
  { code: "EC", name: "Ecuador", dial: "593" },
  { code: "EG", name: "Egipto", dial: "20" },
  { code: "SV", name: "El Salvador", dial: "503" },
  { code: "AE", name: "Emiratos Árabes Unidos", dial: "971" },
  { code: "ER", name: "Eritrea", dial: "291" },
  { code: "SK", name: "Eslovaquia", dial: "421" },
  { code: "SI", name: "Eslovenia", dial: "386" },
  { code: "ES", name: "España", dial: "34" },
  { code: "US", name: "Estados Unidos", dial: "1" },
  { code: "EE", name: "Estonia", dial: "372" },
  { code: "SZ", name: "Esuatini", dial: "268" },
  { code: "ET", name: "Etiopía", dial: "251" },
  { code: "PH", name: "Filipinas", dial: "63" },
  { code: "FI", name: "Finlandia", dial: "358" },
  { code: "FJ", name: "Fiyi", dial: "679" },
  { code: "FR", name: "Francia", dial: "33" },
  { code: "GA", name: "Gabón", dial: "241" },
  { code: "GM", name: "Gambia", dial: "220" },
  { code: "GE", name: "Georgia", dial: "995" },
  { code: "GH", name: "Ghana", dial: "233" },
  { code: "GI", name: "Gibraltar", dial: "350" },
  { code: "GD", name: "Granada", dial: "1" },
  { code: "GR", name: "Grecia", dial: "30" },
  { code: "GL", name: "Groenlandia", dial: "299" },
  { code: "GP", name: "Guadalupe", dial: "590" },
  { code: "GU", name: "Guam", dial: "1" },
  { code: "GT", name: "Guatemala", dial: "502" },
  { code: "GF", name: "Guayana Francesa", dial: "594" },
  { code: "GG", name: "Guernesey", dial: "44" },
  { code: "GN", name: "Guinea", dial: "224" },
  { code: "GQ", name: "Guinea Ecuatorial", dial: "240" },
  { code: "GW", name: "Guinea-Bisáu", dial: "245" },
  { code: "GY", name: "Guyana", dial: "592" },
  { code: "HT", name: "Haití", dial: "509" },
  { code: "HN", name: "Honduras", dial: "504" },
  { code: "HU", name: "Hungría", dial: "36" },
  { code: "IN", name: "India", dial: "91" },
  { code: "ID", name: "Indonesia", dial: "62" },
  { code: "IQ", name: "Irak", dial: "964" },
  { code: "IR", name: "Irán", dial: "98" },
  { code: "IE", name: "Irlanda", dial: "353" },
  { code: "IM", name: "Isla de Man", dial: "44" },
  { code: "NF", name: "Isla Norfolk", dial: "672" },
  { code: "IS", name: "Islandia", dial: "354" },
  { code: "AX", name: "Islas Aland", dial: "358" },
  { code: "KY", name: "Islas Caimán", dial: "1" },
  { code: "CK", name: "Islas Cook", dial: "682" },
  { code: "FO", name: "Islas Feroe", dial: "298" },
  { code: "FK", name: "Islas Malvinas", dial: "500" },
  { code: "MP", name: "Islas Marianas del Norte", dial: "1" },
  { code: "MH", name: "Islas Marshall", dial: "692" },
  { code: "SB", name: "Islas Salomón", dial: "677" },
  { code: "TC", name: "Islas Turcas y Caicos", dial: "1" },
  { code: "VG", name: "Islas Vírgenes Británicas", dial: "1" },
  { code: "VI", name: "Islas Vírgenes de EE. UU.", dial: "1" },
  { code: "IL", name: "Israel", dial: "972" },
  { code: "IT", name: "Italia", dial: "39" },
  { code: "JM", name: "Jamaica", dial: "1" },
  { code: "JP", name: "Japón", dial: "81" },
  { code: "JE", name: "Jersey", dial: "44" },
  { code: "JO", name: "Jordania", dial: "962" },
  { code: "KZ", name: "Kazajistán", dial: "7" },
  { code: "KE", name: "Kenia", dial: "254" },
  { code: "KG", name: "Kirguistán", dial: "996" },
  { code: "KI", name: "Kiribati", dial: "686" },
  { code: "KW", name: "Kuwait", dial: "965" },
  { code: "LA", name: "Laos", dial: "856" },
  { code: "LS", name: "Lesoto", dial: "266" },
  { code: "LV", name: "Letonia", dial: "371" },
  { code: "LB", name: "Líbano", dial: "961" },
  { code: "LR", name: "Liberia", dial: "231" },
  { code: "LY", name: "Libia", dial: "218" },
  { code: "LI", name: "Liechtenstein", dial: "423" },
  { code: "LT", name: "Lituania", dial: "370" },
  { code: "LU", name: "Luxemburgo", dial: "352" },
  { code: "MK", name: "Macedonia del Norte", dial: "389" },
  { code: "MG", name: "Madagascar", dial: "261" },
  { code: "MY", name: "Malasia", dial: "60" },
  { code: "MW", name: "Malaui", dial: "265" },
  { code: "MV", name: "Maldivas", dial: "960" },
  { code: "ML", name: "Mali", dial: "223" },
  { code: "MT", name: "Malta", dial: "356" },
  { code: "MA", name: "Marruecos", dial: "212" },
  { code: "MQ", name: "Martinica", dial: "596" },
  { code: "MU", name: "Mauricio", dial: "230" },
  { code: "MR", name: "Mauritania", dial: "222" },
  { code: "MX", name: "México", dial: "52" },
  { code: "FM", name: "Micronesia", dial: "691" },
  { code: "MD", name: "Moldavia", dial: "373" },
  { code: "MC", name: "Mónaco", dial: "377" },
  { code: "MN", name: "Mongolia", dial: "976" },
  { code: "ME", name: "Montenegro", dial: "382" },
  { code: "MS", name: "Montserrat", dial: "1" },
  { code: "MZ", name: "Mozambique", dial: "258" },
  { code: "MM", name: "Myanmar (Birmania)", dial: "95" },
  { code: "NA", name: "Namibia", dial: "264" },
  { code: "NR", name: "Nauru", dial: "674" },
  { code: "NP", name: "Nepal", dial: "977" },
  { code: "NI", name: "Nicaragua", dial: "505" },
  { code: "NE", name: "Níger", dial: "227" },
  { code: "NG", name: "Nigeria", dial: "234" },
  { code: "NU", name: "Niue", dial: "683" },
  { code: "NO", name: "Noruega", dial: "47" },
  { code: "NC", name: "Nueva Caledonia", dial: "687" },
  { code: "NZ", name: "Nueva Zelanda", dial: "64" },
  { code: "OM", name: "Omán", dial: "968" },
  { code: "NL", name: "Países Bajos", dial: "31" },
  { code: "PK", name: "Pakistán", dial: "92" },
  { code: "PW", name: "Palaos", dial: "680" },
  { code: "PA", name: "Panamá", dial: "507" },
  { code: "PG", name: "Papúa Nueva Guinea", dial: "675" },
  { code: "PY", name: "Paraguay", dial: "595" },
  { code: "PE", name: "Perú", dial: "51" },
  { code: "PF", name: "Polinesia Francesa", dial: "689" },
  { code: "PL", name: "Polonia", dial: "48" },
  { code: "PT", name: "Portugal", dial: "351" },
  { code: "PR", name: "Puerto Rico", dial: "1" },
  { code: "HK", name: "RAE de Hong Kong (China)", dial: "852" },
  { code: "MO", name: "RAE de Macao (China)", dial: "853" },
  { code: "GB", name: "Reino Unido", dial: "44" },
  { code: "CF", name: "República Centroafricana", dial: "236" },
  { code: "CD", name: "República Democrática del Congo", dial: "243" },
  { code: "DO", name: "República Dominicana", dial: "1" },
  { code: "RE", name: "Reunión", dial: "262" },
  { code: "RW", name: "Ruanda", dial: "250" },
  { code: "RO", name: "Rumanía", dial: "40" },
  { code: "RU", name: "Rusia", dial: "7" },
  { code: "WS", name: "Samoa", dial: "685" },
  { code: "AS", name: "Samoa Americana", dial: "1" },
  { code: "BL", name: "San Bartolomé", dial: "590" },
  { code: "KN", name: "San Cristóbal y Nieves", dial: "1" },
  { code: "SM", name: "San Marino", dial: "378" },
  { code: "MF", name: "San Martín", dial: "590" },
  { code: "PM", name: "San Pedro y Miquelón", dial: "508" },
  { code: "VC", name: "San Vicente y las Granadinas", dial: "1" },
  { code: "LC", name: "Santa Lucía", dial: "1" },
  { code: "ST", name: "Santo Tomé y Príncipe", dial: "239" },
  { code: "SN", name: "Senegal", dial: "221" },
  { code: "RS", name: "Serbia", dial: "381" },
  { code: "SC", name: "Seychelles", dial: "248" },
  { code: "SL", name: "Sierra Leona", dial: "232" },
  { code: "SG", name: "Singapur", dial: "65" },
  { code: "SX", name: "Sint Maarten", dial: "1" },
  { code: "SY", name: "Siria", dial: "963" },
  { code: "SO", name: "Somalia", dial: "252" },
  { code: "LK", name: "Sri Lanka", dial: "94" },
  { code: "ZA", name: "Sudáfrica", dial: "27" },
  { code: "SD", name: "Sudán", dial: "249" },
  { code: "SS", name: "Sudán del Sur", dial: "211" },
  { code: "SE", name: "Suecia", dial: "46" },
  { code: "CH", name: "Suiza", dial: "41" },
  { code: "SR", name: "Surinam", dial: "597" },
  { code: "TH", name: "Tailandia", dial: "66" },
  { code: "TW", name: "Taiwán", dial: "886" },
  { code: "TZ", name: "Tanzania", dial: "255" },
  { code: "TJ", name: "Tayikistán", dial: "992" },
  { code: "PS", name: "Territorios Palestinos", dial: "970" },
  { code: "TL", name: "Timor-Leste", dial: "670" },
  { code: "TG", name: "Togo", dial: "228" },
  { code: "TO", name: "Tonga", dial: "676" },
  { code: "TT", name: "Trinidad y Tobago", dial: "1" },
  { code: "TN", name: "Túnez", dial: "216" },
  { code: "TM", name: "Turkmenistán", dial: "993" },
  { code: "TR", name: "Turquía", dial: "90" },
  { code: "TV", name: "Tuvalu", dial: "688" },
  { code: "UA", name: "Ucrania", dial: "380" },
  { code: "UG", name: "Uganda", dial: "256" },
  { code: "UY", name: "Uruguay", dial: "598" },
  { code: "UZ", name: "Uzbekistán", dial: "998" },
  { code: "VU", name: "Vanuatu", dial: "678" },
  { code: "VE", name: "Venezuela", dial: "58" },
  { code: "VN", name: "Vietnam", dial: "84" },
  { code: "YE", name: "Yemen", dial: "967" },
  { code: "DJ", name: "Yibuti", dial: "253" },
  { code: "ZM", name: "Zambia", dial: "260" },
  { code: "ZW", name: "Zimbabue", dial: "263" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryByCode(code: string | undefined): Country | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

/**
 * Bandera como emoji, derivada del ISO: cada letra se mapea a su indicador
 * regional. OJO: Windows no dibuja estas banderas y muestra las dos letras en
 * su lugar. Es una degradación aceptable —sigue diciendo el país— y por eso el
 * selector nunca depende SOLO de la bandera: siempre va con nombre o indicativo.
 */
export function flagFor(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
}

/** Quita acentos para que «mexico» encuentre «México». */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Busca por nombre, código o indicativo, **ordenando por relevancia**.
 *
 * Filtrar a secas no basta: «co» aparece dentro de «mexico», así que un simple
 * `includes` devolvía México antes que Colombia. Quien teclea «co» quiere
 * Colombia. Por eso hay niveles — código exacto, luego nombre que empieza así,
 * luego indicativo, y al final la coincidencia suelta dentro del nombre.
 *
 * Acepta «+52», «52», «mx» o «mexico»: al buscar un país uno teclea lo que
 * tiene a mano, no lo que la lista espera.
 */
export function searchCountries(query: string): Country[] {
  const q = fold(query.trim().replace(/^\+/, ""));
  if (!q) return orderedCountries();

  const scored: Array<{ country: Country; rank: number }> = [];
  for (const country of orderedCountries()) {
    const name = fold(country.name);
    const code = fold(country.code);
    let rank: number | null = null;
    if (code === q) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (country.dial.startsWith(q)) rank = 2;
    else if (code.startsWith(q)) rank = 3;
    else if (name.includes(q)) rank = 4;
    if (rank !== null) scored.push({ country, rank });
  }
  // `sort` es estable, así que dentro de cada nivel se conserva el orden base
  // (mercados de Vivaru primero, luego alfabético).
  return scored.sort((a, b) => a.rank - b.rank).map((item) => item.country);
}

/** Los mercados de Vivaru primero; el resto alfabético. */
export function orderedCountries(): Country[] {
  const primary = PRIMARY_COUNTRIES.map((code) => BY_CODE.get(code)).filter(
    (c): c is Country => Boolean(c),
  );
  const rest = COUNTRIES.filter((c) => !PRIMARY_COUNTRIES.includes(c.code as (typeof PRIMARY_COUNTRIES)[number]));
  return [...primary, ...rest];
}
