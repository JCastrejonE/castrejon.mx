---
title: 'Qué dijeron 225 defectos sobre construir software con agentes de programación'
description: 'De 225 defectos en un producto de hosting construido por agentes de Claude, 119 se encontraron al ejecutar el sistema real y 0 por una prueba unitaria en rojo.'
summary: 'El registro de defectos de Odoo Launchpad: de 225 defectos, 119 se encontraron al ejecutar el sistema real y 0 porque una prueba unitaria se puso en rojo. A partir de él derivé un modelo de desarrollo llamado Proof of Work.'
abstract: 'Odoo Launchpad fue un control plane de hosting para Odoo que agentes de programación de Claude construyeron casi por completo bajo mi dirección en Netlab entre julio y agosto de 2026; lo detuve en octubre de 2026. Su registro enumera 225 defectos, cada uno clasificado según lo que lo detectó. Al ejecutar el sistema real y leer su estado se encontraron 119 (53%); cuando el autor notó que una herramienta de medición estaba mal, 43; y cuando una prueba unitaria se puso en rojo, 0. De 178 defectos de producto, 173 se introdujeron bajo una spec aprobada. Dos familias de defectos eran invisibles al gate por construcción: herramientas de medición que confirmaban lo que su autor esperaba (47) y código al que un segundo llamador nunca llegó (35). En una ejecución medida, 1,545 de 2,241 segundos de tiempo de reloj de los agentes (69%) fueron inferencia del modelo. A partir de este registro derivé un modelo de desarrollo, Proof of Work, en el que un cambio se acepta con base en afirmaciones ejecutables cuyas verificaciones se rompieron a propósito y se vio que fallaban.'
date: '2026-09'
context: 'Caso de estudio · Odoo Launchpad · Netlab'
group: 'agents'
order: 1
repo: 'https://github.com/JCastrejonE/launchpad'
links:
  - label: 'Proof of Work (docs/PROOF-OF-WORK.md)'
    href: 'https://github.com/JCastrejonE/launchpad/blob/main/docs/PROOF-OF-WORK.md'
  - label: 'Ensayo complementario: la comparativa de configuraciones'
    href: '/es/research/setup-bake-off/'
  - label: 'breakcheck'
    href: 'https://github.com/JCastrejonE/breakcheck'
---

## Qué fue Launchpad

Odoo Launchpad fue un control plane para hospedar negocios en Odoo. Aprovisionaba un tenant de Odoo 18 o 19 en una flota de VPS, le daba a cada rama su propio servidor de staging, permitía que un agente de IA convirtiera una solicitud en código en esa rama y promovía el cambio a producción tras un solo clic humano. Agentes de Claude escribieron casi todo el producto bajo mi dirección en Netlab, entre julio y agosto de 2026, y lo detuve de forma deliberada en octubre de 2026. Todos los tenants eran negocios de prueba internos, y fui la única persona que operó el producto de punta a punta.

La parte de agentes del producto, que el repositorio llama Forge, ejecutaba cinco roles sobre el Claude Agent SDK. Un redactor de specs (spec drafter) escribía una spec a partir de un chat. Cuando una persona aprobaba la spec en el primer gate, un workflow de Temporal ejecutaba un initializer que la planeaba como un checklist, sesiones nuevas de coder que implementaban los elementos hasta completar el checklist, y un fixer que tenía una ronda de reparación. Después, el cambio pasaba por CI hasta un pull request y un segundo gate humano. El quinto rol, un supervisor, respondía bajo demanda desde el chat del proyecto y tenía impedido de forma mecánica enviar una señal de gate.

Lo que conservé del proyecto es el registro de cómo se construyó: 1,638 commits, 228 specs y una bitácora de cada error con la forma en que se encontró. El repositorio público es una instantánea depurada de él.

## La pregunta

El pipeline era spec-first en sus dos vías (tracks): sin una spec en `specs/`, no se escribía código. Cada cambio empezaba con una spec, y el trabajo de los agentes tenía que pasar un gate de build, typecheck, lint y pruebas. Quería determinar si ese esfuerzo estaba donde de verdad se detectaban los defectos, así que le hice una sola pregunta a cada defecto del registro: ¿qué lo detectó?

## Método

El registro tiene 225 defectos, deduplicados a partir de seis fuentes internas: el registro de cumplimiento del proyecto (73 filas de defectos), [`docs/VERIFICATION.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/VERIFICATION.md), la lista de trabajo pendiente `PENDING.md`, los hallazgos de una comparación A/B, las intenciones de specs que señalan como rota una spec anterior, y 95 commits `fix(` desde el 31 de julio. Los diez conteos por detector suman 225, un detector por defecto. El registro también agrupa los defectos en seis familias que describen la forma del error, y los seis conteos por familia suman 173.

El registro de cumplimiento en bruto se quitó de la instantánea pública, ya que está lleno de detalles de la operación de producción; [`docs/PROOF-OF-WORK.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/PROOF-OF-WORK.md) indica que sus conteos se tomaron de él antes de quitarlo. Por esta razón, los conteos del registro no se pueden volver a derivar desde el repositorio, y doy cada uno exactamente como lo imprime el registro.

Para el tiempo de los agentes, la fuente fueron las transcripciones de sesión que el Agent SDK escribe para cada worktree: archivos JSONL que guardan cada turno de cada sesión de agente con sus entradas de herramientas y sus marcas de tiempo. El análisis, descrito en [`docs/AGENT-PERFORMANCE.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/AGENT-PERFORMANCE.md), cuenta los bloques `tool_use` de cada mensaje del asistente y resta las marcas de tiempo entre un turno del asistente y su `tool_result` para separar el tiempo de inferencia del tiempo de herramientas.

## Qué detectó los defectos

<figure>
  <picture>
    <source media="(max-width: 40em)" srcset="/research/launchpad/es/detection-narrow.svg" width="343" height="454">
    <img src="/research/launchpad/es/detection.svg" width="672" height="424" alt="Gráfica de barras de lo que detectó los 225 defectos de Launchpad. Ejecutar el sistema real y leer su estado encontró 119 (53%); que el autor notara que su propio instrumento estaba mal, 43; una persona que lee código o documentación, 31; toparse con él al usar el producto, 16; el gate, 7; romper el código y ver una prueba ponerse en rojo, 4; un agente revisor, 2; una caída, 2; la revisión de specs, 1; una prueba unitaria que se pone en rojo, 0." loading="lazy" decoding="async">
  </picture>
  <figcaption>Figura 1. Qué detectó cada uno de los 225 defectos del registro de Launchpad, por conteo, con los porcentajes tal como los imprime el registro. Todos los tenants eran negocios de prueba internos y fui la única persona que operó el producto de punta a punta; las dos caídas fueron caídas del propio entorno de producción de Launchpad, que hospedaba esos tenants de prueba. Fuente: docs/PROOF-OF-WORK.md, sección 1.</figcaption>
</figure>

Al ejecutar el sistema real y leer su estado se encontraron 119 de los 225 defectos. En otros 43, el autor de una herramienta de medición notó que estaba mal, y el registro dice que esto siempre ocurrió después de que ya se había sacado una conclusión errónea. Una persona que leía código o documentación encontró 31, y 16 salieron a la luz mientras yo usaba el producto.

El gate encontró 7, todos fallas de build, typecheck o lint. **Una prueba unitaria que se puso en rojo encontró 0.**

El mismo registro agrega contexto. De los 178 defectos de producto, 173 (97%) se introdujeron bajo una spec aprobada, mientras que la revisión de specs detectó 1 defecto en total; el registro no define cuáles de los 225 cuentan como defectos de producto. Y según el propio conteo del registro, 76 de los 225 defectos solo podrían haberse detectado en un sistema en vivo.

## Las dos familias que el gate no podía ver

<figure>
  <picture>
    <source media="(max-width: 40em)" srcset="/research/launchpad/es/families-narrow.svg" width="343" height="762">
    <img src="/research/launchpad/es/families.svg" width="672" height="615" alt="Gráfica de barras de seis familias de defectos con notas: supuesto erróneo en el plan, 55; el instrumento confirma lo esperado, 47; segundo llamador sin conectar, 35; deriva del entorno o del deploy, 19; prueba que verifica la llamada, 9; el registro dice “hecho” antes que el mundo, 8. Cada fila indica qué cambia el modelo propuesto para esa familia." loading="lazy" decoding="async">
  </picture>
  <figcaption>Figura 2. Las seis familias de defectos del registro y lo que el modelo Proof of Work cambiaría en cada una. Las dos familias con barras de color son invisibles al gate (build, typecheck, lint y pruebas) por construcción: una herramienta de medición vive en shell desechable que ninguna prueba del repositorio ve, y una prueba unitaria llama a la función directamente, así que no puede notar a un segundo llamador que nunca pasa el nuevo parámetro. Los conteos de las seis familias suman 173 de los 225 defectos. Fuente: docs/PROOF-OF-WORK.md, secciones 1 y 4.</figcaption>
</figure>

La familia más grande son los supuestos erróneos en un plan (55), de los cuales 31 se encontraron en vivo y 8 en producción. Son errores sobre el mundo, como que Odoo instala módulos solo al inicializar la base de datos, y lo más que puede hacer un modelo de desarrollo es mover su detección a antes del merge. El registro identifica otras dos familias que el gate nunca habría podido ver, sin importar qué pruebas se hubieran escrito.

### Instrumentos que confirman lo que su autor esperaba (47)

Estos defectos vivían en el shell desechable que una sesión escribía para observar el sistema. `docs/VERIFICATION.md` enumera los de un solo día, el 13 de agosto de 2026. Un sondeo (poll) de la fila de sesión de un initializer esperó 52 minutos una fase que la ejecución no podía alcanzar, porque nunca se había presionado el gate 1. Un sondeo sobre una columna que no existía no imprimió nada, así que su ciclo terminó sin haber medido nada. Dos veces, un deploy cuyo pull remoto había fallado se dio por terminado porque el servicio reportaba `active`, y la segunda vez se reportó como desplegado el arreglo al prompt de la spec 0199 mientras el servidor seguía ejecutando el árbol anterior. Por último, `grep -oE '[$][0-9]+'` sobre el payload de una página coincidió con ids de chunks de React (`$1`, `$12`) y reportó que faltaban precios en una página que los mostraba.

Ninguno de estos instrumentos se incluyó en un commit, así que ninguna prueba los ejecutó nunca. De los 47, 36 se detectaron solo cuando su autor notó que una conclusión era errónea.

### Código que se construyó, se probó y nunca se alcanzó (35)

El caso más común, 17 de los 35, es una función a la que se le agregó un parámetro opcional que un segundo llamador nunca pasó. La regla 12 de `docs/VERIFICATION.md` registra cuatro de ellos en dos días (11 y 12 de agosto de 2026). En uno, `suppressDuplicateApprove` exentaba las ejecuciones de rama desde la spec 0142, pero ninguno de los dos puntos de llamada pasaba `branch`, así que el approve del gate 2 quedaba oculto en cada ejecución de rama.

La spec 0226, que se conserva en la instantánea, es el ejemplo más claro. Su título dice que la rama de pruebas es una copia neutralizada de producción, y todos los elementos del checklist, salvo los dos reservados para una persona, se marcaron como construidos. El elemento D2 le dio a `deployBranchStagingStack` un parámetro opcional `copyProduction?`, y en la instantánea ninguna de las dos llamadas a esa función en `packages/pipeline/src/activities.ts` lo pasa. La propia bitácora de handoff de la spec indica que no se había copiado ninguna base de datos. Una prueba unitaria llama a la función directamente, así que en la suite de pruebas la función siempre se alcanza.

Según el registro, los únicos mecanismos que cerraron de manera demostrable una forma recurrente de defecto fueron de tiempo de compilación: una unión requerida y un valor tipado.

## En qué se fue el tiempo de una sesión de agente

<figure>
  <picture>
    <source media="(max-width: 40em)" srcset="/research/launchpad/es/session-time-narrow.svg" width="343" height="154">
    <img src="/research/launchpad/es/session-time.svg" width="672" height="100" alt="Barra de proporciones para la spec 0105: 1,545 de 2,241 segundos (69%) en inferencia del modelo, 308 segundos ejecutando herramientas y 388 segundos que la tabla fuente no atribuye a ninguna de las dos." loading="lazy" decoding="async">
  </picture>
  <figcaption>Figura 3. En qué se fue el tiempo de reloj (wall clock) de la spec 0105, en sus cinco sesiones de agente (un initializer y cuatro coders, claude-opus-4-8): 1,545 de 2,241 segundos fueron inferencia del modelo y 308 segundos fueron herramientas en ejecución. La tabla fuente deja sin atribuir los otros 388 segundos, y su columna de herramientas suma 307 segundos frente a un total impreso de 308, una diferencia de un segundo que, según el documento, no se puede volver a verificar sin las transcripciones. Un conteo aparte sobre 414 turnos en las ejecuciones 0097, 0105 y 0107 no encontró ningún turno que emitiera dos llamadas a herramientas. Fuente: docs/AGENT-PERFORMANCE.md.</figcaption>
</figure>

La spec 0106 (30 de julio de 2026) analizó las transcripciones de sesión para determinar por qué las ejecuciones de los agentes eran lentas. En la spec 0105, las cinco sesiones repartieron su tiempo de reloj así.

| Sesión | Tiempo de reloj | Inferencia del modelo | Herramientas en ejecución | Proporción de inferencia |
|---|---:|---:|---:|---:|
| Initializer | 555 s | 345 s | 109 s | 62% |
| Coder 1 | 658 s | 493 s | 64 s | 75% |
| Coder 2 | 228 s | 123 s | 59 s | 54% |
| Coder 3 | 418 s | 302 s | 38 s | 72% |
| Coder 4 | 382 s | 282 s | 37 s | 74% |
| **Total** | **2,241 s** | **1,545 s** | **308 s** | **69%** |

El gate obligatorio de typecheck y pruebas tomó 22 segundos, y el análisis concluyó que lo que hace lenta a una sesión es el número de turnos. Por turno, `claude-sonnet-5` tomó 7.8 segundos y $0.04, y `claude-opus-4-8` tomó 18.4 segundos y $0.12. Como las sesiones ejecutaban el gate completo 3–7 veces cada una, el prompt del coder pasó a indicar una prueba dirigida durante la iteración y un gate completo antes de hacer commit, y las ejecuciones del gate completo por sesión bajaron de 4.2 a 3.0 entre las specs 0105 y 0107.

### Una explicación errónea y lo que costó

Las transcripciones también mostraron que ninguno de 414 turnos, en las ejecuciones 0097 (112 turnos), 0105 (125) y 0107 (177), emitió dos llamadas a herramientas. El análisis concluyó que el Agent SDK no podía emitir llamadas a herramientas en paralelo con esta configuración, y los prompts del initializer, el coder y el fixer se actualizaron para decirles a los agentes que el batching no estaba disponible para ellos.

Cuestioné esa conclusión, y una investigación posterior, registrada en [`docs/AGENT-TOPOLOGY.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/AGENT-TOPOLOGY.md), mostró que era errónea: el uso de herramientas en paralelo está activado por defecto a nivel de la API, y nada en el stack lo desactivaba. Al registrar los nombres de las herramientas en una sesión real de coder y en una sesión real de initializer se obtuvieron 24 llamadas, una por turno, y 22 de las 24 eran stateful (16 `Bash`, 3 `Edit`, 3 `Write`), con exactamente dos llamadas `Read`. Una llamada por turno era el comportamiento correcto para esa carga de trabajo.

`docs/AGENT-PERFORMANCE.md` y la regla 5 de `docs/VERIFICATION.md` ahora registran la corrección. Los tres prompts todavía llevan la frase anterior, conservados tal como los vieron los agentes, y la [comparativa de configuraciones](/es/research/setup-bake-off/) del 29 de septiembre de 2026 los ejecutó sin cambios: la configuración que ejecutó los prompts de Launchpad en un proyecto nuevo no hizo llamadas en paralelo, mientras que Claude Code sin extras hizo 12 lotes (batches).

### El plan era el freno

La spec 0199 cambió una sola cosa en el prompt del initializer: ahora indicaba cuánto cuesta un elemento del checklist, y que las piezas que tocan los mismos archivos son un solo elemento. En `cafeteria`, un tenant de prueba interno, un cambio comparable produjo 1 elemento de plan frente a 3 y 3 en las dos ejecuciones anteriores, 26 turnos de coder frente a 60 y 62, y 35 turnos de sesión en total frente a 76 y 76. Del gate 1 al pull request pasaron 9 minutos y 2 segundos. El registro indica sus propias salvedades junto a la tabla: una ejecución no es un resultado, y parte de la reducción vino de que la spec 0005 era un cambio un poco más simple.

## El modelo que derivé: Proof of Work

El 30 de septiembre de 2026 documenté un modelo de desarrollo en el que cada regla remite a los datos anteriores. Su nombre enuncia el principio: un cambio se acepta con base en la evidencia que produce. El texto completo está en [`docs/PROOF-OF-WORK.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/PROOF-OF-WORK.md); estas son sus reglas.

- **La unidad de trabajo es una afirmación (claim).** Un cambio empieza como una lista de afirmaciones, oraciones que alguien podría verificar, cada una con el comando que la verifica y un `kind`: compile, unit, browser, journey (contra un stack real) o live. Una afirmación nombra un efecto observable, como "instala el módulo". El archivo de afirmaciones reemplaza a la spec, porque el 97% de los defectos de producto se introdujeron bajo una spec y la revisión de specs detectó 1.
- **Una verificación debe poder fallar.** Antes de que una afirmación cuente, su verificación se rompe a propósito y tiene que ponerse en rojo. Romper código a propósito detectó 4 defectos, tres a mano y un cuarto en la primera ejecución de `scripts/break-check.sh`, y las rupturas hechas a mano fallaron tres veces en un solo día, así que en el modelo una herramienta hace la ruptura. Extraje esa herramienta como [breakcheck](https://github.com/JCastrejonE/breakcheck).
- **Los tipos prueban el cableado.** Una entrada nueva en una frontera que un segundo llamador podría cruzar es un parámetro requerido, de modo que el compilador enumera cada punto de llamada que falla. Con `copyProduction: boolean`, los dos llamadores de `deployBranchStagingStack` en `activities.ts` no habrían compilado. Un valor que se produce y nunca se consume es un error de lint, y cada activity, ruta, acción y workflow nuevos necesitan un journey test que los alcance desde fuera.
- **Los instrumentos son código.** Una observación que se hará dos veces es un script en `scripts/` con una prueba de positivo conocido.
- **Las garantías se acumulan.** Cada afirmación aceptada se queda en la suite, y cada defecto agrega una afirmación. Según el conteo del registro, 108 de los 225 defectos se podrían haber detectado con una verificación de comportamiento en el momento en que se introdujeron.
- **Los mecanismos reemplazan a la memoria.** El registro muestra que el error del parámetro opcional se cometió siete veces después de que se documentó la regla en su contra. Por eso una sesión hace commit en cada afirmación en verde, un Stop hook se niega a terminar una sesión mientras el gate está en rojo, un pre-commit hook exige un gate en verde, y un revisor con contexto nuevo verifica las afirmaciones contra el sistema en ejecución, porque el autor nunca califica su propio trabajo.
- **Queda un gate humano.** La promoción a producción es el acto irreversible, y la decide una persona. Un cambio que es irreversible, gasta dinero, toca la seguridad o cambia lo que es el producto también lleva una nota de decisión de diez líneas.

La sección 2 del documento compara el modelo con seis modelos existentes, entre ellos las pruebas de mutación (mutation testing) en Google y las herramientas para agentes guiadas por specs. Los modelos que combinan velocidad con una garantía comparten una propiedad: una verificación que puede fallar de forma independiente de la afirmación del autor, más una forma barata de deshacer.

## Discusión

El pipeline spec-first puso su esfuerzo antes del código (specs, vías, bitácoras de handoff) y en un gate de pruebas que verificaban la llamada que hacía el código. Los defectos que importaban se detectaron después, al ejecutar el sistema. El modelo mueve ese esfuerzo a verificaciones ejecutables que corren contra el sistema antes del merge, y elimina las specs, los checklists `## Progress`, las bitácoras de handoff y las líneas de los prompts que describen las herramientas del agente.

El trabajo tiene cuatro límites.

- **Los conteos vienen de un solo registro de un solo producto.** Lo operó un solo desarrollador, los tenants eran negocios de prueba internos, y el registro de cumplimiento en bruto sigue siendo privado. El registro no describe una segunda clasificación independiente de los defectos.
- **El modelo no se ha probado.** La sección 5 del documento propone la prueba: tomar un cambio grande, ejecutarlo con ambos modelos desde el mismo commit, con un conjunto oculto de verificaciones journey escrito de antemano y un puñado de defectos sembrados, y medir el tiempo de reloj, las intervenciones humanas, los defectos sembrados que se detectaron y las fallas ocultas posteriores. Ese experimento no se ha realizado.
- **Tiene costos.** Los journey tests necesitan un stack real, lo que implica minutos de CI y un servidor; los journey tests sobre infraestructura pueden ser flaky, y un gate flaky termina ignorado. El cableado verificado en compilación ayuda al código tipado y no hace nada por el shell ni por SQL.
- **Dos cifras no se pueden volver a verificar.** Los prompts dan la inferencia como "69–80%" de una sesión a lo largo de 414 turnos; `docs/AGENT-PERFORMANCE.md` indica que 69% es el total de su tabla de la spec 0105, que no hay registrada ninguna medición detrás del 80% y que la sesión individual más alta llegó a 75%. La columna de herramientas de esa misma tabla suma 307 segundos frente a un total impreso de 308, y sin las transcripciones esa diferencia no se puede resolver.

## Cómo reproducirlo

El registro de cumplimiento, la lista de trabajo pendiente y las transcripciones no están en la instantánea, así que los conteos de defectos y las mediciones de las sesiones no se pueden volver a calcular. El build y la suite de pruebas se volvieron a ejecutar desde un clon nuevo con estos comandos, usando Node 24.21.0 y pnpm 9.15.0 (el repositorio fija pnpm 9.15.0 en `package.json` y requiere Node 22 o posterior):

```sh
git clone https://github.com/JCastrejonE/launchpad.git
cd launchpad
export PUPPETEER_SKIP_DOWNLOAD=1
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r --no-bail test
```

Se volvió a ejecutar el 16 de octubre de 2026 desde un clon nuevo en el commit `46f050f`: el build pasó, y la suite ejecutó 1,909 pruebas, con 1,874 aprobadas, 0 fallidas y 35 omitidas.

| Paquete | Pruebas | Aprobadas | Omitidas |
|---|---:|---:|---:|
| `packages/github` | 53 | 53 | 0 |
| `packages/agents` | 150 | 150 | 0 |
| `packages/db` | 88 | 88 | 0 |
| `packages/fleet-hostinger` | 281 | 281 | 0 |
| `packages/pipeline` | 551 | 516 | 35 |
| `apps/web` | 786 | 786 | 0 |
| **Total** | **1,909** | **1,874** | **35** |

Las 35 pruebas omitidas son pruebas de workflows de Temporal que solo corren con `TEMPORAL_TEST=1`, que descarga un servidor de pruebas de Temporal. Una prueba ejecuta `git grep`, así que la suite necesita un checkout de git; falla en una copia sin `.git`. El README da el mismo total, 1,909 pruebas, e indica que 35 de ellas solo corren con `TEMPORAL_TEST=1`. Ejecutar el producto en sí requiere Postgres, Temporal, una cuenta con un proveedor de VPS y un dominio, que la instantánea no incluye.

## Referencias

1. [`docs/PROOF-OF-WORK.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/PROOF-OF-WORK.md): el registro de defectos (sección 1), la comparación con modelos existentes (sección 2), el modelo (sección 3), las familias (sección 4) y la prueba propuesta (sección 5). Con fecha del 30 de septiembre de 2026.
2. [`README.md`](https://github.com/JCastrejonE/launchpad/blob/main/README.md): qué fue Launchpad, sus fechas, commits, specs y número de pruebas, y por qué se detuvo.
3. [`docs/AGENT-PERFORMANCE.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/AGENT-PERFORMANCE.md): la tabla de tiempo de reloj por sesión de la spec 0105, las llamadas a herramientas por turno, la latencia por turno y los costos del gate.
4. [`docs/AGENT-TOPOLOGY.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/AGENT-TOPOLOGY.md): los cinco roles de agente, la medición de la spec 0199 y la corrección sobre el uso de herramientas en paralelo.
5. [`docs/VERIFICATION.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/VERIFICATION.md): las 15 reglas de verificación y los incidentes detrás de ellas, incluidas las reglas 12 y 14.
6. [`specs/0226-la-rama-de-pruebas-es-una-copia-neutralizada.md`](https://github.com/JCastrejonE/launchpad/blob/main/specs/0226-la-rama-de-pruebas-es-una-copia-neutralizada.md): el ejemplo desarrollado de código que nada podía alcanzar.
7. [`agents/initializer.md`](https://github.com/JCastrejonE/launchpad/blob/main/agents/initializer.md), [`agents/coder.md`](https://github.com/JCastrejonE/launchpad/blob/main/agents/coder.md) y [`agents/fixer.md`](https://github.com/JCastrejonE/launchpad/blob/main/agents/fixer.md): los prompts que llevan la frase sobre el batching.
8. [`docs/SETUP-BAKEOFF.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/SETUP-BAKEOFF.md) y el ensayo complementario, [la comparativa de configuraciones](/es/research/setup-bake-off/).
9. [`CLAUDE.md`](https://github.com/JCastrejonE/launchpad/blob/main/CLAUDE.md) y [`docs/ARCHITECTURE.md`](https://github.com/JCastrejonE/launchpad/blob/main/docs/ARCHITECTURE.md): la regla spec-first, las dos vías de ejecución y la forma del pipeline.
10. [breakcheck](https://github.com/JCastrejonE/breakcheck), la herramienta extraída del hábito de romper el código.
11. [`scripts/lint-instruments.mjs`](https://github.com/JCastrejonE/launchpad/blob/main/scripts/lint-instruments.mjs) y [`scripts/break-check.sh`](https://github.com/JCastrejonE/launchpad/blob/main/scripts/break-check.sh): el lint de instrumentos y el script de break-check, cuyos comentarios de encabezado registran los incidentes detrás de ellos.
12. Re-ejecución del build y de la suite de pruebas desde un clon nuevo, 16 de octubre de 2026, commit `46f050f`, Node 24.21.0, pnpm 9.15.0.
