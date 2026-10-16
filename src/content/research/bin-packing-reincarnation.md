---
title: Bin packing with a reincarnation heuristic
description: My 2019 C++ solver for one-dimensional bin packing, re-run in 2026 with 30 seeds per instance and compared with best-fit and a lower bound.
summary: A 2019 bin packing solver, re-run in October 2026. It reached the lower bound of 11 bins on 20 items in every run, and it used more bins than online best-fit on 200 and 2000 items.
abstract: >-
  Bin packing asks for the fewest bins of a fixed capacity that hold a list of items. In June 2019 I wrote a C++ solver for the Heuristic Combinatorial Optimization course at UNAM's Facultad de Ciencias. It uses a population heuristic based on Sharma's Reincarnation Algorithm: each soul is a permutation of the items, decoded into bins with next-fit, and in each generation a soul acts as a guru, a commoner or an atheist, which decides whether it moves toward a better-ranked soul or swaps its first item with a random one. The README links a paper in Spanish that the repository doesn't contain, so every result comes from the October 2026 re-run with 30 seeds per instance. On 20 items every run used 11 bins, equal to the lower bound. On 200 items it used 125 to 136 bins and on 2000 items 1304 to 1310, while the online best-fit baseline in the same program used 119 and 1032.
date: '2019-06'
context: 'Course project · Heuristic Combinatorial Optimization · UNAM Facultad de Ciencias'
group: academic
order: 3
repo: https://github.com/JCastrejonE/BPP_Reincarnation
links:
  - label: 'Related: simulated annealing for the traveling salesman problem'
    href: /research/tsp-simulated-annealing/
  - label: 'Related: ant colonies for minimum weight vertex cover'
    href: /research/vertex-cover-ant-colony/
---

## The problem

In one-dimensional bin packing you receive `n` items with integer sizes and an unlimited supply of bins with integer capacity `C`. Every item goes into exactly one bin, no bin may hold more than `C`, and the goal is to use as few bins as possible. The solver reads an instance as `n C` followed by the `n` sizes (`src/main.cpp:57-63`), and its objective is the number of bins.

The repository ships three instances (_instancia_ is Spanish for "instance"):

| File | Items | Capacity | Sum of sizes | Sizes | Items above C/2 | Lower bound |
|---|---|---|---|---|---|---|
| `inputs/instancia20.txt` | 20 | 20 | 213 | 4 to 20 | 10 | 11 |
| `inputs/instancia200.txt` | 200 | 50 | 5515 | 1 to 50 | 114 | 111 |
| `inputs/instancia2000.txt` | 2000 | 80 | 80831 | 1 to 80 | 993 | 1011 |

The lower bound in the last column is the sum of the sizes divided by the capacity, rounded up. No packing can use fewer bins, although on some instances the real optimum is higher.

The repository also includes a small generator that draws each size uniformly from 1 to `C` (`src/instance-gen.cpp:47-54`). In the October 2026 re-run, the generator built on macOS reproduced the three files with seeds 100, 10 and 5, byte for byte except that `inputs/instancia200.txt` has no final newline, so the three instances came from the repository's own generator.

## The method

The method in the 2019 code is based on the Reincarnation Algorithm that Sharma published at CINTI 2010 [4].

### Souls, karma and next-fit

The heuristic keeps a population of candidate solutions that the code calls souls (`include/Soul.hpp`). A soul's `karma` is a permutation of the item sizes. Its cost is the number of bins that next-fit produces from that permutation: traverse the list, add each item to the current bin if it fits, and otherwise close the bin and open a new one (`src/Reincarnation.cpp:199-216`).

Next-fit never returns to a closed bin. For this reason the order of the permutation determines the packing, and the items of each bin are always a contiguous run of the permutation.

### One generation

At the start of each generation (`src/Reincarnation.cpp:40-124`) the program performs these steps:

1. It sorts the population by cost. The first soul is the best guru, and if its cost improves on the best so far, the program stores its permutation. This is the only place where the incumbent solution is recorded.
2. Every soul whose cost equals the best guru's cost increments a counter, and every other soul resets its counter to 0. When the counter reaches 20, the soul attains Nirvana and leaves the population.
3. Every soul draws a lifetime uniformly from 1 to 20.
4. The program draws the number of gurus uniformly from 1 to a third of the living souls. The gurus are the best-ranked souls.
5. The 3 worst souls go to a suspension queue. Once the queue holds more than 6, the oldest return with a new lifetime, so each suspended soul stays out of the population for two generations.
6. Among the remaining souls, a random number become commoners, each assigned to a community guru, and the rest become atheists.

Then each living soul makes one move per pass until its lifetime reaches 0 (`src/Reincarnation.cpp:126-197`). A guru picks a random position and swaps two of its items so that it matches the best guru at that position. A commoner does the same with its community guru as the model. An atheist swaps its first item with a random position. Every move costs one unit of lifetime and triggers a full next-fit evaluation.

The program applies every move, whether the cost increases or decreases. Selection happens only at the generation boundary, through the sort, the roles, Nirvana and the suspension queue.

### Parameters

These are the values in the last commit (`include/Reincarnation.hpp:12-17`):

| Constant | Value | Meaning |
|---|---|---|
| `GENERATIONS` | 1000 | maximum number of generations |
| `POPULATION` | 200 | initial number of souls |
| `MAX_LIFETIME` | 20 | lifetimes are drawn from 1 to 20 |
| `NIRVANA_THRESHOLD` | 20 | consecutive generations tied with the best before a soul leaves |
| `WORST_SOULS` | 3 | souls suspended per generation |
| `SUSPENSION` | 2 | generations a suspended soul waits |

The first commit, on 2019-06-10, used 250 generations, a population of 25, lifetimes up to 80 and a Nirvana threshold of 3. The second commit, on 2019-06-12, raised the generations to 1000. The last commit, on 2019-06-19, set the population, the lifetime limit, the Nirvana threshold and the number of suspended souls to the values above.

### The baseline

The last commit is titled "Added best fit algorithm for comparison". It adds `include/best-fit.hpp`, which places each item, in file order, into the open bin that leaves the least space, and opens a new bin when no bin fits. The `--greedy` flag prints its result next to the heuristic's (`src/main.cpp:74-75`). The header's comment calls it the "best fit online algorithm" (`include/best-fit.hpp:9-10`), and it never sorts the items.

## What the repository contains

The repository has three commits between 2019-06-10 and 2019-06-19, all by me. It contains the solver, the generator, the three instances and a README.

It contains no results. The README links `tex/Reencarnacion.pdf` as a "PDF document in spanish", but no commit has ever contained a `tex/` folder, and the link on GitHub returns a 404 page. There's no output file, log or table either, so I can't determine which bin counts I obtained in 2019 or with which parameters. The README also says "The ant colony optimization heuristic can be tuned to experiment different results" (`README.md:44`), although this solver has no ant colony. The same sentence appears in the README of my ant colony solver, MWVCP_AntColony.

## What was measured

The last commit was re-run on 2026-10-16 on an Apple Silicon Mac with Apple clang 21.0.0 and libc++. Meson wasn't installed, so the build used flags equivalent to the repository's Meson release build (C++11, `-O3`). Each instance ran with seeds 0 to 29 and the `--greedy` flag, which gives 90 runs. All 90 exited normally.

For every run, a check confirmed that the printed solution is a permutation of the input sizes and that next-fit on it gives exactly the printed bin count. To trace the search over time, a second copy was built with my original debug `printf` enabled (`src/Reincarnation.cpp:28`) plus a generation counter. That copy makes no extra random draws, and its final bin counts match the unmodified binary in all 90 runs.

As a reference, three more values were computed for each instance with separate Python code: Martello and Toth's L2 lower bound [2], first-fit decreasing and next-fit in file order. They aren't part of the repository, and the tables below label them as reference values.

## Results

### The heuristic over 30 seeds

| Instance | Best | Median | Mean | Worst | Std. dev. | Seeds at best | Time per run |
|---|---|---|---|---|---|---|---|
| 20 items, C = 20 | 11 | 11 | 11 | 11 | 0 | all 30 | 0.022–0.039 s |
| 200 items, C = 50 | 125 | 127 | 127.97 | 136 | 2.92 | 4, 13, 28 | 0.466–0.492 s |
| 2000 items, C = 80 | 1304 | 1308 | 1307.4 | 1310 | 1.61 | 19, 26 | 4.488–4.752 s |

All values are from the October 2026 re-run. Each run used the full 1000 generations.

<figure>
  <img src="/research/bin-packing-reincarnation/bins-vs-lower-bound.svg" width="512" height="572" alt="Three panels, one per instance. On 20 items, the reincarnation heuristic used 11 bins in all 30 runs, equal to the lower bound of 11, and online best-fit used 12. On 200 items, it used 125 to 136 bins against 119 for best-fit and a lower bound of 111. On 2000 items, it used 1304 to 1310 bins against 1032 for best-fit and a lower bound of 1011." loading="lazy" decoding="async">
  <figcaption>Figure 1. Bins used on the three instances in the repository, from the October 2026 re-run with 30 seeds per instance; the line runs from the best to the worst seed, with a dot at the median. The lower bound is the sum of item sizes divided by the bin capacity, rounded up, and each panel has its own scale.</figcaption>
</figure>

### Against the baseline and the bounds

| Instance | Lower bound | L2 bound (reference) | Reincarnation best / median / worst | Online best-fit (`--greedy`) | First-fit decreasing (reference) | Next-fit, file order (reference) |
|---|---|---|---|---|---|---|
| 20 items | 11 | 11 | 11 / 11 / 11 | 12 | 11 | 14 |
| 200 items | 111 | 118 | 125 / 127 / 136 | 119 | 118 | 146 |
| 2000 items | 1011 | 1012 | 1304 / 1308 / 1310 | 1032 | 1014 | 1337 |

Measured against the simple lower bound, the heuristic's best seed is 0%, 12.61% and 28.98% above it on the three instances, and online best-fit is 9.09%, 7.21% and 2.08% above it.

On 20 items the heuristic always reaches the optimum, since 11 bins equals the lower bound. The 30 seeds produced 16 distinct 11-bin packings. Figure 2 shows the one from seed 0.

<figure>
  <img src="/research/bin-packing-reincarnation/fill-levels-20-items.svg" width="480" height="372" alt="Eleven columns, one per bin of capacity 20, each stacked with the sizes of its items. Seven bins are full. Bin 3 holds 17, bins 6 and 9 hold 19 and bin 7 holds 18, which leaves 7 of the 220 units of capacity empty." loading="lazy" decoding="async">
  <figcaption>Figure 2. Fill levels of the 11-bin packing from the October 2026 re-run with seed 0 on the 20-item instance, with bin capacity 20. Each column is one bin, stacked with its items in the order next-fit placed them; all 30 seeds reached 11 bins, and seed 0 is the first of them.</figcaption>
</figure>

On 200 items the L2 bound and first-fit decreasing both give 118, so the optimum is exactly 118. The heuristic's best seed used 125 bins, 7 above the optimum and 6 above online best-fit. Its worst seed used 136.

On 2000 items the optimum lies between 1012 and 1014. The heuristic's best seed used 1304 bins, 272 more than online best-fit.

### Progress over the generations

This table gives the best bin count recorded at the start of each generation, as the minimum, median and maximum over the 30 seeds (re-run, instrumented copy):

| Generation | 20 items | 200 items | 2000 items |
|---|---|---|---|
| 1 | 12 / 12 / 12 | 141 / 141 / 141 | 1317 / 1317 / 1317 |
| 10 | 11 / 12 / 12 | 138 / 139.5 / 141 | 1312 / 1314 / 1317 |
| 100 | 11 / 11 / 11 | 136 / 137 / 139 | 1307 / 1312 / 1314 |
| 250 | 11 / 11 / 11 | 133 / 136 / 137 | 1304 / 1310 / 1313 |
| 500 | 11 / 11 / 11 | 127 / 132.5 / 137 | 1304 / 1309 / 1311 |
| 1000 | 11 / 11 / 11 | 125 / 127 / 136 | 1304 / 1308 / 1310 |

As a reference, 200 random shuffles of each instance were also decoded with next-fit in Python, and the best of them used 11, 141 and 1318 bins. On the 2000-item instance, the best recorded solution went from 1317 at generation 1 to between 1304 and 1310 at generation 1000.

## Discussion

The heuristic solves the small instance in every run and uses more bins than a one-pass greedy rule on the two larger ones. I think two design choices explain most of the gap, although this is my interpretation of the code and the repository makes no claim about it.

Next-fit only puts consecutive items of the permutation in the same bin, so a good packing needs many specific runs of items at once, and a single swap changes very few of them. Online best-fit avoids this problem completely, because it considers every open bin for every item. And since the program accepts every move, a soul can lose an improvement with its next move, before the sort at the following generation records it.

A reading of the code in 2026 also identified these defects:

- **The seed doesn't change the initial population.** The constructor shuffles the 200 souls before `main` calls `setRandomEngine(seed)` (`src/Reincarnation.cpp:15`, `src/main.cpp:64-65`). In the re-run, the best soul of generation 1 was 12, 141 and 1317 bins for every seed.
- **Seeds 0 and 1 give the same run.** In the libc++ of the re-run, `std::default_random_engine` is `minstd_rand`, which treats seed 0 as seed 1. The outputs for seeds 0 and 1 are identical except for the "Seed:" line on all three instances. Seed 0 is the README's default.
- **The Nirvana loop has undefined behavior.** It erases elements from the population inside a range-based `for` over the same vector (`src/Reincarnation.cpp:53-69`). A build with AddressSanitizer reports a container overflow at line 53 on the 20-item instance with seed 0. The release build didn't crash in any of the 90 runs.
- **A commoner can follow another commoner.** The community guru index is drawn from 0 to the number of gurus inclusive (`src/Reincarnation.cpp:82`), but the gurus occupy positions 0 to one less than that number.
- **Improvements in the last generation are lost**, since the program records the best solution only at the start of a generation (`src/Reincarnation.cpp:44-49`).

The results have three limits. The re-run used one platform, and the C++ standard doesn't fix the algorithms behind `std::shuffle` and `uniform_int_distribution`, so a build with another standard library can produce different bin counts. The three instances are random uniform instances, and there are only three of them. And since the paper is missing, the re-run can't be compared with it.

## Reproduce it

These commands work from a fresh clone of commit `ca61726`. The re-run executed them on macOS with Apple clang 21.0.0:

```sh
git clone https://github.com/JCastrejonE/BPP_Reincarnation.git
cd BPP_Reincarnation
clang++ -std=c++11 -O3 -I include src/Reincarnation.cpp src/main.cpp -o BPP_Reincarnation
clang++ -std=c++11 -O3 -I include src/instance-gen.cpp -o instance-gen
./BPP_Reincarnation -f inputs/instancia20.txt -s 0 --greedy
```

The last command prints the seed-0 permutation, `Bins: 11` and `Best-fit: 12`. To run the 30 seeds of one instance:

```sh
for s in $(seq 0 29); do
  ./BPP_Reincarnation -f inputs/instancia200.txt -s $s --greedy | grep -E 'Bins|Best-fit'
done
```

The program prints elapsed time in whole seconds (`src/main.cpp:78`), so it reports 0 for the 20- and 200-item runs; the times in the results table were measured from outside the process. To regenerate the instance files on macOS:

```sh
./instance-gen -n 20 -b 20 -s 100     # same as inputs/instancia20.txt
./instance-gen -n 200 -b 50 -s 10     # same as inputs/instancia200.txt, which has no final newline
./instance-gen -n 2000 -b 80 -s 5     # same as inputs/instancia2000.txt
```

The README describes a Meson build (`meson build`, then `ninja` inside `build`). The 2026 re-run didn't use that route, because Meson wasn't installed on the machine.

## References

1. Juan C. Castrejón, [BPP_Reincarnation](https://github.com/JCastrejonE/BPP_Reincarnation), commit `ca61726` (2019-06-19). Files used: `README.md`, `meson.build`, `include/Reincarnation.hpp`, `include/Soul.hpp`, `include/best-fit.hpp`, `src/Reincarnation.cpp`, `src/main.cpp`, `src/instance-gen.cpp` and `inputs/instancia{20,200,2000}.txt`.
2. Silvano Martello and Paolo Toth, "Lower bounds and reduction procedures for the bin packing problem", _Discrete Applied Mathematics_ 28(1), 59–70, 1990. Source of the L2 bound used as a reference value.
3. jarro2783, [cxxopts](https://github.com/jarro2783/cxxopts), the command-line option parser bundled in `include/jarro2783/cxxopts.hpp` and credited in the README.
4. Anurag Sharma, "A new optimizing algorithm using reincarnation concept", _2010 11th International Symposium on Computational Intelligence and Informatics (CINTI)_, Budapest, Hungary, IEEE, 281–288, November 2010. DOI [10.1109/CINTI.2010.5672231](https://doi.org/10.1109/CINTI.2010.5672231). Source of the Reincarnation Algorithm on which the method is based.
