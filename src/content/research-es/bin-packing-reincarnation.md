---
title: Empaquetado en contenedores con una heurística de reencarnación
description: Mi solver en C++ de 2019 para bin packing unidimensional, re-ejecutado en 2026 con 30 semillas por instancia y comparado con best-fit y una cota inferior.
summary: Un solver de bin packing de 2019, re-ejecutado en octubre de 2026. Alcanzó la cota inferior de 11 contenedores con 20 objetos en todas las ejecuciones y usó más contenedores que best-fit en línea con 200 y 2000 objetos.
abstract: >-
  El problema de empaquetado en contenedores (bin packing) pide la menor cantidad de contenedores de capacidad fija que alojen una lista de objetos. En junio de 2019 escribí un solver en C++ para el curso de Heurísticas de Optimización Combinatoria de la Facultad de Ciencias de la UNAM. Usa una heurística poblacional basada en el algoritmo de reencarnación de Sharma: cada alma es una permutación de los objetos, decodificada en contenedores con next-fit, y en cada generación un alma actúa como gurú, persona común o ateo, lo que decide si se acerca a un alma mejor clasificada o intercambia su primer objeto con uno aleatorio. El README enlaza un artículo en español que el repositorio no contiene, así que todos los resultados vienen de la re-ejecución de octubre de 2026 con 30 semillas por instancia. Con 20 objetos, todas las ejecuciones usaron 11 contenedores, igual a la cota inferior. Con 200 objetos, la heurística usó de 125 a 136 contenedores y con 2000 objetos de 1304 a 1310, mientras que best-fit en línea, el algoritmo de comparación incluido en el mismo programa, usó 119 y 1032.
date: '2019-06'
context: 'Proyecto del curso · Heurísticas de Optimización Combinatoria · Facultad de Ciencias, UNAM'
group: academic
order: 3
repo: https://github.com/JCastrejonE/BPP_Reincarnation
links:
  - label: 'Relacionado: recocido simulado para el problema del agente viajero'
    href: /es/research/tsp-simulated-annealing/
  - label: 'Relacionado: colonia de hormigas para la cobertura de vértices de peso mínima'
    href: /es/research/vertex-cover-ant-colony/
---

## El problema

En el empaquetado en contenedores (bin packing) en una dimensión recibes `n` objetos con tamaños enteros y una cantidad ilimitada de contenedores con capacidad entera `C`. Cada objeto va en exactamente un contenedor, ningún contenedor puede rebasar `C`, y el objetivo es usar la menor cantidad posible de contenedores. El solver lee una instancia como `n C` seguido de los `n` tamaños (`src/main.cpp:57-63`), y su objetivo es el número de contenedores.

El repositorio incluye tres instancias:

| Archivo | Objetos | Capacidad | Suma de tamaños | Tamaños | Objetos mayores que C/2 | Cota inferior |
|---|---|---|---|---|---|---|
| `inputs/instancia20.txt` | 20 | 20 | 213 | 4 a 20 | 10 | 11 |
| `inputs/instancia200.txt` | 200 | 50 | 5515 | 1 a 50 | 114 | 111 |
| `inputs/instancia2000.txt` | 2000 | 80 | 80831 | 1 a 80 | 993 | 1011 |

La cota inferior (lower bound) de la última columna es la suma de los tamaños dividida entre la capacidad, redondeada hacia arriba. Ningún empaquetado puede usar menos contenedores, aunque en algunas instancias el óptimo real es mayor.

El repositorio también incluye un generador pequeño que elige cada tamaño de manera uniforme entre 1 y `C` (`src/instance-gen.cpp:47-54`). En la re-ejecución de octubre de 2026, el generador compilado en macOS reprodujo los tres archivos con las semillas 100, 10 y 5, byte por byte, salvo que `inputs/instancia200.txt` no tiene salto de línea final, así que las tres instancias salieron del propio generador del repositorio.

## El método

El método del código de 2019 se basa en el algoritmo de reencarnación (Reincarnation Algorithm) que Sharma publicó en CINTI 2010 [4].

### Almas, karma y next-fit

La heurística mantiene una población de soluciones candidatas que el código llama almas (souls, `include/Soul.hpp`). El `karma` de un alma es una permutación de los tamaños de los objetos. Su costo es el número de contenedores que next-fit produce a partir de esa permutación: recorre la lista, agrega cada objeto al contenedor actual si cabe y, si no cabe, cierra el contenedor y abre uno nuevo (`src/Reincarnation.cpp:199-216`).

Next-fit nunca regresa a un contenedor cerrado. Por esta razón el orden de la permutación determina el empaquetado, y los objetos de cada contenedor siempre forman un tramo contiguo de la permutación.

### Una generación

Al inicio de cada generación (`src/Reincarnation.cpp:40-124`) el programa realiza estos pasos:

1. Ordena la población por costo. La primera alma es el mejor gurú y, si su costo mejora el mejor obtenido hasta ese momento, el programa guarda su permutación. Este es el único lugar donde se registra la mejor solución actual.
2. Cada alma cuyo costo es igual al del mejor gurú incrementa un contador, y cada una de las demás reinicia su contador a 0. Cuando el contador llega a 20, el alma alcanza el Nirvana y sale de la población.
3. Cada alma recibe un tiempo de vida elegido de manera uniforme entre 1 y 20.
4. El programa elige el número de gurús de manera uniforme entre 1 y un tercio de las almas vivas. Los gurús son las almas mejor clasificadas.
5. Las 3 peores almas pasan a una cola de suspensión. Cuando la cola tiene más de 6, las más antiguas regresan con un nuevo tiempo de vida, así que cada alma suspendida queda fuera de la población durante dos generaciones.
6. De las almas restantes, un número aleatorio de ellas se vuelven personas comunes (commoners), cada una asignada a un gurú de comunidad, y las demás se vuelven ateas.

Después, cada alma viva hace un movimiento por pasada hasta que su tiempo de vida llega a 0 (`src/Reincarnation.cpp:126-197`). Un gurú elige una posición aleatoria e intercambia dos de sus objetos para coincidir con el mejor gurú en esa posición. Una persona común hace lo mismo, con su gurú de comunidad como modelo. Un ateo intercambia su primer objeto con una posición aleatoria. Cada movimiento cuesta una unidad de tiempo de vida y provoca una evaluación completa con next-fit.

El programa aplica todos los movimientos, ya sea que el costo aumente o disminuya. La selección ocurre solo en el cambio de generación, mediante el ordenamiento, los roles, el Nirvana y la cola de suspensión.

### Parámetros

Estos son los valores del último commit (`include/Reincarnation.hpp:12-17`):

| Constante | Valor | Significado |
|---|---|---|
| `GENERATIONS` | 1000 | número máximo de generaciones |
| `POPULATION` | 200 | número inicial de almas |
| `MAX_LIFETIME` | 20 | los tiempos de vida se eligen entre 1 y 20 |
| `NIRVANA_THRESHOLD` | 20 | generaciones consecutivas que un alma debe empatar con la mejor antes de salir |
| `WORST_SOULS` | 3 | almas suspendidas por generación |
| `SUSPENSION` | 2 | generaciones que espera un alma suspendida |

El primer commit, del 10 de junio de 2019, usaba 250 generaciones, una población de 25, tiempos de vida de hasta 80 y un umbral de Nirvana de 3. El segundo commit, del 12 de junio de 2019, subió las generaciones a 1000. El último commit, del 19 de junio de 2019, fijó la población, el límite del tiempo de vida, el umbral de Nirvana y el número de almas suspendidas en los valores de arriba.

### El algoritmo de comparación

El último commit se titula "Added best fit algorithm for comparison". Agrega `include/best-fit.hpp`, que coloca cada objeto, en el orden del archivo, en el contenedor abierto que deja menos espacio, y abre un contenedor nuevo cuando ningún contenedor tiene cupo. El flag `--greedy` imprime su resultado junto al de la heurística (`src/main.cpp:74-75`). El comentario del header lo llama "best fit online algorithm" (`include/best-fit.hpp:9-10`), y el algoritmo nunca ordena los objetos.

## Qué contiene el repositorio

El repositorio tiene tres commits entre el 10 y el 19 de junio de 2019, todos míos. Contiene el solver, el generador, las tres instancias y un README.

No contiene resultados. El README enlaza `tex/Reencarnacion.pdf` como "PDF document in spanish", pero ningún commit ha contenido nunca una carpeta `tex/`, y el enlace en GitHub devuelve una página 404. Tampoco hay archivos de salida, logs ni tablas, así que no puedo determinar qué cantidades de contenedores obtuve en 2019 ni con qué parámetros. El README también dice "The ant colony optimization heuristic can be tuned to experiment different results" (`README.md:44`), aunque este solver no tiene ninguna colonia de hormigas. La misma oración aparece en el README de mi solver de colonia de hormigas, MWVCP_AntColony.

## Qué se midió

El último commit se volvió a ejecutar el 16 de octubre de 2026 en una Mac con Apple Silicon, con Apple clang 21.0.0 y libc++. Meson no estaba instalado, así que la compilación usó flags equivalentes al build de release de Meson del repositorio (C++11, `-O3`). Cada instancia corrió con las semillas 0 a 29 y el flag `--greedy`, lo que da 90 ejecuciones. Las 90 terminaron normalmente.

Para cada ejecución, una verificación confirmó que la solución impresa es una permutación de los tamaños de entrada y que next-fit sobre ella da exactamente la cantidad de contenedores impresa. Para seguir la búsqueda a lo largo del tiempo, se compiló una segunda copia con mi `printf` de depuración original habilitado (`src/Reincarnation.cpp:28`) más un contador de generaciones. Esa copia no hace sorteos aleatorios adicionales, y sus cantidades finales de contenedores coinciden con las del binario sin modificar en las 90 ejecuciones.

Como referencia, se calcularon tres valores más para cada instancia con código Python aparte: la cota inferior L2 de Martello y Toth [2], first-fit decreasing y next-fit en el orden del archivo. No forman parte del repositorio, y las tablas de abajo los marcan como valores de referencia.

## Resultados

### La heurística con 30 semillas

| Instancia | Mejor | Mediana | Media | Peor | Desv. est. | Semillas con el mejor | Tiempo por ejecución |
|---|---|---|---|---|---|---|---|
| 20 objetos, C = 20 | 11 | 11 | 11 | 11 | 0 | las 30 | 0.022–0.039 s |
| 200 objetos, C = 50 | 125 | 127 | 127.97 | 136 | 2.92 | 4, 13, 28 | 0.466–0.492 s |
| 2000 objetos, C = 80 | 1304 | 1308 | 1307.4 | 1310 | 1.61 | 19, 26 | 4.488–4.752 s |

Todos los valores son de la re-ejecución de octubre de 2026. Cada ejecución usó las 1000 generaciones completas.

<figure>
  <img src="/research/bin-packing-reincarnation/es/bins-vs-lower-bound.svg" width="512" height="572" alt="Tres paneles, uno por instancia. Con 20 objetos, la heurística de reencarnación usó 11 contenedores en las 30 ejecuciones, igual a la cota inferior de 11, y best-fit en línea usó 12. Con 200 objetos, usó de 125 a 136 contenedores frente a 119 de best-fit y una cota inferior de 111. Con 2000 objetos, usó de 1304 a 1310 contenedores frente a 1032 de best-fit y una cota inferior de 1011." loading="lazy" decoding="async">
  <figcaption>Figura 1. Contenedores usados en las tres instancias del repositorio, de la re-ejecución de octubre de 2026 con 30 semillas por instancia; la línea va de la mejor a la peor semilla, con un punto en la mediana. La cota inferior es la suma de los tamaños de los objetos dividida entre la capacidad del contenedor, redondeada hacia arriba, y cada panel tiene su propia escala.</figcaption>
</figure>

### Frente al algoritmo de comparación y las cotas

| Instancia | Cota inferior | Cota L2 (referencia) | Reencarnación mejor / mediana / peor | Best-fit en línea (`--greedy`) | First-fit decreasing (referencia) | Next-fit, orden del archivo (referencia) |
|---|---|---|---|---|---|---|
| 20 objetos | 11 | 11 | 11 / 11 / 11 | 12 | 11 | 14 |
| 200 objetos | 111 | 118 | 125 / 127 / 136 | 119 | 118 | 146 |
| 2000 objetos | 1011 | 1012 | 1304 / 1308 / 1310 | 1032 | 1014 | 1337 |

Respecto a la cota inferior simple, la mejor semilla de la heurística queda 0%, 12.61% y 28.98% por encima en las tres instancias, y best-fit en línea queda 9.09%, 7.21% y 2.08% por encima.

Con 20 objetos la heurística siempre alcanza el óptimo, ya que 11 contenedores igualan la cota inferior. Las 30 semillas produjeron 16 empaquetados distintos de 11 contenedores. La figura 2 muestra el de la semilla 0.

<figure>
  <img src="/research/bin-packing-reincarnation/es/fill-levels-20-items.svg" width="536" height="372" alt="Once columnas, una por contenedor de capacidad 20, cada una apilada con los tamaños de sus objetos. Siete contenedores están llenos. El contenedor 3 contiene 17, los contenedores 6 y 9 contienen 19 y el contenedor 7 contiene 18, lo que deja vacías 7 de las 220 unidades de capacidad." loading="lazy" decoding="async">
  <figcaption>Figura 2. Niveles de llenado del empaquetado de 11 contenedores de la re-ejecución de octubre de 2026 con la semilla 0 en la instancia de 20 objetos, con capacidad de contenedor 20. Cada columna es un contenedor, apilado con sus objetos en el orden en que next-fit los colocó; las 30 semillas llegaron a 11 contenedores, y la semilla 0 es la primera de ellas.</figcaption>
</figure>

Con 200 objetos, la cota L2 y first-fit decreasing dan 118, así que el óptimo es exactamente 118. La mejor semilla de la heurística usó 125 contenedores, 7 por encima del óptimo y 6 por encima de best-fit en línea. Su peor semilla usó 136.

Con 2000 objetos el óptimo está entre 1012 y 1014. La mejor semilla de la heurística usó 1304 contenedores, 272 más que best-fit en línea.

### Avance a lo largo de las generaciones

Esta tabla da la mejor cantidad de contenedores registrada al inicio de cada generación, como el mínimo, la mediana y el máximo de las 30 semillas (re-ejecución, copia instrumentada):

| Generación | 20 objetos | 200 objetos | 2000 objetos |
|---|---|---|---|
| 1 | 12 / 12 / 12 | 141 / 141 / 141 | 1317 / 1317 / 1317 |
| 10 | 11 / 12 / 12 | 138 / 139.5 / 141 | 1312 / 1314 / 1317 |
| 100 | 11 / 11 / 11 | 136 / 137 / 139 | 1307 / 1312 / 1314 |
| 250 | 11 / 11 / 11 | 133 / 136 / 137 | 1304 / 1310 / 1313 |
| 500 | 11 / 11 / 11 | 127 / 132.5 / 137 | 1304 / 1309 / 1311 |
| 1000 | 11 / 11 / 11 | 125 / 127 / 136 | 1304 / 1308 / 1310 |

Como referencia, también se decodificaron con next-fit en Python 200 permutaciones aleatorias de cada instancia, y la mejor de ellas usó 11, 141 y 1318 contenedores. En la instancia de 2000 objetos, la mejor solución registrada pasó de 1317 en la generación 1 a entre 1304 y 1310 en la generación 1000.

## Discusión

La heurística resuelve la instancia pequeña en todas las ejecuciones y usa más contenedores que una regla glotona (greedy) de una sola pasada en las dos más grandes. Creo que dos decisiones de diseño explican la mayor parte de la diferencia, aunque esta es mi interpretación del código y el repositorio no afirma nada al respecto.

Next-fit solo pone en el mismo contenedor objetos consecutivos de la permutación, así que un buen empaquetado necesita muchos tramos específicos de objetos al mismo tiempo, y un solo intercambio cambia muy pocos de ellos. Best-fit en línea evita este problema por completo, porque considera todos los contenedores abiertos para cada objeto. Y como el programa acepta todos los movimientos, un alma puede perder una mejora con su siguiente movimiento, antes de que el ordenamiento de la generación siguiente la registre.

Una lectura del código en 2026 también identificó estos defectos:

- **La semilla no cambia la población inicial.** El constructor revuelve las 200 almas antes de que `main` llame a `setRandomEngine(seed)` (`src/Reincarnation.cpp:15`, `src/main.cpp:64-65`). En la re-ejecución, la mejor alma de la generación 1 tuvo 12, 141 y 1317 contenedores con todas las semillas.
- **Las semillas 0 y 1 dan la misma ejecución.** En la libc++ de la re-ejecución, `std::default_random_engine` es `minstd_rand`, que trata la semilla 0 como la semilla 1. En las tres instancias, las salidas de las semillas 0 y 1 son idénticas salvo por la línea "Seed:". La semilla 0 es la predeterminada del README.
- **El ciclo de Nirvana tiene comportamiento indefinido.** Borra elementos de la población dentro de un `for` basado en rango sobre el mismo vector (`src/Reincarnation.cpp:53-69`). Un build con AddressSanitizer reporta un container overflow en la línea 53 en la instancia de 20 objetos con la semilla 0. El build de release no se cayó en ninguna de las 90 ejecuciones.
- **Una persona común puede seguir a otra persona común.** El índice del gurú de comunidad se elige entre 0 y el número de gurús, inclusive (`src/Reincarnation.cpp:82`), pero los gurús ocupan las posiciones de 0 a uno menos que ese número.
- **Las mejoras de la última generación se pierden**, ya que el programa registra la mejor solución solo al inicio de una generación (`src/Reincarnation.cpp:44-49`).

Los resultados tienen tres límites. La re-ejecución usó una sola plataforma, y el estándar de C++ no fija los algoritmos detrás de `std::shuffle` y `uniform_int_distribution`, así que un build con otra biblioteca estándar puede producir cantidades de contenedores distintas. Las tres instancias son instancias aleatorias uniformes, y solo son tres. Y como el artículo no está disponible, la re-ejecución no se puede comparar con él.

## Cómo reproducirlo

Estos comandos funcionan desde un clon limpio del commit `ca61726`. La re-ejecución los corrió en macOS con Apple clang 21.0.0:

```sh
git clone https://github.com/JCastrejonE/BPP_Reincarnation.git
cd BPP_Reincarnation
clang++ -std=c++11 -O3 -I include src/Reincarnation.cpp src/main.cpp -o BPP_Reincarnation
clang++ -std=c++11 -O3 -I include src/instance-gen.cpp -o instance-gen
./BPP_Reincarnation -f inputs/instancia20.txt -s 0 --greedy
```

El último comando imprime la permutación de la semilla 0, `Bins: 11` y `Best-fit: 12`. Para correr las 30 semillas de una instancia:

```sh
for s in $(seq 0 29); do
  ./BPP_Reincarnation -f inputs/instancia200.txt -s $s --greedy | grep -E 'Bins|Best-fit'
done
```

El programa imprime el tiempo transcurrido en segundos enteros (`src/main.cpp:78`), así que reporta 0 para las ejecuciones de 20 y 200 objetos; los tiempos de la tabla de resultados se midieron desde fuera del proceso. Para regenerar los archivos de instancia en macOS:

```sh
./instance-gen -n 20 -b 20 -s 100     # igual a inputs/instancia20.txt
./instance-gen -n 200 -b 50 -s 10     # igual a inputs/instancia200.txt, que no tiene salto de línea final
./instance-gen -n 2000 -b 80 -s 5     # igual a inputs/instancia2000.txt
```

El README describe un build con Meson (`meson build` y luego `ninja` dentro de `build`). La re-ejecución de 2026 no usó esa ruta, porque Meson no estaba instalado en la máquina.

## Referencias

1. Juan C. Castrejón, [BPP_Reincarnation](https://github.com/JCastrejonE/BPP_Reincarnation), commit `ca61726` (19 de junio de 2019). Archivos usados: `README.md`, `meson.build`, `include/Reincarnation.hpp`, `include/Soul.hpp`, `include/best-fit.hpp`, `src/Reincarnation.cpp`, `src/main.cpp`, `src/instance-gen.cpp` e `inputs/instancia{20,200,2000}.txt`.
2. Silvano Martello y Paolo Toth, "Lower bounds and reduction procedures for the bin packing problem", _Discrete Applied Mathematics_ 28(1), 59–70, 1990. Fuente de la cota L2 usada como valor de referencia.
3. jarro2783, [cxxopts](https://github.com/jarro2783/cxxopts), el parser de opciones de línea de comandos incluido en `include/jarro2783/cxxopts.hpp` y al que el README da crédito.
4. Anurag Sharma, "A new optimizing algorithm using reincarnation concept", _2010 11th International Symposium on Computational Intelligence and Informatics (CINTI)_, Budapest, Hungría, IEEE, 281–288, noviembre de 2010. DOI [10.1109/CINTI.2010.5672231](https://doi.org/10.1109/CINTI.2010.5672231). Fuente del algoritmo de reencarnación en el que se basa el método.
