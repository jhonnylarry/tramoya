// RF-5.4: estado del evento segun confirmacion y fecha
// cotizado: aun no confirmado; confirmado: confirmado y a mas de 30 dias;
// proximo: confirmado y a 30 dias o menos; realizado: confirmado y con fecha pasada
function calcularEstado(fechaEvento, confirmado, hoy = new Date()) {
  if (!confirmado) return 'cotizado';
  const dia = hoy.toISOString().slice(0, 10);
  if (fechaEvento < dia) return 'realizado';
  const dias = Math.ceil((new Date(fechaEvento) - new Date(dia)) / 86400000);
  if (dias <= 30) return 'proximo';
  return 'confirmado';
}
module.exports = { calcularEstado };
