import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchInput from "../components/SearchInput";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import toast from "react-hot-toast";
import { Plus, Pencil } from "lucide-react";

const roles = ["admin", "manager", "cashier", "waiter", "kitchen"];
const roleLabels: Record<string, string> = { admin: "Администратор", manager: "Менеджер", cashier: "Кассир", waiter: "Официант", kitchen: "Кухня" };

const emptyCreateForm = { email: "", password: "", firstName: "", lastName: "", role: "cashier", pin: "" };
type EditForm = { firstName: string; lastName: string; phone: string; role: string; password: string; pin: string };
const emptyEditForm: EditForm = { firstName: "", lastName: "", phone: "", role: "cashier", password: "", pin: "" };

// PIN — 4–10 цифр, как на бэкенде (backend/src/modules/users/user.schema.ts).
const PIN_PATTERN = /^\d{4,10}$/;

export default function Users() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["users", search], queryFn: () => userService.list({ search, limit: 50 }).then((r) => r.data) });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => userService.create(data.pin ? data : { ...data, pin: undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowCreate(false); setForm(emptyCreateForm); toast.success("Сотрудник добавлен"); },
    onError: (error: any) => { toast.error(error.response?.data?.error || "Ошибка"); },
  });
  const toggleMutation = useMutation({
    mutationFn: (id: string) => userService.toggleActive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Статус обновлён"); },
  });
  const updateMutation = useMutation({
    // password/pin отправляются только когда поле реально заполнено — так
    // пустое поле в форме означает «не менять», а не «удалить пароль».
    // Пустой pin для явного снятия PIN — отдельная кнопка ниже, не это поле.
    mutationFn: (data: { id: string; form: EditForm }) => {
      const { firstName, lastName, phone, role, password, pin } = data.form;
      const payload: Record<string, unknown> = { firstName, lastName, phone, role };
      if (password) payload.password = password;
      if (pin) payload.pin = pin;
      return userService.update(data.id, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setEditingId(null); toast.success("Сотрудник обновлён"); },
    onError: (error: any) => { toast.error(error.response?.data?.error || "Ошибка"); },
  });
  const clearPinMutation = useMutation({
    mutationFn: (id: string) => userService.update(id, { pin: "" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("PIN снят"); },
  });

  const users = data?.data || [];
  const roleColors: Record<string, "info" | "success" | "warning" | "gray"> = { manager: "info", cashier: "success", waiter: "warning", kitchen: "gray" };

  const openEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({ firstName: user.firstName || "", lastName: user.lastName || "", phone: user.phone || "", role: user.role, password: "", pin: "" });
  };

  const pinInvalid = form.pin.length > 0 && !PIN_PATTERN.test(form.pin);
  const editPinInvalid = editForm.pin.length > 0 && !PIN_PATTERN.test(editForm.pin);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Сотрудники</h1><p className="text-gray-500">Управление учётными записями</p></div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" />Добавить</button>
      </div>
      <SearchInput value={search} onChange={setSearch} placeholder="Поиск сотрудников..." className="w-80" />
      {isLoading ? <LoadingSpinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead><tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="p-4">Сотрудник</th><th className="p-4">Роль</th><th className="p-4">Email</th><th className="p-4">Касса</th><th className="p-4">Статус</th><th className="p-4 text-right">Действия</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">{user.firstName?.[0]}{user.lastName?.[0]}</div><span className="font-medium text-gray-900">{user.firstName} {user.lastName}</span></div></td>
                  <td className="p-4"><Badge variant={roleColors[user.role] || "gray"}>{roleLabels[user.role] || user.role}</Badge></td>
                  <td className="p-4 text-sm text-gray-500">{user.email}</td>
                  <td className="p-4">
                    {user.hasPin ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="success">PIN задан</Badge>
                        <button onClick={() => clearPinMutation.mutate(user.id)} className="text-xs text-gray-400 hover:text-gray-600">снять</button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">нет входа на кассе</span>
                    )}
                  </td>
                  <td className="p-4"><Badge variant={user.isActive ? "success" : "gray"}>{user.isActive ? "Активен" : "Неактивен"}</Badge></td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <button onClick={() => openEdit(user)} className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" />Изменить</button>
                      <button onClick={() => toggleMutation.mutate(user.id)} className="text-sm font-medium text-primary-600 hover:text-primary-700">{user.isActive ? "Деактивировать" : "Активировать"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Добавить сотрудника">
        <form onSubmit={(e) => { e.preventDefault(); if (!pinInvalid) createMutation.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Имя</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required /></div>
            <div><label className="label">Фамилия</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required /></div>
          </div>
          <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required /></div>
          <div><label className="label">Пароль</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required /></div>
          <div><label className="label">Роль</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">{roles.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></div>
          <div>
            <label className="label">PIN для кассы (необязательно)</label>
            <input
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              className="input"
              inputMode="numeric"
              placeholder="4–10 цифр"
            />
            <p className="mt-1 text-xs text-gray-400">С этим PIN сотрудник входит на кассе, нажав своё имя — email и пароль там не нужны.</p>
            {pinInvalid && <p className="mt-1 text-xs text-red-500">PIN — от 4 до 10 цифр</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Отмена</button><button type="submit" disabled={createMutation.isPending || pinInvalid} className="btn-primary">{createMutation.isPending ? "Создание..." : "Создать"}</button></div>
        </form>
      </Modal>
      <Modal isOpen={editingId !== null} onClose={() => setEditingId(null)} title="Изменить сотрудника">
        <form onSubmit={(e) => { e.preventDefault(); if (editingId && !editPinInvalid) updateMutation.mutate({ id: editingId, form: editForm }); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Имя</label><input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} className="input" required /></div>
            <div><label className="label">Фамилия</label><input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} className="input" required /></div>
          </div>
          <div><label className="label">Телефон</label><input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input" /></div>
          <div><label className="label">Роль</label><select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="input">{roles.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></div>
          <div><label className="label">Новый пароль</label><input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="input" placeholder="оставьте пустым — не менять" /></div>
          <div>
            <label className="label">Новый PIN для кассы</label>
            <input
              value={editForm.pin}
              onChange={(e) => setEditForm({ ...editForm, pin: e.target.value.replace(/\D/g, "").slice(0, 10) })}
              className="input"
              inputMode="numeric"
              placeholder="оставьте пустым — не менять"
            />
            {editPinInvalid && <p className="mt-1 text-xs text-red-500">PIN — от 4 до 10 цифр</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setEditingId(null)} className="btn-secondary">Отмена</button><button type="submit" disabled={updateMutation.isPending || editPinInvalid} className="btn-primary">{updateMutation.isPending ? "Сохранение..." : "Сохранить"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
