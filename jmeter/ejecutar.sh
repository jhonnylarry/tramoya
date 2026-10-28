#!/bin/sh
# Ejecuta el plan JMeter en modo no grafico contra un servidor limpio. Uso: ./jmeter/ejecutar.sh <usuarios>
set -e
N=${1:-10}
PUERTO=3200
lsof -ti:$PUERTO | xargs kill 2>/dev/null || true
sleep 1
PORT=$PUERTO JWT_SECRET=clave-jmeter node src/server.js > /dev/null 2>&1 &
SRV=$!
for i in $(seq 1 60); do curl -sf http://127.0.0.1:$PUERTO/api/health >/dev/null && break; sleep 0.5; done
ARGS=$(node jmeter/preparar.js http://127.0.0.1:$PUERTO)
rm -rf evidencia/jmeter_$N evidencia/jmeter_$N.jtl
jmeter -n -t jmeter/plan_tramoya.jmx $ARGS -Jhost=127.0.0.1 -Jpuerto=$PUERTO -Jusuarios=$N -Jrampa=5 -Jduracion=30 \
  -l evidencia/jmeter_$N.jtl -e -o evidencia/jmeter_$N > evidencia/jmeter_$N.txt 2>&1
kill $SRV
tail -3 evidencia/jmeter_$N.txt
