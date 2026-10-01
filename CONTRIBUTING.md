# Как работать с кодом

## Проверки

```bash
npm run lint          # eslint по всем трём пакетам
npm run lint:fix      # то, что исправляется автоматически
npm run lint:budget   # lint + ограничение на число предупреждений (как в CI)
npm run typecheck     # tsc --noEmit: backend, панель, касса
npm test              # тесты бэкенда (vitest, нужен Postgres)
npm run test:frontend # юнит-тесты панели и кассы (vitest + jsdom, без базы)
npm run test:e2e      # сквозной тест кассы в браузере (Playwright, нужен Postgres)
npm run format        # prettier по репозиторию
npm run ci            # всё вместе, как на PR
```

Перед первым запуском: `npm install` в корне, `docker compose up -d --wait postgres`
(PostgreSQL 16 на localhost:5432) и `npm run setup` (установка трёх пакетов,
миграции, demo-данные). Тесты сами создают и стирают свою базу `qwik_test` в том
же Postgres; другое место — через `TEST_DATABASE_URL` (имя базы обязано
кончаться на `_test`).

## Сквозной тест кассы

`e2e/` — Playwright проходит день кассира в браузере против настоящего
бэкенда: привязка планшета к demo-market, вход Азизы по PIN, открытие смены,
скан `2*` молока, хлеб одним касанием, оплата F8 — и сверка с сервером:
заказ на 31 500, остатки 58 и 79, наличные в смене.

- `e2e/start-backend.mts` готовит базу `qwik_e2e_test` (рядом с тестовой
  базой из `TEST_DATABASE_URL`): стирает, накатывает миграции, кладёт
  демо-данные из `prisma/seed.ts` — и поднимает бэкенд на порту 3200.
  Касса — на 5274 и проксирует API туда (`VITE_PROXY_TARGET`). Запущенная
  разработка на 3000/5173/5174 не мешает.
- Локально браузер — установленный Microsoft Edge (`channel: "msedge"`),
  скачивать ничего не нужно. В CI Playwright ставит свой Chromium.
- Упавший тест оставляет трейс: `npx playwright show-trace test-results/…/trace.zip`.

## Политика линтера

Конфиг один на весь репозиторий — `eslint.config.mjs`. Делится на три части:
бэкенд (Node, без React), фронтенды (браузер, React, доступность), тесты и
скрипты (там `console` и `any` разрешены).

**Ошибка** — то, что ломает поведение: порядок хуков (`react-hooks/rules-of-hooks`),
`==` вместо `===`, `var`, лишние escape-последовательности в регулярках.
Такой PR не вмёрджить.

**Весь код — на уровне Warehouse Pro.** `any` и неиспользуемые переменные —
ошибки линтера в бэкенде и в обоих фронтендах; во фронтендах ещё и полный
рекомендованный набор `eslint-plugin-react-hooks` 7 (setState в эффекте, чтение
ref во время рендера, мутация и т.п.). Во всех трёх `tsconfig.json` включены
`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. Вместо
`any`: на бэкенде — типы Prisma и `z.infer` схем, во фронтендах — типы ответов
API из `services/index.ts`, ошибки запросов — `apiErrorMessage(error, "…")`.

Исключение из правила (`eslint-disable-next-line`) — только с объяснением
после `--`, почему здесь иначе нельзя. Сейчас их 6 (у Warehouse Pro — 28).

**Предупреждения** — 215, и все про доступность (`jsx-a11y`): чаще всего
`<label className="label">` рядом с `<input className="input">` без `htmlFor` и
`id` — подпись видна глазом, но не существует для скринридера и для клика по
тексту. Почти все снимет один компонент `FormField` (задача D-5 в плане
дизайна).

CI запускает `lint:budget`, то есть `eslint . --max-warnings 215`. **Число в
`package.json` разрешено только уменьшать.** PR, добавляющий новое
предупреждение, станет красным; PR, убирающий долг, опускает планку.

## Версии инструментов

ESLint держим на 9.x: `eslint-plugin-jsx-a11y` 6.10.2 ещё не поддерживает 10.x.
Когда плагин обновится — поднять обе версии одним коммитом.

## Что CI проверяет

`.github/workflows/ci.yml` на каждый PR: установка четырёх package-lock,
`prisma generate`, `lint:budget`, `typecheck`, тесты бэкенда и сборку обоих
фронтендов Vite. Около 5–7 минут.
