/**
 * Структурированный учебный план «Подготовка к собеседованию Java Middle».
 * Источник — синтез 8 PDF JavaJub (Лига, АльфаBank, T-Bank, Yandex Travel,
 * VK Balancers, Sber × 2, Ozon Search Platform). Включены только темы с
 * частотой 4+/8 — то, что «обязательно спросят», без редких грейд-факторов.
 *
 * Импортируется в seed.ts (для генерации узлов на canvas) и в
 * scripts/scaffold-java-middle.ts (для генерации MDX).
 */

import type { LDiscipline } from "@/scripts/levenchuk-curriculum";

export type { LDiscipline };

export const JAVA_LEVELS_META: Record<
  number,
  { title: string; meta: string; intro: string }
> = {
  0: {
    title: "Java Core",
    meta: "JDK/JRE/JVM · equals/hashCode · String Pool · Throwable · Stream API",
    intro:
      "Фундамент языка. Без него все следующие уровни рассыпаются: equals/hashCode не работает в HashMap, Stream API ломается на peek без терминалки, String Pool путается с new String.",
  },
  1: {
    title: "Collections",
    meta: "HashMap · ArrayList vs LinkedList · ConcurrentHashMap · fail-fast",
    intro:
      "Топ-частотный блок (HashMap спросят в 8/8 компаний). Знать внутренности: treeify в Java 8, resize, cache locality LinkedList, segmenting в ConcurrentHashMap.",
  },
  2: {
    title: "Concurrency и JMM",
    meta: "synchronized · volatile · happens-before · ExecutorService · CompletableFuture · CAS",
    intro:
      "Самый «отсевочный» блок. JMM happens-before и контракт volatile различают junior от middle. На middle ожидают понимание ABA, ThreadPool параметров, и почему counter++ с volatile не атомарен.",
  },
  3: {
    title: "JVM, GC, диагностика",
    meta: "Heap/Stack/Metaspace · Young/Old gen · G1/ZGC · OOM",
    intro:
      "Что происходит «под капотом». Уровень между junior («GC чистит память») и senior (tuning под нагрузку). Middle должен знать виды OOM и план диагностики через heap dump.",
  },
  4: {
    title: "Spring и Spring Boot",
    meta: "IoC/DI · bean lifecycle · scopes · @Transactional proxy · REST",
    intro:
      "Любая работа с Java middle = Spring. Ключевая ловушка — self-invocation @Transactional/@Async через прокси: спросят с вероятностью 100%.",
  },
  5: {
    title: "Database, JPA, Hibernate",
    meta: "ACID · isolation · B-tree индексы · JOIN/HAVING · N+1 · ORM lifecycle",
    intro:
      "После Spring — самый частый блок. N+1 спросят в 8/8 компаний. Уровни изоляции, planner B-tree, lazy/eager — must-know.",
  },
  6: {
    title: "System Design, Tools, DevOps",
    meta: "Kafka · Circuit Breaker · Кэш · Docker · JUnit/Mockito · live coding",
    intro:
      "Прикладная часть. На middle — концептуальное понимание Kafka ordering, Circuit Breaker состояний, Docker multi-stage. JUnit+Mockito — практика на live coding.",
  },
};

export const JAVA_MIDDLE_TOPICS: LDiscipline[] = [
  // ===== L0. Java Core ===================================================
  {
    slug: "java-jdk-jre-jvm",
    title: "JDK, JRE, JVM — три уровня платформы",
    level: 0,
    estimatedMinutes: 20,
    question: "Что я скачиваю, что я запускаю, что исполняет мой код?",
    what:
      "JVM — спецификация виртуальной машины (загрузчик классов + интерпретатор bytecode + JIT + GC + memory model). JRE — JVM + стандартная библиотека классов (java.lang, java.util, java.nio, ...) — минимум для запуска уже скомпилированной программы. JDK — JRE + инструменты разработки (javac, javadoc, jdb, jconsole, jmap, jstack). Начиная с Java 11 отдельного JRE Oracle не поставляет — есть только JDK; JRE собирают сами через jlink. Дистрибутивы (OpenJDK / Eclipse Temurin / Amazon Corretto / Azul Zulu) различаются вендором сборки, поддержкой LTS, и набором GC.",
    diff: [
      "JVM (спецификация + рантайм) ↔ JRE (рантайм + std-lib) ↔ JDK (JRE + tooling)",
      "javac → bytecode (.class) → JVM интерпретирует и JIT-компилирует",
      "LTS (Java 8, 11, 17, 21) ↔ non-LTS (9, 10, 12...)",
      "Oracle JDK ↔ OpenJDK (один кодовый source, разная сборка)",
    ],
    tech: [
      "javac, java, jar, jlink, jdeps",
      "jcmd, jstack, jmap, jstat, jconsole, jconsole",
      "SDKMAN! для управления версиями",
    ],
    practice: [
      "Скомпилировать Hello.java через javac, запустить через java",
      "Снять thread dump через jstack у живого процесса",
      "Через jlink собрать минимальный JRE под своё приложение",
    ],
    markers: [
      "Отличаешь JDK/JRE/JVM в одном предложении",
      "Знаешь, что такое bytecode и где JIT встраивается",
      "Можешь объяснить разницу OpenJDK vs Oracle JDK",
    ],
    anti: [
      "«JVM = Java» — путать платформу с языком",
      "«Java интерпретируется» — забывать про JIT",
      "Думать, что JDK 17 заменяет JDK 11 (LTS живут параллельно)",
    ],
  },
  {
    slug: "java-equals-hashcode",
    title: "Контракт equals и hashCode",
    level: 0,
    estimatedMinutes: 30,
    question: "Что сломается, если я нарушу контракт?",
    what:
      "Контракт: (1) равные объекты дают равные хэши, (2) hashCode стабилен в течение жизни объекта по полям, участвующим в equals. Нарушение #1 ломает HashMap/HashSet/HashTable: put + get вернёт null, потому что бакет вычисляется по hashCode. Нарушение #2 (mutable поле в equals/hashCode + изменение после put) — объект «потеряется» в коллекции навсегда. Reflexive, symmetric, transitive, consistent, non-null — пять формальных свойств. На middle обязательно знать: equals в Java по умолчанию — == (сравнение ссылок), hashCode — адрес объекта в native memory (но не гарантировано).",
    diff: [
      "equals ↔ == (контентное vs ссылочное сравнение)",
      "hashCode = const (компилируется, но превращает HashMap в LinkedList)",
      "Mutable ключ в HashMap — антипаттерн",
      "Reflexive / symmetric / transitive / consistent / non-null",
      "Java 7 LinkedList в bucket ↔ Java 8 TreeNode (threshold 8/64)",
    ],
    tech: [
      "Objects.hash(...) и Objects.equals(...) из java.util",
      "Records (Java 14+) генерят equals/hashCode автоматически",
      "Lombok @EqualsAndHashCode(callSuper = ?)",
      "IDE-генератор равенства (IntelliJ / VS Code)",
    ],
    practice: [
      "Реализовать equals/hashCode для класса с 4 полями вручную, без генератора",
      "Положить mutable объект в HashSet, поменять поле — увидеть, что contains возвращает false",
      "Реализовать класс через Record и сравнить behaviour",
    ],
    markers: [
      "Можешь объяснить «5 свойств equals» без подглядывания",
      "Знаешь, почему hashCode = 0 «работает», но ломает производительность",
      "Видишь mutable-ключ в коде как баг до тестирования",
    ],
    anti: [
      "Использовать только equals без hashCode — сломанная HashMap",
      "Включать в equals поля, не включая их в hashCode",
      "Делать класс с mutable-полями ключом коллекции",
    ],
  },
  {
    slug: "java-string-pool",
    title: "String immutability и String Pool",
    level: 0,
    estimatedMinutes: 25,
    question: "Почему s1 == s2 для литералов истинно, а для new String — нет?",
    what:
      "String в Java immutable — внутри final char[] (с Java 9 — byte[] + Latin-1/UTF-16 индикатор). Литералы интернируются в String Pool (PermGen в Java 7, Heap начиная с Java 7u40+). При `String s1 = \"abc\"` и `String s2 = \"abc\"` ссылки совпадают — оба указывают на один объект в пуле. `new String(\"abc\")` всегда создаёт новый объект в куче, минуя пул. `s.intern()` явно кладёт строку в пул и возвращает каноническую ссылку. Immutability даёт: thread-safety без синхронизации, безопасный кэш hashCode, защиту в HashMap-ключах, секретность в реверсе class.security.",
    diff: [
      "Литерал \"abc\" (пул) ↔ new String(\"abc\") (heap, отдельный)",
      "String Pool в PermGen (≤ Java 6) ↔ Heap (≥ Java 7u40)",
      "Java 8: char[] ↔ Java 9+: byte[] + coder (Compact Strings)",
      "intern() помещает в пул и возвращает каноническую ссылку",
    ],
    tech: [
      "String.intern() для ручного добавления в пул",
      "StringBuilder / StringBuffer для мутирования в цикле",
      "String.format(), String.join(), Text Blocks (Java 15)",
      "-XX:StringTableSize= для тюнинга пула",
    ],
    practice: [
      "Написать тест: System.out.println(s1 == s2) для разных вариантов литералов и new String",
      "Профилировать конкатенацию через + в цикле vs StringBuilder (jmh)",
      "Замерить размер пула через jcmd <pid> VM.stringtable",
    ],
    markers: [
      "Можешь объяснить ответ \"что выведет s1 == s2\" для 4-5 случаев",
      "Знаешь, что Compact Strings экономят память для ASCII",
      "Понимаешь, зачем intern в обработке миллионов одинаковых строк",
    ],
    anti: [
      "Использовать == для сравнения строк (всегда equals!)",
      "Конкатенация через + в цикле — каждая итерация = новый объект",
      "Большой intern() без понимания — раздувает String Pool",
    ],
  },
  {
    slug: "java-throwable-hierarchy",
    title: "Throwable, checked vs unchecked, try-with-resources",
    level: 0,
    estimatedMinutes: 25,
    question: "Что компилятор требует обрабатывать, а что нет?",
    what:
      "Иерархия: Throwable → Error + Exception → RuntimeException. Error (OutOfMemoryError, StackOverflowError) — фатальные, ловить не рекомендуется. Exception — \"checked\" (IOException, SQLException) — компилятор требует try/catch или throws в сигнатуре. RuntimeException и его потомки (NPE, IllegalArgumentException, IndexOutOfBoundsException) — \"unchecked\", компилятор не требует. Try-with-resources (Java 7+) автоматически вызывает close() на ресурсах, реализующих AutoCloseable или Closeable; в случае двух исключений (в try и в close) — второе подавляется и доступно через getSuppressed().",
    diff: [
      "Throwable / Error / Exception / RuntimeException — иерархия",
      "Checked (компилятор требует) ↔ Unchecked (RuntimeException)",
      "AutoCloseable ↔ Closeable (последний — для java.io, throws IOException)",
      "Suppressed exception в try-with-resources",
    ],
    tech: [
      "try-with-resources (Java 7+)",
      "Multi-catch: catch (IOException | SQLException e)",
      "Exception chaining: new RuntimeException(\"...\", e)",
      "@FunctionalInterface AutoCloseable",
    ],
    practice: [
      "Переписать try-finally с close() в try-with-resources",
      "Сделать класс, реализующий AutoCloseable, и использовать его в try-with-resources",
      "Спровоцировать suppressed exception (бросить в try и в close)",
    ],
    markers: [
      "Знаешь, какие 5 RuntimeException встретятся чаще всего",
      "Используешь try-with-resources вместо try-finally",
      "Понимаешь, когда обернуть checked в unchecked, и когда нет",
    ],
    anti: [
      "catch (Exception e) {} — silent swallow",
      "Бросать checked Exception на каждый чих (контракт раздут)",
      "Использовать исключение для control flow",
    ],
  },
  {
    slug: "java-stream-api",
    title: "Stream API: lazy, terminal, что выведет peek без collect",
    level: 0,
    estimatedMinutes: 30,
    question: "Когда стрим выполняется и почему peek без терминалки молчит?",
    what:
      "Stream — это pipeline ленивых операций. Intermediate (filter, map, peek, sorted, distinct) — не исполняются, пока не пришла terminal (collect, forEach, count, reduce, findFirst, anyMatch). Без terminal операции просто строится цепочка, никакой код не вызывается. Stream — однопроходный (нельзя использовать дважды, IllegalStateException). Sorted и distinct — stateful, требуют буфера всех элементов. Parallel streams — через ForkJoinPool.commonPool() — опасны для IO/блокирующих операций. map vs flatMap: первый 1→1, второй 1→0..N (разворачивает Stream<Stream<T>> в Stream<T>).",
    diff: [
      "Intermediate (lazy) ↔ Terminal (запускает pipeline)",
      "Stateless (filter, map) ↔ Stateful (sorted, distinct, limit) операции",
      "Sequential ↔ Parallel (через ForkJoinPool.commonPool())",
      "map (1→1) ↔ flatMap (1→0..N) ↔ peek (side effect, не меняет элемент)",
    ],
    tech: [
      "Collectors: toList/toSet/toMap, groupingBy, partitioningBy, joining",
      "Stream.of / IntStream.range / Stream.generate / Stream.iterate",
      "Stream.toList() (Java 16+) — immutable; collect(Collectors.toList()) — mutable",
    ],
    practice: [
      "Реализовать groupingBy + counting (количество слов по длине)",
      "Преобразовать List<List<Integer>> в Stream<Integer> через flatMap",
      "Замерить parallel stream на CPU-bound и IO-bound задачах (увидеть разницу)",
    ],
    markers: [
      "Можешь сказать, что выведет peek без collect (ответ: ничего)",
      "Знаешь разницу map vs flatMap и где flatMap незаменим",
      "Не используешь parallel stream для IO без понимания ForkJoinPool",
    ],
    anti: [
      "Использовать stream второй раз после terminal — IllegalStateException",
      "Parallel stream на блокирующих операциях — забивается общий ForkJoinPool",
      "Stream API ради «модно» там, где for-each короче и читаемее",
    ],
  },

  // ===== L1. Collections =================================================
  {
    slug: "java-hashmap-internals",
    title: "HashMap внутреннее устройство",
    level: 1,
    estimatedMinutes: 35,
    question: "Что произошло в Java 8 и почему treeify?",
    what:
      "HashMap — массив бакетов (default capacity 16, load factor 0.75). Индекс бакета: (hash ^ (hash >>> 16)) & (capacity - 1) — XOR верхней и нижней половин хэша для лучшего распределения. Коллизии хранятся в LinkedList (Java 7) или TreeNode/RBT (Java 8 при достижении TREEIFY_THRESHOLD=8 элементов в бакете и MIN_TREEIFY_CAPACITY=64; иначе resize). Резизинг при size > capacity * loadFactor: удваивается массив, элементы перераспределяются. С Java 8 при resize: каждый элемент остаётся в исходном бакете или уходит в (исходный + старая capacity) — без полного rehash. ConcurrentHashMap.put — non-blocking CAS на бакетах, synchronized на головах списка/дерева.",
    diff: [
      "Java 7 (LinkedList в бакете) ↔ Java 8 (TreeNode при ≥ 8 в одном бакете)",
      "TREEIFY_THRESHOLD = 8 ↔ UNTREEIFY_THRESHOLD = 6",
      "MIN_TREEIFY_CAPACITY = 64 (иначе resize вместо treeify)",
      "Capacity всегда степень двойки — для маски (& cap-1) вместо modulo",
    ],
    tech: [
      "HashMap, LinkedHashMap (insertion/access order), TreeMap (red-black tree)",
      "Map.of() / Map.copyOf() — immutable",
      "Hash spread: (h = key.hashCode()) ^ (h >>> 16)",
    ],
    practice: [
      "Открыть OpenJDK source HashMap.putVal — прочитать алгоритм",
      "Реализовать тест: 1M put с заведомо коллизирующими ключами (одинаковый hashCode) — замерить get",
      "Сравнить производительность HashMap vs TreeMap на 1M ключах",
    ],
    markers: [
      "Можешь нарисовать схему бакетов и описать resize за 2 минуты",
      "Знаешь, почему capacity всегда степень двойки",
      "Понимаешь, почему hashCode = 0 не падает, но деградирует",
    ],
    anti: [
      "Думать, что HashMap всегда O(1) — при плохом hash это O(n) или O(log n)",
      "Использовать HashMap в многопоточном коде (Java 7 — infinite loop при resize!)",
      "Менять mutable-ключ после put",
    ],
  },
  {
    slug: "java-arraylist-vs-linkedlist",
    title: "ArrayList vs LinkedList — cache locality и реальность",
    level: 1,
    estimatedMinutes: 20,
    question: "Когда LinkedList реально выгоднее ArrayList? (Почти никогда.)",
    what:
      "ArrayList — динамический массив (Object[] elementData, capacity, size). Доступ по индексу — O(1). Insert/delete в середине — O(n) из-за сдвига. LinkedList — двусвязный список (head/tail + Node<E>{prev, item, next}). Доступ по индексу — O(n/2). Insert/delete в произвольном месте — O(1), но найти место — O(n). На практике ArrayList почти всегда быстрее даже там, где LinkedList выглядит лучше алгоритмически: cache locality (массив = последовательная память, prefetch CPU работает; список = разбросанные узлы по куче). LinkedList оправдан только при insert/delete в начало через ListIterator, и то Deque/ArrayDeque лучше.",
    diff: [
      "ArrayList (Object[]) ↔ LinkedList (двусвязный список)",
      "Random access: O(1) ↔ O(n/2)",
      "Cache locality: высокая ↔ низкая (узлы разбросаны)",
      "Capacity grow: × 1.5 (50%) при заполнении",
    ],
    tech: [
      "ArrayList(initialCapacity) — задать заранее, избежать grow",
      "Arrays.asList — fixed size, не ArrayList!",
      "List.copyOf — immutable, throw UOE на add",
      "ArrayDeque — лучший выбор как deque/stack",
    ],
    practice: [
      "Benchmark (jmh) добавление 1M в середину для обоих",
      "Профилировать cache miss через perf stat для итерации",
      "Заменить LinkedList в legacy-коде на ArrayList, измерить разницу",
    ],
    markers: [
      "Не выбираешь LinkedList «потому что вставка в середину быстрая»",
      "Используешь ArrayDeque вместо LinkedList как очередь/стек",
      "Знаешь, что ArrayList grow — это копия массива",
    ],
    anti: [
      "Выбирать LinkedList по таблице сложностей без замера",
      "Использовать LinkedList в высоконагруженном коде",
      "Не задавать initialCapacity для известного размера",
    ],
  },
  {
    slug: "java-concurrent-hashmap",
    title: "HashMap vs ConcurrentHashMap — почему в проде только второй",
    level: 1,
    estimatedMinutes: 25,
    question: "Что такое сегментирование и почему его убрали в Java 8?",
    what:
      "HashMap не thread-safe: при concurrent put возможна потеря данных, NPE, в Java 7 — бесконечный цикл при resize (попадание в treeify cycle). ConcurrentHashMap решает проблему. Java 7 — 16 сегментов (Segment extends ReentrantLock), каждый — отдельная мини-HashMap. Lock на сегменте при write, write в разные сегменты идут параллельно. Java 8 — отказ от сегментов: CAS на пустых бакетах для insert, synchronized на голове бакета для коллизий. Read почти всегда без локов через volatile-поля. Null-ключ и null-значение запрещены (чтобы отличать «нет ключа» от «ключ есть, но null»). size() — приблизительный, по counter cells.",
    diff: [
      "HashMap (не thread-safe) ↔ ConcurrentHashMap (lock-free на read)",
      "Java 7: Segment[] (16 локов) ↔ Java 8: CAS + synchronized на голове",
      "ConcurrentHashMap.put(null, ...) → NPE",
      "putIfAbsent / computeIfAbsent — атомарные, в отличие от if (containsKey) + put",
    ],
    tech: [
      "ConcurrentHashMap (default)",
      "Collections.synchronizedMap (полная синхронизация — медленнее)",
      "Hashtable (legacy, не используется)",
      "computeIfAbsent / merge / compute — атомарные операции",
    ],
    practice: [
      "Заменить HashMap + synchronized на ConcurrentHashMap.computeIfAbsent",
      "Реализовать кэш через ConcurrentHashMap.computeIfAbsent",
      "Прочитать OpenJDK source ConcurrentHashMap.putVal — найти CAS",
    ],
    markers: [
      "Используешь computeIfAbsent вместо containsKey + put",
      "Не используешь HashMap в многопоточном коде",
      "Знаешь, почему ConcurrentHashMap запрещает null",
    ],
    anti: [
      "Collections.synchronizedMap в высоконагруженном коде",
      "if (!map.containsKey(k)) map.put(k, v) — race condition",
      "Думать, что ConcurrentHashMap снимает все вопросы концурентности (атомарность отдельных операций ≠ атомарность последовательности)",
    ],
  },
  {
    slug: "java-fail-fast-iterators",
    title: "fail-fast vs fail-safe итераторы, ConcurrentModificationException",
    level: 1,
    estimatedMinutes: 20,
    question: "Почему for-each по ArrayList с remove() падает, а по CopyOnWriteArrayList — нет?",
    what:
      "Стандартные коллекции (ArrayList, HashMap, HashSet, LinkedList) — fail-fast: итератор хранит modCount при создании; при каждом next() сверяет с текущим modCount коллекции. Если кто-то модифицировал коллекцию (включая сам итератор не через Iterator.remove) — ConcurrentModificationException. Не гарантия — best-effort. Concurrent коллекции (ConcurrentHashMap, CopyOnWriteArrayList) — fail-safe: итерируются по snapshot (CopyOnWrite) или weakly-consistent (CHM) — изменения видны или нет, но не падает. Правильно удалять во время итерации: Iterator.remove() или Collection.removeIf(predicate).",
    diff: [
      "Fail-fast (CME при модификации) ↔ Fail-safe (snapshot/weakly-consistent)",
      "modCount проверяется в Iterator.next()",
      "Iterator.remove() ↔ Collection.remove() (последний рушит итератор)",
      "removeIf — наиболее идиоматично, fail-safe для большинства Collection",
    ],
    tech: [
      "Iterator.remove() — единственный безопасный способ удалить во время итерации",
      "Collection.removeIf(Predicate) — Java 8+",
      "CopyOnWriteArrayList — для редких write, частых read (snapshot iterator)",
      "ConcurrentHashMap.forEach / forEachKey / forEachValue",
    ],
    practice: [
      "Получить ConcurrentModificationException на ArrayList + .remove() в for-each",
      "Заменить на itr.remove() — увидеть, что работает",
      "Сравнить производительность iter.remove() vs removeIf на 1M элементов",
    ],
    markers: [
      "Не модифицируешь Collection в for-each без Iterator.remove",
      "Используешь removeIf там, где он подходит",
      "Знаешь, что CME — best-effort, не гарантия",
    ],
    anti: [
      "Удалять в for-each через collection.remove() — CME",
      "Использовать CopyOnWriteArrayList там, где много write (копия на каждый write!)",
      "Думать, что отсутствие CME = thread-safety",
    ],
  },

  // ===== L2. Concurrency и JMM ==========================================
  {
    slug: "java-synchronized",
    title: "synchronized — монитор, reentrancy, this vs Class",
    level: 2,
    estimatedMinutes: 25,
    question: "На какой объект захватывается lock и почему reentrant?",
    what:
      "synchronized на методе экземпляра — лок на this. synchronized на static-методе — лок на Class-объект (MyClass.class). synchronized(obj){} — на произвольный объект. У каждого Java-объекта есть monitor (intrinsic lock) в header'е объекта. Reentrant: один и тот же поток может вложенно захватить тот же монитор N раз — компенсирующее unlock N раз. Реализация на байткод-уровне: monitorenter / monitorexit. JIT может оптимизировать (lock elision, lock coarsening, biased locking — последний удалён в Java 15). На middle обязательно знать: synchronized — full memory barrier (видимость по happens-before), но дороже volatile для простых счётчиков, поэтому AtomicLong/LongAdder часто лучше.",
    diff: [
      "synchronized метод instance (lock this) ↔ static (lock Class)",
      "Reentrant — повторный захват тем же потоком разрешён",
      "monitorenter/monitorexit на байткоде",
      "synchronized включает happens-before (full memory barrier)",
    ],
    tech: [
      "synchronized (метод или блок)",
      "ReentrantLock — явный, с tryLock, Condition, fair-режимом",
      "ReentrantReadWriteLock — много read, мало write",
      "StampedLock — optimistic read (Java 8+)",
    ],
    practice: [
      "Написать BankAccount с synchronized методами transfer — увидеть deadlock на 2-х аккаунтах",
      "Переписать на ReentrantLock с tryLock(timeout)",
      "Замерить разницу synchronized vs ReentrantLock vs AtomicLong на 1M increment",
    ],
    markers: [
      "Знаешь, какой объект — lock для synchronized метода",
      "Не путаешь synchronized метод и synchronized блок",
      "Видишь, когда synchronized избыточен и лучше Atomic",
    ],
    anti: [
      "synchronized(stringLiteral) — лок на интернированную строку, конфликт с другими потоками",
      "synchronized метод на mutable-объекте, который передаётся наружу",
      "Двойной synchronized с разным порядком — гарантированный deadlock",
    ],
  },
  {
    slug: "java-volatile",
    title: "volatile — видимость без атомарности",
    level: 2,
    estimatedMinutes: 25,
    question: "Почему volatile counter++ — баг?",
    what:
      "volatile поле гарантирует: (1) видимость — write публикуется во main memory сразу, read берёт из main memory; (2) запрет reordering — компилятор/JIT не переставляет операции вокруг volatile. Но volatile НЕ атомарен. counter++ — это 3 операции: read → +1 → write; между read и write другой поток может вмешаться. Для атомарных операций нужны AtomicInteger.incrementAndGet (CAS-based) или synchronized. Применение volatile: status-флаги, double-checked locking singleton, публикация ссылки на immutable объект. Memory barrier — load на read, store на write. На x86 read volatile почти бесплатен, write — дороже из-за store barrier.",
    diff: [
      "Видимость (publish) ↔ Атомарность (read-modify-write)",
      "volatile (видимость + ordering) ↔ AtomicInteger (видимость + CAS-атомарность)",
      "volatile (single var) ↔ synchronized (compound action)",
      "Java 5 memory model — гарантии volatile, ReentrantLock, final",
    ],
    tech: [
      "volatile",
      "AtomicInteger / AtomicLong / AtomicReference (CAS)",
      "LongAdder (для high-contention counters)",
      "VarHandle (Java 9+) — низкоуровневые операции",
    ],
    practice: [
      "Запустить 100 потоков × 10000 increment volatile int — увидеть, что итог != 1_000_000",
      "Заменить на AtomicInteger.incrementAndGet — итог == 1_000_000",
      "Реализовать DCL Singleton с volatile",
    ],
    markers: [
      "Не используешь volatile для счётчиков",
      "Знаешь, когда volatile достаточно (status flag), а когда нет (RMW)",
      "Понимаешь, что AtomicInteger внутри — volatile + CAS",
    ],
    anti: [
      "Использовать volatile для счётчика (counter++)",
      "Использовать volatile вместо synchronized, когда нужна compound operation",
      "Думать, что volatile создаёт критическую секцию",
    ],
  },
  {
    slug: "java-happens-before",
    title: "JMM happens-before — мост между потоками",
    level: 2,
    estimatedMinutes: 30,
    question: "Когда я уверен, что поток B увидит запись потока A?",
    what:
      "Java Memory Model (JMM, JSR-133, Java 5+) определяет, когда action A happens-before action B. Если HB(A, B), то результат A виден в B. Гарантии: (1) program order — внутри одного потока всё HB по порядку; (2) monitor lock — unlock HB lock того же монитора; (3) volatile — write HB read того же поля; (4) Thread.start HB первой операции запущенного потока; (5) Thread join HB следующих операций ожидающего; (6) final-поле HB чтения после конструктора. Без HB — нет гарантий видимости: поток B может вечно читать stale значение. JMM ≠ модель памяти процессора; JIT-оптимизации могут переставлять операции, если HB не запрещает.",
    diff: [
      "Synchronizes-with (volatile, monitor, final) ↔ Happens-before (транзитивное замыкание)",
      "Program order (внутри потока) ↔ Inter-thread (между потоками через synchronizes-with)",
      "JMM (абстракция) ↔ Cache coherence на CPU (реализация)",
      "Reordering by compiler/CPU/JIT — разрешено, если не нарушает HB",
    ],
    tech: [
      "synchronized — full barrier (unlock HB lock)",
      "volatile — write HB read",
      "AtomicXxx — наследует HB через volatile",
      "Thread.start / Thread.join — HB гарантии",
    ],
    practice: [
      "Написать пример double-checked-locking без volatile — увидеть, что не работает (теоретически)",
      "Прочитать JLS §17.4 — Memory Model",
      "Реализовать pub/sub очередь через volatile + happens-before",
    ],
    markers: [
      "Можешь назвать 5 источников HB без подглядывания",
      "Понимаешь, почему final-поля HB читателя после конструктора",
      "Не пишешь свой lock-free алгоритм без понимания HB",
    ],
    anti: [
      "Использовать non-volatile поле для signal flag — поток никогда не увидит изменение",
      "Полагаться на «сначала write, потом read» без HB — JIT переставит",
      "Тестировать concurrency «один раз прошло — значит работает»",
    ],
  },
  {
    slug: "java-executor-service",
    title: "ExecutorService и ThreadPoolExecutor параметры",
    level: 2,
    estimatedMinutes: 30,
    question: "Чем опасен newCachedThreadPool в проде?",
    what:
      "ThreadPoolExecutor — 7 параметров: corePoolSize, maxPoolSize, keepAliveTime, BlockingQueue<Runnable>, ThreadFactory, RejectedExecutionHandler, (allowCoreThreadTimeOut). Логика приёма task: (1) если живых потоков < core — создать новый; (2) иначе — в очередь; (3) если очередь полна — создать поток до max; (4) если max достигнут — RejectionPolicy. Executors.newCachedThreadPool — max=Integer.MAX_VALUE + SynchronousQueue — DoS-friendly, может породить тысячи потоков. Executors.newFixedThreadPool — corePool=max + LinkedBlockingQueue(MAX_VALUE) — может OOM по очереди. В проде — ThreadPoolExecutor вручную с ограниченной очередью + AbortPolicy/CallerRunsPolicy. Формула размера пула: CPU-bound — N = #cores + 1, IO-bound — N = #cores × (1 + W/C).",
    diff: [
      "newCachedThreadPool (опасно) ↔ ThreadPoolExecutor (вручную)",
      "SynchronousQueue (нет буфера) ↔ LinkedBlockingQueue (MAX_VALUE) ↔ ArrayBlockingQueue (фикс)",
      "AbortPolicy (default) / CallerRunsPolicy / DiscardPolicy / DiscardOldestPolicy",
      "Future ↔ CompletableFuture (composable)",
    ],
    tech: [
      "ThreadPoolExecutor(core, max, keepAlive, unit, queue, factory, handler)",
      "ScheduledThreadPoolExecutor — для periodic tasks",
      "ForkJoinPool — work-stealing, для parallel streams",
      "Executors factory методы — для прототипирования, не для прода",
    ],
    practice: [
      "Создать ThreadPoolExecutor с queue=10 + AbortPolicy — увидеть RejectedExecutionException",
      "Заменить newCachedThreadPool на ThreadPoolExecutor с правильными параметрами",
      "Замерить throughput для разных конфигураций под realistic нагрузкой",
    ],
    markers: [
      "Знаешь все 7 параметров ThreadPoolExecutor",
      "Не используешь Executors.newCachedThreadPool в проде",
      "Понимаешь, почему очередь должна быть bounded",
    ],
    anti: [
      "newCachedThreadPool на публичном API",
      "newFixedThreadPool с дефолтной queue (Integer.MAX_VALUE)",
      "Игнорировать RejectionPolicy — задачи теряются молча",
    ],
  },
  {
    slug: "java-completable-future",
    title: "CompletableFuture: thenApply, allOf, exceptionally",
    level: 2,
    estimatedMinutes: 35,
    question: "Как объединить 3 параллельных запроса с таймаутом и fallback?",
    what:
      "CompletableFuture<T> — promise-style API, реализующий Future + CompletionStage. Цепочки: thenApply (map: T→U), thenCompose (flatMap: T→CF<U>), thenCombine (zip: CF<T> + CF<U> → V), thenAccept (consumer). Параллельность: CF.allOf (ждёт все), CF.anyOf (первый завершившийся). Обработка ошибок: exceptionally (recover), handle (recover + map), whenComplete (peek). Таймауты: orTimeout, completeOnTimeout (Java 9+). По умолчанию executor — ForkJoinPool.commonPool — опасно для блокирующих операций, лучше supplyAsync(task, customExecutor). Несовместим напрямую с Mono/Flux, но CompletableFuture.toCompletionStage интегрируется с reactor.",
    diff: [
      "thenApply (sync) ↔ thenApplyAsync (на executor) ↔ thenApplyAsync(executor)",
      "thenCompose (flatMap) ↔ thenApply (map)",
      "exceptionally (recover) ↔ handle (recover + map) ↔ whenComplete (peek)",
      "allOf (ждёт все) ↔ anyOf (первый)",
    ],
    tech: [
      "CompletableFuture.supplyAsync / runAsync",
      "thenApply / thenCompose / thenCombine / thenAccept",
      "allOf / anyOf / orTimeout / completeOnTimeout",
      "exceptionally / handle / whenComplete",
    ],
    practice: [
      "Реализовать parallel-fetch 3 микросервисов с allOf + orTimeout + exceptionally",
      "Заменить chain Future.get() (блокирующий) на CompletableFuture chain (non-blocking)",
      "Реализовать retry через CompletableFuture + exceptionallyCompose",
    ],
    markers: [
      "Не вызываешь .get() на CompletableFuture без needs",
      "Используешь custom executor вместо commonPool для IO",
      "Видишь разницу thenApply vs thenCompose в одну минуту",
    ],
    anti: [
      ".get() в цепочке — превращает async в blocking",
      "Использовать commonPool для блокирующих IO задач",
      "Забывать exceptionally — silent failure",
    ],
  },
  {
    slug: "java-cas-aba",
    title: "CAS и ABA-проблема, AtomicStampedReference",
    level: 2,
    estimatedMinutes: 30,
    question: "Что не так с lock-free стеком на CAS?",
    what:
      "CAS (Compare-And-Swap) — атомарная операция CPU: compareAndSwap(addr, expected, new) — если *addr == expected, заменить на new, вернуть true; иначе false. Основа AtomicInteger, ConcurrentHashMap, ReentrantLock. Lock-free стек: push = while (!head.compareAndSet(curHead, newNode)). Проблема ABA: поток T1 читает head=A, готовится к CAS. T2 делает pop (A→B), push C, pop, push A. T1 делает CAS(A, newNode) — успешен, но top уже другой! Решение: AtomicStampedReference (значение + версия) или AtomicMarkableReference (значение + флаг). CAS на JVM компилируется в lock cmpxchg (x86) — десятки наносекунд, но contention деградирует. LongAdder снижает contention за счёт padding cells.",
    diff: [
      "Lock-based (synchronized, ReentrantLock) ↔ Lock-free (CAS)",
      "AtomicInteger (CAS, может ABA) ↔ AtomicStampedReference (CAS + version)",
      "lock cmpxchg (x86) ↔ ll/sc (ARM) — реализация",
      "Optimistic concurrency (CAS retry) ↔ Pessimistic (lock)",
    ],
    tech: [
      "AtomicInteger, AtomicLong, AtomicReference",
      "AtomicStampedReference, AtomicMarkableReference",
      "LongAdder, LongAccumulator (контеншн-friendly)",
      "VarHandle.compareAndSet (Java 9+)",
    ],
    practice: [
      "Написать lock-free Treiber Stack на AtomicReference — увидеть ABA сценарий",
      "Переписать на AtomicStampedReference — ABA устранена",
      "Замерить throughput AtomicLong vs LongAdder под high contention",
    ],
    markers: [
      "Можешь объяснить ABA-проблему на пальцах",
      "Знаешь, где LongAdder быстрее AtomicLong",
      "Не пишешь lock-free структуры без понимания HB",
    ],
    anti: [
      "Использовать AtomicReference для head/tail concurrent структуры без ABA-защиты",
      "AtomicLong как счётчик статистики — лучше LongAdder",
      "Spin без backoff в CAS-loop — burn CPU",
    ],
  },

  // ===== L3. JVM, GC, диагностика ========================================
  {
    slug: "java-jvm-memory",
    title: "Области памяти JVM — где что живёт",
    level: 3,
    estimatedMinutes: 25,
    question: "Куда уходит OOM: Heap, Metaspace или native?",
    what:
      "Память JVM: (1) Heap — объекты, разделён на Young (Eden + 2 Survivor) и Old gen, управляется GC; (2) Stack — на каждый поток, фреймы методов, локальные примитивы и ссылки, размер -Xss (default ~512KB-1MB); (3) Metaspace (Java 8+, заменил PermGen) — class metadata, в native memory; (4) PC Register — на поток, адрес текущей инструкции; (5) Native Method Stack — для JNI; (6) Code Cache — JIT-компилированный код. Параметры: -Xms / -Xmx (heap), -XX:MaxMetaspaceSize, -Xss, -XX:ReservedCodeCacheSize. OOM виды: Java heap space (heap), Metaspace, GC overhead limit exceeded (GC не успевает), unable to create new native thread (упёрлись в OS лимит), Direct buffer memory (off-heap через ByteBuffer.allocateDirect).",
    diff: [
      "Heap (объекты, GC) ↔ Stack (фрейм метода, на поток)",
      "Young gen (Eden+Survivor) ↔ Old gen (tenured) ↔ Metaspace (class metadata)",
      "PermGen (≤ Java 7, fixed) ↔ Metaspace (Java 8+, native memory, auto-grow)",
      "On-heap ↔ Off-heap (DirectByteBuffer, Unsafe.allocateMemory)",
    ],
    tech: [
      "-Xms / -Xmx / -Xss / -XX:MaxMetaspaceSize / -XX:ReservedCodeCacheSize",
      "jcmd <pid> VM.native_memory summary",
      "jstat -gc <pid> 1s — мониторинг GC в реальном времени",
      "MAT (Eclipse Memory Analyzer) для heap dump",
    ],
    practice: [
      "Запустить процесс с -Xmx512m, наполнить ArrayList, поймать OOM",
      "Спровоцировать Metaspace OOM через создание классов рантайм-генератором",
      "Снять heap dump через jmap -dump:live,format=b,file=heap.bin <pid> — открыть в MAT",
    ],
    markers: [
      "Можешь нарисовать схему памяти JVM",
      "Знаешь, чем Metaspace отличается от PermGen",
      "Понимаешь, какой OOM требует -Xmx, какой -XX:MaxMetaspaceSize",
    ],
    anti: [
      "Думать, что весь объект на стеке — в Java на стеке только примитивы и ссылки",
      "Игнорировать Metaspace в Java 8+ — DI/proxy/CGLIB могут раздуть его",
      "Увеличивать -Xmx без анализа причины OOM (часто это утечка, не недостаток)",
    ],
  },
  {
    slug: "java-gc",
    title: "GC: Young/Old gen, Serial/Parallel/G1/ZGC",
    level: 3,
    estimatedMinutes: 35,
    question: "Какой GC выбрать для приложения с 50GB heap и SLA 10ms?",
    what:
      "GC основан на гипотезе weak generational hypothesis: большинство объектов умирают молодыми. Young gen: Eden (новые объекты), 2 Survivor (S0/S1). Minor GC — копирующий, перемещает живые из Eden+S0 в S1, потом в Old после N циклов (tenuring). Major/Full GC — на Old gen, дороже. Сборщики: Serial (1 поток, embedded, -XX:+UseSerialGC), Parallel (multi-thread, throughput, default до Java 8), G1 (region-based, low-latency, default с Java 9, регионы 1-32MB), ZGC (concurrent, sub-millisecond pause, -XX:+UseZGC, JDK 11+, для huge heap), Shenandoah (concurrent compaction, Red Hat, JDK 12+). Современный выбор: G1 (default, до 32GB heap, цель ≤ 200ms pause), ZGC (для huge heap или SLA ≤ 10ms).",
    diff: [
      "Generational (Young/Old) ↔ Region-based (G1)",
      "Stop-the-world ↔ Concurrent (ZGC/Shenandoah)",
      "Throughput (Parallel) ↔ Low-latency (G1/ZGC)",
      "Mark-Sweep ↔ Mark-Sweep-Compact ↔ Copying",
    ],
    tech: [
      "-XX:+UseG1GC (default ≥ Java 9)",
      "-XX:+UseZGC -XX:+ZGenerational (JDK 21+)",
      "-XX:MaxGCPauseMillis=200 (целевая пауза G1)",
      "-Xlog:gc* — структурированный GC лог (Java 9+)",
    ],
    practice: [
      "Запустить приложение с разными GC, замерить throughput и pause через -Xlog:gc",
      "Снять GC лог за час прода, визуализировать в GCViewer или GCEasy",
      "Спровоцировать Full GC через System.gc() (если -XX:+DisableExplicitGC не выставлен)",
    ],
    markers: [
      "Можешь объяснить разницу Minor vs Full GC",
      "Знаешь, какой GC default в Java 8, 11, 17, 21",
      "Можешь прочитать GC лог и сказать, в чём bottleneck",
    ],
    anti: [
      "Звать System.gc() в продовом коде",
      "Использовать -XX:+UseParallelGC для low-latency сервиса",
      "Огромный -Xmx без выбора GC — Full GC pause в минуты",
    ],
  },
  {
    slug: "java-oom-diagnostics",
    title: "OOM: виды, диагностика, heap dump",
    level: 3,
    estimatedMinutes: 30,
    question: "Я получил OutOfMemoryError. Что делать первым?",
    what:
      "Виды OOM: (1) «Java heap space» — кончилась куча, обычно утечка или недостаток -Xmx; (2) «Metaspace» — class loader leak или раздутый proxy; (3) «GC overhead limit exceeded» — > 98% времени в GC, < 2% освобождается; (4) «unable to create new native thread» — OS лимит threads или -Xss слишком большой; (5) «Direct buffer memory» — off-heap. План диагностики: (a) -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heap.bin — авто-dump при падении; (b) jmap -dump:live,format=b,file=heap.bin <pid> — вручную; (c) открыть в MAT, найти Dominator Tree, посмотреть Top Consumers; (d) типичные подозреваемые: static-кэши без TTL, ThreadLocal в пуле потоков, незакрытые ресурсы. Утечка в Java = «GC не может собрать живой объект» (есть reachability через GC roots), не баг GC.",
    diff: [
      "Heap OOM (объекты) ↔ Metaspace OOM (классы) ↔ Native OOM (off-heap)",
      "Утечка (объект reachable, но не нужен) ↔ Недостаток памяти (объекты нужны)",
      "GC roots: Thread stack, static, JNI references, classloader",
      "Dominator Tree ↔ References Tree (в MAT)",
    ],
    tech: [
      "-XX:+HeapDumpOnOutOfMemoryError + -XX:HeapDumpPath",
      "jmap -dump:live,format=b,file=heap.bin <pid>",
      "MAT (Memory Analyzer Tool), jhat, VisualVM",
      "jcmd <pid> GC.heap_info / GC.class_histogram",
    ],
    practice: [
      "Спровоцировать утечку через ThreadLocal в Executor (не вызывать remove)",
      "Снять heap dump, открыть в MAT, найти Dominator Tree",
      "Прогнать full GC roots анализ для подозрительного объекта",
    ],
    markers: [
      "Знаешь 5 видов OOM",
      "Понимаешь, что увеличить -Xmx — не решение, а отсрочка",
      "Можешь интерпретировать heap dump в MAT",
    ],
    anti: [
      "Увеличивать -Xmx без диагностики причины",
      "Игнорировать heap dump («долго анализировать») — баг возвращается",
      "Считать, что GC сломан, когда дело в утечке",
    ],
  },

  // ===== L4. Spring и Spring Boot =======================================
  {
    slug: "spring-ioc-di",
    title: "IoC, DI и Constructor injection",
    level: 4,
    estimatedMinutes: 25,
    question: "Почему constructor injection лучше field injection?",
    what:
      "IoC (Inversion of Control) — контейнер управляет жизненным циклом, а не код. DI (Dependency Injection) — частный случай IoC, зависимости передаются извне. Три варианта в Spring: constructor (Constructor injection — рекомендуется), setter (для optional / circular), field (через @Autowired на поле — самый плохой). Constructor injection: (1) делает зависимости видимыми в сигнатуре, (2) позволяет final-поля (immutable bean), (3) ловит circular dependency на старте, не в рантайме, (4) проще тестировать (просто new Service(mock, mock)). Field injection: (1) скрывает зависимости, (2) ломает immutability, (3) не работает в plain unit-test без Spring контейнера, (4) разрешает circular cycle. Начиная с Spring 4.3 @Autowired не нужен на единственном конструкторе.",
    diff: [
      "IoC (контейнер управляет) ↔ DI (передача зависимостей)",
      "Constructor injection (best) ↔ Setter (optional) ↔ Field (worst)",
      "Singleton (default scope) ↔ Prototype",
      "@Autowired ↔ @Inject (JSR-330) ↔ @Resource (JSR-250)",
    ],
    tech: [
      "@Component / @Service / @Repository / @Controller / @RestController",
      "@Configuration + @Bean — manual bean definition",
      "@Autowired + @Qualifier + @Primary",
      "ApplicationContext.getBean() (для тестов и edge cases)",
    ],
    practice: [
      "Переписать field injection класс на constructor injection — увидеть, что тесты проще",
      "Создать circular dependency через field, потом через constructor — увидеть failure mode",
      "Реализовать @Bean в @Configuration с условиями (@ConditionalOnProperty)",
    ],
    markers: [
      "Используешь только constructor injection в новом коде",
      "Можешь объяснить, почему @Autowired на поле — антипаттерн",
      "Знаешь разницу @Autowired / @Inject / @Resource",
    ],
    anti: [
      "@Autowired на private field — невозможно протестировать без reflection или Spring",
      "Circular dependency через setter / field — Spring «починит» молча",
      "ApplicationContext.getBean() в обычном бизнес-коде",
    ],
  },
  {
    slug: "spring-bean-lifecycle",
    title: "Bean lifecycle: BeanDefinition → @PostConstruct → @PreDestroy",
    level: 4,
    estimatedMinutes: 25,
    question: "Когда вызывается @PostConstruct и почему он лучше InitializingBean?",
    what:
      "Жизненный цикл: (1) Парсинг конфигурации → BeanDefinition (метаданные о бине); (2) Instantiation (рефлексия конструктора); (3) Populate properties (DI); (4) Aware callbacks (BeanNameAware.setBeanName, BeanFactoryAware.setBeanFactory, ApplicationContextAware.setApplicationContext); (5) BeanPostProcessor.postProcessBeforeInitialization (например, AOP создаёт прокси здесь, @Async); (6) @PostConstruct / InitializingBean.afterPropertiesSet / init-method; (7) BeanPostProcessor.postProcessAfterInitialization (тут @Transactional оборачивается в прокси через CGLIB); (8) Bean готов к использованию; (9) При shutdown: @PreDestroy → DisposableBean.destroy → destroy-method. ApplicationListener events: ContextRefreshedEvent — все бины созданы. @PostConstruct лучше InitializingBean: не привязывает к Spring API.",
    diff: [
      "BeanDefinition (метаданные) ↔ Bean (инстанс)",
      "@PostConstruct (JSR-250, портативно) ↔ InitializingBean.afterPropertiesSet (Spring-API) ↔ @Bean(initMethod)",
      "BeanPostProcessor (для всех бинов) ↔ BeanFactoryPostProcessor (на definition)",
      "ContextRefreshedEvent / ContextClosedEvent",
    ],
    tech: [
      "@PostConstruct, @PreDestroy (jakarta.annotation.*)",
      "BeanPostProcessor — самый частый extension point",
      "@EventListener — слушать ApplicationEvents",
      "SmartLifecycle — phased startup/shutdown",
    ],
    practice: [
      "Реализовать BeanPostProcessor, который логирует каждый созданный бин",
      "Сделать @PostConstruct с инициализацией кэша",
      "Сделать @PreDestroy с graceful shutdown очереди",
    ],
    markers: [
      "Можешь нарисовать последовательность из 8 шагов lifecycle",
      "Знаешь, в какой момент @Transactional оборачивает в прокси",
      "Используешь @PostConstruct вместо InitializingBean",
    ],
    anti: [
      "Тяжёлая работа в конструкторе — нет DI ещё",
      "@Async / @Transactional в init-методе — не работает (прокси ещё не готов)",
      "Не вызывать @PreDestroy для ресурсов (соединения, threads, файлы)",
    ],
  },
  {
    slug: "spring-scopes",
    title: "Scopes и prototype-в-singleton проблема",
    level: 4,
    estimatedMinutes: 25,
    question: "Почему prototype-бин, инжектнутый в singleton, остаётся одним инстансом?",
    what:
      "Scopes: singleton (default, один на ApplicationContext), prototype (новый на каждый getBean), request/session/application (Web-only). Проблема: если singleton зависит от prototype через @Autowired, Spring внедряет один и тот же экземпляр на старте, и singleton всегда работает с ним. Решения: (1) ObjectFactory<T> / Provider<T> / ObjectProvider<T> — getObject() возвращает новый prototype; (2) @Lookup на абстрактном методе — Spring переопределяет через CGLIB; (3) ApplicationContext.getBean (anti-pattern); (4) AOP scope proxy через @Scope(value=\"prototype\", proxyMode=TARGET_CLASS) — каждое обращение к методу проксируется и создаёт новый бин. Web scopes: request — новый бин на HTTP request; session — на user session.",
    diff: [
      "Singleton (1 на context) ↔ Prototype (новый на каждый getBean)",
      "Request / Session / Application (Web-only)",
      "ObjectFactory / Provider / ObjectProvider — на каждый вызов",
      "Scope proxy (TARGET_CLASS/INTERFACE) — для DI prototype в singleton",
    ],
    tech: [
      "@Scope(\"prototype\")",
      "@Scope(value=\"prototype\", proxyMode=ScopedProxyMode.TARGET_CLASS)",
      "ObjectProvider<T> (Spring 4.3+)",
      "@Lookup для абстрактных методов",
    ],
    practice: [
      "Создать @Scope(\"prototype\") бин, инжектнуть в singleton через @Autowired — увидеть, что один инстанс",
      "Заменить на ObjectProvider — увидеть, что каждый getObject новый",
      "Реализовать через @Lookup-method",
    ],
    markers: [
      "Не наступаешь на prototype-в-singleton",
      "Знаешь 3 способа решения",
      "Используешь ObjectProvider как идиоматичное решение",
    ],
    anti: [
      "Инжектить prototype через @Autowired в singleton и удивляться",
      "Полагаться на ApplicationContext.getBean() — coupling с Spring",
      "Использовать prototype без необходимости — usually singleton хватает",
    ],
  },
  {
    slug: "spring-transactional-proxy",
    title: "@Transactional через прокси и self-invocation",
    level: 4,
    estimatedMinutes: 30,
    question: "Почему this.transactionalMethod() не открывает транзакцию?",
    what:
      "@Transactional реализован через AOP: Spring оборачивает бин в прокси (JDK Dynamic Proxy если есть interface, CGLIB иначе). Прокси перехватывает внешние вызовы, открывает транзакцию через PlatformTransactionManager, после метода commit или rollback. Self-invocation: вызов this.method() внутри того же бина идёт мимо прокси — транзакция НЕ открывается. То же самое для @Async, @Cacheable, @Retryable — все proxy-based. Решения: (1) разнести в два бина; (2) AopContext.currentProxy().method(); (3) @Self-inject через ObjectProvider или setter. С Spring 6 (AOT, native) — прокси частично заменены direct invocation. rollbackFor: по умолчанию откатывает только на RuntimeException и Error; checked — НЕ откатывает! Поэтому @Transactional(rollbackFor = Exception.class) — must для большинства случаев.",
    diff: [
      "JDK Dynamic Proxy (на interface) ↔ CGLIB (на класс, требует non-final)",
      "External call (через прокси) ↔ Self-invocation (мимо прокси)",
      "Default rollback: RuntimeException + Error ↔ rollbackFor = Exception.class",
      "@Transactional на public методах (default proxy access)",
    ],
    tech: [
      "@Transactional с параметрами: propagation, isolation, rollbackFor, readOnly, timeout",
      "PlatformTransactionManager (DataSourceTransactionManager / JpaTransactionManager)",
      "TransactionTemplate (программный API)",
      "AopContext.currentProxy() (требует @EnableAspectJAutoProxy(exposeProxy = true))",
    ],
    practice: [
      "Создать @Transactional метод A, который зовёт this.transactionalB() — увидеть, что B не в своей транзакции",
      "Бросить IOException в @Transactional без rollbackFor — увидеть commit",
      "Разнести A и B в два сервиса — увидеть, что работает",
    ],
    markers: [
      "Не вызываешь @Transactional через this",
      "Используешь rollbackFor = Exception.class или Throwable.class",
      "Знаешь, почему final-класс ломает CGLIB прокси",
    ],
    anti: [
      "this.transactionalMethod() и ожидание новой транзакции",
      "Полагаться на default rollback для checked exceptions",
      "@Transactional на private методе — Spring молча игнорирует",
    ],
  },
  {
    slug: "spring-transactional-propagation",
    title: "Propagation: REQUIRED, REQUIRES_NEW, NESTED",
    level: 4,
    estimatedMinutes: 25,
    question: "Что произойдёт, если REQUIRES_NEW вложен в REQUIRED, и внешний откатится?",
    what:
      "Propagation определяет поведение, если уже открыта транзакция: (1) REQUIRED (default) — присоединиться к существующей или открыть новую; (2) REQUIRES_NEW — приостановить текущую, открыть новую (физически отдельный коннект! commit/rollback независимо); (3) NESTED — savepoint в текущей транзакции (commit при выходе из метода, rollback откатывает только до savepoint); (4) SUPPORTS — присоединиться, если есть, иначе без транзакции; (5) MANDATORY — обязательна внешняя; (6) NEVER — не должно быть внешней; (7) NOT_SUPPORTED — приостановить и работать без; (8) NESTED. REQUIRES_NEW — самое тяжёлое: лишний коннект, может deadlock'нуться с внешней. NESTED работает только на JDBC-savepoints (не везде).",
    diff: [
      "REQUIRED (присоединиться/новая) ↔ REQUIRES_NEW (новая физическая)",
      "NESTED (savepoint) ↔ REQUIRES_NEW (отдельный коннект)",
      "MANDATORY (требует внешнюю) ↔ NEVER (запрещает внешнюю)",
      "SUPPORTS (без транзакции, если нет) ↔ NOT_SUPPORTED (suspend + без)",
    ],
    tech: [
      "@Transactional(propagation = Propagation.REQUIRES_NEW)",
      "@Transactional(propagation = Propagation.NESTED)",
      "JpaTransactionManager / DataSourceTransactionManager",
      "JpaProperties.setOpenInView (антипаттерн!)",
    ],
    practice: [
      "Реализовать @Transactional(REQUIRES_NEW) для логирования действий — даже при rollback внешней транзакции логи сохраняются",
      "NESTED для частичного rollback (savepoint)",
      "Спровоцировать deadlock через REQUIRES_NEW на одной строке таблицы",
    ],
    markers: [
      "Знаешь, что REQUIRES_NEW требует второй коннект",
      "Понимаешь, когда NESTED работает, а когда нет",
      "Не используешь REQUIRES_NEW «на всякий случай»",
    ],
    anti: [
      "REQUIRES_NEW в цикле — каждый раз новый коннект, исчерпание пула",
      "Полагаться на NESTED без проверки, что JDBC-driver поддерживает savepoints",
      "Использовать default REQUIRED для всего — иногда нужна изоляция",
    ],
  },
  {
    slug: "spring-rest-validation",
    title: "REST контроллер, @Valid, @RestControllerAdvice",
    level: 4,
    estimatedMinutes: 25,
    question: "Как обработать 400 для невалидного DTO и 404 для отсутствующей сущности?",
    what:
      "Spring MVC: @RestController = @Controller + @ResponseBody. @RequestMapping и shortcuts: @GetMapping, @PostMapping, @PutMapping, @DeleteMapping, @PatchMapping. Параметры: @PathVariable (из URL), @RequestParam (query string), @RequestBody (тело + Jackson), @RequestHeader, @ModelAttribute. Валидация: @Valid на параметре + JSR-380 (jakarta.validation) аннотации на DTO (@NotNull, @NotBlank, @Min, @Email, @Size). При нарушении — MethodArgumentNotValidException. Глобальный handler: @RestControllerAdvice + @ExceptionHandler — конвертирует exception в ResponseEntity. Стандарт: 400 (validation), 404 (not found), 409 (conflict), 422 (semantic), 500 (server error). ProblemDetail (RFC 7807) — стандарт для error response (Spring 6+).",
    diff: [
      "@Controller (HTML view) ↔ @RestController (= @Controller + @ResponseBody)",
      "@PathVariable ↔ @RequestParam ↔ @RequestBody",
      "MethodArgumentNotValidException (validation) ↔ ConstraintViolationException (Bean)",
      "ResponseStatusException ↔ @ResponseStatus ↔ @RestControllerAdvice",
    ],
    tech: [
      "@Valid + JSR-380 (@NotNull, @Size, @Email, @Pattern)",
      "@RestControllerAdvice + @ExceptionHandler",
      "ResponseEntity<T> для ручного контроля статуса/заголовков",
      "ProblemDetail (Spring 6+, RFC 7807)",
    ],
    practice: [
      "Реализовать UserController с POST /users + @Valid CreateUserDto",
      "Сделать @RestControllerAdvice с handler'ами для 4 типов exception",
      "Вернуть ProblemDetail вместо custom error object",
    ],
    markers: [
      "Используешь @Valid + JSR-380, не валидируешь вручную",
      "Не выбрасываешь plain Exception из контроллера",
      "Различаешь 400/404/409/422 в выборе статуса",
    ],
    anti: [
      "Возвращать 200 OK с error JSON — клиент должен парсить тело, чтобы понять ошибку",
      "Голый ResponseEntity.ok(error) на каждый чих",
      "Stack trace в response body — leak внутренностей",
    ],
  },

  // ===== L5. Database, JPA, Hibernate ===================================
  {
    slug: "db-acid-isolation",
    title: "ACID и уровни изоляции",
    level: 5,
    estimatedMinutes: 30,
    question: "Какая аномалия возможна на READ COMMITTED, но не на REPEATABLE READ?",
    what:
      "ACID: Atomicity (commit или rollback целиком), Consistency (валидное состояние до и после), Isolation (степень изоляции от других транзакций), Durability (после commit данные на диске). Уровни изоляции (SQL стандарт): READ UNCOMMITTED (видит uncommitted данные — dirty read), READ COMMITTED (видит только committed, default в PostgreSQL/Oracle; non-repeatable read возможен), REPEATABLE READ (повторное чтение того же select даёт тот же результат; phantom read возможен по стандарту, но в PostgreSQL не возможен из-за MVCC; default в MySQL InnoDB), SERIALIZABLE (полная изоляция, через SSI/2PL). Аномалии: (1) Dirty read — читаем uncommitted; (2) Non-repeatable read — между двумя select одного row значение поменялось; (3) Phantom read — между двумя select по диапазону появились/исчезли строки; (4) Lost update — два UPDATE «затёрли» друг друга.",
    diff: [
      "READ UNCOMMITTED ↔ READ COMMITTED ↔ REPEATABLE READ ↔ SERIALIZABLE",
      "Dirty read ↔ Non-repeatable read ↔ Phantom read ↔ Lost update",
      "MVCC (PostgreSQL/Oracle) ↔ Locking (MySQL InnoDB)",
      "PostgreSQL REPEATABLE READ исключает phantom (стандарт допускает)",
    ],
    tech: [
      "@Transactional(isolation = Isolation.REPEATABLE_READ)",
      "SET TRANSACTION ISOLATION LEVEL ... (SQL)",
      "SELECT ... FOR UPDATE (pessimistic)",
      "@Version (optimistic locking JPA)",
    ],
    practice: [
      "Воспроизвести dirty read на READ UNCOMMITTED (но default PostgreSQL — RC, надо постараться)",
      "Воспроизвести non-repeatable read через 2 коннекта на RC",
      "Поднять до REPEATABLE READ — увидеть, что non-repeatable исчезает",
    ],
    markers: [
      "Можешь объяснить 4 аномалии и в каком уровне они исключены",
      "Знаешь default уровень PostgreSQL (READ COMMITTED) vs MySQL (REPEATABLE READ)",
      "Не выбираешь SERIALIZABLE «чтобы спать спокойно» — он дорогой",
    ],
    anti: [
      "SERIALIZABLE везде — деградация throughput, serialization errors",
      "READ UNCOMMITTED для скорости — dirty reads = баги в логике",
      "Считать default RC безопасным для всех сценариев",
    ],
  },
  {
    slug: "db-indexes",
    title: "B-tree индексы, leftmost prefix, когда не помогает",
    level: 5,
    estimatedMinutes: 30,
    question: "Почему составной индекс (a, b, c) не используется в WHERE b = 1?",
    what:
      "B-tree — балансированное дерево, O(log n) поиск. Default тип индекса в PostgreSQL/MySQL. Поддерживает: =, <, >, BETWEEN, IN, ORDER BY. Не поддерживает: LIKE '%abc' (анкорить нечего), function на колонке (WHERE LOWER(name) = 'abc' — нужен functional index CREATE INDEX ON tbl (LOWER(name))). Составной индекс (a, b, c) — leftmost prefix rule: используется для WHERE a = ?, WHERE a = ? AND b = ?, WHERE a = ? AND b = ? AND c = ?. НЕ используется (или используется частично) для WHERE b = ? (без a). Покрывающий индекс (covering / INCLUDE) — содержит все нужные колонки, planner делает Index Only Scan без обращения к heap. Другие типы: Hash (только =, in-memory), GIN (для JSONB, массивов, полнотекстового), GiST (для геометрии, range), BRIN (для огромных таблиц с физическим порядком).",
    diff: [
      "B-tree (универсальный) ↔ Hash (только =) ↔ GIN (JSONB) ↔ GiST (geo/range) ↔ BRIN (sequential data)",
      "Index Scan ↔ Index Only Scan (covering) ↔ Bitmap Index Scan (для OR / много rows)",
      "Leftmost prefix rule для составных индексов",
      "Selectivity — почему индекс на boolean бесполезен (5/95)",
    ],
    tech: [
      "CREATE INDEX idx_users_email ON users(email);",
      "CREATE INDEX CONCURRENTLY (без table lock, но дольше)",
      "CREATE INDEX ... INCLUDE (col_x) — covering",
      "CREATE INDEX ... USING GIN (data_jsonb)",
    ],
    practice: [
      "Создать индекс (a, b, c), выполнить WHERE b = 1 — увидеть Seq Scan",
      "Создать functional index ON LOWER(email) для case-insensitive search",
      "Сравнить размер таблицы и индекса через pg_size_pretty",
    ],
    markers: [
      "Знаешь leftmost prefix rule",
      "Понимаешь, почему индекс на boolean бесполезен",
      "Используешь CREATE INDEX CONCURRENTLY в проде",
    ],
    anti: [
      "Индекс на каждую колонку — replication overhead, slow write",
      "Индекс на boolean — selectivity слишком низкая",
      "Использовать LIKE 'abc%' для prefix search без поняти, что 'a%' уже работает",
    ],
  },
  {
    slug: "db-explain-analyze",
    title: "EXPLAIN ANALYZE: Seq Scan vs Index Scan, Nested Loop vs Hash Join",
    level: 5,
    estimatedMinutes: 25,
    question: "Почему planner выбрал Seq Scan, а не мой свежий индекс?",
    what:
      "EXPLAIN — план без исполнения, EXPLAIN ANALYZE — план + реальное время. Виды узлов: Seq Scan (полный скан), Index Scan (через B-tree), Index Only Scan (covering, без обращения к heap), Bitmap Index Scan + Bitmap Heap Scan (для OR / range / много rows). Joins: Nested Loop (хорошо для small × large), Hash Join (build hash table в памяти, scan другую — middle × middle), Merge Join (две sorted relations). Planner выбирает по cost estimate (на основе ANALYZE статистики). Часто Seq Scan быстрее Index Scan: при выборке > 10-20% таблицы или при отсутствии актуальной статистики. Команды: ANALYZE table; — обновить статистику, VACUUM ANALYZE; — VACUUM + статистика. Параметры: EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) — добавляет buffer hits.",
    diff: [
      "Seq Scan (full) ↔ Index Scan ↔ Index Only Scan (covering)",
      "Nested Loop ↔ Hash Join ↔ Merge Join",
      "EXPLAIN (cost estimate) ↔ EXPLAIN ANALYZE (cost + actual time)",
      "Buffers (cached vs disk) — без них cost не отражает IO",
    ],
    tech: [
      "EXPLAIN ANALYZE / EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)",
      "ANALYZE table; — обновить статистику",
      "pg_stat_statements — топ медленных запросов",
      "auto_explain — лог планов медленных запросов",
    ],
    practice: [
      "Прогнать EXPLAIN ANALYZE для запроса с JOIN — посмотреть выбранный план",
      "Создать индекс, прогнать снова — увидеть Index Scan",
      "Заполнить таблицу 1M строк, замерить разницу Hash Join vs Nested Loop",
    ],
    markers: [
      "Читаешь EXPLAIN ANALYZE и можешь объяснить узлы",
      "Знаешь, когда Seq Scan лучше Index Scan",
      "Запускаешь ANALYZE после больших insert/delete",
    ],
    anti: [
      "Бросать индексы на каждый медленный query, не глядя в план",
      "Игнорировать BUFFERS — реальная стоимость = disk IO",
      "Не запускать EXPLAIN ANALYZE на проде из-за «опасно» (только не write-операции)",
    ],
  },
  {
    slug: "db-joins-window",
    title: "JOIN, WHERE vs HAVING, оконные функции",
    level: 5,
    estimatedMinutes: 30,
    question: "В чём разница ROW_NUMBER, RANK, DENSE_RANK?",
    what:
      "JOIN типы: INNER (пересечение), LEFT/RIGHT (все из левой/правой + matching из другой), FULL (всё из обеих, null на missing), CROSS (декартово произведение). WHERE — фильтрация ДО GROUP BY (на строки), HAVING — ПОСЛЕ GROUP BY (на агрегаты, например HAVING COUNT(*) > 5). Оконные функции (OVER) — агрегаты, не сворачивающие строки: ROW_NUMBER() OVER (ORDER BY x) — уникальный номер; RANK() — пропускает после ties (1,1,3); DENSE_RANK() — не пропускает (1,1,2); LAG/LEAD — предыдущая/следующая строка; SUM/AVG OVER (PARTITION BY group ORDER BY x) — running totals. CTE (WITH ...) — для читаемости и рекурсии. CTE с RECURSIVE — для деревьев.",
    diff: [
      "INNER ↔ LEFT/RIGHT ↔ FULL ↔ CROSS JOIN",
      "WHERE (до GROUP BY) ↔ HAVING (после GROUP BY)",
      "ROW_NUMBER (1,2,3) ↔ RANK (1,1,3) ↔ DENSE_RANK (1,1,2)",
      "Aggregate (сворачивает) ↔ Window (сохраняет строки)",
    ],
    tech: [
      "GROUP BY + HAVING + COUNT(*)/SUM/AVG/MIN/MAX",
      "ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)",
      "LAG / LEAD / FIRST_VALUE / LAST_VALUE",
      "WITH cte AS (...) SELECT ... (CTE)",
    ],
    practice: [
      "Написать запрос: топ-3 товара по продажам в каждой категории (ROW_NUMBER + WHERE rn ≤ 3)",
      "Реализовать вторую по величине зарплату через RANK или LIMIT/OFFSET",
      "CROSS JOIN для генерации календаря дат",
    ],
    markers: [
      "Знаешь разницу WHERE vs HAVING без думания",
      "Используешь оконные функции вместо self-join, где можно",
      "Различаешь RANK / DENSE_RANK / ROW_NUMBER",
    ],
    anti: [
      "HAVING вместо WHERE для не-агрегатных условий — лишний overhead",
      "Self-join для топ-N в группе вместо ROW_NUMBER",
      "Игнорировать CROSS JOIN — иногда нужен для cartesian product",
    ],
  },
  {
    slug: "db-orm-lifecycle",
    title: "JPA: Transient/Persistent/Detached/Removed, Lazy vs Eager",
    level: 5,
    estimatedMinutes: 25,
    question: "Когда entity становится Persistent и почему Detached опасен?",
    what:
      "Состояния JPA entity: (1) Transient (new MyEntity() — не в БД, не в EntityManager); (2) Persistent (после persist() или load — в EntityManager + БД, изменения автоматически синхронизируются на flush); (3) Detached (после close сессии или detach() — есть в БД, нет в EM, изменения не сохраняются, требуют merge); (4) Removed (после remove() — будет удалён на flush). Lazy vs Eager: @ManyToOne / @OneToOne default = EAGER (всегда грузится в SELECT с JOIN); @OneToMany / @ManyToMany default = LAZY (proxy, загружается при первом обращении). Hibernate создаёт proxy через CGLIB. Доступ к lazy за пределами session = LazyInitializationException. Антипаттерн: spring.jpa.open-in-view=true (default!) — держит session на весь HTTP request, делает sneaky lazy queries в контроллере.",
    diff: [
      "Transient ↔ Persistent ↔ Detached ↔ Removed",
      "EAGER (auto-JOIN) ↔ LAZY (proxy, on-demand)",
      "@ManyToOne/@OneToOne default = EAGER ↔ @OneToMany/@ManyToMany default = LAZY",
      "persist (insert) ↔ merge (для detached) ↔ saveOrUpdate (Hibernate-only)",
    ],
    tech: [
      "@Entity, @Id, @Column, @Table",
      "@ManyToOne(fetch = FetchType.LAZY) (рекомендуется!)",
      "@EntityGraph, JOIN FETCH, @BatchSize",
      "EntityManager.persist / merge / remove / find / detach / clear",
    ],
    practice: [
      "Загрузить entity, закрыть сессию, обратиться к lazy collection — словить LazyInitializationException",
      "Решить через JOIN FETCH в JPQL",
      "Отключить spring.jpa.open-in-view=false — увидеть, какие места ломаются",
    ],
    markers: [
      "Используешь FetchType.LAZY на @ManyToOne (override default)",
      "Отключаешь open-in-view в новых проектах",
      "Различаешь persist/merge/saveOrUpdate",
    ],
    anti: [
      "Eager на @OneToMany — N+1 на ровном месте",
      "open-in-view = true — антипаттерн «sneaky queries»",
      "Заполнение Detached entity без merge и удивление",
    ],
  },
  {
    slug: "db-n-plus-one",
    title: "N+1 проблема и решения (JOIN FETCH, @EntityGraph, @BatchSize)",
    level: 5,
    estimatedMinutes: 30,
    question: "Я загрузил 100 заказов и обращаюсь к order.getItems(). Сколько запросов?",
    what:
      "N+1: 1 запрос для main collection + N запросов для каждой lazy-relation. List<Order> orders = repository.findAll(); for (Order o : orders) o.getItems().size(); — 1 + N SELECT. Решения по сложности: (1) JOIN FETCH в JPQL: SELECT o FROM Order o JOIN FETCH o.items — 1 запрос с JOIN, но дубликаты строк (нужен DISTINCT или Set), не работает с пагинацией (HHH000104 warning); (2) @EntityGraph(\"order-with-items\") — декларативное FETCH; (3) @BatchSize(size = 100) — IN-batching, 1 + N/100 запросов; (4) DTO projection — самое чистое, query напрямую в DTO без JPA-сущности; (5) Hibernate fetch profiles. EAGER — НЕ решение N+1, она просто меняет lazy на always-load, что хуже в большинстве сценариев.",
    diff: [
      "N+1 (lazy без JOIN FETCH) ↔ Cartesian explosion (несколько JOIN FETCH в одном)",
      "JOIN FETCH ↔ @EntityGraph ↔ @BatchSize ↔ DTO projection",
      "EAGER — НЕ решение N+1 (просто всегда грузит)",
      "DISTINCT при JOIN FETCH (default ON для коллекций)",
    ],
    tech: [
      "JPQL: SELECT o FROM Order o JOIN FETCH o.items",
      "@EntityGraph(attributePaths = {\"items\"})",
      "@BatchSize(size = 100) на @OneToMany",
      "DTO projection: SELECT new com.x.OrderDto(o.id, o.total) FROM Order o",
    ],
    practice: [
      "Включить spring.jpa.show-sql + p6spy — увидеть N+1 в логе",
      "Решить через JOIN FETCH, заметить дубликаты — добавить DISTINCT",
      "Заменить на @EntityGraph — увидеть тот же SQL",
    ],
    markers: [
      "Видишь N+1 в логе SQL до того, как поднимется issue",
      "Знаешь 4 способа решения и когда какой",
      "Не используешь EAGER как костыль",
    ],
    anti: [
      "EAGER на @OneToMany — решение хуже проблемы",
      "JOIN FETCH с пагинацией — Hibernate ругается, делает в памяти",
      "Несколько JOIN FETCH на @OneToMany в одной query — cartesian product",
    ],
  },

  // ===== L6. System Design, Tools, DevOps ===============================
  {
    slug: "kafka-basics",
    title: "Kafka: партиции, ordering, consumer group, exactly-once",
    level: 6,
    estimatedMinutes: 30,
    question: "Как гарантировать exactly-once и что для этого нужно?",
    what:
      "Kafka — distributed log. Топик разбит на партиции (parallelism unit). Сообщение принадлежит одной партиции по ключу (hash(key) % partitions). Ordering гарантирован только внутри партиции, не глобально. Consumer Group — N consumer'ов делят партиции (rebalance при add/remove). Offset — позиция consumer'а в партиции, коммитится в __consumer_offsets topic. Гарантии доставки: (1) at-most-once (auto-commit before processing — теряем); (2) at-least-once (commit after processing — дубликаты при retry); (3) exactly-once — нужен idempotent producer (enable.idempotence=true) + transactions (transactional.id) + isolation.level=read_committed на consumer. На practice middle: Transactional Outbox pattern — write в БД + в outbox table в одной транзакции, отдельный poller отправляет в Kafka.",
    diff: [
      "Topic ↔ Partition (parallelism) ↔ Offset (позиция)",
      "Consumer Group (балансировка) ↔ Single consumer",
      "Ordering — гарантирован внутри партиции, не глобально",
      "At-most-once ↔ At-least-once ↔ Exactly-once",
    ],
    tech: [
      "KafkaProducer / KafkaConsumer (Java client)",
      "Spring Kafka: @KafkaListener, KafkaTemplate",
      "Schema Registry + Avro / Protobuf",
      "Transactional Outbox + Debezium CDC",
    ],
    practice: [
      "Поднять Kafka в Docker, отправить 1M сообщений в 3-партиционный топик",
      "Реализовать idempotent consumer через UNIQUE constraint в БД",
      "Реализовать Transactional Outbox для атомарного write БД+Kafka",
    ],
    markers: [
      "Знаешь, что ordering — только внутри партиции",
      "Понимаешь, что нужно для exactly-once",
      "Используешь Transactional Outbox для критичных событий",
    ],
    anti: [
      "Полагаться на global ordering — невозможно",
      "auto-commit + heavy processing — потеря при crash",
      "Один KafkaConsumer на много потоков — он НЕ thread-safe",
    ],
  },
  {
    slug: "design-circuit-breaker",
    title: "Circuit Breaker и Retry с jitter (Resilience4j)",
    level: 6,
    estimatedMinutes: 25,
    question: "Зачем HALF_OPEN и в чём опасность retry без jitter?",
    what:
      "Circuit Breaker — паттерн от каскадного отказа. Три состояния: CLOSED (всё OK, считаем failure rate), OPEN (failure rate > threshold — все запросы fail-fast без вызова downstream), HALF_OPEN (после timeout — пропускаем пробные запросы; success → CLOSED, fail → OPEN). Без CB одно медленное API забивает thread pool и роняет весь сервис. Retry — повтор при failure, но: (1) опасен retry storm — все клиенты одновременно ретраят после обрыва, downstream добивает; решение — exponential backoff + jitter (random шум для расфазировки). (2) Retry имеет смысл только для transient errors (network, timeout), не для 4xx. Resilience4j — composable: Retry + CircuitBreaker + RateLimiter + Bulkhead + TimeLimiter, каждый wrapper над Supplier/Function.",
    diff: [
      "CLOSED (норма) ↔ OPEN (fail-fast) ↔ HALF_OPEN (пробные запросы)",
      "Retry без jitter ↔ Retry с exponential backoff + jitter",
      "Transient errors (network, timeout) ↔ Permanent (4xx, validation)",
      "Hystrix (legacy) ↔ Resilience4j (modern)",
    ],
    tech: [
      "Resilience4j: CircuitBreaker, Retry, RateLimiter, Bulkhead, TimeLimiter",
      "Spring Cloud Circuit Breaker (abstraction)",
      "@CircuitBreaker / @Retry аннотации",
      "Micrometer интеграция для метрик",
    ],
    practice: [
      "Обернуть REST-клиент в @CircuitBreaker с failureRateThreshold = 50%",
      "Спровоцировать OPEN через 5 failures, дождаться HALF_OPEN",
      "Добавить retry с exponential backoff (initial 100ms, multiplier 2, jitter 0.5)",
    ],
    markers: [
      "Используешь CircuitBreaker для всех внешних HTTP",
      "Не делаешь retry на 4xx",
      "Знаешь, зачем jitter в retry",
    ],
    anti: [
      "Retry без jitter — retry storm на восстанавливающийся сервис",
      "Бесконечный retry без max attempts — заваливаешь pool",
      "Retry на POST без idempotency — двойная операция",
    ],
  },
  {
    slug: "design-cache",
    title: "Кэширование: Caffeine vs Redis, паттерны",
    level: 6,
    estimatedMinutes: 25,
    question: "Когда локальный кэш, а когда распределённый?",
    what:
      "Локальный кэш (Caffeine) — в JVM-памяти процесса, мгновенный доступ (ns), но: (1) каждый инстанс свой → не консистентен; (2) умирает с процессом; (3) кушает heap. Подходит: lookup-кэш, конфигурация, immutable справочники. Распределённый (Redis, Hazelcast) — общий на все инстансы, durable, но network hop (ms). Паттерны: (1) Cache-aside (lazy load) — приложение проверяет cache, если miss — query БД, кладёт в cache; (2) Read-through — cache сам подгружает (через loader); (3) Write-through — write идёт в cache → cache синхронно в БД; (4) Write-behind — write в cache, async flush в БД (потеря при crash!); (5) Refresh-ahead — proactive refresh до expiration. TTL — обязательно для всех кэшей (без него — утечка). Invalidation — самое сложное; cache-aside проще всех. Кэш отображения на чтение — оставит хвост stale данных; принять или пушить инвалидацию через pub/sub.",
    diff: [
      "Локальный (Caffeine, in-process) ↔ Распределённый (Redis, Hazelcast)",
      "Cache-aside (pull) ↔ Read-through (push) ↔ Write-through ↔ Write-behind",
      "TTL ↔ LRU/LFU eviction",
      "Strong consistency ↔ Eventual consistency (cache stale)",
    ],
    tech: [
      "Caffeine — лучший локальный (LRU + LFU, async load)",
      "Spring Cache @Cacheable / @CacheEvict / @CachePut",
      "Redis (RedisTemplate) для distributed",
      "Hazelcast / Apache Ignite для embedded distributed",
    ],
    practice: [
      "Обернуть @Cacheable + Caffeine на медленный метод",
      "Заменить на Redis backend — измерить overhead",
      "Реализовать invalidation через @CacheEvict + Redis pub/sub",
    ],
    markers: [
      "Знаешь, когда локальный, когда распределённый",
      "Всегда задаёшь TTL",
      "Понимаешь различия паттернов и trade-offs",
    ],
    anti: [
      "Кэш без TTL — утечка",
      "Write-behind для денег / критичных данных — потеря",
      "Локальный кэш в multi-instance кластере с ожиданием consistency",
    ],
  },
  {
    slug: "docker-image",
    title: "Docker: image vs container, multi-stage build",
    level: 6,
    estimatedMinutes: 25,
    question: "Зачем multi-stage build для Java приложения?",
    what:
      "Image — immutable шаблон, слоистая файловая система (overlayFS). Container — runtime-инстанс image + writable layer. Один image → N container. Dockerfile инструкции: FROM (base image), COPY (файлы), RUN (команды в build-time, создаёт layer), CMD (default command, переопределяется), ENTRYPOINT (всегда выполняется), ENV, EXPOSE, USER, WORKDIR. Layer cache: каждая инструкция = layer; если изменилась только верхняя — нижние реюзаются. Multi-stage build для Java: FROM maven:3.9 AS build → COPY pom.xml → RUN mvn dependency:go-offline → COPY src → RUN mvn package; FROM eclipse-temurin:21-jre-alpine → COPY --from=build /app/target/*.jar app.jar — финальный image меньше в разы и не содержит maven/JDK. CMD vs ENTRYPOINT: CMD легко переопределить (`docker run image other-cmd`), ENTRYPOINT — нет, аргументы передаются в него.",
    diff: [
      "Image (immutable) ↔ Container (runtime + writable layer)",
      "RUN (build time) ↔ CMD (default runtime) ↔ ENTRYPOINT (всегда)",
      "Single-stage ↔ Multi-stage (отдельные стадии build и runtime)",
      "Layer cache — реюз по hash инструкции",
    ],
    tech: [
      "Dockerfile — FROM, COPY, RUN, CMD, ENTRYPOINT, ENV",
      ".dockerignore — исключить файлы из context",
      "BuildKit (DOCKER_BUILDKIT=1) — параллельные stages",
      "Jib (Spring Boot) — build image без Dockerfile",
    ],
    practice: [
      "Написать Dockerfile single-stage для Spring Boot → измерить размер (~600MB)",
      "Переписать на multi-stage с jre-alpine → ~150MB",
      "Замерить time-to-build с layer cache и без",
    ],
    markers: [
      "Используешь multi-stage по умолчанию",
      "Знаешь разницу CMD vs ENTRYPOINT",
      "Заботишься о размере image (alpine, distroless)",
    ],
    anti: [
      "FROM ubuntu + apt install для прода — гигантский attack surface",
      "Запуск под root — нарушение security",
      "Копировать .git / target в image — ненужно, раздувает",
    ],
  },
  {
    slug: "test-junit-mockito",
    title: "JUnit 5 + Mockito: mock/spy, ArgumentCaptor, when/thenReturn vs doReturn",
    level: 6,
    estimatedMinutes: 30,
    question: "В каких случаях doReturn вместо when/thenReturn обязателен?",
    what:
      "JUnit 5 (Jupiter) — модульная архитектура: API, Engine, Vintage (для JUnit 4). Lifecycle: @BeforeAll/@BeforeEach/@AfterEach/@AfterAll. @ParameterizedTest для DRY. @Nested для группировки. @ExtendWith({MockitoExtension.class}) — интеграция с Mockito. Mockito: mock (полностью искусственный объект, все методы возвращают null/0/false), spy (обёртка над реальным объектом, можно override отдельные методы). Stub: when(mock.foo()).thenReturn(x). doReturn(x).when(mock).foo() — обязателен для (1) spy (when вызовет реальный метод), (2) void методов (doNothing/doAnswer/doThrow), (3) методов, бросающих checked exception в setup. ArgumentCaptor.forClass(X.class) + verify(mock).method(captor.capture()) — поймать аргумент для assertion. Mockito.inOrder для проверки порядка вызовов. AssertJ — fluent assertions, лучше Hamcrest и встроенных JUnit.",
    diff: [
      "mock (всё фейк) ↔ spy (обёртка над реальным)",
      "when().thenReturn() ↔ doReturn().when() (для spy и void)",
      "verify(mock).method() ↔ ArgumentCaptor (захват аргумента)",
      "@Mock ↔ @InjectMocks ↔ @Spy",
    ],
    tech: [
      "JUnit 5: @Test, @BeforeEach, @AfterEach, @ParameterizedTest, @Nested",
      "Mockito: @Mock, @InjectMocks, when/thenReturn, verify, ArgumentCaptor",
      "AssertJ: assertThat(actual).isEqualTo(expected).isInstanceOf(X.class)",
      "@ExtendWith(MockitoExtension.class)",
    ],
    practice: [
      "Написать тест UserService с mock UserRepository через @InjectMocks + @Mock",
      "Заюзать ArgumentCaptor для проверки, что email был передан в Notifier",
      "Заменить spy(real) + doReturn — увидеть разницу с when().thenReturn()",
    ],
    markers: [
      "Используешь @InjectMocks + @Mock, не вручную new",
      "Используешь AssertJ вместо assertEquals",
      "Знаешь, когда doReturn вместо when",
    ],
    anti: [
      "mock на DTO / entity — бессмысленно, проще new",
      "Множество verify в одном тесте — тест проверяет реализацию, а не контракт",
      "InjectMocks без @ExtendWith — null pointer на старте",
    ],
  },
  {
    slug: "java-live-rest",
    title: "Live coding: REST + DTO + @Valid + Mockito-тест",
    level: 6,
    estimatedMinutes: 40,
    question: "За 30 минут собрать CRUD endpoint и unit-тест?",
    what:
      "Типичная live-задача на Middle Java: «реализуй POST /users + GET /users/{id} с валидацией и тестом». Алгоритм: (1) DTO: CreateUserDto (record с @NotBlank/@Email/@Size), UserDto; (2) Entity: User с @Id/@Email (или MapStruct mapper); (3) Repository: extends JpaRepository<User, Long>; (4) Service: с constructor injection, методы create() / findById(); (5) Controller: @RestController + @PostMapping + @Valid @RequestBody, @GetMapping + @PathVariable + ResponseEntity (или ResponseStatusException), (6) GlobalExceptionHandler: @RestControllerAdvice с @ExceptionHandler для MethodArgumentNotValidException → 400, NotFoundException → 404; (7) Тест: @ExtendWith(MockitoExtension.class), @Mock UserRepository, @InjectMocks UserService, when(repo.save(any())).thenReturn(saved), ArgumentCaptor для проверки email. Code smells, которые ищет интервьюер: голый @Autowired на поле, отсутствие @Valid, ловля Exception, голый ResponseEntity.ok без typing.",
    diff: [
      "DTO (контракт API) ↔ Entity (модель БД) — не один тот же класс",
      "Constructor injection (best) ↔ Field injection",
      "@RestController ↔ @Controller (с @ResponseBody на каждом методе)",
      "GlobalExceptionHandler ↔ try-catch в каждом методе",
    ],
    tech: [
      "Spring Boot: @RestController, @RequestMapping, @PathVariable, @Valid",
      "Spring Data JPA: JpaRepository, derived queries (findByEmail)",
      "JUnit 5 + Mockito + AssertJ",
      "MapStruct для DTO ↔ Entity",
    ],
    practice: [
      "Собрать full CRUD за 30 минут (контроллер + сервис + репозиторий + тест)",
      "Добавить @RestControllerAdvice с 3 handler'ами",
      "Прогнать тест с MockMvc + @WebMvcTest как integration",
    ],
    markers: [
      "Сразу пишешь Constructor injection",
      "Не путаешь DTO и Entity",
      "Используешь @Valid вместо ручной валидации",
    ],
    anti: [
      "@Autowired на поле в live-задаче — minus от интервьюера",
      "Прокинуть Entity сразу в response — leak полей БД",
      "Голый try-catch вокруг каждой операции — junior-почерк",
    ],
  },
];

// ---------- Раскладка позиций для canvas (React Flow) -------------------

function disciplinePosition(level: number, idxInLevel: number) {
  // Та же логика, что у levenchuk: x по уровню (column), y по индексу.
  return {
    x: 120 + level * 280,
    y: 80 + idxInLevel * 140,
  };
}

/** Превращает JAVA_MIDDLE_TOPICS в seed-формат для DB. */
export function buildJavaMiddleNodeSeeds(): {
  slug: string;
  title: string;
  summary: string;
  positionX: number;
  positionY: number;
  estimatedMinutes: number;
  prerequisites: string[];
}[] {
  const byLevel = new Map<number, LDiscipline[]>();
  for (const t of JAVA_MIDDLE_TOPICS) {
    const bucket = byLevel.get(t.level) ?? [];
    bucket.push(t);
    byLevel.set(t.level, bucket);
  }

  const out: {
    slug: string;
    title: string;
    summary: string;
    positionX: number;
    positionY: number;
    estimatedMinutes: number;
    prerequisites: string[];
  }[] = [];

  let prevLevelLast: string | null = null;
  for (const lvl of [0, 1, 2, 3, 4, 5, 6] as const) {
    const topics = byLevel.get(lvl) ?? [];
    let prevInLevel: string | null = prevLevelLast;
    topics.forEach((t, idx) => {
      const pos = disciplinePosition(t.level, idx);
      out.push({
        slug: t.slug,
        title: t.title,
        summary: t.question,
        positionX: pos.x,
        positionY: pos.y,
        estimatedMinutes: t.estimatedMinutes,
        prerequisites: prevInLevel ? [prevInLevel] : [],
      });
      prevInLevel = t.slug;
    });
    const last = topics[topics.length - 1];
    if (last) prevLevelLast = last.slug;
  }

  return out;
}
