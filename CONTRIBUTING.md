# Как работать с кодом

## Проверки

```bash
npm run lint          # eslint по всем трём пакетам
npm run lint:fix      # то, что исправляется автоматически
npm run lint:budget   # lint + ограничение на число предупреждений (как в CI)
npm run typecheck     # tsc --noEmit: backend, панель, касса
npm test              # тесты бэкенда (vitest)
npm run format        # prettier по репозиторию
npm run ci            # всё вместе, как на PR
```

Перед первым запуском: `npm install` в корне, `docker compose up -d --wait postgres`
(PostgreSQL 16 на localhost:5432) и `npm run setup` (установка трёх пакетов,
миграции, demo-данные). Тесты сами создают и стирают свою базу `qwik_test` в том
же Postgres; другое место — через `TEST_DATABASE_URL` (имя базы обязано
кончаться на `_test`).

## Политика линтера

Конфиг один на весь репозиторий — `eslint.config.mjs`. Делится на три части:
бэкенд (Node, без React), фронтенды (браузер, React, доступность), тесты и
скрипты (там `console` и `any` разрешены).

**Ошибка** — то, что ломает поведение: порядок хуков (`react-hooks/rules-of-hooks`),
`==` вместо `===`, `var`, лишние escape-последовательности в регулярках.
Такой PR не вмёрджить.

**Бэкенд — на уровне Warehouse Pro:** `any` и неиспользуемые переменные там —
ошибки, а не предупреждения (`eslint.config.mjs`), в `backend/tsconfig.json`
включены `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
Сейчас на бэкенде 0 предупреждений, и новое `any` не пройдёт CI. Вместо `any` —
типы Prisma (`Prisma.ProductWhereInput` и т.п.) и типы схем валидации
(`z.infer<typeof …QuerySchema>`).

**Предупреждение** — накопленный долг фронтендов. Сегодня его 313 (панель 249,
касса 64): подписи полей без связи с полем (`jsx-a11y`), `any`, неиспользуемые
переменные. 185 из них — про подписи: `<label className="label">` написан
рядом с `<input className="input">`, но без `htmlFor` и `id`. Почти все эти
предупреждения снимет один компонент `FormField` (задача D-5).

CI запускает `lint:budget`, то есть `eslint . --max-warnings 313`. **Число в
`package.json` разрешено только уменьшать.** PR, добавляющий новое
предупреждение, станет красным; PR, убирающий долг, опускает планку.

## Версии инструментов

ESLint держим на 9.x: `eslint-plugin-jsx-a11y` 6.10.2 ещё не поддерживает 10.x.
Когда плагин обновится — поднять обе версии одним коммитом.

## Что CI проверяет

`.github/workflows/ci.yml` на каждый PR: установка четырёх package-lock,
`prisma generate`, `lint:budget`, `typecheck`, тесты бэкенда и сборку обоих
фронтендов Vite. Около 5–7 минут.
