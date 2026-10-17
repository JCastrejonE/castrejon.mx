---
title: Recocido simulado para el problema del agente viajero
description: Mi solver en C++ de 2019 para el agente viajero con 40 y 150 ciudades del mundo, re-ejecutado en 2026 para reproducir sus resultados y verificar su artículo.
summary: Un programa de recocido simulado de 2019 para el problema del agente viajero, re-ejecutado en octubre de 2026. La revisión de 2019 del código reprodujo exactamente su resultado de 150 ciudades, 0.164943812, y la re-ejecución midió lo que el artículo solo había mostrado en gráficas.
abstract: >-
  El problema del agente viajero (traveling salesman problem) busca la ruta más corta que pasa por un conjunto de ciudades. En 2019, para el curso de Heurísticas de Optimización Combinatoria de la Facultad de Ciencias de la UNAM, escribí un programa en C++ para resolverlo y un artículo de 10 páginas en español. El programa busca el camino abierto más corto entre 40 o 150 de las 1,092 ciudades de la base de datos del proyecto, donde solo 187 de los 780 pares entre las 40 ciudades tienen conexión. Usa recocido simulado (simulated annealing) y termina con una búsqueda local por intercambio de pares. El artículo presentó tres gráficas y ningún número, así que el código se volvió a ejecutar en octubre de 2026. La revisión de 2019 reprodujo su resultado de 150 ciudades, un costo de 0.164943812, con la misma secuencia de 922,000 costos aceptados. Con 40 ciudades, el código del repositorio alcanzó el mejor costo registrado, 0.308330781, en 26 de 100 semillas, y el primer conjunto de parámetros del artículo no lo alcanzó en ninguna.
date: '2019-05'
context: 'Proyecto del curso · Heurísticas de Optimización Combinatoria · Facultad de Ciencias, UNAM'
group: academic
order: 1
repo: https://github.com/JCastrejonE/TSP_SimulatedAnnealing
links:
  - label: 'Artículo (PDF, en español)'
    href: https://github.com/JCastrejonE/TSP_SimulatedAnnealing/blob/master/tex/Recocido_Simulado.pdf
  - label: 'Relacionado: colonia de hormigas para la cobertura de vértices de peso mínima'
    href: /es/research/vertex-cover-ant-colony/
  - label: 'Relacionado: empaquetado en contenedores con una heurística de reencarnación'
    href: /es/research/bin-packing-reincarnation/
---

## El problema

Mi artículo, <i lang="es">Algoritmo de Recocido Simulado para el problema del Agente Viajero</i> (mayo de 2019), define el problema del agente viajero (traveling salesman problem) de la forma usual: dado un conjunto de ciudades y la distancia entre cada par, encontrar la ruta más corta que visita cada ciudad exactamente una vez y regresa al punto de partida (`tex/main.tex:35`). La función de costo del artículo (`main.tex:69`), el documento del curso y el código suman solo los tramos consecutivos, así que el programa en realidad minimiza un camino abierto, sin tramo de regreso. Todo lo que sigue usa esa definición, ya que es la que produce los resultados.

Las ciudades vienen de la base de datos SQLite del repositorio (`db/tsp.db`). Contiene 1,092 ciudades de 135 países, con latitud y longitud, y 123,403 conexiones entre pares de ciudades, cada una con una distancia. El documento del curso describe esta gráfica como "muy densa" y no completa, y dentro de una sola instancia la mayoría de los pares de ciudades no tiene conexión:

| Archivo de instancia | Ciudades | Pares con conexión |
|---|---|---|
| `inputs/instancia40.txt` | 40 | 187 de 780 |
| `inputs/instancia40_.txt` | 40 | 183 de 780 |
| `inputs/instancia150.txt` | 150 | 2,608 de 11,175 |
| `inputs/instancia150_.txt` | 150 | 2,632 de 11,175 |

Los dos archivos cuyo nombre termina en `_` se subieron al repositorio el 26 de marzo de 2019 y difieren de los originales en dos ciudades cada uno. El artículo nunca dice qué archivo usó y solo menciona "una instancia de TSP con 40 ciudades", así que este ensayo compara contra `instancia40.txt`, que tiene las mismas ciudades que los archivos de resultados de 2019.

### La función de costo

El documento del curso <i lang="es">Función de costo para TSP</i> de Canek Peláez (`pdf/fcosto.pdf`, 13 de febrero de 2019) define el costo, y el código lo implementa (`src/Annealing.cpp:92-169`). Para una instancia S:

- El normalizador N(S) es la suma de las |S| − 1 distancias de conexión más grandes entre las ciudades de S, y max_d(S) es la mayor de ellas.
- La distancia natural d(u, v) es la distancia haversine con R = 6,373,000 m.
- El peso aumentado de un tramo es su distancia almacenada cuando la conexión existe, y d(u, v) × max_d(S) cuando no existe.
- El costo de un camino es la suma de los pesos aumentados de sus tramos, dividida entre N(S).

Según el documento, el propósito de este diseño es que un camino que usa solo conexiones existentes se evalúe entre 0 y 1, y que cualquier camino con una conexión faltante se evalúe por encima de 1. El documento llama factibles a los caminos del primer tipo. Calculados a partir de la base de datos, N(S) = 173,613,497.69 y max_d(S) = 4,940,077.59 para `instancia40.txt`, y N(S) = 722,404,322.59 y max_d(S) = 4,978,506.48 para `instancia150.txt`. En las 123,403 conexiones, la razón entre la distancia almacenada y la distancia haversine está entre 0.9999985 y 1.0000016, así que las distancias almacenadas son distancias de círculo máximo en metros. Por lo tanto, el costo de un camino factible es su longitud en metros dividida entre N(S).

<figure>
  <img src="/research/tsp-simulated-annealing/es/tour-40.svg" width="600" height="279" alt="Mapa de 40 ciudades unidas por un solo camino abierto. Empieza en Charlotte, Estados Unidos, baja por México, Centroamérica y Sudamérica, cruza el Atlántico de Belém, Brasil, a Dakar, Senegal, sigue por el norte de África, Europa, Medio Oriente, India, Asia Central, China y el Sudeste Asiático, y termina en Tokio, Japón." loading="lazy" decoding="async">
  <figcaption>Figura 1. El mejor camino de 40 ciudades registrado: costo 0.308330781 y longitud 53,530,385.30 m. Una re-ejecución en 2026 del código del repositorio lo encontró con las semillas 7 y 10, y el archivo de resultados de 2019 tiene el mismo camino en orden inverso. Los tramos son segmentos rectos en longitud y latitud, y los puntos grises son las demás ciudades de la base de datos dentro del marco.</figcaption>
</figure>

## El método

El código sigue las notas del curso <i lang="es">Capítulo 1, Aceptación por umbrales</i> (`pdf/hoc.pdf`, procedimientos 1 a 5). Sus partes son estas:

- **Vecino.** Intercambia dos ciudades en posiciones elegidas al azar con distribución uniforme. El programa actualiza el costo en O(1) a partir de los tramos que cambian (commit `f0f1896`, 2019-03-04).
- **Aceptación.** A temperatura T, un vecino s′ del camino actual s se acepta cuando f(s′) < f(s) + T (`main.tex:92`, `Annealing.cpp:208`).
- **Lotes.** Un lote reúne L vecinos aceptados y regresa su costo promedio. También termina después de M rechazos; en el código del repositorio el contador de rechazos nunca se reinicia dentro de un lote (la línea que lo reinicia está comentada en `Annealing.cpp:223`), mientras que el pseudocódigo del artículo cuenta cada intento (`main.tex:113`).
- **Enfriamiento.** En cada temperatura, el programa ejecuta lotes mientras el promedio de cada lote no sea mayor que el del anterior, y luego multiplica T por φ. Se detiene cuando T ya no es mayor que ε (`Annealing.cpp:234-247`). Guarda el mejor camino que ha visto.
- **Inicio.** El camino inicial es una permutación aleatoria de la instancia. Una búsqueda binaria determina la temperatura a la que se acepta una fracción P de los vecinos de ese camino, empezando en T = 8 con P = 0.95. En dos re-ejecuciones instrumentadas, la búsqueda terminó en T = 948743.849456787 (40 ciudades, semilla 7) y T = 151519.968750000 (150 ciudades, semilla 4).
- **Barrido final.** Después de la fase de recocido, el código aplica una y otra vez al mejor camino el intercambio de dos ciudades que más lo mejora, hasta que ningún intercambio lo mejore (`Annealing.cpp:39-90`). Está activado por defecto y el artículo no lo describe. Una opción `--use-hybrid` ejecuta el barrido cada vez que aparece un nuevo mejor camino; las re-ejecuciones de 2026 no la usaron.

La regla de aceptación es determinista: T es el margen en el que el costo de un vecino puede exceder el costo actual y aun así aceptarse. Cada disminución de T reduce ese margen, así que el decremento lento de la temperatura que describe el artículo (`main.tex:78`) limita poco a poco cuánto peor puede ser un vecino aceptado.

En este ensayo aparecen tres conjuntos de parámetros:

| Parámetro | Código del repositorio (`2a52c94`) | Revisión de 2019 (`4f5a890`) | Figuras 1, 2, 3 del artículo |
|---|---|---|---|
| L, tamaño de lote | 3000 | 1000 | 1000, 6000, 6000 |
| M, límite de intentos por lote | 30000 (10 L) | 100000 (100 L), se reinicia con cada aceptación | 3 L |
| ε, temperatura final | 0.001 | 0.0001 | 0.01 |
| φ, factor de enfriamiento | 0.95 | 0.95 | 0.95, 0.95, 0.99 |
| P y T inicial | 0.95 y 8 | 0.95 y 8 | no se indican |
| Barrido final | activado | ausente | no se menciona |

Los valores del repositorio están en `include/Annealing.hpp:10-16`; los de la revisión de 2019, en su `include/Annealing.h:9-13` y en `src/main.cpp:89`; los del artículo, en `main.tex:195`, `:210` y `:220`.

## Lo que reportan el artículo y el historial

El artículo muestra tres gráficas de gnuplot con el costo de una de cada 500 soluciones aceptadas en una instancia de 40 ciudades, una gráfica por cada conjunto de parámetros de la tabla. No tienen pie de figura, y el artículo no reporta costos finales, semillas, tiempos de ejecución ni ninguna ejecución con 150 ciudades, aunque su resumen promete resultados comparativos de la ejecución con diferentes parámetros (`main.tex:29`). Sus conclusiones son estas:

1. Un lote más grande explora mejor el espacio de búsqueda y aumenta la probabilidad de obtener una buena solución, y también aumenta el tiempo de ejecución (`main.tex:208`).
2. Mientras más cerca de 1 esté el factor de enfriamiento, más iteraciones se realizan antes de cumplir la condición de terminación (`main.tex:218`).
3. "En los 3 casos, al probar con diferentes semillas, la mejor solución encontrada, resultó ser la misma permutación de ciudades, lo que sugiere que el ajuste de parámetros no afecta en gran medida para instancias pequeñas del problema" (`main.tex:228`).
4. En instancias más grandes, como 150 ciudades, la experimentación con los parámetros es esencial para conseguir mejores soluciones (`main.tex:230`).

Las gráficas usan un eje lineal hasta 1.2 × 10<sup>7</sup>, así que todo costo menor que aproximadamente 10<sup>5</sup> queda sobre el eje horizontal, incluida toda la fase factible.

El historial de git tiene más. El commit `4f5a890` (2019-03-06) agregó cuatro archivos de salida, y el commit `a22090f` los borró el mismo día:

- `results150.txt`, semillas 130 a 149 con 150 ciudades: 0.187759377 para la semilla 130, 0.171172030 para la semilla 131 y 0.164943812 para las semillas 132 a 149, con 73 a 94 s por semilla.
- `solution150.txt`, el camino de 150 ciudades de la semilla 132.
- `seed132.txt`, el costo de cada una de las 922,000 soluciones aceptadas con la semilla 132.
- `results_100-199.txt`, semillas 100 a 199 con 40 ciudades: 0.310470829 para las semillas 100 a 112 y 0.308330781 para las semillas 113 a 199.

En esa revisión, el mejor camino es un miembro `static` que el programa nunca reinicia entre semillas (`include/Annealing.h:27-29, 75-76`), así que cada línea reporta el mejor de todas las semillas ejecutadas hasta ese momento en el proceso. Los valores repetidos después de la semilla 132 y después de la semilla 113 vienen arrastrados de semillas anteriores. El código del repositorio reinicia el mejor camino en cada ejecución (`Annealing.cpp:22-25`).

## Lo que midió la re-ejecución

En octubre de 2026 el código se recompiló y se volvió a ejecutar en macOS (arm64) con Apple clang 21 y el SQLite del sistema, un proceso por semilla:

1. La revisión `4f5a890`, sin cambios, contra los archivos que se subieron con ella. Esa revisión tiene la semilla 132 fija en el código y lee la instancia de la entrada estándar. Para el rango de semillas 130 a 149, solo cambiaron los límites del ciclo.
2. El código del repositorio (`2a52c94`) con las cuatro instancias y las semillas 0 a 10, más las semillas 100 a 199 con `instancia40.txt` y 130 a 149 con `instancia150.txt`.
3. Los tres conjuntos de parámetros del artículo con `instancia40.txt` y las semillas 0 a 10 y 100 a 199, compilados a partir del código del repositorio cambiando solo las constantes de `include/Annealing.hpp`. El artículo no indica P, la T inicial ni las semillas, así que se mantuvieron los valores del repositorio, y el barrido final siguió activado porque el programa no tiene una forma funcional de desactivarlo.

Los puntos 2 y 3 suman 497 ejecuciones, 444 de ellas con `instancia40.txt`. Como verificación independiente, la función de costo del documento del curso se reimplementó en Python sobre la base de datos. Da 0.164943812 para el camino de 150 ciudades de 2019, y 0.310470829 y 0.308330781 para los dos caminos de 40 ciudades de 2019, y cada tramo de estos tres caminos es una conexión existente.

## Resultados

### La ejecución de 2019 con 150 ciudades se reproduce exactamente

La revisión `4f5a890` produjo el mismo camino que `solution150.txt`, con costo 0.164943812, y la misma secuencia de 922,000 costos aceptados que `seed132.txt`, en el mismo orden. Algunos valores difieren en los últimos decimales impresos, como máximo en 3.72529e-08, en valores entre 4,454,585 y 4,808,361, y ninguna de esas diferencias cambia una decisión de aceptación. Con el rango de semillas 130 a 149, el camino y el costo de cada semilla coincidieron con `results150.txt`. En 2026, la ejecución con la semilla 132 tardó de 5 a 6 s; el archivo de 2019 reporta 83 s.

La reproducción depende de la biblioteca estándar de C++. `std::default_random_engine` está definido por la implementación: libc++ lo define como `minstd_rand`, y libstdc++ de GCC como `minstd_rand0`. Como la traza coincide en exactamente el mismo orden, las ejecuciones de 2019 usaron el mismo motor y las mismas distribuciones que la libc++ actual de Apple, y una compilación con libstdc++ debería dar caminos distintos para las mismas semillas (sin probar). El mismo motor hace que las semillas 0 y 1 sean idénticas, porque `minstd_rand` reemplaza una semilla 0 por 1, así que el rango por defecto del programa, `-s 0 -e 10`, da 11 ejecuciones, de las cuales 10 son distintas.

<figure>
  <img src="/research/tsp-simulated-annealing/es/tour-150.svg" width="600" height="279" alt="Mapa de 150 ciudades unidas por un solo camino abierto. Empieza en Kumasi, Ghana, va hacia el este por África, Medio Oriente y Asia hasta Japón, regresa al oeste por China, el sur de Asia, el Sudeste Asiático, Mongolia, Rusia y Europa, baja hasta el sur de África y vuelve al norte por Medio Oriente y el norte de África, cruza de Guinea-Bisáu a Brasil, y termina en Charlotte, Estados Unidos, después de pasar por Sudamérica, Centroamérica y México." loading="lazy" decoding="async">
  <figcaption>Figura 2. El mejor camino de 150 ciudades, con costo 0.164943812 y longitud 119,156,122.54 m, de la ejecución de 2019 con la semilla 132. Una re-ejecución en 2026 de esa revisión lo reprodujo; los puntos grises son las demás ciudades de la base de datos dentro del marco.</figcaption>
</figure>

<figure>
  <img src="/research/tsp-simulated-annealing/es/cost-150-seed132.svg" width="600" height="380" alt="Gráfica en escala logarítmica del costo de cada camino aceptado a lo largo de 922,000 soluciones aceptadas. El costo empieza por encima de 6 millones. Baja de 1 por primera vez en la solución aceptada 121,551, sube de 1 por última vez en la solución aceptada 326,920, luego disminuye lentamente y llega a 0.164943812 en la solución aceptada 913,718." loading="lazy" decoding="async">
  <figcaption>Figura 3. Costo de cada camino aceptado en la ejecución de 2019 con 150 ciudades y la semilla 132, a partir de los 922,000 valores de <code>seed132.txt</code>, en escala logarítmica. La banda abarca el costo más bajo y el más alto de cada bloque de 1,000 soluciones aceptadas; el primer camino factible aparece en la solución aceptada 121,551 y el mejor en la 913,718.</figcaption>
</figure>

El primer costo aceptado es 6,516,054.583547368. La búsqueda acepta caminos no factibles hasta la solución aceptada 326,920, y luego pasa las 595,080 soluciones aceptadas restantes entre caminos factibles.

### El código del repositorio

| Instancia | Semillas | Factibles | Mejor | Mediana de las factibles | Mejor antes del barrido final |
|---|---|---|---|---|---|
| `instancia40.txt` | 0–10 | 11 de 11 | 0.308330781 (semillas 7, 10) | 0.326036767 | 0.308330781 |
| `instancia40.txt` | 100–199 | 96 de 100 | 0.308330781 (26 semillas) | 0.317977745 | 0.308330781 |
| `instancia40_.txt` | 0–10 | 11 de 11 | 0.308707227 (semillas 2, 9) | 0.335553469 | 0.308707227 |
| `instancia150.txt` | 0–10 | 10 de 11 | 0.174476204 (semilla 4) | 0.193297486 | 0.200165125 |
| `instancia150.txt` | 130–149 | 17 de 20 | 0.178417046 (semilla 140) | 0.190970371 | 0.200444840 |
| `instancia150_.txt` | 0–10 | 8 de 11 | 0.170681015 (semilla 7) | 0.183887928 | 0.191679788 |

Con 40 ciudades, el mejor camino del código del repositorio es el mejor camino de 2019 recorrido en sentido inverso. Es el costo más bajo de las 444 re-ejecuciones con `instancia40.txt` y del registro de 2019, aunque nada demuestra que sea óptimo. Las 4 ejecuciones no factibles de las 100 terminaron con costos cercanos a 205601.3.

Con 150 ciudades, el mejor costo en 31 semillas, 0.174476204, es peor que el 0.164943812 de la revisión de 2019, que usaba una temperatura final menor (ε = 0.0001) y no tenía barrido final. El barrido mejoró todas las ejecuciones factibles con 150 ciudades (10 de 10 y 17 de 17); con la semilla 4 llevó el mejor costo aceptado de 0.200165125 a 0.174476204. Con `instancia40.txt` mejoró 5 de 11 y 44 de 96 ejecuciones factibles. Cada ejecución aceptó entre 1,409,284 y 1,761,450 soluciones en las instancias de 40 ciudades y entre 1,211,613 y 1,308,203 en las de 150 ciudades. El programa reportó de 2 a 3 s en 157 de estas 164 ejecuciones, y entre 72 y 903 s en las otras 7.

<figure>
  <img src="/research/tsp-simulated-annealing/es/cost-40-seed7.svg" width="600" height="380" alt="Gráfica en escala logarítmica del costo de cada camino aceptado a lo largo de 1,749,911 soluciones aceptadas en una re-ejecución con 40 ciudades. El costo empieza por encima de 10 millones, baja de 1 por primera vez en la solución aceptada 360,112 y llega a 0.308330781 en la solución aceptada 1,730,885." loading="lazy" decoding="async">
  <figcaption>Figura 4. La misma vista para una re-ejecución en 2026 del código del repositorio con 40 ciudades y la semilla 7 (L = 3000, M = 30000, ε = 0.001, φ = 0.95, barrido final activado). El primer camino factible aparece en la solución aceptada 360,112, y el costo llega a 0.308330781 en la solución aceptada 1,730,885 de 1,749,911.</figcaption>
</figure>

### Los parámetros del artículo

Con las semillas 100 a 199 y `instancia40.txt`, los tres conjuntos de parámetros del artículo y el código del repositorio se comparan así:

| Parámetros | Factibles | Mejor | Mediana de las factibles | Ejecuciones en 0.308330781 | Mejor antes del barrido final | Soluciones aceptadas por ejecución |
|---|---|---|---|---|---|---|
| L 1000, φ 0.95 (artículo, primero) | 62 de 100 | 0.318230368 | 0.357823749 | 0 | 0.350965649 | 198,107 a 241,960 |
| L 6000, φ 0.95 (artículo, segundo) | 96 de 100 | 0.308330781 | 0.337156377 | 3 | 0.322736673 | 1,317,578 a 1,520,004 |
| L 6000, φ 0.99 (artículo, tercero) | 100 de 100 | 0.308330781 | 0.325614325 | 7 | 0.323987376 | 5,767,265 a 6,966,512 |
| L 3000, φ 0.95 (repositorio) | 96 de 100 | 0.308330781 | 0.317977745 | 26 | 0.308330781 | 1,534,845 a 1,761,450 |

Los conjuntos del artículo usan M = 3 L y ε = 0.01; el código del repositorio usa M = 30000 y ε = 0.001.

<figure>
  <img src="/research/tsp-simulated-annealing/es/rerun-40-final-costs.svg" width="600" height="524" alt="Cuatro histogramas del costo final con 40 ciudades, uno por conjunto de parámetros, cada uno sobre las semillas 100 a 199. Con L 1000 y φ 0.95, 62 de 100 ejecuciones son factibles y la mayoría termina entre 0.33 y 0.38. Con L 6000 y φ 0.95, 96 son factibles. Con L 6000 y φ 0.99, las 100 son factibles y la mayoría termina entre 0.31 y 0.34. Con el código del repositorio, 96 son factibles y la barra más alta es la del intervalo más bajo, de 0.30 a 0.31, con 31 ejecuciones." loading="lazy" decoding="async">
  <figcaption>Figura 5. Costo final de cada ejecución factible con 40 ciudades y las semillas 100 a 199, re-ejecutada en 2026 con los tres conjuntos de parámetros del artículo y con el código del repositorio, todas con el barrido final activado. Los intervalos miden 0.01, y el número sobre la barra más alta de cada fila es su cantidad de ejecuciones.</figcaption>
</figure>

La re-ejecución coincide con el artículo en las dos primeras conclusiones. Las ejecuciones graficadas en el artículo terminan en aproximadamente 229,000, 1,460,000 y 5,980,000 soluciones aceptadas (leídas de las gráficas), y cada valor cae dentro del rango de las re-ejecuciones con los mismos parámetros, aunque las semillas del artículo siguen sin conocerse. La mediana del costo factible mejora de 0.357823749 a 0.337156377 y a 0.325614325 conforme crecen L y φ, y las semillas 0 a 10 muestran el mismo orden (0.370797817, 0.352663452 y 0.319501461).

La tercera conclusión no se sostuvo. Dentro de cada conjunto de parámetros, semillas distintas terminaron en caminos distintos. Con L = 1000, ninguna de las 111 ejecuciones (semillas 0 a 10 y 100 a 199) alcanzó 0.308330781, la mejor fue 0.318230368, y 38 de las 100 ejecuciones con las semillas 100 a 199 terminaron no factibles. Con ε = 0.01, la fase de recocido por sí sola nunca alcanzó 0.308330781 en ninguna ejecución de los tres conjuntos; el barrido final, que el artículo no describe, hizo las últimas mejoras. Con el ε = 0.001 del repositorio, la fase de recocido lo alcanza por sí sola.

### El archivo de 40 ciudades de 2019 salió de código que nunca se subió al repositorio

La revisión `4f5a890` no reproduce `results_100-199.txt`. Con `instancia40.txt`, la semilla 100 termina no factible en 113493.146933171, donde el archivo reporta 0.310470829. La semilla 101 nunca termina: la ejecución se detuvo después de 150 s, y sus últimos 200,000 valores de salida alternan entre 0.315819476 y 0.315801619, así que los promedios de lotes consecutivos son iguales y el programa nunca sale del ciclo `while (p <= q)`. Por lo tanto, el archivo salió de código que nunca se subió al repositorio. Su mejor camino sigue siendo el mejor registrado, ya que el código del repositorio encontró el mismo camino en sentido inverso.

## Discusión

La ejecución de 150 ciudades se reproduce desde su commit, solución aceptada por solución aceptada, siempre que la compilación use libc++, y una implementación independiente de la función de costo confirma los dos mejores costos. Lo que dice el artículo sobre el tamaño de lote y el factor de enfriamiento coincide con las re-ejecuciones.

El punto débil del artículo es su evidencia. No reporta números, y su única afirmación cuantitativa, que todos los conjuntos de parámetros encontraron la misma mejor permutación, falla con su propio primer conjunto de parámetros. Sus parámetros difieren de los del código que lo acompaña, y omite el barrido final, que con ε = 0.01 hace la última parte de la búsqueda. La figura 5 muestra, a partir de una re-ejecución, la comparación por semilla que le faltaba al artículo.

Ninguno de los dos mejores costos tiene una prueba de optimalidad; la re-ejecución no calculó ninguna cota inferior ni usó un solver exacto. Los tiempos de ejecución son segundos enteros que reportó el programa, medidos mientras otros procesos compartían la máquina, así que solo son indicativos.

### Errores en el artículo y en el código

- La definición del problema describe una ruta cerrada (`main.tex:35`); la función de costo y el código calculan un camino abierto.
- La desigualdad de aceptación es estricta en §4.1 (`main.tex:92`) y no estricta en el procedimiento 2 (`main.tex:114`).
- La ec. (2) multiplica w(u, v) por una constante α para los pares sin conexión (`main.tex:184-190`), pero w solo está definida sobre las conexiones; el código usa d(u, v) × max_d(S), igual que el documento del curso. El artículo nunca define N(S), aunque sus gráficas muestran costos normalizados.
- Las figuras tienen `\label` y no tienen `\caption`, así que el texto solo se refiere a ellas por su posición.
- Los documentos del curso en `pdf/` no se citan, y las dos entradas de la bibliografía no indican medio de publicación ni editorial.
- `--skip-sweep` no tiene efecto, porque `main.cpp:80` revisa el nombre de opción `final-sweep`, que nunca se declara.
- Sin `-p`, el programa escribe en un apuntador a archivo sin inicializar (`main.cpp:158-160`) y termina con un segmentation fault.
- La ruta de la base de datos es `../db/tsp.db` (`main.cpp:13`), así que el programa solo funciona desde un directorio junto a `db/`, como `build/`.
- `meson.build` lista `src/Main.cpp` y el archivo es `src/main.cpp`, así que la compilación con Meson solo funciona en un sistema de archivos que no distingue mayúsculas de minúsculas.
- Con varias semillas en un mismo archivo `-p`, todos los puntos van a un solo bloque de datos de gnuplot, y la gráfica los dibuja como una sola línea.

## Cómo reproducirlo

Estos comandos se probaron en un clon nuevo en macOS (arm64) con las Xcode Command Line Tools, que incluyen clang y SQLite. El comando directo de `clang++` usa las mismas flags que la compilación release de Meson. Ejecuta el programa desde `build/` y pasa siempre `-p`:

```
git clone https://github.com/JCastrejonE/TSP_SimulatedAnnealing.git
cd TSP_SimulatedAnnealing
mkdir build && cd build
clang++ -std=c++11 -O3 -I../include ../src/Annealing.cpp ../src/Graph.cpp ../src/main.cpp -lsqlite3 -o TSP_SimmulatedAnnealing
./TSP_SimmulatedAnnealing -f ../inputs/instancia40.txt -s 7 -e 7 -p plot40.txt
```

La ejecución imprime el camino y `Evaluation: 0.308330781`. Con `-f ../inputs/instancia150.txt -s 4 -e 4` imprime `Evaluation: 0.174476204`, el mejor resultado del código del repositorio con 150 ciudades; el resultado de 2019, 0.164943812, viene de la revisión `4f5a890` (ver abajo). El archivo `plot40.txt` es un script de gnuplot con cada costo aceptado.

Para reproducir la ejecución de 2019 con 150 ciudades y comparar su traza con la que está en el repositorio:

```
cd ..
git checkout 4f5a890
clang++ -std=c++11 -O3 -Iinclude src/main.cpp -lsqlite3 -o tsp2019
./tsp2019 < instancia150.txt > rerun132.txt
tail -3 rerun132.txt
sed -n '2,922001p' rerun132.txt > a.txt
head -n 922000 seed132.txt > b.txt
paste -d ' ' a.txt b.txt | awk '{d=$1-$2; if (d<0) d=-d; if (d>m) m=d} END {print NR, m}'
```

`tail` muestra 0.164943812 antes de las dos líneas de tiempo, y el último comando imprime `922000 3.72529e-08`: el número de costos aceptados comparados y la mayor diferencia entre las dos trazas. Para los conjuntos de parámetros del artículo, cambia `BATCH_SIZE`, `MAX_BATCH_ATTEMPTS` (a `BATCH_SIZE * 3`), `EPSILON` (a 0.01) y `PHI` en `include/Annealing.hpp` del código del repositorio (`2a52c94`), vuelve a compilar y ejecuta las semillas 100 a 199.

## Referencias

1. Juan C. Castrejón. <i lang="es">Algoritmo de Recocido Simulado para el problema del Agente Viajero</i>. Mayo de 2019. Archivos del repositorio `tex/main.tex` y `tex/Recocido_Simulado.pdf`.
2. Canek Peláez. <i lang="es">Función de costo para TSP</i>. Documento del curso, 13 de febrero de 2019. Archivo del repositorio `pdf/fcosto.pdf`.
3. <i lang="es">Capítulo 1, Aceptación por umbrales</i>. Notas del curso, páginas 3 a 7, sin autor indicado. Archivo del repositorio `pdf/hoc.pdf`.
4. Kirkpatrick, S.; Gelatt Jr, C. D.; Vecchi, M. P. (1983). <i lang="en">Optimization by Simulated Annealing</i>. Citado en [1], que no indica medio de publicación.
5. Applegate, D. L.; Bixby, R. M.; Chvátal, V.; Cook, W. J. (2006). <i lang="en">The Traveling Salesman Problem</i>. Citado en [1], que no indica editorial.
6. Repositorio en el commit `2a52c94` (2019-05-13): `src/Annealing.cpp`, `src/main.cpp`, `include/Annealing.hpp`, `meson.build`, `db/tsp.db` y los cuatro archivos de `inputs/`.
7. Repositorio en el commit `4f5a890` (2019-03-06): `include/Annealing.h`, `src/main.cpp`, `results150.txt`, `results_100-199.txt`, `seed132.txt` y `solution150.txt`, borrados en el commit `a22090f`.
8. La re-ejecución de octubre de 2026: 497 ejecuciones del código del repositorio con los parámetros del repositorio y con los del artículo, y las ejecuciones de la revisión `4f5a890` descritas arriba.
