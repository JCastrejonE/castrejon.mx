---
title: Simulated annealing for the traveling salesman problem
description: My 2019 C++ solver for the traveling salesman problem on 40 and 150 world cities, re-run in 2026 to reproduce its results and test its paper's claims.
summary: A 2019 simulated annealing solver for the traveling salesman problem, re-run in October 2026. The 2019 revision of the code reproduced its 150-city result, 0.164943812, exactly, and the re-run measured what the paper had only shown in plots.
abstract: >-
  The traveling salesman problem asks for the shortest route through a set of cities. In 2019, for the Heuristic Combinatorial Optimization course at UNAM's Facultad de Ciencias, I wrote a C++ solver for it and a 10-page paper in Spanish. The solver searches for the shortest open path through 40 or 150 of the 1,092 cities in the project's database, where only 187 of the 780 pairs among the 40 cities have a connection. It uses simulated annealing and ends with a pairwise-swap local search. The paper reported three plots and no numbers, so the code was re-run in October 2026. The 2019 revision reproduced its 150-city result, a cost of 0.164943812, with the same sequence of 922,000 accepted costs. On 40 cities the committed code reached the best cost on record, 0.308330781, in 26 of 100 seeds, and the paper's first parameter set reached it in none.
date: '2019-05'
context: 'Course project · Heuristic Combinatorial Optimization · UNAM Facultad de Ciencias'
group: academic
order: 1
repo: https://github.com/JCastrejonE/TSP_SimulatedAnnealing
links:
  - label: 'Paper (PDF, in Spanish)'
    href: https://github.com/JCastrejonE/TSP_SimulatedAnnealing/blob/master/tex/Recocido_Simulado.pdf
  - label: 'Related: ant colonies for minimum weight vertex cover'
    href: /research/vertex-cover-ant-colony/
  - label: 'Related: bin packing with a reincarnation heuristic'
    href: /research/bin-packing-reincarnation/
---

## The problem

My paper, <i lang="es">Algoritmo de Recocido Simulado para el problema del Agente Viajero</i> ("Simulated Annealing Algorithm for the Traveling Salesman Problem", May 2019), defines the problem in the usual way: given a set of cities and the distance between each pair, find the shortest route that visits each city exactly once and returns to the starting point (`tex/main.tex:35`). The cost function in the paper (`main.tex:69`), the course handout and the code all sum consecutive legs only, so the solver actually minimizes an open path with no return leg. Everything below uses that definition, since it's the one the results come from.

The cities come from the SQLite database in the repository (`db/tsp.db`). It holds 1,092 cities in 135 countries, with latitude and longitude, and 123,403 connections between pairs of cities, each with a distance. The handout describes this graph as "very dense" and incomplete, and inside a single instance most pairs of cities have no connection:

| Instance file | Cities | Pairs with a connection |
|---|---|---|
| `inputs/instancia40.txt` | 40 | 187 of 780 |
| `inputs/instancia40_.txt` | 40 | 183 of 780 |
| `inputs/instancia150.txt` | 150 | 2,608 of 11,175 |
| `inputs/instancia150_.txt` | 150 | 2,632 of 11,175 |

(<i lang="es">Instancia</i> is Spanish for "instance".) The two files whose names end in `_` were committed on 2019-03-26 and differ from the originals in two cities each. The paper never names the file it used and only mentions "a TSP instance with 40 cities", so this essay compares against `instancia40.txt`, which has the same cities as the 2019 result files.

### The cost function

The course handout <i lang="es">Función de costo para TSP</i> by Canek Peláez (`pdf/fcosto.pdf`, February 13, 2019) defines the cost, and the code implements it (`src/Annealing.cpp:92-169`). For an instance S:

- The normalizer N(S) is the sum of the |S| − 1 largest connection distances among the cities of S, and max_d(S) is the largest of them.
- The natural distance d(u, v) is the haversine distance with R = 6,373,000 m.
- The augmented weight of a leg is its stored distance when the connection exists, and d(u, v) × max_d(S) when it doesn't.
- The cost of a path is the sum of the augmented weights of its legs, divided by N(S).

The handout's purpose for this design is that a path using only existing connections evaluates between 0 and 1, and any path with a missing connection evaluates above 1. The handout calls the first kind feasible (<i lang="es">factible</i>). Computed from the database, N(S) = 173,613,497.69 and max_d(S) = 4,940,077.59 for `instancia40.txt`, and N(S) = 722,404,322.59 and max_d(S) = 4,978,506.48 for `instancia150.txt`. On all 123,403 connections, the ratio of the stored distance to the haversine distance lies between 0.9999985 and 1.0000016, so the stored distances are great-circle distances in meters. For a feasible path, the cost is therefore its length in meters divided by N(S).

<figure>
  <img src="/research/tsp-simulated-annealing/tour-40.svg" width="600" height="279" alt="Map of 40 cities joined by one open path. It starts in Charlotte, United States, runs south through Mexico, Central America and South America, crosses the Atlantic from Belém, Brazil, to Dakar, Senegal, continues through North Africa, Europe, the Middle East, India, Central Asia, China and Southeast Asia, and ends in Tokyo, Japan." loading="lazy" decoding="async">
  <figcaption>Figure 1. The best 40-city path on record: cost 0.308330781 and length 53,530,385.30 m. A 2026 re-run of the committed code found it with seeds 7 and 10, and the 2019 results file has the same path in reverse order. Legs are straight segments in longitude and latitude, and gray dots are the other database cities inside the frame.</figcaption>
</figure>

## The method

The code follows the course notes <i lang="es">Capítulo 1, Aceptación por umbrales</i> (`pdf/hoc.pdf`, Procedures 1 to 5). Its parts are these:

- **Neighbor.** Swap two cities at positions chosen uniformly at random. The program updates the cost in O(1) from the legs that change (commit `f0f1896`, 2019-03-04).
- **Acceptance.** At temperature T, a neighbor s′ of the current path s is accepted when f(s′) < f(s) + T (`main.tex:92`, `Annealing.cpp:208`).
- **Batches.** A batch collects L accepted neighbors and returns their average cost. It also ends after M rejections; in the committed code the rejection counter is never reset inside a batch (the reset line is commented out at `Annealing.cpp:223`), while the paper's pseudocode counts every attempt (`main.tex:113`).
- **Cooling.** At each temperature the program runs batches while each batch's average is no greater than the previous one's, then multiplies T by φ. It stops when T is no longer above ε (`Annealing.cpp:234-247`). It keeps the best path it has seen.
- **Start.** The initial path is a random shuffle of the instance. A binary search determines the temperature at which a fraction P of the neighbors of that path are accepted, starting from T = 8 with P = 0.95. In two instrumented re-runs the search ended at T = 948743.849456787 (40 cities, seed 7) and T = 151519.968750000 (150 cities, seed 4).
- **Final sweep.** After the annealing phase, the code applies the best improving swap of two cities to the best path, again and again, until no swap improves it (`Annealing.cpp:39-90`). It's on by default, and the paper doesn't describe it. A `--use-hybrid` option runs the sweep each time a new best path appears; the 2026 re-runs didn't use it.

The acceptance rule is deterministic: T is the margin by which a neighbor's cost may exceed the current cost and still be accepted. Each decrease of T narrows that margin, so the slow decrease of the temperature that the paper describes (`main.tex:78`) gradually limits how much worse an accepted neighbor can be.

Three sets of parameters appear in this essay:

| Parameter | Committed code (`2a52c94`) | 2019 revision (`4f5a890`) | Paper figures 1, 2, 3 |
|---|---|---|---|
| L, batch size | 3000 | 1000 | 1000, 6000, 6000 |
| M, attempt limit per batch | 30000 (10 L) | 100000 (100 L), reset on each acceptance | 3 L |
| ε, final temperature | 0.001 | 0.0001 | 0.01 |
| φ, cooling factor | 0.95 | 0.95 | 0.95, 0.95, 0.99 |
| P and starting T | 0.95 and 8 | 0.95 and 8 | not stated |
| Final sweep | on | absent | not mentioned |

The committed values are in `include/Annealing.hpp:10-16`; the 2019 revision's are in its `include/Annealing.h:9-13` and `src/main.cpp:89`; the paper's are at `main.tex:195`, `:210` and `:220`.

## What the paper and the history report

The paper shows three gnuplot plots of the cost of every 500th accepted solution on a 40-city instance, one per parameter set in the table. They have no captions, and the paper reports no final costs, seeds, run times or 150-city run, although its abstract promises "comparative results of runs with different parameters" (`main.tex:29`). Its conclusions, translated from Spanish, are these:

1. A larger batch explores the search space better and increases the probability of a good solution, and it also increases run time (`main.tex:208`).
2. The closer the cooling factor is to 1, the more iterations run before the stopping condition (`main.tex:218`).
3. "In the 3 cases, testing with different seeds, the best solution found turned out to be the same permutation of cities, which suggests that parameter tuning does not greatly affect small instances of the problem" (`main.tex:228`).
4. On larger instances, such as 150 cities, experimentation with the parameters is essential to obtain better solutions (`main.tex:230`).

The plots use a linear axis up to 1.2 × 10<sup>7</sup>, so every cost below about 10<sup>5</sup> sits on the horizontal axis, including the whole feasible phase.

The git history has more. Commit `4f5a890` (2019-03-06) added four output files, and commit `a22090f` deleted them the same day:

- `results150.txt`, seeds 130 to 149 on 150 cities: 0.187759377 for seed 130, 0.171172030 for seed 131 and 0.164943812 for seeds 132 to 149, with 73 to 94 s per seed.
- `solution150.txt`, the 150-city path for seed 132.
- `seed132.txt`, the cost of each of the 922,000 accepted solutions for seed 132.
- `results_100-199.txt`, seeds 100 to 199 on 40 cities: 0.310470829 for seeds 100 to 112 and 0.308330781 for seeds 113 to 199.

In that revision the best path is a `static` member that the program never resets between seeds (`include/Annealing.h:27-29, 75-76`), so each line reports the best over all seeds run so far in the process. The repeated values after seed 132 and after seed 113 are carry-over. The committed code resets the best path for each run (`Annealing.cpp:22-25`).

## What the re-run measured

In October 2026 the code was rebuilt and re-run on macOS (arm64) with Apple clang 21 and the system SQLite, one process per seed:

1. Revision `4f5a890`, unchanged, against the files committed with it. That revision has seed 132 hard-coded and reads the instance from standard input. For the seed range 130 to 149, only the loop bounds changed.
2. The committed code (`2a52c94`) on the four instances with seeds 0 to 10, plus seeds 100 to 199 on `instancia40.txt` and 130 to 149 on `instancia150.txt`.
3. The paper's three parameter sets on `instancia40.txt` with seeds 0 to 10 and 100 to 199, built from the committed sources with only the constants in `include/Annealing.hpp` changed. The paper doesn't state P, the starting T or the seeds, so the committed values stayed, and the final sweep stayed on because the program has no working way to disable it.

Items 2 and 3 add up to 497 runs, 444 of them on `instancia40.txt`. As an independent check, the handout's cost function was reimplemented in Python against the database. It gives 0.164943812 for the 2019 150-city path, and 0.310470829 and 0.308330781 for the two 2019 40-city paths, and every leg of these three paths is an existing connection.

## Results

### The 2019 run on 150 cities reproduces exactly

Revision `4f5a890` produced the same path as `solution150.txt`, with cost 0.164943812, and the same sequence of 922,000 accepted costs as `seed132.txt`, in the same order. Some values differ in the last printed decimals, by at most 3.72529e-08 on values between 4,454,585 and 4,808,361, and none of those differences changes an acceptance decision. With the seed range 130 to 149, every seed's path and cost matched `results150.txt`. In 2026 the seed 132 run took 5 to 6 s; the 2019 file reports 83 s.

The reproduction depends on the C++ standard library. `std::default_random_engine` is implementation-defined: libc++ defines it as `minstd_rand`, and GCC's libstdc++ as `minstd_rand0`. Since the trace matches in exact order, the 2019 runs used the same engine and distributions as current Apple libc++, and a build with libstdc++ should give different paths for the same seeds (untested). The same engine makes seeds 0 and 1 identical, because `minstd_rand` replaces a seed of 0 with 1, so the program's default range, `-s 0 -e 10`, gives 10 distinct runs out of 11.

<figure>
  <img src="/research/tsp-simulated-annealing/tour-150.svg" width="600" height="279" alt="Map of 150 cities joined by one open path. It starts in Kumasi, Ghana, goes east through Africa, the Middle East and Asia as far as Japan, returns west through China, South Asia, Southeast Asia, Mongolia, Russia and Europe, continues south to southern Africa and back north through the Middle East and North Africa, crosses from Guinea-Bissau to Brazil, and ends in Charlotte, United States, after passing through South America, Central America and Mexico." loading="lazy" decoding="async">
  <figcaption>Figure 2. The best 150-city path, with cost 0.164943812 and length 119,156,122.54 m, from the 2019 run with seed 132. A 2026 re-run of that revision reproduced it; gray dots are the other database cities inside the frame.</figcaption>
</figure>

<figure>
  <img src="/research/tsp-simulated-annealing/cost-150-seed132.svg" width="600" height="380" alt="Log-scale chart of the cost of each accepted path over 922,000 accepted solutions. The cost starts above 6 million. It first falls below 1 at accepted solution 121,551, goes above 1 for the last time at accepted solution 326,920, then decreases slowly and reaches 0.164943812 at accepted solution 913,718." loading="lazy" decoding="async">
  <figcaption>Figure 3. Cost of every accepted path in the 2019 run on 150 cities with seed 132, from the 922,000 values in <code>seed132.txt</code>, on a log scale. The band spans the lowest and highest cost in each block of 1,000 accepted solutions; the first feasible path appears at accepted solution 121,551 and the best at 913,718.</figcaption>
</figure>

The first accepted cost is 6,516,054.583547368. The search accepts infeasible paths until accepted solution 326,920, and then spends the remaining 595,080 accepted solutions among feasible ones.

### The committed code

| Instance | Seeds | Feasible | Best | Median feasible | Best before final sweep |
|---|---|---|---|---|---|
| `instancia40.txt` | 0–10 | 11 of 11 | 0.308330781 (seeds 7, 10) | 0.326036767 | 0.308330781 |
| `instancia40.txt` | 100–199 | 96 of 100 | 0.308330781 (26 seeds) | 0.317977745 | 0.308330781 |
| `instancia40_.txt` | 0–10 | 11 of 11 | 0.308707227 (seeds 2, 9) | 0.335553469 | 0.308707227 |
| `instancia150.txt` | 0–10 | 10 of 11 | 0.174476204 (seed 4) | 0.193297486 | 0.200165125 |
| `instancia150.txt` | 130–149 | 17 of 20 | 0.178417046 (seed 140) | 0.190970371 | 0.200444840 |
| `instancia150_.txt` | 0–10 | 8 of 11 | 0.170681015 (seed 7) | 0.183887928 | 0.191679788 |

On 40 cities, the best path from the committed code is the 2019 best path traversed in reverse. It's the lowest cost in all 444 re-runs on `instancia40.txt` and in the 2019 record, though nothing proves it optimal. The 4 infeasible runs out of 100 ended with costs near 205601.3.

On 150 cities, the best cost over 31 seeds, 0.174476204, is worse than the 0.164943812 of the 2019 revision, which used a smaller final temperature (ε = 0.0001) and no final sweep. The sweep improved every feasible 150-city run (10 of 10 and 17 of 17); for seed 4 it took the best accepted cost from 0.200165125 to 0.174476204. On `instancia40.txt` it improved 5 of 11 and 44 of 96 feasible runs. A run accepted between 1,409,284 and 1,761,450 solutions on the 40-city instances and between 1,211,613 and 1,308,203 on the 150-city instances. The program reported 2 to 3 s for 157 of these 164 runs, and between 72 and 903 s for the other 7.

<figure>
  <img src="/research/tsp-simulated-annealing/cost-40-seed7.svg" width="600" height="380" alt="Log-scale chart of the cost of each accepted path over 1,749,911 accepted solutions in a re-run on 40 cities. The cost starts above 10 million, first falls below 1 at accepted solution 360,112, and reaches 0.308330781 at accepted solution 1,730,885." loading="lazy" decoding="async">
  <figcaption>Figure 4. The same view for a 2026 re-run of the committed code on 40 cities with seed 7 (L = 3000, M = 30000, ε = 0.001, φ = 0.95, final sweep on). The first feasible path appears at accepted solution 360,112, and the cost reaches 0.308330781 at accepted solution 1,730,885 of 1,749,911.</figcaption>
</figure>

### The paper's parameters

With seeds 100 to 199 on `instancia40.txt`, the paper's three parameter sets and the committed code compare as follows:

| Parameters | Feasible | Best | Median feasible | Runs at 0.308330781 | Best before final sweep | Accepted solutions per run |
|---|---|---|---|---|---|---|
| L 1000, φ 0.95 (paper, first) | 62 of 100 | 0.318230368 | 0.357823749 | 0 | 0.350965649 | 198,107 to 241,960 |
| L 6000, φ 0.95 (paper, second) | 96 of 100 | 0.308330781 | 0.337156377 | 3 | 0.322736673 | 1,317,578 to 1,520,004 |
| L 6000, φ 0.99 (paper, third) | 100 of 100 | 0.308330781 | 0.325614325 | 7 | 0.323987376 | 5,767,265 to 6,966,512 |
| L 3000, φ 0.95 (committed) | 96 of 100 | 0.308330781 | 0.317977745 | 26 | 0.308330781 | 1,534,845 to 1,761,450 |

The paper's sets use M = 3 L and ε = 0.01; the committed code uses M = 30000 and ε = 0.001.

<figure>
  <img src="/research/tsp-simulated-annealing/rerun-40-final-costs.svg" width="600" height="524" alt="Four histograms of final cost on 40 cities, one per parameter set, each over seeds 100 to 199. With L 1000 and φ 0.95, 62 of 100 runs are feasible and most end between 0.33 and 0.38. With L 6000 and φ 0.95, 96 are feasible. With L 6000 and φ 0.99, all 100 are feasible and most end between 0.31 and 0.34. With the committed code, 96 are feasible and the tallest bar is the lowest bin, 0.30 to 0.31, with 31 runs." loading="lazy" decoding="async">
  <figcaption>Figure 5. Final cost of each feasible run on 40 cities with seeds 100 to 199, re-run in 2026 with the paper's three parameter sets and with the committed code, all with the final sweep on. Bins are 0.01 wide, and the number above each row's tallest bar is its count of runs.</figcaption>
</figure>

The re-run agrees with the paper on the first two conclusions. The plotted runs in the paper end at about 229,000, 1,460,000 and 5,980,000 accepted solutions (read off the plots), and each value falls inside the range of the re-runs with the same parameters, although the paper's seeds remain unknown. The median feasible cost improves from 0.357823749 to 0.337156377 to 0.325614325 as L and φ grow, and seeds 0 to 10 show the same order (0.370797817, 0.352663452 and 0.319501461).

The third conclusion didn't hold. Within each parameter set, different seeds ended on different paths. With L = 1000, none of 111 runs (seeds 0 to 10 and 100 to 199) reached 0.308330781, the best was 0.318230368, and 38 of the 100 runs with seeds 100 to 199 ended infeasible. With ε = 0.01, the annealing phase alone never reached 0.308330781 in any run of the three sets; the final sweep, which the paper doesn't describe, made the last improvements. With the committed ε = 0.001, the annealing phase reaches it by itself.

### The 2019 40-city file came from uncommitted code

Revision `4f5a890` doesn't reproduce `results_100-199.txt`. On `instancia40.txt`, seed 100 ends infeasible at 113493.146933171, where the file reports 0.310470829. Seed 101 never terminates: the run was stopped after 150 s, and its last 200,000 output values alternate between 0.315819476 and 0.315801619, so consecutive batch averages are equal and the loop `while (p <= q)` never exits. The file therefore came from code that was never committed. Its best path is still the best on record, since the committed code found the same path in reverse.

## Discussion

The 150-city run reproduces from its commit, accepted solution by accepted solution, as long as the build uses libc++, and an independent implementation of the cost function confirms the two best costs. The paper's statements about batch size and cooling factor agree with the re-runs.

The paper's weak point is its evidence. It reports no numbers, and its one quantitative claim, that every parameter set found the same best permutation, fails for its own first parameter set. Its parameters differ from those of the code it ships, and it omits the final sweep, which at ε = 0.01 performs the last part of the search. Figure 5 shows, from a re-run, the per-seed comparison the paper lacked.

Neither best cost has a proof of optimality; the re-run computed no lower bound and used no exact solver. Run times are whole seconds reported by the program, measured while other jobs shared the machine, so they are indicative only.

### Errors in the paper and the code

- The problem definition describes a closed route (`main.tex:35`); the cost function and the code compute an open path.
- The acceptance inequality is strict in §4.1 (`main.tex:92`) and non-strict in Procedure 2 (`main.tex:114`).
- Eq. (2) multiplies w(u, v) by a constant α for pairs without a connection (`main.tex:184-190`), but w is defined only on connections; the code uses d(u, v) × max_d(S), as the handout does. The paper never defines N(S), although its plots show normalized costs.
- The figures have a `\label` and no `\caption`, so the text refers to them by position only.
- The course handouts in `pdf/` aren't cited, and the two bibliography entries have no venue or publisher.
- `--skip-sweep` has no effect, because `main.cpp:80` tests the option name `final-sweep`, which is never declared.
- Without `-p`, the program writes to an uninitialized file pointer (`main.cpp:158-160`) and exits with a segmentation fault.
- The database path is `../db/tsp.db` (`main.cpp:13`), so the program only works from a directory next to `db/`, such as `build/`.
- `meson.build` lists `src/Main.cpp` and the file is `src/main.cpp`, so the Meson build works only on a case-insensitive file system.
- With several seeds in one `-p` file, all points go into one gnuplot data block, and the plot draws them as one line.

## Reproduce it

These commands were tested on a fresh clone on macOS (arm64) with the Xcode Command Line Tools, which provide clang and SQLite. The direct `clang++` command uses the same flags as the Meson release build. Run the program from `build/` and always pass `-p`:

```
git clone https://github.com/JCastrejonE/TSP_SimulatedAnnealing.git
cd TSP_SimulatedAnnealing
mkdir build && cd build
clang++ -std=c++11 -O3 -I../include ../src/Annealing.cpp ../src/Graph.cpp ../src/main.cpp -lsqlite3 -o TSP_SimmulatedAnnealing
./TSP_SimmulatedAnnealing -f ../inputs/instancia40.txt -s 7 -e 7 -p plot40.txt
```

The run prints the path and `Evaluation: 0.308330781`. With `-f ../inputs/instancia150.txt -s 4 -e 4` it prints `Evaluation: 0.174476204`, the committed code's best on 150 cities; the 2019 result, 0.164943812, comes from revision `4f5a890`, below. The file `plot40.txt` is a gnuplot script with every accepted cost.

To reproduce the 2019 run on 150 cities and compare its trace with the committed one:

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

`tail` shows 0.164943812 before the two timing lines, and the last command prints `922000 3.72529e-08`: the number of accepted costs compared and the largest difference between the two traces. For the paper's parameter sets, change `BATCH_SIZE`, `MAX_BATCH_ATTEMPTS` (to `BATCH_SIZE * 3`), `EPSILON` (to 0.01) and `PHI` in `include/Annealing.hpp` at the committed revision, rebuild, and run seeds 100 to 199.

## References

1. Juan C. Castrejón. <i lang="es">Algoritmo de Recocido Simulado para el problema del Agente Viajero</i>. May 2019. Repository files `tex/main.tex` and `tex/Recocido_Simulado.pdf`.
2. Canek Peláez. <i lang="es">Función de costo para TSP</i>. Course handout, February 13, 2019. Repository file `pdf/fcosto.pdf`.
3. <i lang="es">Capítulo 1, Aceptación por umbrales</i>. Course notes, pages 3 to 7, no author shown. Repository file `pdf/hoc.pdf`.
4. Kirkpatrick, S.; Gelatt Jr, C. D.; Vecchi, M. P. (1983). <i>Optimization by Simulated Annealing</i>. Cited in [1], which gives no venue.
5. Applegate, D. L.; Bixby, R. M.; Chvátal, V.; Cook, W. J. (2006). <i>The Traveling Salesman Problem</i>. Cited in [1], which gives no publisher.
6. Repository at commit `2a52c94` (2019-05-13): `src/Annealing.cpp`, `src/main.cpp`, `include/Annealing.hpp`, `meson.build`, `db/tsp.db` and the four files in `inputs/`.
7. Repository at commit `4f5a890` (2019-03-06): `include/Annealing.h`, `src/main.cpp`, `results150.txt`, `results_100-199.txt`, `seed132.txt` and `solution150.txt`, deleted in commit `a22090f`.
8. The October 2026 re-run: 497 runs of the committed sources with the committed and the paper's parameters, and the runs of revision `4f5a890` described above.
