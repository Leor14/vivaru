# Runbook — la demo de Lomas de Sayilbedra, el día de la demo

> **Para qué.** Dejar el conjunto demo con «hoy» antes de enseñarlo. La historia de tres meses y los
> documentos no cambian; la portería, en cambio, necesita las visitas y los paquetes del día. Plan y
> detalle: `docs/plan-seed-demo-lomas-de-sayilbedra.md` (la historia; §14, el ensayo) y
> `docs/plan-documentos-demo-lomas.md` (los documentos).
>
> **Estado al 15 sep 2026:** sembrado en **producción** y en el **ensayo de staging**, los dos con el
> verificador en 43 de 43.
> - Producción: `PoyiASYEYoPSMulCWPJa`, «Lomas de Sayilbedra». La historia se sembró el 14 sep, los
>   documentos a las 00:35 UTC del 15 y las fotos de medidor ilustradas (D2) a las 04:53 UTC.
> - Staging: `fnBFuQe2p8h5fwy3jpeB`, «Lomas de Sayilbedra (ensayo)»; las fotos de medidor, a las 04:25 UTC.
> - Medidores abre en agosto, la última ronda, con una franja que dice que septiembre todavía no tiene
>   lecturas (H.51, arreglada el 15 sep).
>
> La demo se enseña en **`www.grupovivaru.com`**. Sin `www` no sirve mientras falte el TXT `fah-claim`.

## 1. Antes: la credencial

Los scripts leen y escriben con la ADC. Si fallan con `invalid_rapt` o `invalid_grant`, la renueva
David (`gcloud auth application-default login`): no es un error del script. La credencial del CLI de
firebase es otra y caduca aparte; estos scripts no la usan.

## 2. Simular, y después escribir

En **producción**, que es donde se enseña la demo:

```bash
node functions/scripts/sembrar-historia-demo.mjs hogaru-1 PoyiASYEYoPSMulCWPJa --refrescar
```

```bash
node functions/scripts/sembrar-historia-demo.mjs hogaru-1 PoyiASYEYoPSMulCWPJa --refrescar --escribir --si-produccion
```

**Cada corrida en producción escribe datos de prueba y lleva el sí de David en ese momento.** El script
exige `--si-produccion`. En el ensayo de staging es el mismo comando con `vivaru-staging-02
fnBFuQe2p8h5fwy3jpeB`, sin `--si-produccion`.

Qué hace `--refrescar`:

- **Cierra lo que los días anteriores dejaron abierto en la portería.**
- **Siembra el día, pero solo lo que ya pasó a la hora de correrlo:** cuatro visitas (una ya terminada,
  dos dentro y una programada para las 17:30) y tres paquetes (09:15, 11:40 y 13:05).
- **No toca el dinero, la historia ni los documentos.** Es idempotente: una segunda corrida el mismo día
  solo añade lo que haya llegado a su hora entre tanto.

**Los documentos no envejecen.** Sus fechas son las de la historia, de junio a septiembre, así que no
hace falta volver a correr `--documentos` antes de una demo.

**La hora importa.** Corrido antes de las 13:05, falta el tercer paquete; pasadas las 17:30, la visita
de la tarde sale «Expirado», que es lo correcto a esa hora. El mejor momento es entre las 13:05 y la
demo.

## 3. Verificar

```bash
node functions/scripts/verificar-historia-demo.mjs hogaru-1 PoyiASYEYoPSMulCWPJa
```

Tiene que salir en verde: **43 comprobaciones** al 15 sep, las 37 de la historia y 6 de los documentos.
Si algo sale en rojo, no enseñar esa pantalla y avisar. En el ensayo, con `vivaru-staging-02
fnBFuQe2p8h5fwy3jpeB`.

**Las cuentas demo** son `+lomas-res1`, `+lomas-res2`, `+lomas-consejo` y `+lomas-porteria`, alias del
hotmail de David.
- Si alguna no tiene contraseña, se genera un enlace para ponerla con la consola de administración, sin
  correo.
- Al 15 sep, en producción solo había entrado la del residente al corriente.
- **En el ensayo de staging, al 15 sep ninguna tenía contraseña.** Las cuatro nacieron de nuevo con la
  resiembra de T2.3 (14 sep, 22:18 UTC): `--limpiar` borra las cuentas, y con ellas la contraseña que se
  les hubiera puesto. Después de resembrar, hay que volver a generar el enlace. `+lomas-res1` es Encinos
  03.

## 4. Durante la demo: lo que no hay que tocar

- **«Enviar acceso a 95»**: está a un clic y manda correo a buzones que no existen (contrato, H.28).
- **Lo que se confirma en pantalla se escribe de verdad:** la entrega de un paquete, el ingreso de una
  visita, una reserva. En el ensayo da igual; en producción cambia la demo hasta el siguiente
  `--refrescar`.
- **Abrir Cartera puede escribir** (H.27): archiva en Documentos los comprobantes aprobados que no tengan
  documento. La semilla ya los archiva al aprobar, así que no debería encontrar ninguno. Si después de la
  demo el verificador marca documentos fuera del manifiesto, es esto.
- **Rarezas del producto que se ven y no son de la semilla** (contrato, §H):
  - la «Próxima reserva» del residente sale un día antes, y a veces ya pasada (H.32, H.36);
  - el listado de reservas de la portería empieza en junio (H.38);
  - los PDF del informe mensual y del reporte de comité pintan el dinero en formato colombiano,
    «$598.400» (H.40);
  - el logo no sale en el informe mensual (H.41);
  - el residente ve en Documentos el PDF de un comunicado programado antes de que se le publique (H.50);
  - la foto de cada lectura del medidor la ve el residente («Tus consumos medidos» → «Ver foto») y no la
    administración (H.45).

## 5. Limpiar

`--limpiar` borra por id exacto todo lo sembrado —la historia y los documentos—, las cuentas y los
archivos, y devuelve los ajustes a como estaban, logo incluido. Se probó en el ensayo el 14 sep (T2.3 del
plan de documentos). **No se usa sin David.** Las cuatro cuentas demo se borran, y la resiembra las
vuelve a crear sin contraseña.
