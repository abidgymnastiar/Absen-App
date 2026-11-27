import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LuSearch } from 'react-icons/lu';
import { saveAttendanceHolidays } from '../../actions';
import type { Period } from '../../periods';

const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function AttendanceHolidayDialog({
  period,
  employees,
  holidayByEmployee,
  onClose,
  onSaved,
}: {
  period: Period;
  employees: [string, { name: string; position: string }][];
  holidayByEmployee: ReadonlyMap<string, number>;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [changes, setChanges] = useState(new Map<string, number | null>());
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const selected = [...changes].map(([employeeId, weekday]) => ({ employeeId, weekday }));
  const query = search.trim().toLowerCase();
  const visibleEmployees = employees.filter(([id, employee]) =>
    `${employee.name} ${id}`.toLowerCase().includes(query)
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !selected.length) return;
    setPending(true);
    setError('');
    try {
      await saveAttendanceHolidays(period.id, selected);
      onSaved(`Jadwal libur diperbarui untuk ${selected.length} karyawan.`);
      dialog.current?.close();
    } catch {
      setError('Jadwal gagal disimpan. Coba lagi.');
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="attendance-holiday-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-11/12 max-w-2xl overflow-y-auto rounded-lg bg-card text-default-800 backdrop:bg-black/50"
      onClose={onClose}
      onCancel={event => {
        if (pending) event.preventDefault();
      }}
    >
      <form onSubmit={submit}>
        <h2
          id="attendance-holiday-title"
          className="border-b border-default-200 px-5 py-4 font-semibold"
        >
          List Libur
        </h2>
        <div className="space-y-3 p-5">
          <p className="text-sm text-default-600">
            Hari yang dipilih berlaku setiap minggu dalam periode ini.
          </p>
          <div className="relative">
            <LuSearch
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-default-500"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Cari nama atau ID pegawai"
              placeholder="Cari nama atau ID pegawai"
              className="form-input form-input-sm ps-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') event.preventDefault();
              }}
            />
          </div>
          <div className="max-h-[55vh] divide-y divide-default-200 overflow-auto rounded border border-default-200">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_8rem] gap-2 bg-default-100 px-3 py-2 text-xs font-semibold text-default-700 sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-4">
              <span>Karyawan</span>
              <span>Hari libur</span>
            </div>
            {visibleEmployees.map(([id, employee]) => {
              const name = employee.name || id;
              const previous = holidayByEmployee.get(id) ?? null;
              const weekday = changes.has(id) ? changes.get(id) : previous;
              return (
                <label
                  key={id}
                  className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2 px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_10rem] sm:gap-4"
                >
                  <span className="min-w-0 break-words">
                    <span className="block font-medium">{name}</span>
                    {employee.position && (
                      <span className="block text-xs text-default-500">{employee.position}</span>
                    )}
                  </span>
                  <select
                    aria-label={`Hari libur untuk ${name}`}
                    className="form-input form-input-sm min-w-0 w-full"
                    value={weekday ?? ''}
                    disabled={pending}
                    onChange={event => {
                      const value = event.target.value;
                      const nextWeekday = value === '' ? null : Number(value);
                      setChanges(current => {
                        const next = new Map(current);
                        if (nextWeekday === previous) next.delete(id);
                        else next.set(id, nextWeekday);
                        return next;
                      });
                    }}
                  >
                    <option value="">Tanpa jadwal</option>
                    {[1, 2, 3, 4, 5, 6, 0].map(day => (
                      <option key={day} value={day}>
                        {weekdays[day]}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
            {visibleEmployees.length === 0 && (
              <p role="status" className="px-3 py-4 text-sm text-default-600">
                Pegawai tidak ditemukan.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-default-200 px-5 py-3">
          <button
            type="button"
            className="btn btn-sm border border-default-200"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn btn-sm bg-primary text-white"
            disabled={pending || !selected.length}
          >
            {pending
              ? 'Menyimpan…'
              : selected.length
                ? `Simpan libur (${selected.length})`
                : 'Simpan libur'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
