"use client";

import { useEffect, useRef, useState } from "react";
import { Employee, DEFAULT_COLORS } from "@/types";

interface NewEmployeeData {
  name: string; color: string; gender: string; dateOfBirth: string;
  employeeType: string; phone4: string; password: string; role: string;
}

interface Props {
  employees: Employee[];
  onAdd: (data: NewEmployeeData) => void;
  onDelete: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onUpdate: (id: number, data: Partial<NewEmployeeData>) => void;
  onRestore: (employee: Employee) => void;
  onDragStart: (employee: Employee) => void;
}

const EMPTY_FORM: NewEmployeeData = {
  name: "", color: DEFAULT_COLORS[0], gender: "F",
  dateOfBirth: "", employeeType: "FULL_TIME", phone4: "", password: "", role: "EMPLOYEE",
};

// ── Full employee edit modal ──────────────────────────────────────────────────
function EmployeeEditModal({ emp, onSave, onClose }: {
  emp: Employee; onSave: (data: Partial<NewEmployeeData>) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<NewEmployeeData>({
    name: emp.name, color: emp.color, gender: emp.gender ?? "F",
    dateOfBirth: emp.dateOfBirth ?? "", employeeType: emp.employeeType ?? "FULL_TIME",
    phone4: emp.phone4 ?? "", password: "", role: emp.role ?? "EMPLOYEE",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose} dir="rtl">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 relative overflow-hidden"
        style={{ border: "1px solid #F5D5D2", boxShadow: "0 1px 3px rgba(220,38,38,0.06), 0 8px 24px rgba(220,38,38,0.08), 0 32px 64px rgba(0,0,0,0.1)" }}
        onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, #E5252A 20%, #E5252A 80%, transparent 100%)" }} />
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">עריכת פרטי עובד</h3>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-gray-400">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">שם מלא</label>
            <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">צבע</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200" />
                <div className="flex gap-1 flex-wrap">
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: form.color === c ? "#111" : "transparent" }} />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">מגדר</label>
              <div className="flex gap-2">
                {[["F","נקבה"],["M","זכר"]].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({ ...f, gender: val }))}
                    className="flex-1 py-2 text-sm rounded-lg border transition-all font-medium"
                    style={{ background: form.gender === val ? "#D7252F" : "#fff", color: form.gender === val ? "#fff" : "#6B7280", borderColor: form.gender === val ? "#D7252F" : "#E5E7EB" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">תאריך לידה</label>
              <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">סוג משרה</label>
              <div className="flex gap-2">
                {[["FULL_TIME","מלאה"],["PART_TIME","חלקית"]].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({ ...f, employeeType: val }))}
                    className="flex-1 py-1.5 text-xs rounded-lg border transition-all font-medium"
                    style={{ background: form.employeeType === val ? "#D7252F" : "#fff", color: form.employeeType === val ? "#fff" : "#6B7280", borderColor: form.employeeType === val ? "#D7252F" : "#E5E7EB" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">4 ספרות נייד</label>
              <input type="tel" inputMode="numeric" maxLength={4} placeholder="1234"
                value={form.phone4} onChange={e => setForm(f => ({ ...f, phone4: e.target.value.replace(/\D/g,"").slice(0,4) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 text-center tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">סיסמה חדשה (אופציונלי)</label>
              <input type="password" placeholder="השאר ריק = ללא שינוי"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">הרשאה</label>
            <div className="flex gap-2">
              {[["EMPLOYEE","עובד/ת"],["MANAGER","מנהל/ת"]].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setForm(f => ({ ...f, role: val }))}
                  className="flex-1 py-2 text-sm rounded-lg border transition-all font-medium"
                  style={{ background: form.role === val ? "#D7252F" : "#fff", color: form.role === val ? "#fff" : "#6B7280", borderColor: form.role === val ? "#D7252F" : "#E5E7EB" }}>
                  {label}
                </button>
              ))}
            </div>
            {form.role === "MANAGER" && emp.role !== "MANAGER" && (
              <p className="text-[11px] text-amber-600 mt-1">מנהל/ת יכול/ה לערוך את הלוח, העובדים וכל ההגדרות</p>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => onSave(form)} disabled={!form.name.trim()}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-colors"
              style={{ background: "#D7252F" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
              onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
              שמור שינויים
            </button>
            <button onClick={onClose} className="px-4 py-2.5 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EmployeeManager({ employees, onAdd, onDelete, onRename, onUpdate, onRestore, onDragStart }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewEmployeeData>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [archivedList, setArchivedList] = useState<Employee[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Archived employees aren't in the roster prop — fetched separately and
  // refreshed whenever the active roster changes (e.g. after an archive)
  useEffect(() => {
    fetch("/api/employees")
      .then(r => r.json())
      .then((all: Employee[]) => setArchivedList(Array.isArray(all) ? all.filter(e => e.archived) : []));
  }, [employees]);

  async function handleRestore(id: number) {
    if (restoringId) return;
    setRestoringId(id);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      if (!res.ok) { alert("השחזור נכשל"); return; }
      const emp = await res.json();
      setArchivedList(prev => prev.filter(e => e.id !== id));
      onRestore(emp);
    } finally {
      setRestoringId(null);
    }
  }

  function handleAdd() {
    if (!form.name.trim()) return;
    onAdd({ ...form, name: form.name.trim() });
    setForm({ ...EMPTY_FORM, color: DEFAULT_COLORS[employees.length % DEFAULT_COLORS.length] });
    setAdding(false);
  }

  function handleSaveEdit(data: Partial<NewEmployeeData>) {
    if (!editingEmployee) return;
    onUpdate(editingEmployee.id, data);
    setEditingEmployee(null);
  }

  return (
    <div className="mt-6" dir="rtl">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">עובדים</h2>
        <button onClick={() => setAdding(v => !v)}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600">
          {adding ? "ביטול" : "+ הוסף"}
        </button>
      </div>

      {adding && (
        <div className="mb-4 bg-gray-50 rounded-xl p-4 border border-gray-200" dir="rtl">
          <p className="text-sm font-semibold text-gray-700 mb-3">רישום עובד חדש</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">שם מלא *</label>
              <input autoFocus placeholder="שם העובד" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">צבע</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200" />
                <div className="flex gap-1 flex-wrap">
                  {DEFAULT_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: form.color === c ? "#111" : "transparent" }} />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">מגדר</label>
              <div className="flex gap-2">
                {[["F","נקבה"],["M","זכר"]].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({ ...f, gender: val }))}
                    className="flex-1 py-2 text-sm rounded-lg border transition-all font-medium"
                    style={{ background: form.gender === val ? "#D7252F" : "#fff", color: form.gender === val ? "#fff" : "#6B7280", borderColor: form.gender === val ? "#D7252F" : "#E5E7EB" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">תאריך לידה</label>
              <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">סוג משרה</label>
              <div className="flex gap-2">
                {[["FULL_TIME","מלאה"],["PART_TIME","חלקית"]].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setForm(f => ({ ...f, employeeType: val }))}
                    className="flex-1 py-2 text-sm rounded-lg border transition-all font-medium"
                    style={{ background: form.employeeType === val ? "#D7252F" : "#fff", color: form.employeeType === val ? "#fff" : "#6B7280", borderColor: form.employeeType === val ? "#D7252F" : "#E5E7EB" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">4 ספרות נייד</label>
              <input type="tel" inputMode="numeric" maxLength={4} placeholder="1234"
                value={form.phone4} onChange={e => setForm(f => ({ ...f, phone4: e.target.value.replace(/\D/g,"").slice(0,4) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 text-center tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">סיסמה</label>
              <input type="password" placeholder="סיסמה ראשונית"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={!form.name.trim()}
            className="mt-3 w-full py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-colors"
            style={{ background: "#D7252F" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
            onMouseLeave={e => (e.currentTarget.style.background = "#D7252F")}>
            הוסף עובד
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {employees.map(emp => (
          <div key={emp.id} draggable={confirmDeleteId !== emp.id}
            onDragStart={() => confirmDeleteId !== emp.id && onDragStart(emp)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm border border-white/20 select-none"
            style={{ backgroundColor: emp.color, minWidth: 130, cursor: confirmDeleteId === emp.id ? "default" : "grab" }}>

            {confirmDeleteId === emp.id ? (
              /* Archive confirmation overlay — soft delete, history preserved */
              <div className="flex flex-col items-center gap-1.5 w-full py-0.5">
                <span className="text-white text-xs font-semibold text-center">להעביר את {emp.name} לארכיון?</span>
                <div className="flex gap-1.5 w-full">
                  <button onClick={() => { onDelete(emp.id); setConfirmDeleteId(null); }}
                    className="flex-1 py-1 text-xs font-bold bg-white/90 text-red-600 rounded-md hover:bg-white transition-colors">
                    לארכיון
                  </button>
                  <button onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 py-1 text-xs font-bold bg-white/20 text-white rounded-md hover:bg-white/30 transition-colors">
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span onDoubleClick={() => setEditingEmployee(emp)}
                  className="text-white font-medium text-sm drop-shadow flex-1 cursor-pointer select-none"
                  title="לחץ פעמיים לעריכה">
                  {emp.name}
                  {emp.employeeType === "PART_TIME" && <span className="text-[10px] opacity-70 mr-1">(ח&quot;מ)</span>}
                </span>
                <button onClick={() => setConfirmDeleteId(emp.id)}
                  className="text-white/70 hover:text-white text-xs leading-none flex-shrink-0">✕</button>
              </>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">לחץ פעמיים על עובד לעריכת פרטים · העברה לארכיון שומרת את ההיסטוריה וחוסמת התחברות</p>

      {/* Archived employees — restorable */}
      {archivedList.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ארכיון ({archivedList.length})</h3>
          <div className="flex flex-wrap gap-2">
            {archivedList.map(emp => (
              <div key={emp.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 select-none">
                <span className="w-2.5 h-2.5 rounded-full opacity-50" style={{ background: emp.color }} />
                <span className="text-xs text-gray-500 line-through">{emp.name}</span>
                <button onClick={() => handleRestore(emp.id)} disabled={restoringId === emp.id}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-md px-2 py-0.5 bg-white hover:bg-gray-100 transition-colors disabled:opacity-50">
                  {restoringId === emp.id ? "משחזר..." : "שחזור"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingEmployee && (
        <EmployeeEditModal
          emp={editingEmployee}
          onSave={handleSaveEdit}
          onClose={() => setEditingEmployee(null)}
        />
      )}
    </div>
  );
}
