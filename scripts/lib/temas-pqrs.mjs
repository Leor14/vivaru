// Vocabulario de temas de PQRS, compartido por el contador y el muestreador.
//
// POR QUÉ ES UN MÓDULO: misma lección que el parser. Si el muestreador que
// extrae los casos del gold set usara una copia de estos patrones, los ejemplos
// podrían no ser los mismos mensajes que el contador contó — y la taxonomía
// citaría como evidencia algo que sus propias cifras no respaldan.
//
// Vocabulario de los TRES mercados a propósito: «pipa» es mexicano y
// «tanquero» ecuatoriano, «cuota» convive con «alícuota» y «expensa»,
// «alberca» con «piscina», «estacionamiento» con «parqueadero». Un detector con
// vocabulario de un solo país haría parecer que en el otro no se habla del tema.
//
// «mantenimiento» a secas se cuenta en obra_mantenimiento SABIENDO que en
// México también nombra la cuota mensual («pago de mantenimiento»). El solape
// es real y va en las dos direcciones; el conteo es para ordenar por magnitud,
// no para separar con bisturí — la misma advertencia que dejó escrita el
// análisis mexicano.

export const TEMAS = {
  agua: /\b(aguas?|fugas?|filtracion(es)?|humedad(es)?|goteras?|goteos?|presion|bombas?|cisternas?|tinacos?|pipas?|tanqueros?|hidroneumatico|inundacion(es)?|drenaje|tuberias?)\b/,
  cuotas_pagos: /\b(cuotas?|alicuotas?|expensas?|mensualidad(es)?|adeudos?|morosos?|morosidad|recargos?|comprobantes?|transferencias?|depositos?|pagos?|pagar|pague|cobros?|estado de cuenta|facturas?)\b/,
  asamblea_administracion: /\b(asambleas?|reunion(es)?|comite|administracion|administradora?|actas?|votacion(es)?|votar|convocatorias?|directivas?|consejo|quorum)\b/,
  obra_mantenimiento: /\b(obras?|reparacion(es)?|reparar|impermeabiliza\w*|pinturas?|pintar|albanil\w*|herrer\w*|refaccion(es)?|mantenimientos?|fachadas?|azoteas?|techos?|grietas?|plomeros?|plomeria)\b/,
  elevadores: /\b(elevador(es)?|ascensor(es)?)\b/,
  seguridad_porteria: /\b(seguridad|guardias?|vigilan\w*|casetas?|garitas?|porterias?|conserjes?|guardiania|paquetes?|paqueteria|robos?|robar\w*|camaras?|intrusos?)\b/,
  luz_electricidad: /\b(luz|energia|electric\w*|apagon(es)?|cfe|cortocircuitos?|focos?|lamparas?|medidor(es)?|transformador(es)?)\b/,
  convivencia_ruido: /\b(ruidos?|fiestas?|musica|volumen|escandalos?|mascotas?|perros?|gatos?|convivencia|molestias?|claxon)\b/,
  amenidades: /\b(albercas?|piscinas?|gimnasios?|salon (de eventos|comunal|de usos)|amenidad(es)?|palapas?|asador(es)?|terrazas?|juegos infantiles|areas? verdes?)\b/,
  accesos_estacionamiento: /\b(porton(es)?|pluma|estacionamientos?|parqueaderos?|cajon(es)?|cocheras?|control de acceso|zaguan|acceso vehicular)\b/,
  limpieza_basura: /\b(limpiezas?|basuras?|desechos|escombros?|reciclaje|fumigacion(es)?|plagas?|cucarachas?|ratas?)\b/,
};

/** Adjuntos: el export los deja como marcador, no como texto. */
export const SIN_TEXTO = /\b(imagen omitida|video omitido|documento omitido|audio omitido|sticker omitido|gif omitido|multimedia omitido|tarjeta de contacto omitida|se elimino este mensaje|eliminaste este mensaje)\b/;

/**
 * Mensajes que escribe WhatsApp, no una persona.
 *
 * POR QUÉ APARECIÓ TARDE, y es la lección de siempre: se descubrió muestreando
 * para etiquetar, no contando. **«Cambió tu código de seguridad con X» lleva la
 * palabra «seguridad»**, así que el detector de `seguridad_porteria` lo contaba
 * como si un vecino hubiera escrito sobre la portería. Son **89 en México y 141
 * en Ecuador** — y el tema entero en Ecuador tenía 132 mensajes, o sea que el
 * ruido era mayor que la señal.
 *
 * Es exactamente el fallo que los dos scripts de anonimización dejaron escrito:
 * una comprobación que comparte el punto ciego de lo que comprueba no comprueba
 * nada. El contador se creía las cifras porque el ruido pasaba su propio tamiz.
 *
 * NO incluye «se editó este mensaje»: eso es un marcador al final de un mensaje
 * real, y filtrarlo tiraría el mensaje entero.
 */
export const SISTEMA = /(cambio tu codigo de seguridad|se unio usando el enlace|te uniste usando el enlace|anadio a |creo el grupo|cambio el asunto|cambio la descripcion|cambio la imagen del grupo|salio del grupo|elimino a |cambio su numero de telefono|los mensajes y las llamadas estan cifrados|ahora es admin|estableciste este grupo)/;

/**
 * La administración se reconoce por el nombre del remitente en los dos corpus
 * («Rodrigo Administración», «Paola Salazar Administradora»). El nombre del
 * grupo mexicano también contiene «administración» y captura las líneas de
 * sistema — excluirlas de los mensajes de residentes es correcto.
 */
export const esAdmin = (autor, norm) => norm(autor).includes("administra");

/**
 * Verbos con los que se anuncia algo. Vienen de
 * `analizar-corpus-vecinal.mjs`, donde sirven para ENCONTRAR avisos; aquí
 * sirven para lo contrario, DESCARTARLOS.
 *
 * POR QUÉ HACE FALTA, y no se vio hasta muestrear: el corpus mezcla dos géneros
 * que van en direcciones opuestas. Un aviso es la SALIDA del administrador; un
 * ticket de PQRS es la ENTRADA del residente. Filtrar por el nombre del
 * remitente no basta, porque el análisis mexicano ya midió que **27 de 83
 * avisos los escriben residentes** — miembros del comité publicando
 * mantenimientos. Sin este filtro, el gold set etiquetaría comunicados como si
 * fueran peticiones, y el clasificador aprendería el género equivocado.
 */
export const ANUNCIA = /\b(les? informo|les? informamos|se informa|informamos|comunicamos|se comunica|les? comunico|se realizara|se realizaran|se llevara a cabo|habra|tendremos|se suspende|se suspendera|se cortara|recordamos|les recuerdo|se recuerda|reporte de trabajos|aviso|atencion|convocatoria|se convoca)\b/;
