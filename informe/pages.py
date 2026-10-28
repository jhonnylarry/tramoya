import subprocess,json,re
txt=subprocess.run(["pdftotext","-layout","Informe_EP3_ISY1102_Jonathan_Larraguibel.pdf","-"],capture_output=True,text=True).stdout
pages=txt.split("\f")
idx=[("1","1. Introducción"),("2","2. Criterios de calidad"),("3","3. Plan de pruebas"),("3.1","3.1 Estrategia de pruebas"),("3.2","3.2 Tipos de prueba"),("3.3","3.3 Criterios de aceptación"),("3.4","3.4 Herramientas utilizadas"),("3.5","3.5 Trazabilidad con el ERS"),("3.6","3.6 Análisis de cobertura y coherencia"),("3.7","3.7 Objetivos, alcance y cronograma"),("4","4. Diseño de casos de prueba"),("5","5. Ejecución de pruebas"),("5.1","5.1 Resumen de ejecución"),("5.2","5.2 Detalle de ejecución de casos"),("5.3","5.3 Criticidad de incidentes"),("6","6. Análisis ético y normativo"),("7","7. Conclusiones y recomendaciones"),("8","8. Informe de certificación final"),("A","Anexo A. Evidencia de ejecución"),("B","Anexo B. Descripción del producto")]
out={}
for k,t in idx:
    for i,p in enumerate(pages):
        if i<2: continue
        if any(l.strip().startswith(t) for l in p.splitlines()):
            out[k]=str(i+1); break
json.dump(out,open("pages.json","w")); print(out, len(pages)-1)
