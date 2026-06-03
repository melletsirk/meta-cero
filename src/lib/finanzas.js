/**
 * Convierte Tasa Efectiva Anual (TEA) a Tasa Efectiva Mensual (TEM)
 * Fórmula: TEM = ( (1 + TEA)^(1/12) ) - 1
 * @param {number} tea Tasa Efectiva Anual en porcentaje (ej: 15.5 para 15.5%)
 * @returns {number} Tasa Efectiva Mensual en decimal (ej: 0.012 para 1.2%)
 */
export function calcularTasaMensual(tea) {
  if (!tea) return 0;
  const teaDecimal = tea / 100;
  return Math.pow(1 + teaDecimal, 1 / 12) - 1;
}

/**
 * Formatea un número a moneda peruana (S/.)
 * @param {number} monto 
 * @returns {string} Monto formateado
 */
export function formatearMonedaPeru(monto) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(monto || 0);
}

/**
 * Genera un cronograma de pagos usando el Sistema Francés (Cuota Fija)
 * @param {number} monto Monto original del préstamo
 * @param {number} tea Tasa Efectiva Anual (porcentaje)
 * @param {number} plazo Número de meses / cuotas
 * @param {Date|string} fechaInicio Fecha de desembolso
 * @param {number} seguroDesgravamen Monto fijo de seguro por cuota (opcional)
 * @returns {Array} Array de cuotas con capital, interes, seguro y total
 */
export function generarCronogramaFrances(monto, tea, plazo, fechaInicio, seguroDesgravamen = 0) {
  const tem = calcularTasaMensual(tea);
  
  // Cálculo de cuota base (Capital + Interés)
  // Fórmula: C = P * [ i(1+i)^n ] / [ (1+i)^n - 1 ]
  let cuotaBase = 0;
  if (tem > 0) {
    const factor = Math.pow(1 + tem, plazo);
    cuotaBase = monto * ((tem * factor) / (factor - 1));
  } else {
    cuotaBase = monto / plazo;
  }

  const cuotas = [];
  let saldoPendiente = monto;
  let fechaActual = new Date(fechaInicio);

  for (let i = 1; i <= plazo; i++) {
    // Calcular siguiente fecha (sumar 1 mes)
    fechaActual = new Date(fechaActual.setMonth(fechaActual.getMonth() + 1));
    
    let interes = saldoPendiente * tem;
    let capital = cuotaBase - interes;
    
    // Ajuste en la última cuota por redondeos
    if (i === plazo) {
      capital = saldoPendiente;
      cuotaBase = capital + interes;
    }
    
    saldoPendiente -= capital;
    if (saldoPendiente < 0.01) saldoPendiente = 0;

    cuotas.push({
      numero: i,
      fecha: fechaActual.toISOString().split('T')[0],
      capital: Number(capital.toFixed(2)),
      interes: Number(interes.toFixed(2)),
      seguro: Number(seguroDesgravamen.toFixed(2)),
      total: Number((cuotaBase + seguroDesgravamen).toFixed(2)),
      saldo_pendiente: Number(saldoPendiente.toFixed(2)),
      pagada: false,
      modo: 'calculado'
    });
  }

  return cuotas;
}

/**
 * Estrategia Bola de Nieve: Ordena las deudas por menor saldo pendiente
 */
export function estrategiaBolaDeNieve(deudas) {
  return [...deudas].sort((a, b) => a.monto_pendiente - b.monto_pendiente);
}

/**
 * Estrategia Avalancha: Ordena las deudas por mayor tasa de interés (TEA)
 */
export function estrategiaAvalancha(deudas) {
  return [...deudas].sort((a, b) => (b.tea || 0) - (a.tea || 0));
}
