import { useState } from "react";
import { Package, Plus, Save, ShoppingCart, Trash2 } from "lucide-react";
import Badge, { statusBadge } from "../components/Badge";
import Button from "../components/Button";
import Checkbox from "../components/Checkbox";
import ConfirmDialog from "../components/ConfirmDialog";
import DataTable, { type Column } from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import FormField from "../components/FormField";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import SearchInput from "../components/SearchInput";
import Select from "../components/Select";
import StatsCard from "../components/StatsCard";
import Tabs from "../components/Tabs";
import Toggle from "../components/Toggle";
import { notify } from "../components/notify";

/**
 * Витрина интерфейса (D-5): все компоненты панели во всех состояниях, светлая
 * и тёмная тема рядом. Заменяет Storybook почти бесплатно и заодно проверяет
 * D-1: если в тёмной колонке что-то белое или нечитаемое — токен забыт.
 * Открыта только администратору (utils/access.ts).
 */
export default function DesignSystem() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Витрина интерфейса</h1>
        <p className="mt-1 max-w-3xl text-gray-500">
          Компоненты панели во всех состояниях: слева светлая тема, справа тёмная. Новое на страницах собирается из этих частей; если
          чего-то здесь нет — сначала добавьте сюда.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ThemeColumn theme="light" />
        <ThemeColumn theme="dark" />
      </div>
    </div>
  );
}

function ThemeColumn({ theme }: { theme: "light" | "dark" }) {
  return (
    // Класс .light/.dark переопределяет токены внутри блока (index.css), какая бы тема ни была у панели.
    <section aria-label={theme === "light" ? "Светлая тема" : "Тёмная тема"} className={`${theme} space-y-6 rounded-md border border-gray-200 bg-canvas p-4 text-gray-900 sm:p-6`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{theme === "light" ? "Светлая тема" : "Тёмная тема"}</p>
      <Colors />
      <Type />
      <Buttons />
      <Fields />
      <Choices />
      <Statuses />
      <TableDemo />
      <Overlays />
      <Misc />
    </section>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {note && <p className="mt-0.5 text-sm text-gray-500">{note}</p>}
      </div>
      {children}
    </div>
  );
}

// Классы целиком, а не собранные из кусочков: Tailwind находит их в исходнике.
const SURFACES = [
  ["bg-canvas", "canvas — фон страницы"],
  ["bg-surface", "surface — карточка"],
  ["bg-bar", "bar — строка состояния"],
  ["bg-bar-2", "bar-2 — меню"],
  ["bg-action", "action — главная кнопка"],
  ["bg-pay", "pay — только оплата"],
] as const;
const STEEL = ["bg-primary-50", "bg-primary-100", "bg-primary-200", "bg-primary-300", "bg-primary-400", "bg-primary-500", "bg-primary-600", "bg-primary-700"];
const SEMANTIC = [
  ["success", "bg-success-50", "bg-success-500", "bg-success-700"],
  ["warning", "bg-warning-50", "bg-warning-500", "bg-warning-700"],
  ["danger", "bg-danger-50", "bg-danger-500", "bg-danger-700"],
  ["info", "bg-info-50", "bg-info-500", "bg-info-700"],
] as const;

function Colors() {
  return (
    <Block title="Цвета" note="Страницы берут смысл (success, danger), а не оттенок (green-600). Сталь — акцент, зелёный — только оплата.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SURFACES.map(([cls, label]) => (
          <div key={cls} className="flex items-center gap-2 text-xs text-gray-600">
            <span className={`h-8 w-8 shrink-0 rounded-sm border border-gray-200 ${cls}`} />
            {label}
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-xs text-gray-500">primary / info — сталь 50…700</p>
        <div className="flex overflow-hidden rounded-sm border border-gray-200">
          {STEEL.map((cls) => (
            <span key={cls} className={`h-8 flex-1 ${cls}`} title={cls} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SEMANTIC.map(([name, ...shades]) => (
          <div key={name}>
            <div className="flex overflow-hidden rounded-sm border border-gray-200">
              {shades.map((cls) => (
                <span key={cls} className={`h-8 flex-1 ${cls}`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-600">{name}</p>
          </div>
        ))}
      </div>
    </Block>
  );
}

function Type() {
  return (
    <Block title="Шрифт и цифры" note="IBM Plex Sans; цифры табличные — суммы в колонке не прыгают.">
      <div className="space-y-1.5">
        <p className="text-2xl font-bold">Заголовок страницы</p>
        <p className="text-lg font-semibold">Заголовок блока</p>
        <p className="text-sm text-gray-700">Основной текст: описание раздела, подписи, значения в таблице.</p>
        <p className="text-xs text-gray-500">Подсказка и второстепенный текст</p>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Шапка таблицы</p>
        <p className="font-semibold tabular-nums">
          1 111 111 сўм
          <br />
          9 999 999 сўм
        </p>
      </div>
    </Block>
  );
}

function Buttons() {
  return (
    <Block title="Кнопки" note="Покой, фокус с клавиатуры (Tab), загрузка, недоступна. type по умолчанию — button.">
      {(["primary", "secondary", "danger", "ghost"] as const).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <Button variant={variant} icon={<Plus className="h-4 w-4" />}>
            {variant === "danger" ? "Удалить" : "Добавить"}
          </Button>
          <Button variant={variant} className="ring-2 ring-primary-500 ring-offset-2">
            Фокус
          </Button>
          <Button variant={variant} loading>
            Сохраняю
          </Button>
          <Button variant={variant} disabled>
            Недоступна
          </Button>
        </div>
      ))}
    </Block>
  );
}

function Fields() {
  const [name, setName] = useState("Кока-кола 1,5 л");
  const [query, setQuery] = useState("");
  return (
    <Block title="Поля" note="FormField связывает подпись, подсказку и ошибку с полем — для клика и для диктора.">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Название" required hint="Так товар выглядит в чеке">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Цена" error="Цена ниже себестоимости — проверьте">
          <input className="input" defaultValue="11 000" inputMode="decimal" />
        </FormField>
        <FormField label="Категория">
          <Select placeholder="Выберите…" options={[{ value: "drinks", label: "Напитки" }, { value: "bakery", label: "Хлеб и выпечка" }]} defaultValue="drinks" />
        </FormField>
        <FormField label="Штрихкод" hint="Поле недоступно: код уже в общей базе">
          <input className="input" defaultValue="4780000000113" disabled />
        </FormField>
        <FormField label="Описание" className="sm:col-span-2">
          <textarea className="input" rows={2} placeholder="Необязательно" />
        </FormField>
        <div className="sm:col-span-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Поиск товаров…" />
        </div>
      </div>
    </Block>
  );
}

function Choices() {
  const [sound, setSound] = useState(true);
  const [stock, setStock] = useState(false);
  const [tab, setTab] = useState("all");
  return (
    <Block title="Выбор" note="Флажок — пункт формы; переключатель — настройка, которая действует сразу; вкладки — стрелками ←/→.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <Checkbox label="Учитывать остаток" description="Касса не продаст больше, чем есть" defaultChecked />
          <Checkbox label="Продаётся на вес" />
          <Checkbox label="Недоступно" disabled />
        </div>
        <div className="space-y-3">
          <Toggle label="Звук на кухне" checked={sound} onChange={setSound} />
          <Toggle label="Делиться каталогом" description="Названия товаров — в общую базу" checked={stock} onChange={setStock} />
          <Toggle label="Недоступно" checked disabled onChange={() => {}} />
        </div>
      </div>
      <Tabs
        label="Статус заказов"
        value={tab}
        onChange={setTab}
        items={[
          { value: "all", label: "Все", count: 24 },
          { value: "pending", label: "Ожидают", count: 3 },
          { value: "ready", label: "Готовы", count: 1 },
          { value: "cancelled", label: "Отменены" },
        ]}
      />
    </Block>
  );
}

function Statuses() {
  return (
    <Block title="Статусы">
      <div className="flex flex-wrap gap-2">
        <Badge variant="success">success</Badge>
        <Badge variant="warning">warning</Badge>
        <Badge variant="danger">danger</Badge>
        <Badge variant="info">info</Badge>
        <Badge>gray</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {["pending", "preparing", "completed", "cancelled", "occupied"].map((status) => {
          const badge = statusBadge(status);
          return (
            <Badge key={status} variant={badge.variant}>
              {badge.label}
            </Badge>
          );
        })}
      </div>
    </Block>
  );
}

interface SampleRow {
  id: string;
  name: string;
  price: number;
  stock: number;
  min: number;
}

const ROWS: SampleRow[] = [
  { id: "1", name: "Молоко «Лактис» 3,2% 1 л", price: 13500, stock: 59, min: 12 },
  { id: "2", name: "Хлеб «Нон» белый", price: 4500, stock: 80, min: 20 },
  { id: "3", name: "Сметана 20% 400 г", price: 18500, stock: 4, min: 8 },
];

const COLUMNS: Column<SampleRow>[] = [
  { key: "name", header: "Товар", cell: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
  { key: "price", header: "Цена", align: "right", className: "whitespace-nowrap", cell: (row) => `${row.price.toLocaleString("ru-RU")} сўм` },
  { key: "stock", header: "Остаток", align: "right", cell: (row) => <span className={row.stock <= row.min ? "font-semibold text-danger-600" : ""}>{row.stock}</span> },
  {
    key: "status",
    header: "Статус",
    cell: (row) => (row.stock <= row.min ? <Badge variant="warning">Мало</Badge> : <Badge variant="success">В наличии</Badge>),
  },
];

function TableDemo() {
  const [state, setState] = useState<"data" | "loading" | "empty" | "error">("data");
  const [page, setPage] = useState(2);
  return (
    <Block title="Таблица" note="Загрузка — строки-заглушки той же высоты; пусто — EmptyState с действием; ошибка — «Повторить».">
      <Tabs
        label="Состояние таблицы"
        value={state}
        onChange={setState}
        items={[
          { value: "data", label: "Данные" },
          { value: "loading", label: "Загрузка" },
          { value: "empty", label: "Пусто" },
          { value: "error", label: "Ошибка" },
        ]}
      />
      <DataTable
        caption="Пример таблицы товаров"
        columns={COLUMNS}
        rows={state === "empty" ? [] : ROWS}
        rowKey={(row) => row.id}
        loading={state === "loading"}
        error={state === "error" ? "Нет связи с сервером — повторите, когда связь вернётся" : null}
        onRetry={() => setState("data")}
        empty={
          <EmptyState compact title="Товаров пока нет" description="Быстрее всего — сканером." action={<Button icon={<Plus className="h-4 w-4" />}>Добавить</Button>} />
        }
      />
      <Pagination page={page} totalPages={7} total={134} onChange={setPage} />
    </Block>
  );
}

function Overlays() {
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <Block title="Окна и уведомления" note="Окно держит фокус внутри, Escape закрывает, фокус возвращается на кнопку.">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setModal(true)}>
          Открыть окно
        </Button>
        <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(true)}>
          Удалить…
        </Button>
        <Button variant="ghost" onClick={() => notify.success("Товар сохранён")}>
          Успех
        </Button>
        <Button variant="ghost" onClick={() => notify.error("Не удалось сохранить — повторите")}>
          Ошибка
        </Button>
        <Button variant="ghost" onClick={() => notify.undo("«Сметана» удалена", () => notify.success("Вернули"))}>
          С «Вернуть»
        </Button>
      </div>
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Новая категория" size="sm">
        <div className="space-y-4">
          <FormField label="Название" required>
            <input className="input" placeholder="Напитки" />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>
              Отмена
            </Button>
            <Button icon={<Save className="h-4 w-4" />} onClick={() => setModal(false)}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        danger
        title="Удалить товар?"
        description="«Сметана 20% 400 г» пропадёт из каталога и с кассы. История продаж останется."
        confirmLabel="Удалить"
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
    </Block>
  );
}

function Misc() {
  return (
    <Block title="Показатели, пусто, загрузка">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard title="Выручка за сегодня" value="1 254 000 сўм" change={12} icon={<ShoppingCart className="h-5 w-5" />} />
        <StatsCard title="Всего товаров" value="55" icon={<Package className="h-5 w-5" />} color="red" />
      </div>
      <div className="rounded-md border border-dashed border-gray-300">
        <EmptyState compact title="Приходов пока нет" description="Приход — это поступление товара: остатки растут." action={<Button>Оформить приход</Button>} />
      </div>
      <div className="flex items-center gap-6">
        <LoadingSpinner size="sm" />
        <LoadingSpinner />
      </div>
    </Block>
  );
}
