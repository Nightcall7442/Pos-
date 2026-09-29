import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import SearchInput from "../components/SearchInput";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";

const roles = ["admin", "manager", "cashier", "waiter", "kitchen"];
const roleLabels: Record<string, string> = { admin: "Администратор", manager: "Менеджер", cashier: "Кассир", waiter: "Официант", kitchen: "Кухня" };

export default function Users() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", role: "cashier" });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["users", search], queryFn: () => userService.list({ search, limit: 50 }).then((r) => r.data) });
  const createMutation = useMutation({
    mutationFn: (data: any) => userService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowCreate(false); setForm({ email: "", password: "", firstName: "", lastName: "", role: "cashier" }); toast.success("Сотрудник добавлен"); },
    onError: (error: any) => { toast.error(error.response?.data?.error || "Ошибка"); },
  });
  const toggleMutation = useMutation({
    mutationFn: (id: string) => userService.toggleActive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Статус обновлён"); },
  });

  const users = data?.data || [];
  const roleColors: Record<string, "info" | "success" | "warning" | "gray"> = { manager: "info", cashier: "success", waiter: "warning", kitchen: "gray" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Сотрудники</h1><p className="text-gray-500">Управление учётными записями</p></div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" />Добавить</button>
      </div>
      <SearchInput value={search} onChange={setSearch} placeholder="Поиск сотрудников..." className="w-80" />
      {isLoading ? <LoadingSpinner /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="p-4">Сотрудник</th><th className="p-4">Роль</th><th className="p-4">Email</th><th className="p-4">Статус</th><th className="p-4 text-right">Действия</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">{user.firstName?.[0]}{user.lastName?.[0]}</div><span className="font-medium text-gray-900">{user.firstName} {user.lastName}</span></div></td>
                  <td className="p-4"><Badge variant={roleColors[user.role] || "gray"}>{roleLabels[user.role] || user.role}</Badge></td>
                  <td className="p-4 text-sm text-gray-500">{user.email}</td>
                  <td className="p-4"><Badge variant={user.isActive ? "success" : "gray"}>{user.isActive ? "Активен" : "Неактивен"}</Badge></td>
                  <td className="p-4 text-right"><button onClick={() => toggleMutation.mutate(user.id)} className="text-sm font-medium text-primary-600 hover:text-primary-700">{user.isActive ? "Деактивировать" : "Активировать"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Добавить сотрудника">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Имя</label><input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" required /></div>
            <div><label className="label">Фамилия</label><input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" required /></div>
          </div>
          <div><label className="label">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required /></div>
          <div><label className="label">Пароль</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required /></div>
          <div><label className="label">Роль</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">{roles.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Отмена</button><button type="submit" disabled={createMutation.isPending} className="btn-primary">{createMutation.isPending ? "Создание..." : "Создать"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
