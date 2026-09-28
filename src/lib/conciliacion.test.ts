import { describe, expect, it } from "vitest";
import {
  conciliar,
  type CuentaDestino,
  type ExtraccionComprobante,
  type MovimientoParaConciliar,
  type OpcionesConciliacion,
  type SolicitudParaConciliar,
} from "./conciliacion";

// Tests de las 9 reglas de conciliación (SPEC 12). conciliar() es una función
// pura: sin red ni DB, así que estos casos son la red de regresión real antes
// de repetir transferencias de prueba de verdad. Cubren los casos que la spec
// enumera como "manual test" para cada regla.

const CUENTA: CuentaDestino = {
  alias: "prode.cobros.mp",
  cbu: "0000003100000000123456",
  titular: "Prode SRL",
};

function solicitud(overrides: Partial<SolicitudParaConciliar> = {}): SolicitudParaConciliar {
  return {
    monto_a_transferir: 5000.37,
    created_at: "2026-09-28T12:00:00-03:00",
    expira_en: "2026-09-30T12:00:00-03:00",
    ...overrides,
  };
}

function extraccion(overrides: Partial<ExtraccionComprobante> = {}): ExtraccionComprobante {
  return {
    es_comprobante: true,
    legible: true,
    monto: 5000.37,
    moneda: "ARS",
    fecha: "2026-09-28",
    hora: "12:05",
    remitente_nombre: "Juan Perez",
    remitente_documento: "20-12345678-9",
    destinatario_nombre: "Prode SRL",
    destinatario_alias: "prode.cobros.mp",
    destinatario_cbu: "0000003100000000123456",
    numero_operacion: "123456789",
    banco_o_billetera: "Mercado Pago",
    senales_sospechosas: [],
    confianza: 0.97,
    ...overrides,
  };
}

function movimiento(overrides: Partial<MovimientoParaConciliar> = {}): MovimientoParaConciliar {
  return {
    monto: 5000.37,
    direccion: "ingreso",
    estado_mp: "approved",
    fecha_acreditacion: "2026-09-28T12:05:00-03:00",
    pagador_nombre: "Juan Perez",
    pagador_documento: "20-12345678-9",
    numero_operacion: "123456789",
    consumido: false,
    ...overrides,
  };
}

function opciones(overrides: Partial<OpcionesConciliacion> = {}): OpcionesConciliacion {
  return {
    cuenta: CUENTA,
    exigirRemitente: true,
    duplicado: false,
    ...overrides,
  };
}

function reglaOk(reglas: ReturnType<typeof conciliar>["reglas"], codigo: string): boolean {
  const regla = reglas.find((r) => r.codigo === codigo);
  if (!regla) throw new Error(`No se encontró la regla ${codigo}`);
  return regla.ok;
}

describe("conciliar", () => {
  it("aprueba cuando todo coincide", () => {
    const resultado = conciliar(solicitud(), extraccion(), movimiento(), opciones());
    expect(resultado.aprobar).toBe(true);
    expect(resultado.motivos).toEqual([]);
    expect(resultado.reglas.every((r) => r.ok)).toBe(true);
  });

  it("R2 falla si el monto difiere en un centavo", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ monto: 5000.36 }),
      movimiento(),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R2")).toBe(false);
    expect(resultado.aprobar).toBe(false);
    expect(resultado.motivos.some((m) => m.startsWith("R2"))).toBe(true);
  });

  it("R5 falla si el remitente del comprobante es otra persona", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ remitente_nombre: "Maria Lopez", remitente_documento: null }),
      movimiento(),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R5")).toBe(false);
    expect(resultado.aprobar).toBe(false);
  });

  it("R5 pasa con un nombre abreviado en el comprobante (iniciales)", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ remitente_nombre: "J Perez", remitente_documento: null }),
      movimiento({ pagador_documento: null }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R5")).toBe(true);
  });

  it("R5 pasa con un documento parcialmente enmascarado que coincide en los últimos dígitos", () => {
    const resultado = conciliar(
      solicitud(),
      // El comprobante no muestra el nombre del remitente, solo el documento
      // enmascarado (habitual en algunos bancos): alcanza con que el
      // documento sea compatible con el pagador real.
      extraccion({ remitente_nombre: null, remitente_documento: "***5678-9" }),
      movimiento({ pagador_nombre: "Juan Perez", pagador_documento: "20-12345678-9" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R5")).toBe(true);
  });

  it("R5 falla si el documento del remitente no coincide, aunque el nombre sea parecido", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ remitente_nombre: "Juan Perez", remitente_documento: "27-99999999-1" }),
      movimiento({ pagador_nombre: "Juan Perez", pagador_documento: "20-12345678-9" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R5")).toBe(false);
  });

  it("R5 se omite si Mercado Pago no informa remitente y no se exige", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ remitente_nombre: "Juan Perez" }),
      movimiento({ pagador_nombre: null, pagador_documento: null }),
      opciones({ exigirRemitente: false }),
    );
    expect(reglaOk(resultado.reglas, "R5")).toBe(true);
  });

  it("R5 falla si Mercado Pago no informa remitente pero se exige (default)", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ remitente_nombre: "Juan Perez" }),
      movimiento({ pagador_nombre: null, pagador_documento: null }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R5")).toBe(false);
  });

  it("R8 falla si el comprobante ya se usó en otra solicitud", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion(),
      movimiento(),
      opciones({ duplicado: true }),
    );
    expect(reglaOk(resultado.reglas, "R8")).toBe(false);
    expect(resultado.aprobar).toBe(false);
  });

  it("R4 pasa con un comprobante sin hora del mismo día calendario", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ hora: null }),
      movimiento({ fecha_acreditacion: "2026-09-28T23:50:00-03:00" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R4")).toBe(true);
  });

  it("R4 falla con un comprobante de otro día", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ fecha: "2026-09-27", hora: null }),
      movimiento({ fecha_acreditacion: "2026-09-28T12:05:00-03:00" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R4")).toBe(false);
    expect(resultado.aprobar).toBe(false);
  });

  it("R4 falla si la hora difiere más de la tolerancia (15 min)", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ hora: "12:05" }),
      movimiento({ fecha_acreditacion: "2026-09-28T12:25:00-03:00" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R4")).toBe(false);
  });

  it("R1 falla si la imagen no es un comprobante", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ es_comprobante: false, legible: false, monto: null, confianza: 0 }),
      null,
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R1")).toBe(false);
    expect(resultado.aprobar).toBe(false);
  });

  it("R1 falla si hay señales sospechosas aunque el resto sea coherente", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ senales_sospechosas: ["tipografía inconsistente en el monto"] }),
      movimiento(),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R1")).toBe(false);
  });

  it("R6 falla si el destinatario no es la cuenta del prode", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({
        destinatario_alias: "otra.cuenta.mp",
        destinatario_cbu: "9999999999999999999999",
        destinatario_nombre: "Otra Persona",
      }),
      movimiento(),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R6")).toBe(false);
    expect(resultado.aprobar).toBe(false);
  });

  it("no aprueba mientras no aparece el movimiento en la cuenta y queda esperando", () => {
    const resultado = conciliar(solicitud(), extraccion(), null, opciones());
    expect(resultado.aprobar).toBe(false);
    expect(resultado.esperandoMovimiento).toBe(true);
    // R1, R2, R6 y R8 no dependen del movimiento y ya deberían pasar.
    expect(reglaOk(resultado.reglas, "R1")).toBe(true);
    expect(reglaOk(resultado.reglas, "R2")).toBe(true);
    expect(reglaOk(resultado.reglas, "R6")).toBe(true);
    expect(reglaOk(resultado.reglas, "R8")).toBe(true);
  });

  it("no queda esperandoMovimiento si además hay otra regla independiente que ya falló", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ monto: 999 }),
      null,
      opciones(),
    );
    expect(resultado.aprobar).toBe(false);
    expect(resultado.esperandoMovimiento).toBe(false);
  });

  it("R3 falla si el movimiento ya fue consumido por otra solicitud", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion(),
      movimiento({ consumido: true }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R3")).toBe(false);
    expect(resultado.aprobar).toBe(false);
  });

  it("R3 falla si el movimiento es un egreso", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion(),
      movimiento({ direccion: "egreso" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R3")).toBe(false);
  });

  it("R7 no penaliza cuando el comprobante es de otro banco con número distinto", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ numero_operacion: "OP-BANCO-999", banco_o_billetera: "Banco Nación" }),
      movimiento({ numero_operacion: "123456789" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R7")).toBe(true);
  });

  it("R7 falla si el comprobante es de Mercado Pago y el número no coincide", () => {
    const resultado = conciliar(
      solicitud(),
      extraccion({ numero_operacion: "000000000", banco_o_billetera: "Mercado Pago" }),
      movimiento({ numero_operacion: "123456789" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R7")).toBe(false);
  });

  it("R9 falla si la acreditación ocurrió después de vencer la reserva", () => {
    const resultado = conciliar(
      solicitud({ expira_en: "2026-09-28T12:00:00-03:00" }),
      extraccion(),
      movimiento({ fecha_acreditacion: "2026-09-28T13:00:00-03:00" }),
      opciones(),
    );
    expect(reglaOk(resultado.reglas, "R9")).toBe(false);
    expect(resultado.aprobar).toBe(false);
  });
});
