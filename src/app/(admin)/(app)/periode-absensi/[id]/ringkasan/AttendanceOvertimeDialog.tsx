import { useEffect, useRef, useState, type FormEvent } from 'react';
import { saveAttendanceOvertime } from '../../actions';
import { overtimeLabels, type AttendanceOvertime, type OvertimeType } from '../../overtime';
import type { Period } from '../../periods';

function OvertimeEmployeeFields({
  id,
  name,
  entries,
}: {
  id: string;
  name: string;
  entries: AttendanceOvertime[];
}) {
  const [type, setType] = useState<OvertimeType>(entries[0]?.type ?? 'L');
  const entry = entries.find(entry => entry.type === type);

  return (
    <fieldset className="grid items-end gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-3">
      <legend className="sr-only">{name}</legend>
      <div className="min-w-0 self-center break-words font-medium">{name}</div>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <label className="min-w-0 space-y-1">
          <span>Jenis</span>
          <select
            name={`type-${id}`}
            className="form-input form-input-sm min-w-0"
            value={type}
            onChange={event => setType(event.target.value as OvertimeType)}
          >
            <option value="L">{overtimeLabels.L}</option>
            <option value="LB">{overtimeLabels.LB}</option>
          </select>
        </label>
        <label className="min-w-0 space-y-1">
          <span>Jam</span>
          <input
            key={type}
            name={`hours-${id}`}
            type="number"
            inputMode="numeric"
            className="form-input form-input-sm min-w-0 px-2"
            min={0}
            max={24}
            defaultValue={entry ? Math.floor(entry.minutes / 60) : ''}
          />
        </label>
        <label className="min-w-0 space-y-1">
          <span>Menit</span>
          <input
            key={type}
            name={`minutes-${id}`}
            type="number"
            inputMode="numeric"
            className="form-input form-input-sm min-w-0 px-2"
            min={0}
            max={59}
            defaultValue={entry ? entry.minutes % 60 : ''}
          />
        </label>
      </div>
      {entry && (
        <p className="text-xs text-default-600 sm:col-span-2">
          Catatan tersimpan untuk jenis ini akan diperbarui.
        </p>
      )}
    </fieldset>
  );
}

export default function AttendanceOvertimeDialog({
  period,
  initialDate,
  employees,
  entries,
  onClose,
  onSaved,
}: {
  period: Period;
  initialDate: string;
  employees: [string, { name: string }][];
  entries: AttendanceOvertime[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(new Set<string>());
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(initialDate);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const query = search.trim().toLowerCase();
  const visibleEmployees = employees.filter(([id, employee]) =>
    `${employee.name} ${id}`.toLowerCase().includes(query)
  );
  const selectedEmployees = employees.filter(([id]) => selected.has(id));
  const entriesByEmployee = new Map<string, AttendanceOvertime[]>();
  for (const entry of entries) {
    if (entry.date !== date) continue;
    const employeeEntries = entriesByEmployee.get(entry.employeeId) ?? [];
    employeeEntries.push(entry);
    entriesByEmployee.set(entry.employeeId, employeeEntries);
  }

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !selected.size) return;
    const form = new FormData(event.currentTarget);
    const overtimeEntries: Omit<AttendanceOvertime, 'date'>[] = [];
    for (const [employeeId, employee] of selectedEmployees) {
      const type = form.get(`type-${employeeId}`);
      const minutes =
        Number(form.get(`hours-${employeeId}`)) * 60 + Number(form.get(`minutes-${employeeId}`));
      if (
        (type !== 'L' && type !== 'LB') ||
        !Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 1440
      ) {
        setError(`Isi durasi antara 1 menit dan 24 jam untuk ${employee.name || employeeId}.`);
        return;
      }
      overtimeEntries.push({ employeeId, type, minutes });
    }

    setPending(true);
    setError('');
    try {
      await saveAttendanceOvertime(period.id, { date, entries: overtimeEntries });
      onSaved(`Data lembur tersimpan untuk ${selected.size} pegawai.`);
      dialog.current?.close();
    } catch {
      setError('Data lembur gagal disimpan. Coba lagi.');
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="attendance-overtime-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-11/12 max-w-5xl overflow-y-auto rounded-lg bg-card text-default-800 backdrop:bg-black/50"
      onClose={onClose}
      onCancel={event => {
        if (pending) event.preventDefault();
      }}
    >
      <form onSubmit={submit}>
        <h2
          id="attendance-overtime-title"
          className="sticky top-0 z-10 border-b border-default-200 bg-card px-5 py-4 font-semibold"
        >
          Input Lembur
        </h2>
        <fieldset
          disabled={pending}
          className="grid min-w-0 gap-5 p-5 text-sm lg:grid-cols-[16rem_minmax(0,1fr)]"
        >
          <fieldset className="min-w-0 space-y-2">
            <legend className="font-medium">Pilih pegawai ({selected.size} dipilih)</legend>
            <input
              type="search"
              className="form-input"
              aria-label="Cari nama atau ID pegawai"
              placeholder="Cari nama atau ID pegawai"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <div className="max-h-44 divide-y divide-default-200 overflow-y-auto rounded border border-default-200 lg:max-h-[45dvh]">
              {visibleEmployees.map(([id, employee]) => (
                <label key={id} className="flex cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    className="form-checkbox shrink-0"
                    checked={selected.has(id)}
                    onChange={event => {
                      const checked = event.target.checked;
                      setSelected(previous => {
                        const next = new Set(previous);
                        if (checked) next.add(id);
                        else next.delete(id);
                        return next;
                      });
                    }}
                  />
                  <span className="min-w-0 break-words">
                    <span className="block font-medium">{employee.name || id}</span>
                    {employee.name && <span className="text-xs text-default-500">{id}</span>}
                  </span>
                </label>
              ))}
              {visibleEmployees.length === 0 && (
                <p className="px-3 py-2 text-default-600">Pegawai tidak ditemukan.</p>
              )}
            </div>
          </fieldset>
          <div className="min-w-0 space-y-3 lg:border-s lg:border-default-200 lg:ps-5">
            <label className="block max-w-48 space-y-1">
              <span className="font-medium">Tanggal lembur</span>
              <input
                type="date"
                className="form-input"
                required
                value={date}
                min={period.startDate}
                max={period.endDate}
                onChange={event => setDate(event.target.value)}
              />
            </label>

            <h3 className="font-medium">Rincian per pegawai</h3>
            {selectedEmployees.length > 0 ? (
              <div className="divide-y divide-default-200 rounded border border-default-200 lg:max-h-[45dvh] lg:overflow-y-auto">
                {selectedEmployees.map(([id, employee]) => (
                  <OvertimeEmployeeFields
                    key={JSON.stringify([date, id])}
                    id={id}
                    name={employee.name || id}
                    entries={entriesByEmployee.get(id) ?? []}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded border border-dashed border-default-200 p-4 text-default-600">
                Pilih pegawai untuk mengisi jenis dan durasi lembur.
              </p>
            )}
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
          </div>
        </fieldset>
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-default-200 bg-card px-5 py-3">
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
            disabled={pending || !selected.size || !date}
          >
            {pending ? 'Menyimpan…' : 'Simpan lembur'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
