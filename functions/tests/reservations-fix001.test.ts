import { describe, expect, it } from "vitest";

import { evaluarReglasDeReserva, type ContextoDecision } from "../src/reservations";

/**
 * `PRD-V-FIX-001` — las trece reglas de una reserva, decididas en el servidor.
 *
 * Se prueba la función pura, igual que `calcularSaldo` en payments: es el
 * cálculo QUE ESCRIBE. La interfaz puede mostrar lo que quiera; si los dos
 * divergen, manda esto.
 *
 * `ahora` se inyecta siempre: una prueba de anticipación que dependa del reloj
 * real es una prueba que falla los viernes a las 21:45.
 */

const AHORA = new Date("2026-08-21T10:00:00");

function contexto(overrides: Partial<ContextoDecision> = {}): ContextoDecision {
  return {
    amenity: {},
    reservasDelDia: [],
    usoMensualDeLaUnidad: 0,
    saldoVencido: null,
    ahora: AHORA,
    ...overrides,
  };
}

const CANDIDATA = { date: "2026-08-22", startTime: "10:00", endTime: "11:00", unitId: "u-1" };

describe("FIX-001 · camino feliz", () => {
  it("una reserva válida con el área sin restricciones pasa", () => {
    expect(evaluarReglasDeReserva(CANDIDATA, contexto())).toEqual({ ok: true });
  });
});

describe("FIX-001 · rango y anticipación", () => {
  it("fin antes del inicio es rango inválido", () => {
    const r = evaluarReglasDeReserva({ ...CANDIDATA, startTime: "11:00", endTime: "10:00" }, contexto());
    expect(r).toMatchObject({ ok: false, regla: "rango_invalido" });
  });

  it("reservar dentro de los 30 minutos siguientes es rechazado", () => {
    const r = evaluarReglasDeReserva(
      { ...CANDIDATA, date: "2026-08-21", startTime: "10:15", endTime: "11:00" },
      contexto(),
    );
    expect(r).toMatchObject({ ok: false, regla: "anticipacion" });
  });

  it("reservar con 31 minutos de anticipación pasa", () => {
    const r = evaluarReglasDeReserva(
      { ...CANDIDATA, date: "2026-08-21", startTime: "10:31", endTime: "11:31" },
      contexto(),
    );
    expect(r).toEqual({ ok: true });
  });
});

describe("FIX-001 · día disponible", () => {
  // 2026-08-22 es sábado (getDay() = 6).
  it("un día de la semana fuera de la lista es rechazado", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ amenity: { availableWeekdays: [1, 2, 3] } }));
    expect(r).toMatchObject({ ok: false, regla: "dia_no_disponible" });
  });

  it("el día correcto de la semana pasa", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ amenity: { availableWeekdays: [6] } }));
    expect(r).toEqual({ ok: true });
  });

  it("una fecha bloqueada es rechazada aunque el día de semana sirva", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ amenity: { blockedDates: ["2026-08-22"] } }));
    expect(r).toMatchObject({ ok: false, regla: "dia_no_disponible" });
  });

  it("las fechas de unavailableDates cuentan igual que blockedDates", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ amenity: { unavailableDates: ["2026-08-22"] } }));
    expect(r).toMatchObject({ ok: false, regla: "dia_no_disponible" });
  });

  it("antes de la ventana de vigencia del área es rechazada", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ amenity: { availabilityStartDate: "2026-09-01" } }));
    expect(r).toMatchObject({ ok: false, regla: "dia_no_disponible" });
  });

  it("después de la ventana de vigencia es rechazada", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ amenity: { availabilityEndDate: "2026-08-01" } }));
    expect(r).toMatchObject({ ok: false, regla: "dia_no_disponible" });
  });
});

describe("FIX-001 · ventana horaria y duración", () => {
  it("fuera del horario de operación es rechazada", () => {
    const r = evaluarReglasDeReserva(
      { ...CANDIDATA, startTime: "22:00", endTime: "23:00" },
      contexto({ amenity: { operatingHoursStart: "08:00", operatingHoursEnd: "20:00" } }),
    );
    expect(r).toMatchObject({ ok: false, regla: "fuera_de_ventana" });
  });

  it("dentro del horario de operación pasa", () => {
    const r = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ amenity: { operatingHoursStart: "08:00", operatingHoursEnd: "20:00" } }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("sin horario explícito mandan los turnos configurados", () => {
    const r = evaluarReglasDeReserva(
      { ...CANDIDATA, startTime: "07:00", endTime: "08:00" },
      contexto({ amenity: { reservationSlots: ["09:00 - 12:00", "14:00 - 18:00"] } }),
    );
    expect(r).toMatchObject({ ok: false, regla: "fuera_de_ventana" });
  });

  // La ventana por defecto (06:00–22:00) es la que aplica la interfaz cuando
  // el área no configura nada. El servidor debe coincidir.
  it("sin configuración alguna aplica la ventana por defecto", () => {
    const dentro = evaluarReglasDeReserva({ ...CANDIDATA, startTime: "06:00", endTime: "07:00" }, contexto());
    const fuera = evaluarReglasDeReserva({ ...CANDIDATA, startTime: "05:00", endTime: "06:00" }, contexto());
    expect(dentro).toEqual({ ok: true });
    expect(fuera).toMatchObject({ ok: false, regla: "fuera_de_ventana" });
  });

  it("superar la duración máxima es rechazado nombrando el tope", () => {
    const r = evaluarReglasDeReserva(
      { ...CANDIDATA, startTime: "10:00", endTime: "12:30" },
      contexto({ amenity: { maxReservationDurationMinutes: 120 } }),
    );
    expect(r).toMatchObject({ ok: false, regla: "duracion_maxima" });
    if (!r.ok) expect(r.mensaje).toContain("120");
  });
});

describe("FIX-001 · mora", () => {
  it("con saldo vencido la reserva es rechazada", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ saldoVencido: 140.4 }));
    expect(r).toMatchObject({ ok: false, regla: "mora" });
  });

  // `null` significa «la política no aplica» — apagada o unidad exenta — y es
  // distinto de cero. La distinción es la que preserva la exención por unidad.
  it("saldoVencido null (política apagada o exenta) no bloquea", () => {
    expect(evaluarReglasDeReserva(CANDIDATA, contexto({ saldoVencido: null }))).toEqual({ ok: true });
  });

  it("saldo vencido de cero no bloquea", () => {
    expect(evaluarReglasDeReserva(CANDIDATA, contexto({ saldoVencido: 0 }))).toEqual({ ok: true });
  });
});

describe("FIX-001 · cupo mensual", () => {
  it("con el cupo agotado es rechazada nombrando el cupo", () => {
    const r = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ amenity: { maxReservationsPerUnitPerMonth: 2 }, usoMensualDeLaUnidad: 2 }),
    );
    expect(r).toMatchObject({ ok: false, regla: "cupo_mensual" });
    if (!r.ok) expect(r.mensaje).toContain("2");
  });

  it("por debajo del cupo pasa", () => {
    const r = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ amenity: { maxReservationsPerUnitPerMonth: 2 }, usoMensualDeLaUnidad: 1 }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("sin cupo configurado no hay límite", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ usoMensualDeLaUnidad: 99 }));
    expect(r).toEqual({ ok: true });
  });
});

describe("FIX-001 · aforo y solapamiento", () => {
  const OCUPADO = { unitId: "u-2", status: "approved", startTime: "10:00", endTime: "11:00" };

  // Es LA corrección de fondo: el navegador solo veía las reservas de la
  // propia unidad, así que dos unidades podían tomar el mismo turno. El
  // servidor ve todas.
  it("el turno tomado por OTRA unidad bloquea con aforo 1", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ reservasDelDia: [OCUPADO] }));
    expect(r).toMatchObject({ ok: false, regla: "aforo" });
  });

  it("con aforo 2 el segundo entra y el tercero no", () => {
    const dos = [OCUPADO, { ...OCUPADO, unitId: "u-3" }];
    const conUna = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ amenity: { maxReservationsPerSlot: 2 }, reservasDelDia: [OCUPADO] }),
    );
    const conDos = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ amenity: { maxReservationsPerSlot: 2 }, reservasDelDia: dos }),
    );
    expect(conUna).toEqual({ ok: true });
    expect(conDos).toMatchObject({ ok: false, regla: "aforo" });
  });

  it("una reserva cancelada no ocupa el turno", () => {
    const r = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ reservasDelDia: [{ ...OCUPADO, status: "cancelled" }] }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("una reserva rechazada no ocupa el turno", () => {
    const r = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ reservasDelDia: [{ ...OCUPADO, status: "rejected" }] }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("rangos que no se tocan conviven", () => {
    const r = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ reservasDelDia: [{ ...OCUPADO, startTime: "11:00", endTime: "12:00" }] }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("una reserva vieja sin startTime/endTime cuenta por su slot", () => {
    const r = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({ reservasDelDia: [{ unitId: "u-2", status: "approved", slot: "10:00 - 11:00" }] }),
    );
    expect(r).toMatchObject({ ok: false, regla: "aforo" });
  });
});

describe("FIX-001 · orden de las reglas", () => {
  // El mensaje nombra UNA causa. Si hay varias incumplidas, gana la más
  // barata de comprobar — y la de mora va antes que el aforo para que el
  // mensaje al moroso sea el de pago, no el de horario.
  it("con mora Y turno ocupado, el mensaje es el de mora", () => {
    const r = evaluarReglasDeReserva(
      CANDIDATA,
      contexto({
        saldoVencido: 100,
        reservasDelDia: [{ unitId: "u-2", status: "approved", startTime: "10:00", endTime: "11:00" }],
      }),
    );
    expect(r).toMatchObject({ ok: false, regla: "mora" });
  });
});
