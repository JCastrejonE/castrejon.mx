---
title: 'Minimum weight vertex cover with an ant colony'
description: 'A 2026 re-run of my 2019 ant colony solver for the minimum weight vertex cover problem, with 100 seeds per instance, compared with exact optima.'
summary: 'I wrote this C++ ant colony solver for the minimum weight vertex cover problem in 2019 at UNAM. In 2026 it was re-run on the five instances in its repository, and every result was compared with the exact optimum.'
abstract: 'In 2019 I wrote a C++ solver for the minimum weight vertex cover problem for the Heuristic Combinatorial Optimization course at UNAM’s Facultad de Ciencias, with a short report in Spanish. It follows the ant colony method of Shyu, Yin and Lin (2004): 10 ants choose vertices by pheromone and by uncovered edges per unit of weight, and the colony starts from a greedy cover. The report tested one 15-vertex, 24-edge graph built so that greedy fails: greedy used 8 vertices and the colony found 6. In 2026 the unmodified code was re-run with 100 seeds on that graph and on the four other instances in the repository, against exact optima. On the report’s graph, 23 runs reached the optimum of 6 and 77 returned 7, the optimum plus vertex 0, which a defect in the random selection step favors. On the other four instances, the colony reached the optimum on three and never improved on greedy on the fourth.'
date: '2019'
context: 'Course project · Heuristic Combinatorial Optimization · UNAM Facultad de Ciencias'
group: 'academic'
order: 2
repo: 'https://github.com/JCastrejonE/MWVCP_AntColony'
links:
  - label: 'Report (PDF, in Spanish)'
    href: 'https://github.com/JCastrejonE/MWVCP_AntColony/blob/master/tex/Colonia_de_Hormigas.pdf'
  - label: 'Traveling salesman with simulated annealing'
    href: '/research/tsp-simulated-annealing/'
  - label: 'Bin packing'
    href: '/research/bin-packing-reincarnation/'
---

## Problem

A vertex cover of an undirected graph G = (V, E) is a set of vertices V′ ⊆ V that touches every edge: for each edge (u, v), u or v belongs to V′. When the vertices carry weights, a minimum weight vertex cover is a cover whose total weight is as small as possible. The problem is NP-hard, so no polynomial-time algorithm for it is known.

I wrote the solver and its report in 2019 for the Heuristic Combinatorial Optimization course at the Facultad de Ciencias of UNAM. The report, <span lang="es">"Algoritmo de Colonia de Hormigas para el problema de Cobertura de Vértices de Peso Mínima"</span>, is 9 pages in Spanish, and it sets a practical goal: a metaheuristic that finds solutions that are "good enough" (<span lang="es">*suficientemente buenas*</span>) in reasonable time. The cost of a cover is the sum of its weights, f(V′) = Σ w(v) over v ∈ V′. The solver is a C++11 command-line program built with Meson.

## Method

The method follows Shyu, Yin and Lin (2004) closely. My report lists their paper in its bibliography but never says in the text which parts come from it, so I'll state it here: the overall procedure, the graph representation, the transition rule, both pheromone updates, the stopping criterion and the greedy initial solution all come from that paper. So do 10 ants, q₀ = 0.9, an evaporation rate of 0.9 (their α) and the formula for τ₀ (their p. 291). The limit of 150 cycles without improvement doesn't appear in their paper.

### How an ant builds a cover

Each ant walks on the complete graph over V, so it can move from any vertex to any other. An edge of that complete graph has weight 1 while it belongs to E and is still uncovered, and weight 0 otherwise; this is how each ant tracks the edges its partial cover still misses.

In every cycle, each of the 10 ants starts on a random vertex and then adds one vertex per step until its set covers every edge. At each step the ant scores every vertex j as τ_j · η_j, where τ_j is the pheromone on j and η_j is the number of edges that j would newly cover, divided by the weight of j. With probability q₀ = 0.9 the ant takes the vertex with the highest score. Otherwise, according to the report, it draws a vertex at random with probability proportional to its score; the code's version of this step has a defect, which I describe in the discussion.

Two pheromone rules steer the colony. Each time an ant takes vertex i, a local update moves its pheromone toward the initial value, τ_i = (1 − φ)τ_i + φτ₀; the report describes this as lowering the vertex's appeal to the other ants, so that they explore vertices not yet visited. After all ants finish, a global update multiplies the pheromone of every vertex by (1 − φ) and then adds φ/(total weight of the best known cover) to each vertex of that cover.

The colony starts from a greedy cover, which repeatedly takes the vertex with the largest ratio of uncovered edges to weight. That cover is the first best known solution, and the code replaces it only with a strictly cheaper one (src/AntColony.cpp:205), so the program never returns a cover worse than the greedy one.

### Parameters

| Parameter | Report (main.tex:154) | Code (include/AntColony.hpp:12–17) |
|---|---|---|
| Number of ants | k = 10 | `ANTS 10` |
| Probability of taking the best-scoring vertex | q₀ = 0.9 | `THRESHOLD 0.9` |
| Local update rate | φ = 0.9 | `PHI 0.9` |
| Global update rate | φ = 0.9 | `EVAPORATION_RATE 0.9` |
| Stop after this many cycles without improvement | INTENTOS = 150 | `MAX_IMPROVE_ATTEMPTS 150` |
| Initial pheromone | τ₀ = n(n − a)/C | the same formula (src/AntColony.cpp:36–38) |

Here n is the number of vertices, C is the cost of the greedy cover and a is its number of vertices. The code also multiplies every score by `RELATIVE_SIGNIFICANCE` (1) and by 10; neither factor appears in the report.

## What was measured

### The report's experiment

The report tests one instance: 15 vertices, 24 edges and equal weights, "built so that the greedy algorithm ... does not obtain the optimal solution". The file inputs/prueba.txt matches it: it has these sizes, every weight 1, and the same 24 edges that the report's Figures 3 and 4 draw. A path runs through vertices 2 to 14, and vertices 0 and 1 are each joined to vertices 3, 5, 7, 9, 11 and 13. Vertices 0 and 1 have degree 6, more than any other vertex, so greedy takes them first and still needs the six odd path vertices to cover the path, for 8 vertices in total. The six odd vertices alone already cover every edge.

<figure>
  <img src="/research/vertex-cover-ant-colony/best-cover-prueba.svg" width="440" height="386" alt="Graph of the report's instance: a path through vertices 2 to 14, with vertices 0 and 1 each joined to vertices 3, 5, 7, 9, 11 and 13. Those six vertices are filled and form the best cover, the exact optimum of 6; the other nine are hollow. Greedy picks vertices 0 and 1 first and ends with 8 vertices." loading="lazy" decoding="async">
  <figcaption>Figure 1. The report's instance (inputs/prueba.txt: 15 vertices, 24 edges, every weight 1), redrawn for this page, with the 6-vertex cover from the report's Figure 4 filled in; an integer program confirms that 6 is the optimum. In the October 2026 re-run, 23 of 100 seeds returned this cover and the other 77 returned it plus vertex 0.</figcaption>
</figure>

The report gives its results as two figures. Counting their filled vertices gives 8 for greedy (the report's Figure 3: vertices 0, 1, 3, 5, 7, 9, 11 and 13) and 6 for the colony (Figure 4: vertices 3, 5, 7, 9, 11 and 13). The report doesn't state the seed, the number of runs, the running time, the compiler or the machine.

It also claims, without data, that the colony "shows similar performance on much larger graphs". The repository contains four other instances that the report never mentions: g.txt, grafica2.txt, trampa2-100.txt and trampa200.txt.

### The October 2026 re-run

On 2026-10-16 the unmodified code was compiled with Apple clang 21.0.0 on arm64 macOS, using the flags that the project's Meson configuration requests (`-std=c++11 -O3`, warning level 3), since Meson wasn't installed. Every instance was run with seeds 0 to 99, which gives 100 runs per instance, and each returned set was checked to be a valid cover whose weight equals the cost the program prints.

To determine the exact optimum, each instance was solved as an integer program with the `milp` function of SciPy 1.13.1, which calls the HiGHS solver: minimize Σ w_i x_i subject to x_u + x_v ≥ 1 for every edge, with every x_i in {0, 1}. The solver reported an optimal solution for all five instances. The convergence numbers come from a copy of the code that only adds prints to standard error; it draws no random numbers, and its result matched the unmodified binary on every traced run.

One limit applies to any comparison with 2019: on libc++, `std::default_random_engine` is `minstd_rand`, while GCC's libstdc++ uses `minstd_rand0`, and I don't know which toolchain I used in 2019. A given seed can therefore produce a different run today.

## Results

All five instances have unit weights, so the cost of a cover equals its number of vertices.

### The report's instance

The re-run's greedy cover is {0, 1, 3, 5, 7, 9, 11, 13}, cost 8, identical to the report's Figure 3. For the colony, 23 of the 100 seeds returned exactly the cover of the report's Figure 4, {3, 5, 7, 9, 11, 13}, and the integer program confirms that 6 is optimal. The other 77 seeds returned 7 vertices, and every one of those covers was the optimum plus vertex 0.

Seed 5 is the lowest seed that reproduces the report's Figure 4; it reached 6 in cycle 26 and stopped after 175 cycles. The default seed, 0, returns {0, 3, 5, 7, 9, 11, 13}: it improved from 8 to 7 in cycle 36 and stopped after 185 cycles.

### All five instances

| Instance | Vertices | Edges | Greedy | Colony, 100 seeds | Colony mean | Seeds at the optimum | Exact optimum |
|---|---|---|---|---|---|---|---|
| prueba.txt (the report's) | 15 | 24 | 8 | 6–7 | 6.77 | 23 | 6 |
| g.txt | 20 | 55 | 13 | 8–10 | 8.99 | 3 | 8 |
| grafica2.txt | 100 | 174 | 54 | 54 | 54.0 | 0 | 53 |
| trampa2-100.txt | 100 | 2,548 | 74 | 52–74 | 58.68 | 62 | 52 |
| trampa200.txt | 200 | 4,555 | 133 | 68 | 68.0 | 100 | 68 |

<figure>
  <img src="/research/vertex-cover-ant-colony/greedy-vs-aco.svg" width="440" height="542" alt="Dot plot of greedy and ant colony cover sizes on five instances, measured as percent above the exact optimum. prueba.txt: greedy 8, ant colony 6–7, optimum 6. g.txt: greedy 13, ant colony 8–10, optimum 8. grafica2.txt: greedy 54, ant colony 54, optimum 53. trampa2-100.txt: greedy 74, ant colony 52–74, optimum 52. trampa200.txt: greedy 133, ant colony 68, optimum 68." loading="lazy" decoding="async">
  <figcaption>Figure 2. Greedy and ant colony cover sizes on the five instances in the repository, plotted as the distance above the exact optimum from an integer program. The report tested only prueba.txt (greedy 8, colony 6); every mark here comes from the October 2026 re-run of the unmodified code with 100 seeds per instance.</figcaption>
</figure>

The two "trampa" (Spanish for trap) instances have a structure that misleads greedy. trampa2-100.txt is a 52-vertex cycle plus 48 vertices, each joined to all 52 cycle vertices; greedy takes the 48 high-degree vertices first and then 26 cycle vertices, for 74, while the optimum is the cycle itself. The colony reached 52 with 62 seeds and 53 with 8, and 30 seeds never improved on the greedy 74. With seed 0, the last improvement came in cycle 131 and the run stopped after 280 cycles. trampa200.txt is a 135-vertex cycle plus 65 vertices that are joined to 68 of the cycle's vertices; all 100 seeds went from 133 to the optimum of 68, and seed 0 reached it in the first cycle.

The other two instances behave differently. On g.txt, 95 seeds ended at 9, 3 reached the optimum of 8 and 2 ended at 10, all of them below the greedy 13. On grafica2.txt, no seed improved on the greedy 54, and the optimum is 53. So the report's sentence about larger graphs holds for the two trap instances and fails on grafica2.txt.

Every run printed an elapsed time of 0 seconds; the program reports whole seconds.

## Discussion

### Why 77 runs stop at 7

The exploration step (src/AntColony.cpp:152–163) is meant to be a roulette in which each vertex receives slots in proportion to its score:

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

The counter `i` persists from one vertex to the next, and the loop compares it with each vertex's own score. As a result, vertex j receives slots only when its score exceeds every earlier score, and then only the slots between that earlier maximum and its own score. Every slot between the largest single score and the sum of all scores keeps its initial value 0, which is vertex 0. In an exploration step vertex 0 therefore receives a share of the slots that has nothing to do with its score, and the ant adds it to its cover whether or not it covers a new edge. The random start vertex is added unconditionally as well, and nothing removes redundant vertices at the end.

The re-run added two diagnostics. Neither is in the repository.

- A vertex is redundant when the rest of the cover still covers every edge. On prueba.txt, 77 of the 100 covers contained a redundant vertex, vertex 0 every time; on g.txt, 97 of 100 did, and it was vertex 0 in 96. Removing the redundant vertices gives the optimum in all 100 seeds on both instances.
- A modified copy was also built, with a cumulative roulette over the vertices that still cover edges. It reached the optimum with 95 of 100 seeds on prueba.txt, 57 on g.txt and 22 on grafica2.txt, but only with 2 on trampa2-100.txt and 28 on trampa200.txt.

The second result suggests that part of the original code's success on the trap instances comes from the defect. Besides favoring vertex 0, the defective roulette gives the slots of tied vertices to the one with the lowest index, and the optimal covers of both trap instances consist of low-index vertices: vertices 0 to 51 in trampa2-100.txt and the even vertices from 0 to 134 in trampa200.txt.

### Gaps in the report and the repository

- The report uses one instance and gives its results only as two figures, without a seed or a run count.
- The claim about larger graphs has no data behind it in the report.
- Equation 2 mixes indices: its numerator is written τ_j η_rk, its denominator sums τ_j η_rk over r, and it uses "max" where it means argmax.
- The report uses the same symbol φ for the local and the global update rates; the code has two constants, both 0.9.
- The text never defines INTENTOS, the limit of cycles without improvement; it's `MAX_IMPROVE_ATTEMPTS` in the code.
- The bibliography has two entries, Dorigo (1992) and Shyu, Yin and Lin (2004), and the text cites neither. The repository's pdf/ folder also holds Tuba and Jovanovic (2009), saved as Tuba-Rovanovic.pdf, which the report doesn't cite.
- The README says the solver uses the algorithm "with some few variants". The code implements one variant, which reinforces only the best known cover, and Tuba and Jovanovic (p. 940) identify that variant, the elitist ant system, with the algorithm of Shyu, Yin and Lin.
- The committed program never prints or draws the greedy cover; its Graphviz option draws only the colony's cover. The repository doesn't show how the report's Figure 3 was produced.
- The commit history doesn't settle which parameters produced the report's Figure 4. The commit that raised `THRESHOLD` from 0.5 to 0.9, `EVAPORATION_RATE` from 0.2 to 0.9 and `PHI` from 0.12 to 0.9 (e276a4d) is dated 82 seconds before the commit that added the text of the results section, and the roulette's random distribution changed from `uniform_int_distribution<double>` to `uniform_int_distribution<int>` 28 seconds after it.
- The report is dated "Mayo 2019", while the text of its results section, its Figures 3 and 4 and the final PDF were committed on 7 June 2019.

If I returned to this code, I'd fix the roulette and remove redundant vertices from each cover before comparing it with the best one.

## Reproduce it

Clone the repository and compile it. The README builds with Meson (`meson build && cd build`, then `ninja`); the 2026 re-run compiled the sources directly because Meson wasn't installed.

```sh
git clone https://github.com/JCastrejonE/MWVCP_AntColony.git
cd MWVCP_AntColony
clang++ -std=c++11 -O3 -I include src/*.cpp -o MWVCP_AntColony
./MWVCP_AntColony -f inputs/prueba.txt -s 5
```

With seed 5 the program prints a cover of 6 vertices and `Evaluation: 6`. To draw the result, add `-g prueba.gv` and render the file with Graphviz (`dot prueba.gv -Tsvg > prueba.svg`).

To count the outcomes over 100 seeds:

```sh
for s in $(seq 0 99); do ./MWVCP_AntColony -f inputs/prueba.txt -s $s | grep Evaluation; done | sort | uniq -c
```

In the October 2026 re-run this printed `23 Evaluation: 6` and `77 Evaluation: 7`. Replace prueba.txt with any other file in inputs/ to obtain the rest of the table. Since the random engine differs between C++ standard libraries, a build with GCC can map seeds to different runs.

The re-run computed the optima with SciPy's `milp`. The script below states the same integer program with PuLP 3.3.1 and its bundled CBC solver, and it returns the same optimum on all five instances. Save it as cover_ilp.py:

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

It prints `inputs/prueba.txt: optimum 6 (Optimal)`.

## References

1. Juan C. Castrejón (2019). <span lang="es">"Algoritmo de Colonia de Hormigas para el problema de Cobertura de Vértices de Peso Mínima"</span>, report in Spanish. tex/main.tex and tex/Colonia_de_Hormigas.pdf in the repository.
2. S. J. Shyu, P. Y. Yin, B. M. T. Lin (2004). "An Ant Colony Optimization Algorithm for the Minimum Weight Vertex Cover Problem", *Annals of Operations Research*, 131, 283–304. Listed in the report's bibliography; a copy is in pdf/Shyu-Yin.pdf.
3. M. Dorigo (1992). "Optimization, Learning and Natural Algorithm", PhD thesis, Politecnico di Milano, Italy. Listed in the report's bibliography with this title.
4. M. Tuba, R. Jovanovic (2009). "An Analysis of Different Variations of Ant Colony Optimization to the Minimum Weight Vertex Cover Problem", *WSEAS Transactions on Information Science and Applications*, 6(6), 936–945. In the repository as pdf/Tuba-Rovanovic.pdf; absent from the report's bibliography.
5. Repository source files: include/AntColony.hpp (parameters), src/AntColony.cpp (greedy start, transition rule, roulette, pheromone updates), src/main.cpp (input format and options), meson.build, README.md and the five instances in inputs/.
6. SciPy 1.13.1, the `milp` function with the HiGHS solver, used for the exact optima in the 2026 re-run; PuLP 3.3.1 with CBC gives the same values.
