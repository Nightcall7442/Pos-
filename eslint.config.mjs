// Один конфиг на все три пакета. До этого линтера в репозитории не было вовсе:
// в backend/package.json лежал скрипт "lint": "eslint src/", но ни пакета, ни
// конфига — команда падала. Фронтенд (13 000 строк) не проверялся ничем, кроме tsc.
//
// ESLint держим на 9.x: eslint-plugin-jsx-a11y (6.10.2) ещё не поддерживает 10.x.
// Когда плагин обновится — поднять обе версии одним коммитом.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

// Правила, которые ловят ошибки, а не стиль: стиль отдан Prettier.
const common = {
  eqeqeq: ["error", "smart"],
  "no-var": "error",
  "prefer-const": "error",
  "no-implicit-coercion": "off",
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unused-vars": [
    "warn",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
  ],
  "@typescript-eslint/no-empty-object-type": "warn",
  // Пустой catch здесь осознанный приём: разбор localStorage и подобное, где
  // падать нельзя и логировать нечего.
  "no-empty": ["error", { allowEmptyCatch: true }],
  // Расширение типов Express (declare global { namespace Express }) — штатный
  // способ, другого в @types/express нет.
  "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/build/**",
      "backend/uploads/**",
      "backend/prisma/migrations/**",
      // Клиент Prisma для переноса данных из SQLite — сгенерированный код.
      "backend/prisma/generated/**",
      "landing/**",
      "**/*.d.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Бэкенд: Node, без React ────────────────────────────────────────────────
  // Планка как у Warehouse Pro: any и неиспользуемые переменные — ошибки, а не
  // предупреждения. На бэкенде их не осталось ни одного, и новые не появятся.
  {
    files: ["backend/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    rules: {
      ...common,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },

  // ── Фронтенды: браузер + React ─────────────────────────────────────────────
  {
    files: ["frontend-admin/**/*.{ts,tsx}", "pos-terminal/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...common,
      // Планка как у Warehouse Pro: any и неиспользуемые переменные — ошибки,
      // правила хуков — полный рекомендованный набор eslint-plugin-react-hooks 7
      // (порядок хуков, зависимости, setState в эффекте, чтение ref при
      // рендере, мутация состояния и т.п.).
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Доступность: берём ровно то, что включено в recommended (правила,
      // выключенные там специально — например устаревшее label-has-for, — не
      // поднимаем), и понижаем до предупреждений. Это рабочий список для
      // задачи D-6, а не повод ронять сборку сегодня.
      ...Object.fromEntries(
        Object.entries(jsxA11y.flatConfigs.recommended.rules)
          .filter(([, level]) => level !== "off" && level !== 0)
          .map(([rule]) => [rule, "warn"])
      ),
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // ── Тесты и скрипты: console и node-окружение здесь норма ──────────────────
  {
    files: ["backend/tests/**/*.ts", "backend/scripts/**/*.ts", "e2e/**/*.{ts,mts}", "**/*.config.{ts,js}"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      ...common,
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
