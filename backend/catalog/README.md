# Каталог штрихкодов

`catalog.jsonl.gz` — поставляемый вместе с приложением снимок общей базы штрихкодов
(одна позиция в строке: `b` — штрихкод, `n` — название, `br` — бренд, `q` — объём,
`c` — полка). При старте сервера его загружает `src/modules/catalog/catalog.import.ts`.

## Источник и лицензия

Данные получены из проектов [Open Food Facts](https://world.openfoodfacts.org),
[Open Beauty Facts](https://world.openbeautyfacts.org),
[Open Products Facts](https://world.openproductsfacts.org) и
[Open Pet Food Facts](https://world.openpetfoodfacts.org).

> Contains information from Open Food Facts (and sister projects), which is made
> available here under the Open Database License (ODbL) 1.0.
> © Open Food Facts contributors.

Файл — *производная база* (выборка и нормализация названий, объёмов и полок),
поэтому он распространяется на условиях [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/):
нужно сохранять указание источника и отдавать производную базу на тех же условиях.
Отдельные записи — [Database Contents License 1.0](https://opendatacommons.org/licenses/dbcl/1-0/).
Остальной код репозитория этой лицензией не затрагивается.

Что вошло и как собрать заново — в разделе «База штрихкодов» основного `README.md`
и в шапке `scripts/build-catalog.ts`.

## Национальный каталог Узбекистана

Данные из `tasnif.soliq.uz` в этот файл **не входят**: сервер запрашивает их по
одному штрихкоду и запоминает только в базе данных (см. раздел «База штрихкодов»
основного `README.md`).
