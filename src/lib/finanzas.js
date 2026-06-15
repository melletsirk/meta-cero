/**
 * ============================================================
 * finanzas.js — Cálculos financieros para el sistema peruano
 * ============================================================
 */

// ---------------------------------------------------------------------------
// FRECUENCIAS DE PAGO
// ---------------------------------------------------------------------------

export const FRECUENCIAS = {
  mensual:    { label: 'Mensual',              dias: 30,  periodosPorAnio: 12   },
  quincenal:  { label: 'Quincenal (15 días)',   dias: 15,  periodosPorAnio: 24   },
  catorcenal: { label: 'Catorcenal (14 días)',  dias: 14,  periodosPorAnio: 26.07 },
  semanal:    { label: 'Semanal (7 días)',       dias: 7,   periodosPorAnio: 52   },
  cuota_unica:{ label: 'Cuota Única al vencer', dias: null, periodosPorAnio: 1   },
}

// ---------------------------------------------------------------------------
// TASAS PERIÓDICAS
// ---------------------------------------------------------------------------

/**
 * Calcula la tasa periódica efectiva a partir de la TEA.
 * Fórmulas según el sistema financiero peruano:
 *   Mensual    : (1 + TEA)^(1/12)    - 1
 *   Quincenal  : (1 + TEA)^(15/365)  - 1
 *   Catorcenal : (1 + TEA)^(14/365)  - 1
 *   Semanal    : (1 + TEA)^(7/365)   - 1
 *
 * @param {number} tea - TEA en porcentaje (ej: 24 para 24%)
 * @param {string} frecuencia - Clave de FRECUENCIAS
 * @returns {number} Tasa periódica en decimal
 */
export function calcularTasaPeriodica(tea, frecuencia = 'mensual', base = 365) {
  if (!tea || tea <= 0) return 0
  const teaDec = tea / 100

  switch (frecuencia) {
    case 'mensual':
      // Para mensual la base no cambia la fórmula (1/12 de año)
      return Math.pow(1 + teaDec, 1 / 12) - 1
    case 'quincenal':
      return Math.pow(1 + teaDec, 15 / base) - 1
    case 'catorcenal':
      return Math.pow(1 + teaDec, 14 / base) - 1
    case 'semanal':
      return Math.pow(1 + teaDec, 7 / base) - 1
    case 'cuota_unica':
      return teaDec  // se usa directamente en el cálculo de cuota única
    default:
      return Math.pow(1 + teaDec, 1 / 12) - 1
  }
}

// ---------------------------------------------------------------------------
// ALERTAS DE TEA
// ---------------------------------------------------------------------------

/**
 * Devuelve el nivel y mensaje de alerta según la TEA ingresada.
 * Rangos del sistema financiero peruano (SBS):
 *   < 8%      → Inusualmente baja
 *   8%–80%    → Rango normal formal
 *   80%–300%  → Alta (fintechs / emergencia)
 *   > 300%    → Muy alta (crédito informal)
 *
 * @param {number|null} tea - TEA en porcentaje
 * @returns {{ level: 'none'|'yellow'|'green'|'orange'|'red', mensaje: string }}
 */
export function alertaTEA(tea) {
  if (tea === null || tea === undefined || tea === '' || isNaN(Number(tea))) {
    return { level: 'none', mensaje: '' }
  }
  const t = Number(tea)
  if (t < 8) {
    return {
      level: 'yellow',
      mensaje: 'Tasa inusualmente baja, verifica que sea correcta.'
    }
  }
  if (t <= 80) {
    return {
      level: 'green',
      mensaje: 'Tasa dentro del rango normal del sistema financiero formal.'
    }
  }
  if (t <= 300) {
    return {
      level: 'orange',
      mensaje: 'Tasa alta, típica de fintechs o créditos de emergencia. Considera refinanciar si es posible.'
    }
  }
  return {
    level: 'red',
    mensaje: 'Tasa muy alta, típica de crédito informal. Prioriza saldar esta deuda cuanto antes.'
  }
}

// ---------------------------------------------------------------------------
// MONEDA
// ---------------------------------------------------------------------------

/**
 * Formatea un monto en la moneda indicada.
 * Formato peruano: S/ 1,250.00 | $ 1,250.00
 *
 * @param {number} monto
 * @param {'PEN'|'USD'} moneda
 * @returns {string}
 */
export function formatearMoneda(monto, moneda = 'PEN') {
  if (moneda === 'USD') {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto || 0)
  }
  // PEN — la API de Intl genera "S/ " en es-PE
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto || 0)
}

/**
 * Retorna el símbolo o prefijo de la moneda.
 * @param {'PEN'|'USD'} moneda
 * @returns {string}
 */
export function simboloMoneda(moneda = 'PEN') {
  return moneda === 'USD' ? '$' : 'S/'
}

// ---------------------------------------------------------------------------
// CRONOGRAMA FRANCÉS (cuota fija)
// ---------------------------------------------------------------------------

/**
 * Genera el cronograma de pagos con Sistema Francés para cualquier frecuencia.
 * Si el usuario sólo tiene TCEA (sin TEA pura), se puede pasar tcea=true en
 * opciones para marcar las cuotas como aproximadas.
 *
 * @param {number}        monto              Capital inicial
 * @param {number}        tea                TEA en porcentaje (o TCEA si esAproximado=true)
 * @param {number}        numCuotas          Número de cuotas
 * @param {Date|string}   fechaInicio        Fecha de desembolso
 * @param {string}        frecuencia         Clave de FRECUENCIAS ('mensual', etc.)
 * @param {boolean}       esAproximado       true si se usa TCEA en lugar de TEA pura
 * @returns {Array}       Array de cuotas
 */
export function generarCronogramaFrances(monto, tea, numCuotas, fechaInicio, fechaPrimerPago, frecuencia = 'mensual', esAproximado = false, base = 365, redondearCuota = false) {
  // Cuota única: no hay amortización progresiva
  if (frecuencia === 'cuota_unica') {
    return generarCuotaUnica(monto, tea, fechaInicio, fechaPrimerPago, esAproximado)
  }

  const tasaInteres = calcularTasaPeriodica(tea, frecuencia, base)
  const dias = FRECUENCIAS[frecuencia]?.dias ?? 30
  
  const tasaTotal = tasaInteres

  // Cuota base (capital + interés), fórmula francesa
  let cuotaBase = 0
  if (tasaTotal > 0) {
    const factor = Math.pow(1 + tasaTotal, numCuotas)
    cuotaBase = monto * ((tasaTotal * factor) / (factor - 1))
  } else {
    cuotaBase = monto / numCuotas
  }

  // Algunas cooperativas/cajas redondean la cuota al entero superior
  // y ajustan la última cuota automáticamente
  if (redondearCuota) {
    cuotaBase = Math.ceil(cuotaBase)
  }

  const cuotas = []
  let saldo = monto
  let fechaActual = new Date(fechaPrimerPago || fechaInicio)

  for (let i = 1; i <= numCuotas; i++) {
    if (i > 1) {
      fechaActual = avanzarFecha(fechaActual, frecuencia, dias)
    }

    // Truncar interés a 2 decimales (como hacen las cooperativas)
    const interesExacto = saldo * tasaInteres
    const interes = redondearCuota
      ? Math.floor(interesExacto * 100) / 100
      : Number(interesExacto.toFixed(2))

    let cuotaPeriodo = cuotaBase
    let capital = cuotaPeriodo - interes

    // Ajuste en última cuota por redondeos acumulados
    if (i === numCuotas) {
      capital = saldo
      cuotaPeriodo = capital + interes
    }

    saldo -= capital
    if (saldo < 0.005) saldo = 0

    // Asegurar que matemáticamente el total coincida exactamente con capital + interes
    const capitalFixed = Number(capital.toFixed(2))
    const interesFixed = Number(interes.toFixed(2))
    const totalFixed = Number((capitalFixed + interesFixed).toFixed(2))

    cuotas.push({
      numero: i,
      fecha: fechaActual.toISOString().split('T')[0],
      capital: capitalFixed,
      interes: interesFixed,
      total: totalFixed,
      capital_pendiente: Number(Math.max(0, saldo).toFixed(2)),
      pagada: false,
      modo: esAproximado ? 'aproximado' : 'calculado',
    })
  }

  return cuotas
}

/**
 * Genera una cuota única al vencimiento.
 * Interés simple: I = P * TEA * (días / 365)
 * Total = P + I
 */
function generarCuotaUnica(monto, tea, fechaInicio, fechaVencimiento, esAproximado = false) {
  const teaDec = (tea || 0) / 100
  const fechaVenc = new Date(fechaVencimiento || fechaInicio)
  
  if (!fechaVencimiento) {
    fechaVenc.setFullYear(fechaVenc.getFullYear() + 1) // 1 año por defecto para cuota única
  }

  const diasPrestamo = Math.max(0, Math.round(
    (fechaVenc - new Date(fechaInicio)) / (1000 * 60 * 60 * 24)
  ))
  const interes = monto * teaDec * (diasPrestamo / 365)
  
  const capitalFixed = Number(monto.toFixed(2))
  const interesFixed = Number(interes.toFixed(2))
  const totalFixed = Number((capitalFixed + interesFixed).toFixed(2))

  return [{
    numero: 1,
    fecha: fechaVenc.toISOString().split('T')[0],
    capital: capitalFixed,
    interes: interesFixed,
    total: totalFixed,
    capital_pendiente: 0,
    pagada: false,
    modo: esAproximado ? 'aproximado' : 'calculado',
  }]
}

/**
 * Avanza la fecha según la frecuencia de pago.
 */
function avanzarFecha(fecha, frecuencia, dias) {
  const d = new Date(fecha)
  switch (frecuencia) {
    case 'mensual':
      d.setMonth(d.getMonth() + 1)
      break
    default:
      d.setDate(d.getDate() + dias)
  }
  return d
}


