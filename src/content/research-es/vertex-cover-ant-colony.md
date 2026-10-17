---
title: 'Cobertura de vértices de peso mínima con una colonia de hormigas'
description: 'Re-ejecución en 2026 de mi solver de 2019 con colonia de hormigas para cobertura de vértices de peso mínima: 100 semillas por instancia, contra óptimos exactos.'
summary: 'Escribí este solver en C++ con colonia de hormigas para la cobertura de vértices de peso mínima en 2019, en la UNAM. En 2026 se volvió a ejecutar sobre las cinco instancias de su repositorio, y cada resultado se comparó con el óptimo exacto.'
abstract: 'En 2019 escribí un solver en C++ para el problema de cobertura de vértices de peso mínima en el curso de Heurísticas de Optimización Combinatoria de la Facultad de Ciencias de la UNAM, con un reporte breve en español. Sigue el método de colonia de hormigas de Shyu, Yin y Lin (2004): 10 hormigas eligen vértices según la feromona y las aristas sin cubrir por unidad de peso, y la colonia parte de una cobertura greedy. El reporte probó una gráfica de 15 vértices y 24 aristas construida para que greedy falle: greedy usó 8 vértices y la colonia encontró 6. En 2026 el código sin modificar se volvió a ejecutar con 100 semillas sobre esa gráfica y sobre las otras cuatro instancias del repositorio, frente a los óptimos exactos. En la gráfica del reporte, 23 ejecuciones alcanzaron el óptimo de 6 y 77 devolvieron 7, el óptimo más el vértice 0, que un defecto en el paso de selección aleatoria favorece. En las otras cuatro instancias, la colonia alcanzó el óptimo en tres y en la cuarta nunca mejoró la cobertura greedy.'
date: '2019'
context: 'Proyecto del curso · Heurísticas de Optimización Combinatoria · Facultad de Ciencias, UNAM'
group: 'academic'
order: 2
repo: 'https://github.com/JCastrejonE/MWVCP_AntColony'
links:
  - label: 'Reporte (PDF, en español)'
    href: 'https://github.com/JCastrejonE/MWVCP_AntColony/blob/master/tex/Colonia_de_Hormigas.pdf'
  - label: 'Relacionado: recocido simulado para el problema del agente viajero'
    href: '/es/research/tsp-simulated-annealing/'
  - label: 'Relacionado: empaquetado en contenedores con una heurística de reencarnación'
    href: '/es/research/bin-packing-reincarnation/'
---

## Problema

Una cobertura de vértices (vertex cover) de una gráfica no dirigida G = (V, E) es un conjunto de vértices V′ ⊆ V que toca todas las aristas: para cada arista (u, v), u o v pertenece a V′. Cuando los vértices tienen pesos, una cobertura de vértices de peso mínima (minimum weight vertex cover) es una cobertura cuyo peso total es el menor posible. El problema es NP-duro, así que no se conoce un algoritmo de tiempo polinomial que lo resuelva.

Escribí el solver y su reporte en 2019 para el curso de Heurísticas de Optimización Combinatoria de la Facultad de Ciencias de la UNAM. El reporte, <span lang="es">"Algoritmo de Colonia de Hormigas para el problema de Cobertura de Vértices de Peso Mínima"</span>, tiene 9 páginas en español y se plantea un objetivo práctico: una metaheurística que encuentre soluciones <span lang="es">*suficientemente buenas*</span> en tiempo razonable. El costo de una cobertura es la suma de sus pesos, f(V′) = Σ w(v) sobre v ∈ V′. El solver es un programa de línea de comandos en C++11 que se compila con Meson.

## Método

El método sigue de cerca a Shyu, Yin y Lin (2004). Mi reporte incluye su artículo en la bibliografía, pero el texto nunca dice qué partes vienen de él, así que lo aclaro aquí: el procedimiento general, la representación de la gráfica, la regla de transición, las dos actualizaciones de feromona, el criterio de paro y la solución inicial greedy vienen de ese artículo. De ahí vienen también las 10 hormigas, q₀ = 0.9, una tasa de evaporación de 0.9 (su α) y la fórmula de τ₀ (su p. 291). El límite de 150 ciclos sin mejora no aparece en su artículo.

### Cómo construye una hormiga su cobertura

Cada hormiga recorre la gráfica completa sobre V, así que puede moverse de cualquier vértice a cualquier otro. Una arista de esa gráfica completa tiene peso 1 mientras pertenece a E y sigue sin cubrir, y peso 0 en otro caso; así es como cada hormiga lleva la cuenta de las aristas que su cobertura parcial todavía no cubre.

En cada ciclo, cada una de las 10 hormigas empieza en un vértice aleatorio y luego agrega un vértice por paso hasta que su conjunto cubre todas las aristas. En cada paso, la hormiga le asigna a cada vértice j la puntuación τ_j · η_j, donde τ_j es la feromona en j y η_j es el número de aristas sin cubrir que j cubriría, dividido entre el peso de j. Con probabilidad q₀ = 0.9, la hormiga toma el vértice con la puntuación más alta. En otro caso, según el reporte, elige un vértice al azar con probabilidad proporcional a su puntuación; la versión de este paso en el código tiene un defecto, que describo en la discusión.

Dos reglas de feromona guían a la colonia. Cada vez que una hormiga toma el vértice i, una actualización local acerca su feromona al valor inicial, τ_i = (1 − φ)τ_i + φτ₀; el reporte describe esto como una forma de reducir el atractivo del vértice para las demás hormigas, para que exploren vértices que aún no se han visitado. Cuando todas las hormigas terminan, una actualización global multiplica la feromona de cada vértice por (1 − φ) y luego suma φ/(peso total de la mejor cobertura conocida) a cada vértice de esa cobertura.

La colonia parte de una cobertura greedy, que toma una y otra vez el vértice con la mayor razón de aristas sin cubrir entre peso. Esa cobertura es la primera mejor solución conocida, y el código solo la reemplaza por una estrictamente más barata (src/AntColony.cpp:205), así que el programa nunca devuelve una cobertura peor que la greedy.

### Parámetros

| Parámetro | Reporte (main.tex:154) | Código (include/AntColony.hpp:12–17) |
|---|---|---|
| Número de hormigas | k = 10 | `ANTS 10` |
| Probabilidad de tomar el vértice con mayor puntuación | q₀ = 0.9 | `THRESHOLD 0.9` |
| Tasa de actualización local | φ = 0.9 | `PHI 0.9` |
| Tasa de actualización global | φ = 0.9 | `EVAPORATION_RATE 0.9` |
| Detenerse tras este número de ciclos sin mejora | INTENTOS = 150 | `MAX_IMPROVE_ATTEMPTS 150` |
| Feromona inicial | τ₀ = n(n − a)/C | la misma fórmula (src/AntColony.cpp:36–38) |

Aquí n es el número de vértices, C es el costo de la cobertura greedy y a es su número de vértices. El código además multiplica cada puntuación por `RELATIVE_SIGNIFICANCE` (1) y por 10; ninguno de los dos factores aparece en el reporte.

## Qué se midió

### El experimento del reporte

El reporte prueba una sola instancia: 15 vértices, 24 aristas y pesos iguales, "construida de tal forma que el algoritmo greedy ... no obtiene la solución óptima". El archivo inputs/prueba.txt coincide con ella: tiene esos tamaños, todos sus pesos son 1 y contiene las mismas 24 aristas que dibujan las figuras 3 y 4 del reporte. Un camino recorre los vértices del 2 al 14, y los vértices 0 y 1 están unidos cada uno a los vértices 3, 5, 7, 9, 11 y 13. Los vértices 0 y 1 tienen grado 6, más que cualquier otro vértice, así que greedy los toma primero y todavía necesita los seis vértices impares del camino para cubrirlo, con un total de 8 vértices. Los seis vértices impares por sí solos ya cubren todas las aristas.

<figure>
  <img src="/research/vertex-cover-ant-colony/es/best-cover-prueba.svg" width="440" height="386" alt="Gráfica de la instancia del reporte: un camino que recorre los vértices del 2 al 14, con los vértices 0 y 1 unidos cada uno a los vértices 3, 5, 7, 9, 11 y 13. Esos seis vértices están rellenos y forman la mejor cobertura, el óptimo exacto de 6; los otros nueve están huecos. Greedy elige primero los vértices 0 y 1 y termina con 8 vértices." loading="lazy" decoding="async">
  <figcaption>Figura 1. La instancia del reporte (inputs/prueba.txt: 15 vértices, 24 aristas, todos los pesos iguales a 1), redibujada para esta página, con la cobertura de 6 vértices de la figura 4 del reporte rellena; un programa entero confirma que 6 es el óptimo. En la re-ejecución de octubre de 2026, 23 de 100 semillas devolvieron esta cobertura y las otras 77 la devolvieron con el vértice 0 agregado.</figcaption>
</figure>

El reporte presenta sus resultados como dos figuras. Al contar sus vértices rellenos se obtienen 8 para greedy (la figura 3 del reporte: vértices 0, 1, 3, 5, 7, 9, 11 y 13) y 6 para la colonia (figura 4: vértices 3, 5, 7, 9, 11 y 13). El reporte no indica la semilla, el número de ejecuciones, el tiempo de ejecución, el compilador ni la máquina.

También afirma, sin datos, que la colonia "muestra un desempeño similar en gráficas mucho más grandes". El repositorio contiene otras cuatro instancias que el reporte nunca menciona: g.txt, grafica2.txt, trampa2-100.txt y trampa200.txt.

### La re-ejecución de octubre de 2026

El 16 de octubre de 2026, el código sin modificar se compiló con Apple clang 21.0.0 en macOS arm64, con las flags que pide la configuración de Meson del proyecto (`-std=c++11 -O3`, nivel de advertencias 3), ya que Meson no estaba instalado. Cada instancia se ejecutó con las semillas 0 a 99, lo que da 100 ejecuciones por instancia, y se verificó que cada conjunto devuelto fuera una cobertura válida cuyo peso coincidiera con el costo que imprime el programa.

Para determinar el óptimo exacto, cada instancia se resolvió como un programa entero con la función `milp` de SciPy 1.13.1, que llama al solver HiGHS: minimizar Σ w_i x_i sujeto a x_u + x_v ≥ 1 para cada arista, con cada x_i en {0, 1}. El solver reportó una solución óptima para las cinco instancias. Las cifras de convergencia vienen de una copia del código que solo agrega impresiones a la salida de error estándar; lo agregado no genera números aleatorios, y el resultado de la copia coincidió con el del binario sin modificar en cada ejecución trazada.

Hay un límite para cualquier comparación con 2019: en libc++, `std::default_random_engine` es `minstd_rand`, mientras que libstdc++ de GCC usa `minstd_rand0`, y no sé qué toolchain usé en 2019. Por eso, una misma semilla puede producir hoy una ejecución distinta.

## Resultados

Las cinco instancias tienen pesos unitarios, así que el costo de una cobertura es igual a su número de vértices.

### La instancia del reporte

La cobertura greedy de la re-ejecución es {0, 1, 3, 5, 7, 9, 11, 13}, con costo 8, idéntica a la figura 3 del reporte. Para la colonia, 23 de las 100 semillas devolvieron exactamente la cobertura de la figura 4 del reporte, {3, 5, 7, 9, 11, 13}, y el programa entero confirma que 6 es óptimo. Las otras 77 semillas devolvieron 7 vértices, y cada una de esas coberturas era el óptimo más el vértice 0.

La semilla 5 es la menor que reproduce la figura 4 del reporte; llegó a 6 en el ciclo 26 y se detuvo tras 175 ciclos. La semilla por defecto, 0, devuelve {0, 3, 5, 7, 9, 11, 13}: mejoró de 8 a 7 en el ciclo 36 y se detuvo tras 185 ciclos.

### Las cinco instancias

| Instancia | Vértices | Aristas | Greedy | Colonia, 100 semillas | Promedio de la colonia | Semillas en el óptimo | Óptimo exacto |
|---|---|---|---|---|---|---|---|
| prueba.txt (la del reporte) | 15 | 24 | 8 | 6–7 | 6.77 | 23 | 6 |
| g.txt | 20 | 55 | 13 | 8–10 | 8.99 | 3 | 8 |
| grafica2.txt | 100 | 174 | 54 | 54 | 54.0 | 0 | 53 |
| trampa2-100.txt | 100 | 2,548 | 74 | 52–74 | 58.68 | 62 | 52 |
| trampa200.txt | 200 | 4,555 | 133 | 68 | 68.0 | 100 | 68 |

<figure>
  <img src="/research/vertex-cover-ant-colony/es/greedy-vs-aco.svg" width="440" height="542" alt="Gráfica de puntos con el tamaño de las coberturas de greedy y de la colonia de hormigas en cinco instancias, medido como porcentaje sobre el óptimo exacto. prueba.txt: greedy 8, colonia de hormigas 6–7, óptimo 6. g.txt: greedy 13, colonia de hormigas 8–10, óptimo 8. grafica2.txt: greedy 54, colonia de hormigas 54, óptimo 53. trampa2-100.txt: greedy 74, colonia de hormigas 52–74, óptimo 52. trampa200.txt: greedy 133, colonia de hormigas 68, óptimo 68." loading="lazy" decoding="async">
  <figcaption>Figura 2. Tamaño de las coberturas de greedy y de la colonia de hormigas en las cinco instancias del repositorio, graficado como la distancia sobre el óptimo exacto de un programa entero. El reporte solo probó prueba.txt (greedy 8, colonia 6); cada marca de esta figura viene de la re-ejecución de octubre de 2026 del código sin modificar, con 100 semillas por instancia.</figcaption>
</figure>

Las dos instancias "trampa" tienen una estructura que engaña a greedy. trampa2-100.txt es un ciclo de 52 vértices más 48 vértices, cada uno unido a los 52 vértices del ciclo; greedy toma primero los 48 vértices de grado alto y luego 26 vértices del ciclo, para un total de 74, mientras que el óptimo es el ciclo mismo. La colonia llegó a 52 con 62 semillas y a 53 con 8, y 30 semillas nunca mejoraron el 74 de greedy. Con la semilla 0, la última mejora llegó en el ciclo 131 y la ejecución se detuvo tras 280 ciclos. trampa200.txt es un ciclo de 135 vértices más 65 vértices unidos a 68 de los vértices del ciclo; las 100 semillas pasaron de 133 al óptimo de 68, y la semilla 0 lo alcanzó en el primer ciclo.

Las otras dos instancias se comportan de forma distinta. En g.txt, 95 semillas terminaron en 9, 3 alcanzaron el óptimo de 8 y 2 terminaron en 10, todas por debajo del 13 de greedy. En grafica2.txt, ninguna semilla mejoró el 54 de greedy, y el óptimo es 53. Así, la frase del reporte sobre gráficas más grandes se cumple en las dos instancias trampa y falla en grafica2.txt.

Todas las ejecuciones imprimieron un tiempo transcurrido de 0 segundos; el programa reporta segundos enteros.

## Discusión

### Por qué 77 ejecuciones se quedan en 7

El paso de exploración (src/AntColony.cpp:152–163) está pensado como una ruleta en la que cada vértice recibe casillas en proporción a su puntuación:

```cpp
vector<double> vertexProb(ceil(argSum));
int i = 0;
for (int j = 0; j < this->n; j++)
{
  double vertexChances = /* score of vertex j */;
  for (; i < vertexChances; i++)
  {
    vertexProb[i] = j;
  }
}
```

El contador `i` conserva su valor de un vértice al siguiente, y el loop lo compara con la puntuación propia de cada vértice. Como resultado, el vértice j recibe casillas solo cuando su puntuación supera todas las puntuaciones anteriores, y en ese caso solo recibe las casillas entre ese máximo anterior y su propia puntuación. Toda casilla entre la mayor puntuación individual y la suma de todas las puntuaciones conserva su valor inicial 0, que es el vértice 0. Por eso, en un paso de exploración el vértice 0 recibe una parte de las casillas que no tiene relación con su puntuación, y la hormiga lo agrega a su cobertura cubra o no una arista nueva. El vértice inicial aleatorio también se agrega sin condiciones, y nada elimina los vértices redundantes al final.

La re-ejecución agregó dos diagnósticos. Ninguno de los dos está en el repositorio.

- Un vértice es redundante cuando el resto de la cobertura sigue cubriendo todas las aristas. En prueba.txt, 77 de las 100 coberturas contenían un vértice redundante, siempre el vértice 0; en g.txt, 97 de 100 lo contenían, y era el vértice 0 en 96. Al eliminar los vértices redundantes se obtiene el óptimo con las 100 semillas en ambas instancias.
- También se compiló una copia modificada, con una ruleta acumulada sobre los vértices que todavía cubren aristas. Alcanzó el óptimo con 95 de 100 semillas en prueba.txt, 57 en g.txt y 22 en grafica2.txt, pero solo con 2 en trampa2-100.txt y 28 en trampa200.txt.

El segundo resultado sugiere que parte del éxito del código original en las instancias trampa viene del defecto. Además de favorecer al vértice 0, la ruleta defectuosa le da las casillas de los vértices empatados al de menor índice, y las coberturas óptimas de las dos instancias trampa están formadas por vértices de índice bajo: los vértices del 0 al 51 en trampa2-100.txt y los vértices pares del 0 al 134 en trampa200.txt.

### Vacíos en el reporte y en el repositorio

- El reporte usa una sola instancia y presenta sus resultados solo como dos figuras, sin semilla ni número de ejecuciones.
- En el reporte, la afirmación sobre gráficas más grandes no tiene datos que la respalden.
- La ecuación 2 mezcla índices: su numerador está escrito τ_j η_rk, su denominador suma τ_j η_rk sobre r, y usa "max" donde quiere decir argmax.
- El reporte usa el mismo símbolo φ para las tasas de actualización local y global; el código tiene dos constantes, ambas de 0.9.
- El texto nunca define INTENTOS, el límite de ciclos sin mejora; en el código se llama `MAX_IMPROVE_ATTEMPTS`.
- La bibliografía tiene dos entradas, Dorigo (1992) y Shyu, Yin y Lin (2004), y el texto no cita ninguna. La carpeta pdf/ del repositorio también contiene Tuba y Jovanovic (2009), guardado como Tuba-Rovanovic.pdf, que el reporte no cita.
- El README dice que el solver usa el algoritmo "with some few variants". El código implementa una variante, que refuerza solo la mejor cobertura conocida, y Tuba y Jovanovic (p. 940) identifican esa variante, el sistema de hormigas elitista (elitist ant system), con el algoritmo de Shyu, Yin y Lin.
- El programa que está en el repositorio nunca imprime ni dibuja la cobertura greedy; su opción de Graphviz dibuja solo la cobertura de la colonia. El repositorio no muestra cómo se generó la figura 3 del reporte.
- El historial de commits no aclara qué parámetros produjeron la figura 4 del reporte. El commit que subió `THRESHOLD` de 0.5 a 0.9, `EVAPORATION_RATE` de 0.2 a 0.9 y `PHI` de 0.12 a 0.9 (e276a4d) está fechado 82 segundos antes del commit que agregó el texto de la sección de resultados, y la distribución aleatoria de la ruleta cambió de `uniform_int_distribution<double>` a `uniform_int_distribution<int>` 28 segundos después de ese commit.
- El reporte tiene fecha "Mayo 2019", mientras que el texto de su sección de resultados, sus figuras 3 y 4 y el PDF final se agregaron al repositorio el 7 de junio de 2019.

Si volviera a este código, corregiría la ruleta y eliminaría los vértices redundantes de cada cobertura antes de compararla con la mejor.

## Cómo reproducirlo

Clona el repositorio y compílalo. El README compila con Meson (`meson build && cd build`, luego `ninja`); la re-ejecución de 2026 compiló las fuentes directamente porque Meson no estaba instalado.

```sh
git clone https://github.com/JCastrejonE/MWVCP_AntColony.git
cd MWVCP_AntColony
clang++ -std=c++11 -O3 -I include src/*.cpp -o MWVCP_AntColony
./MWVCP_AntColony -f inputs/prueba.txt -s 5
```

Con la semilla 5, el programa imprime una cobertura de 6 vértices y `Evaluation: 6`. Para dibujar el resultado, agrega `-g prueba.gv` y renderiza el archivo con Graphviz (`dot prueba.gv -Tsvg > prueba.svg`).

Para contar los resultados de 100 semillas:

```sh
for s in $(seq 0 99); do ./MWVCP_AntColony -f inputs/prueba.txt -s $s | grep Evaluation; done | sort | uniq -c
```

En la re-ejecución de octubre de 2026, esto imprimió `23 Evaluation: 6` y `77 Evaluation: 7`. Reemplaza prueba.txt por cualquier otro archivo de inputs/ para obtener el resto de la tabla. Como el motor aleatorio cambia entre bibliotecas estándar de C++, una compilación con GCC puede asignar las semillas a ejecuciones distintas.

La re-ejecución calculó los óptimos con `milp` de SciPy. El siguiente script plantea el mismo programa entero con PuLP 3.3.1 y el solver CBC que trae incluido, y devuelve el mismo óptimo en las cinco instancias. Guárdalo como cover_ilp.py:

```python
import sys
import pulp

tok = open(sys.argv[1]).read().split()
n, m = int(tok[0]), int(tok[1])
w = [int(t) for t in tok[2:2 + n]]
e = [(int(tok[2 + n + 2 * k]), int(tok[3 + n + 2 * k])) for k in range(m)]
prob = pulp.LpProblem("cover", pulp.LpMinimize)
x = [pulp.LpVariable(f"x{i}", cat="Binary") for i in range(n)]
prob += pulp.lpSum(w[i] * x[i] for i in range(n))
for u, v in e:
    prob += x[u] + x[v] >= 1
prob.solve(pulp.PULP_CBC_CMD(msg=0))
print(f"{sys.argv[1]}: optimum {round(pulp.value(prob.objective))} ({pulp.LpStatus[prob.status]})")
```

```sh
python3 -m venv .venv
.venv/bin/pip install pulp
.venv/bin/python cover_ilp.py inputs/prueba.txt
```

Imprime `inputs/prueba.txt: optimum 6 (Optimal)`.

## Referencias

1. Juan C. Castrejón (2019). <span lang="es">"Algoritmo de Colonia de Hormigas para el problema de Cobertura de Vértices de Peso Mínima"</span>, reporte en español. tex/main.tex y tex/Colonia_de_Hormigas.pdf en el repositorio.
2. S. J. Shyu, P. Y. Yin, B. M. T. Lin (2004). "An Ant Colony Optimization Algorithm for the Minimum Weight Vertex Cover Problem", *Annals of Operations Research*, 131, 283–304. Incluido en la bibliografía del reporte; hay una copia en pdf/Shyu-Yin.pdf.
3. M. Dorigo (1992). "Optimization, Learning and Natural Algorithm", tesis doctoral, Politecnico di Milano, Italia. Incluida en la bibliografía del reporte con este título.
4. M. Tuba, R. Jovanovic (2009). "An Analysis of Different Variations of Ant Colony Optimization to the Minimum Weight Vertex Cover Problem", *WSEAS Transactions on Information Science and Applications*, 6(6), 936–945. En el repositorio como pdf/Tuba-Rovanovic.pdf; no aparece en la bibliografía del reporte.
5. Archivos fuente del repositorio: include/AntColony.hpp (parámetros), src/AntColony.cpp (cobertura greedy inicial, regla de transición, ruleta, actualizaciones de feromona), src/main.cpp (formato de entrada y opciones), meson.build, README.md y las cinco instancias de inputs/.
6. SciPy 1.13.1, la función `milp` con el solver HiGHS, usada para los óptimos exactos en la re-ejecución de 2026; PuLP 3.3.1 con CBC da los mismos valores.
