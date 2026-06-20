'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, employeesApi } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEK_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_COLORS: Record<string, string> = {
  PRESENT:  'bg-green-100 text-green-700',
  ABSENT:   'bg-red-100 text-red-700',
  HALF_DAY: 'bg-yellow-100 text-yellow-700',
  ON_LEAVE: 'bg-blue-100 text-blue-700',
  HOLIDAY:  'bg-purple-100 text-purple-700',
  WEEKEND:  'bg-gray-100 text-gray-500',
};

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const qc = useQueryClient();

  const { data: report = [], isLoading } = useQuery({
    queryKey: ['attendance-report', month, year],
    queryFn: () => attendanceApi.monthlyReport(month, year) as any,
  });

  const seedMut = useMutation({
    mutationFn: () => attendanceApi.autoSeed(month, year),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance-report', month, year] }),
  });

  const arr = report as any[];
  const totals = arr.reduce((s: any, r: any) => ({
    present: s.present + r.present, absent: s.absent + r.absent, halfDay: s.halfDay + r.halfDay,
    lop: s.lop + r.lop, overtime: s.overtime + r.overtimeHours,
  }), { present: 0, absent: 0, halfDay: 0, lop: 0, overtime: 0 });

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24" />
        <button onClick={() => seedMut.mutate()} disabled={seedMut.isPending} className="ml-auto px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          {seedMut.isPending ? 'Seeding…' : 'Auto-seed Weekends/Holidays'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total Present', value: totals.present, color: 'text-green-600' },
          { label: 'Total Absent',  value: totals.absent,  color: 'text-red-600'   },
          { label: 'Half Days',     value: totals.halfDay, color: 'text-yellow-600' },
          { label: 'LOP Days',      value: +totals.lop.toFixed(1), color: 'text-orange-600' },
          { label: 'OT Hours',      value: +totals.overtime.toFixed(1), color: 'text-indigo-600' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Employee','Present','Absent','Half Day','On Leave','LOP Days','OT Hours','Late Mins'].map(h =>
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((r: any) => (
                <tr key={r.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-900">{r.firstName} {r.lastName}</p><p className="text-xs text-gray-400">{r.employeeCode}</p></td>
                  <td className="px-4 py-3 text-green-700 font-medium">{r.present}</td>
                  <td className="px-4 py-3 text-red-600">{r.absent}</td>
                  <td className="px-4 py-3 text-yellow-600">{r.halfDay}</td>
                  <td className="px-4 py-3 text-blue-600">{r.onLeave}</td>
                  <td className="px-4 py-3 font-semibold text-orange-600">{r.lop}</td>
                  <td className="px-4 py-3 text-indigo-600">{r.overtimeHours}</td>
                  <td className="px-4 py-3 text-gray-500">{r.lateMinutes}</td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No attendance data for this period</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Daily Entry Tab ───────────────────────────────────────────────────────────
function DailyEntryTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now.toISOString().split('T')[0]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [form, setForm] = useState<any>({ status: 'PRESENT', source: 'MANUAL' });

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });

  // load existing record when employee + date changes
  const selMonth = new Date(selectedDate).getMonth() + 1;
  const selYear  = new Date(selectedDate).getFullYear();
  const { data: empAttendance = [] } = useQuery({
    queryKey: ['emp-attendance', selectedEmp, selMonth, selYear],
    queryFn: () => selectedEmp ? attendanceApi.get(selectedEmp, selMonth, selYear) as any : Promise.resolve([]),
    enabled: !!selectedEmp,
  });

  const markMut = useMutation({
    mutationFn: () => attendanceApi.mark({ employeeId: selectedEmp, date: selectedDate, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp-attendance', selectedEmp] });
      qc.invalidateQueries({ queryKey: ['attendance-report'] });
    },
  });

  const arr = empAttendance as any[];
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const firstDay    = new Date(selYear, selMonth - 1, 1).getDay();

  const calDays: number[] = [];
  for (let i = 0; i < firstDay; i++) calDays.push(0);
  for (let i = 1; i <= daysInMonth; i++) calDays.push(i);

  function getRecord(day: number) {
    const d = new Date(selYear, selMonth - 1, day).toISOString().split('T')[0];
    return arr.find((r: any) => r.date?.startsWith(d));
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: mark form */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Mark Attendance</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select employee…</option>
              {(employees as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {['PRESENT','ABSENT','HALF_DAY','ON_LEAVE','HOLIDAY','WEEKEND'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          {form.status === 'PRESENT' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Check In</label>
                <input type="datetime-local" value={form.checkIn || ''} onChange={e => setForm({ ...form, checkIn: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Check Out</label>
                <input type="datetime-local" value={form.checkOut || ''} onChange={e => setForm({ ...form, checkOut: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="MANUAL">Manual</option>
              <option value="BIOMETRIC">Biometric</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button onClick={() => markMut.mutate()} disabled={markMut.isPending || !selectedEmp} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {markMut.isPending ? 'Saving…' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* Right: mini calendar */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{MONTHS[selMonth - 1]} {selYear} {selectedEmp ? '— selected employee' : ''}</h3>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {WEEK_DAYS.map(d => <div key={d} className="text-center font-semibold text-gray-400 py-1">{d}</div>)}
          {calDays.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const rec = getRecord(day);
            const isSelected = selectedDate === `${selYear}-${String(selMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            return (
              <div
                key={day}
                onClick={() => setSelectedDate(`${selYear}-${String(selMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`)}
                className={`h-9 flex flex-col items-center justify-center rounded-lg cursor-pointer border text-xs font-medium ${isSelected ? 'ring-2 ring-indigo-400' : ''} ${rec ? STATUS_COLORS[rec.status] || 'bg-gray-100' : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'}`}
              >
                <span>{day}</span>
                {rec?.overtimeMinutes > 0 && <span className="text-[8px] text-indigo-600">OT</span>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(STATUS_COLORS).map(([s, cls]) => (
            <span key={s} className={`px-2 py-0.5 text-[10px] rounded-full ${cls}`}>{s.replace('_', ' ')}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shifts & Roster Tab ───────────────────────────────────────────────────────
function ShiftsRosterTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [shiftModal, setShiftModal] = useState<any>(null);
  const [shiftForm, setShiftForm]   = useState<any>({ weeklyOffDays: [0,6], graceMinutes: 15, overtimeAfterMinutes: 0, isNightShift: false, isDefault: false });
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm, setAssignForm]   = useState<any>({ employeeIds: [] });

  const { data: shifts  = [] } = useQuery({ queryKey: ['shifts'], queryFn: () => attendanceApi.shifts() as any });
  const { data: roster  = [] } = useQuery({ queryKey: ['roster', month, year], queryFn: () => attendanceApi.roster(month, year) as any });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });

  const saveShiftMut = useMutation({
    mutationFn: () => shiftModal?.id ? attendanceApi.updateShift(shiftModal.id, shiftForm) : attendanceApi.createShift(shiftForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setShiftModal(null); },
  });
  const delShiftMut = useMutation({ mutationFn: (id: string) => attendanceApi.deleteShift(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }) });
  const assignMut   = useMutation({
    mutationFn: () => attendanceApi.assignShift(assignForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roster'] }); setAssignModal(false); setAssignForm({ employeeIds: [] }); },
  });
  const delRosterMut = useMutation({ mutationFn: (id: string) => attendanceApi.deleteRosterEntry(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }) });

  function openCreateShift() { setShiftModal('create'); setShiftForm({ weeklyOffDays: [0,6], graceMinutes: 15, overtimeAfterMinutes: 0, isNightShift: false, isDefault: false }); }
  function openEditShift(s: any) { setShiftModal(s); setShiftForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, weeklyOffDays: JSON.parse(s.weeklyOffDays || '[0,6]'), graceMinutes: s.graceMinutes, overtimeAfterMinutes: s.overtimeAfterMinutes, isNightShift: s.isNightShift, isDefault: s.isDefault }); }

  const shiftArr   = shifts as any[];
  const rosterArr  = roster as any[];
  const empArr     = employees as any[];

  return (
    <div className="space-y-6">
      {/* Shifts section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Shift Definitions</h3>
          <button onClick={openCreateShift} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ New Shift</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {shiftArr.map((s: any) => (
            <div key={s.id} className="border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{s.name}{s.isDefault && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">Default</span>}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.startTime} – {s.endTime}{s.isNightShift && ' 🌙'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditShift(s)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => delShiftMut.mutate(s.id)} className="text-xs text-red-500 hover:underline">Del</button>
                </div>
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {WEEK_DAYS.map((d, i) => {
                  const offDays = JSON.parse(s.weeklyOffDays || '[0,6]');
                  return <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded ${offDays.includes(i) ? 'bg-gray-200 text-gray-400 line-through' : 'bg-green-100 text-green-700'}`}>{d}</span>;
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Grace {s.graceMinutes}m · OT after {s.overtimeAfterMinutes}m</p>
            </div>
          ))}
          {shiftArr.length === 0 && <div className="col-span-3 text-center py-8 text-gray-400 text-sm">No shifts defined yet</div>}
        </div>
      </div>

      {/* Roster section */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Shift Roster</h3>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24" />
          <button onClick={() => setAssignModal(true)} className="ml-auto px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Assign Shift</button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Employee','Shift','From','To','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rosterArr.map((r: any) => (
                <tr key={r.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.employee?.firstName} {r.employee?.lastName}<div className="text-xs text-gray-400">{r.employee?.employeeCode}</div></td>
                  <td className="px-4 py-3 text-gray-700">{r.shift?.name}<div className="text-xs text-gray-400">{r.shift?.startTime}–{r.shift?.endTime}</div></td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.fromDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.toDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3"><button onClick={() => delRosterMut.mutate(r.id)} className="text-xs text-red-500 hover:underline">Remove</button></td>
                </tr>
              ))}
              {rosterArr.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No roster entries for this period</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift modal */}
      {shiftModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">{shiftModal === 'create' ? 'New Shift' : 'Edit Shift'}</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={shiftForm.name || ''} onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label><input type="time" value={shiftForm.startTime || ''} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">End Time</label><input type="time" value={shiftForm.endTime || ''} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Grace (mins)</label><input type="number" value={shiftForm.graceMinutes} onChange={e => setShiftForm({ ...shiftForm, graceMinutes: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">OT after (mins)</label><input type="number" value={shiftForm.overtimeAfterMinutes} onChange={e => setShiftForm({ ...shiftForm, overtimeAfterMinutes: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Weekly Off Days</label>
                <div className="flex gap-2">
                  {WEEK_DAYS.map((d, i) => (
                    <button key={d} type="button" onClick={() => {
                      const cur: number[] = shiftForm.weeklyOffDays || [];
                      setShiftForm({ ...shiftForm, weeklyOffDays: cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i] });
                    }} className={`px-2 py-1 text-xs rounded ${(shiftForm.weeklyOffDays || []).includes(i) ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                {[['isNightShift','Night Shift'],['isDefault','Default Shift']].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!shiftForm[k]} onChange={e => setShiftForm({ ...shiftForm, [k]: e.target.checked })} className="rounded" /> {l}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShiftModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => saveShiftMut.mutate()} disabled={saveShiftMut.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{saveShiftMut.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Assign shift modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Assign Shift to Employees</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Shift *</label>
                <select value={assignForm.shiftId || ''} onChange={e => setAssignForm({ ...assignForm, shiftId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select shift…</option>
                  {shiftArr.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">From Date</label><input type="date" value={assignForm.fromDate || ''} onChange={e => setAssignForm({ ...assignForm, fromDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">To Date</label><input type="date" value={assignForm.toDate || ''} onChange={e => setAssignForm({ ...assignForm, toDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Employees *</label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {empArr.map((e: any) => (
                    <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                      <input type="checkbox" checked={assignForm.employeeIds.includes(e.id)} onChange={ev => {
                        const ids: string[] = assignForm.employeeIds;
                        setAssignForm({ ...assignForm, employeeIds: ev.target.checked ? [...ids, e.id] : ids.filter((x: string) => x !== e.id) });
                      }} className="rounded" />
                      {e.firstName} {e.lastName} <span className="text-gray-400 text-xs">({e.employeeCode})</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{assignForm.employeeIds.length} selected</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setAssignModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => assignMut.mutate()} disabled={assignMut.isPending || !assignForm.employeeIds.length} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{assignMut.isPending ? 'Assigning…' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Regularization Tab ────────────────────────────────────────────────────────
function RegularizationTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [applyModal, setApplyModal] = useState(false);
  const [form, setForm] = useState<any>({ requestedStatus: 'PRESENT' });
  const [reviewModal, setReviewModal] = useState<any>(null);

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ['regularizations', status],
    queryFn: () => attendanceApi.regularizations(status ? { status } : undefined) as any,
  });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });

  const applyMut  = useMutation({ mutationFn: () => attendanceApi.applyRegularization(form), onSuccess: () => { qc.invalidateQueries({ queryKey: ['regularizations'] }); setApplyModal(false); setForm({ requestedStatus: 'PRESENT' }); } });
  const reviewMut = useMutation({ mutationFn: (d: any) => attendanceApi.reviewRegularization(d.id, { status: d.status, comment: d.comment }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['regularizations'] }); setReviewModal(null); } });

  const arr = regs as any[];
  const statusColor: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700' };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          {['','PENDING','APPROVED','REJECTED'].map(s => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${status === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{s || 'All'}</button>
          ))}
        </div>
        <button onClick={() => setApplyModal(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Apply Regularization</button>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Employee','Date','Requested Status','Check In','Check Out','Reason','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((r: any) => (
                <tr key={r.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.employee?.firstName} {r.employee?.lastName}<div className="text-xs text-gray-400">{r.employee?.employeeCode}</div></td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[r.requestedStatus] || 'bg-gray-100 text-gray-600'}`}>{r.requestedStatus}</span></td>
                  <td className="px-4 py-3 text-gray-600">{r.checkIn || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.checkOut || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColor[r.status] || ''}`}>{r.status}</span></td>
                  <td className="px-4 py-3">
                    {r.status === 'PENDING' && <button onClick={() => setReviewModal(r)} className="text-xs text-indigo-600 hover:underline">Review</button>}
                  </td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No regularization requests</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {applyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Apply for Regularization</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {(employees as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Date *</label><input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Mark as</label>
                <select value={form.requestedStatus} onChange={e => setForm({ ...form, requestedStatus: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="PRESENT">Present</option>
                  <option value="HALF_DAY">Half Day</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Check In (HH:mm)</label><input type="time" value={form.checkIn || ''} onChange={e => setForm({ ...form, checkIn: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Check Out (HH:mm)</label><input type="time" value={form.checkOut || ''} onChange={e => setForm({ ...form, checkOut: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label><textarea rows={2} value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setApplyModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => applyMut.mutate()} disabled={applyMut.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{applyMut.isPending ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Review Regularization</h3>
            <p className="text-sm text-gray-600 mb-1">{reviewModal.employee?.firstName} {reviewModal.employee?.lastName}</p>
            <p className="text-sm text-gray-500 mb-4">{new Date(reviewModal.date).toLocaleDateString('en-IN')} · {reviewModal.requestedStatus}</p>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Comment</label><textarea rows={2} onChange={e => setReviewModal({ ...reviewModal, comment: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setReviewModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => reviewMut.mutate({ id: reviewModal.id, status: 'REJECTED', comment: reviewModal.comment })} disabled={reviewMut.isPending} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">Reject</button>
              <button onClick={() => reviewMut.mutate({ id: reviewModal.id, status: 'APPROVED', comment: reviewModal.comment })} disabled={reviewMut.isPending} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Biometric Import Tab ──────────────────────────────────────────────────────
function BiometricImportTab() {
  const qc = useQueryClient();
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMut = useMutation({
    mutationFn: () => attendanceApi.biometricImport(csv),
    onSuccess: (data: any) => { setResult(data); qc.invalidateQueries({ queryKey: ['attendance-report'] }); },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsv(ev.target?.result as string);
    reader.readAsText(file);
  }

  const sampleCsv = `employeeCode,date,checkIn,checkOut\nEMP001,2026-06-01,09:05,18:30\nEMP002,2026-06-01,08:55,17:45\nEMP001,2026-06-02,09:20,18:15`;

  return (
    <div className="max-w-2xl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
        <p className="font-semibold mb-1">CSV Format</p>
        <p className="text-xs font-mono whitespace-pre text-blue-700">{sampleCsv}</p>
        <p className="text-xs mt-2 text-blue-600">Columns: <code>employeeCode, date (YYYY-MM-DD), checkIn (HH:mm), checkOut (HH:mm)</code>. Header row required.</p>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Upload CSV File</label>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Or paste CSV content</label>
        <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8} placeholder={sampleCsv} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
      </div>

      <button onClick={() => importMut.mutate()} disabled={importMut.isPending || !csv.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
        {importMut.isPending ? 'Importing…' : 'Import'}
      </button>

      {result && (
        <div className={`mt-5 p-4 rounded-xl border text-sm ${result.failed === 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
          <p className="font-semibold mb-1">Import Complete</p>
          <p>✓ {result.success} records imported · ✗ {result.failed} failed · Total {result.total}</p>
          {result.errors?.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">Errors:</p>
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Daily Entry', 'Shifts & Roster', 'Regularization', 'Biometric Import', 'Bulk Import'];

export default function AttendancePage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-500 mt-1">Manage attendance, shifts, overtime, and regularizations</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t}</button>
        ))}
      </div>

      <div>
        {tab === 0 && <OverviewTab />}
        {tab === 1 && <DailyEntryTab />}
        {tab === 2 && <ShiftsRosterTab />}
        {tab === 3 && <RegularizationTab />}
        {tab === 4 && <BiometricImportTab />}
        {tab === 5 && <BulkImportTab />}
      </div>
    </div>
  );
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      inQuotes = !inQuotes;
    } else if (text[i] === ',' && !inQuotes) {
      let val = text.substring(start, i).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1).trim();
      }
      result.push(val);
      start = i + 1;
    }
  }
  let val = text.substring(start).trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    val = val.substring(1, val.length - 1).trim();
  }
  result.push(val);
  return result;
}

function BulkImportTab() {
  const qc = useQueryClient();
  const [csv, setCsv] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list() as any,
  });

  const importMut = useMutation({
    mutationFn: (records: any[]) => attendanceApi.bulkImport(records),
    onSuccess: (data: any) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ['attendance-report'] });
    },
    onError: (e: any) => setError(e.message || 'Import failed'),
  });

  const handleDownloadTemplate = () => {
    const headers = ['employeeCode', 'date', 'status', 'checkIn', 'checkOut'];
    const sample = [
      'EMP0001', '2026-06-20', 'PRESENT', '09:00', '18:00\n' +
      'EMP0002', '2026-06-20', 'ABSENT', '', ''
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), sample.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "attendance_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsv(ev.target?.result as string);
    reader.readAsText(file);
  }

  const handleImport = () => {
    setError('');
    setResult(null);

    const lines = csv.trim().split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      setError('CSV is empty or missing data rows.');
      return;
    }

    const headers = parseCSVLine(lines[0]);
    const empArr = employees as any[];
    const codeToId = Object.fromEntries(empArr.map(e => [e.employeeCode, e.id]));

    const records: any[] = [];
    const localErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 3) continue; // Skip empty/incomplete lines

      const record: any = {};
      headers.forEach((header, index) => {
        record[header.trim()] = values[index]?.trim() || '';
      });

      const empId = codeToId[record.employeeCode];
      if (!empId) {
        localErrors.push(`Row ${i + 1}: Employee code "${record.employeeCode}" not found.`);
        continue;
      }

      if (!record.date || !record.status) {
        localErrors.push(`Row ${i + 1}: Date and status are required.`);
        continue;
      }

      // Format record
      const checkIn = record.checkIn ? `${record.date}T${record.checkIn}:00` : undefined;
      const checkOut = record.checkOut ? `${record.date}T${record.checkOut}:00` : undefined;

      records.push({
        employeeId: empId,
        date: record.date,
        status: record.status,
        checkIn,
        checkOut,
        source: 'MANUAL',
      });
    }

    if (records.length === 0) {
      setError('No valid records found to import.');
      if (localErrors.length > 0) {
        setResult({ success: 0, failed: localErrors.length, total: localErrors.length, errors: localErrors });
      }
      return;
    }

    importMut.mutate(records);
    if (localErrors.length > 0) {
      setResult((prev: any) => ({
        ...prev,
        errors: [...(prev?.errors || []), ...localErrors],
      }));
    }
  };

  const sampleCsv = `employeeCode,date,status,checkIn,checkOut\nEMP0001,2026-06-20,PRESENT,09:00,18:00\nEMP0002,2026-06-20,ABSENT,,\nEMP0001,2026-06-21,WEEKEND,,`;

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
        <div>
          <p className="font-semibold mb-1">Attendance Bulk Import CSV Format</p>
          <p className="text-xs font-mono whitespace-pre text-blue-700">{sampleCsv}</p>
          <p className="text-xs mt-2 text-blue-600">Columns: <code>employeeCode, date (YYYY-MM-DD), status (PRESENT/ABSENT/HALF_DAY/ON_LEAVE/HOLIDAY/WEEKEND), checkIn (HH:mm, optional), checkOut (HH:mm, optional)</code>.</p>
        </div>
        <button onClick={handleDownloadTemplate} className="btn-secondary text-xs flex-shrink-0 ml-4">
          📥 Template CSV
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Upload CSV File</label>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Or paste CSV content</label>
        <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8} placeholder={sampleCsv} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
      </div>

      <button onClick={handleImport} disabled={importMut.isPending || !csv.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
        {importMut.isPending ? 'Importing…' : 'Import'}
      </button>

      {result && (
        <div className={`mt-5 p-4 rounded-xl border text-sm ${result.failed === 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
          <p className="font-semibold mb-1">Import Complete</p>
          <p>✓ {result.success} records imported · ✗ {result.failed} failed · Total {result.total}</p>
          {result.errors?.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">Errors / Warnings:</p>
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {result.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
