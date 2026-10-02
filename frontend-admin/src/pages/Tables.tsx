import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tableService } from "../services";
import LoadingSpinner from "../components/LoadingSpinner";
import Badge, { statusBadge } from "../components/Badge";
import Modal from "../components/Modal";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { useMoney } from "../hooks/useMoney";

export default function Tables() {
  const { money } = useMoney();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ number: "", capacity: 4, zone: "" });
  const qc = useQueryClient();

  const { data: tables, isLoading } = useQuery({ queryKey: ["tables"], queryFn: () => tableService.list().then((r) => r.data.data) });
  const { data: stats } = useQuery({ queryKey: ["table-stats"], queryFn: () => tableService.getStats().then((r) => r.data.data) });
  const createMutation = useMutation({ mutationFn: (data: { number: string; capacity: number; zone: string }) => tableService.create(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["tables"] }); setShowCreate(false); setForm({ number: "", capacity: 4, zone: "" }); toast.success("Стол добавлен"); } });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => tableService.updateStatus(id, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ["tables"] }); toast.success("Статус обновлён"); } });

  const statusColors: Record<string, string> = { available: "border-green-300 bg-green-50", occupied: "border-red-300 bg-red-50", reserved: "border-blue-300 bg-blue-50", maintenance: "border-yellow-300 bg-yellow-50" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Столы</h1><p className="text-gray-500">Управление столами ресторана</p></div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="mr-2 h-4 w-4" />Добавить стол</button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card text-center"><p className="text-2xl font-bold text-gray-900">{stats.total}</p><p className="text-sm text-gray-500">Всего</p></div>
          <div className="card text-center"><p className="text-2xl font-bold text-green-600">{stats.available}</p><p className="text-sm text-gray-500">Свободны</p></div>
          <div className="card text-center"><p className="text-2xl font-bold text-red-600">{stats.occupied}</p><p className="text-sm text-gray-500">Заняты</p></div>
          <div className="card text-center"><p className="text-2xl font-bold text-blue-600">{stats.reserved}</p><p className="text-sm text-gray-500">Забронированы</p></div>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {tables?.map((table) => {
            const badge = statusBadge(table.status);
            return (
              <div key={table.id} className={`rounded-xl border-2 p-4 text-center transition-all hover:shadow-md ${statusColors[table.status] || "border-gray-200"}`}>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface shadow-sm">
                  <span className="text-xl font-bold text-gray-900">{table.number}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{table.capacity} мест</p>
                {table.zone && <p className="text-xs text-gray-400">{table.zone}</p>}
                <Badge variant={badge.variant} className="mt-2">{badge.label}</Badge>
                {table.orders?.[0] && <p className="mt-1 text-xs font-medium text-red-600">{money(table.orders[0].total)}</p>}
                <div className="mt-2 flex gap-1 justify-center">
                  {["available", "occupied", "reserved", "maintenance"].map((s) => (
                    <button key={s} onClick={() => statusMutation.mutate({ id: table.id, status: s })} className={`h-2 w-2 rounded-full ${s === "available" ? "bg-green-500" : s === "occupied" ? "bg-red-500" : s === "reserved" ? "bg-blue-500" : "bg-yellow-500"}`} title={s === "available" ? "Свободен" : s === "occupied" ? "Занят" : s === "reserved" ? "Забронирован" : "Обслуживание"} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Добавить стол" size="sm">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
          <div><label className="label">Номер стола</label><input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="input" required /></div>
          <div><label className="label">Вместимость</label><input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 4 })} className="input" /></div>
          <div><label className="label">Зона</label><input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="input" placeholder="Напр., Терраса, VIP" /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Отмена</button><button type="submit" className="btn-primary">Создать</button></div>
        </form>
      </Modal>
    </div>
  );
}
