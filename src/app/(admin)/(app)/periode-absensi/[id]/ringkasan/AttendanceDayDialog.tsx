import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LuArrowLeft, LuCalendarDays, LuList, LuPencil, LuPlus } from 'react-icons/lu';
import { saveAttendance, saveAttendanceCorrection } from '../../actions';
import {
  attendanceShifts,
  dailyIndicatorEntries,
  offsetAttendanceDate,
  type Attendance,
  type AttendanceDayScans,
  type AttendanceStatus,
} from '../attendanceData';
import AttendanceFields from '../AttendanceFields';

const formatWorkDate = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

export default function AttendanceDayDialog({
  periodId,
  employeeName,
  employeeId,
  date,
  type,
  correction,
  scheduledHoliday,
  scans,
  employeeRecords,
  workDates,
  onClose,
}: {
  periodId: string;
  employeeName: string;
  employeeId: string;
  date: string;
  type?: string;
  correction?: AttendanceStatus;
  scheduledHoliday: boolean;
  scans?: AttendanceDayScans;
  employeeRecords: Attendance[];
  workDates: ReadonlyMap<string, string>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const historyTable = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const workDateRecords = employeeRecords.filter(
    record => (workDates.get(record.id) ?? record.date) === date
  );
  const records = type
    ? workDateRecords.filter(record => record.attendanceType.trim().toLowerCase() === type)
    : workDateRecords;
  const displayedRecords = showHistory ? employeeRecords : records;
  const editing = records.find(record => record.id === editingId);

  const shift = scans?.shift;
  const missingScan =
    !type && scans && scans.masuk !== scans.keluar && records.length
      ? scans.masuk
        ? 'Pulang'
        : 'Masuk'
      : undefined;
  const addingScan = adding && missingScan;
  const nextDate = offsetAttendanceDate(date, 1);
  const previousDate = offsetAttendanceDate(date, -1);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    const region = historyTable.current;
    const row = region?.querySelector('tr[data-selected-date]');
    if (!showHistory || !region || !row) return;

    const headerHeight = region.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    region.scrollTop +=
      row.getBoundingClientRect().top - region.getBoundingClientRect().top - headerHeight;
  }, [showHistory, date]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || pending) return;

    const form = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      await saveAttendance(periodId, editing.id, form);
      setEditingId(null);
      setMessage('Perubahan absensi tersimpan.');
    } catch {
      setError('Perubahan gagal disimpan. Periksa data dan coba lagi.');
    } finally {
      setPending(false);
    }
  }

  async function addMissingScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const source = records[0];
    if (pending || !missingScan || !source) return;

    const form = new FormData(event.currentTarget);
    form.set('employeeId', employeeId);
    form.set('employeeName', employeeName || source.employeeName);
    form.set('site', source.site);
    form.set('department', source.department);
    form.set('position', source.position);
    form.set('attendanceType', missingScan);
    form.set('description', 'Scan dilengkapi manual');

    setPending(true);
    setError('');
    try {
      await saveAttendance(periodId, null, form);
      setAdding(false);
      setMessage(
        `Scan ${missingScan.toLowerCase()} tersimpan. Status dihitung ulang dari pasangan scan.`
      );
    } catch {
      setError('Scan gagal disimpan. Periksa tanggal dan jamnya.');
    } finally {
      setPending(false);
    }
  }

  async function changeStatus(status: AttendanceStatus | null) {
    if (pending) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await saveAttendanceCorrection(periodId, employeeId, date, status);
      setMessage('Status harian tersimpan.');
    } catch {
      setError('Status gagal disimpan. Coba lagi.');
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="fixed inset-0 m-auto max-h-[90dvh] w-11/12 max-w-2xl overflow-y-auto rounded-lg bg-card text-default-800 backdrop:bg-black/50"
      aria-labelledby="attendance-day-title"
      onClose={onClose}
      onCancel={event => {
        if (pending) event.preventDefault();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-default-200 px-5 py-4">
        <div className="min-w-0 space-y-1">
          <h2 id="attendance-day-title" className="text-base font-semibold">
            {showHistory
              ? 'Riwayat Absensi Pegawai'
              : addingScan
                ? `Tambah Scan ${missingScan}`
                : editing
                  ? 'Edit Catatan Absensi'
                  : type
                    ? 'Catatan Absensi Duplikat'
                    : 'Catatan Absensi Harian'}
          </h2>
          <p className="text-sm text-default-600">
            {employeeName || employeeId}
            {showHistory ? (
              <span> · {employeeRecords.length} catatan dalam periode ini</span>
            ) : (
              <>
                {' · '}
                <time dateTime={date}>{date}</time>
                {shift && (
                  <span>
                    {' '}
                    · Shift {shift} ({attendanceShifts[shift].label})
                  </span>
                )}
                {type && <span className="capitalize"> · {type}</span>}
              </>
            )}
          </p>
        </div>
        {!addingScan && !editing && (
          <button
            type="button"
            className="btn btn-sm border border-default-200"
            disabled={pending}
            onClick={() => setShowHistory(value => !value)}
          >
            {showHistory ? (
              <>
                <LuArrowLeft className="size-4" aria-hidden="true" /> Kembali ke harian
              </>
            ) : (
              <>
                <LuList className="size-4" aria-hidden="true" /> Riwayat Absensi
              </>
            )}
          </button>
        )}
      </div>
      {addingScan ? (
        <form onSubmit={addMissingScan}>
          <div className="space-y-3 p-5">
            <p className="text-sm text-default-600">
              {missingScan === 'Pulang'
                ? 'Isi tanggal dan jam pulang sebenarnya. Jika pulang setelah tengah malam, pilih tanggal berikutnya.'
                : 'Isi tanggal dan jam masuk sebenarnya. Jika ini pasangan scan pulang shift malam, pilih tanggal sebelumnya.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Tanggal scan</span>
                <input
                  className="form-input"
                  type="date"
                  name="date"
                  min={missingScan === 'Masuk' ? previousDate : date}
                  max={missingScan === 'Pulang' ? nextDate : date}
                  defaultValue={date}
                  required
                  disabled={pending}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>Jam scan</span>
                <input
                  className="form-input"
                  type="time"
                  name="time"
                  step={1}
                  required
                  disabled={pending}
                />
              </label>
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
              onClick={() => {
                setError('');
                setAdding(false);
              }}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-sm bg-primary text-white" disabled={pending}>
              {pending ? 'Menyimpan…' : 'Simpan scan'}
            </button>
          </div>
        </form>
      ) : editing ? (
        <form onSubmit={submit}>
          <div className="space-y-3 p-5">
            <AttendanceFields key={editing.id} record={editing} />
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
              onClick={() => setEditingId(null)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-sm bg-primary text-white" disabled={pending}>
              {pending ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      ) : (
        <>
          {!showHistory && (
            <>
              <div className="space-y-2 border-b border-default-200 px-5 py-3">
                <p className="text-sm font-medium">Status harian</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Status harian">
                  {dailyIndicatorEntries.map(([code, { label, color }]) => (
                    <button
                      key={code}
                      type="button"
                      className={`btn btn-sm ${color} ${correction === code ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                      aria-pressed={correction === code}
                      disabled={pending || !employeeId}
                      onClick={() => changeStatus(code)}
                    >
                      {code} · {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm border border-default-200"
                    aria-pressed={correction === undefined}
                    disabled={pending || correction === undefined}
                    onClick={() => changeStatus(null)}
                  >
                    {scheduledHoliday ? 'Otomatis · Libur terjadwal' : 'Otomatis dari scan'}
                  </button>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </div>
              {missingScan && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-default-200 bg-warning/10 px-5 py-3">
                  <p className="text-sm text-default-700">
                    Scan {missingScan.toLowerCase()} belum ditemukan. Lengkapi jika jam sebenarnya
                    diketahui.
                  </p>
                  <button
                    type="button"
                    className="btn btn-sm border border-default-200 bg-card"
                    disabled={pending}
                    onClick={() => {
                      setError('');
                      setMessage('');
                      setAdding(true);
                    }}
                  >
                    <LuPlus className="size-4" aria-hidden="true" />
                    Tambah scan {missingScan.toLowerCase()}
                  </button>
                </div>
              )}
            </>
          )}
          {showHistory && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 bg-primary/5 px-5 py-3 text-sm">
              <div className="flex items-center gap-2">
                <LuCalendarDays className="size-4 text-primary" aria-hidden="true" />
                <span>
                  Tanggal kerja dipilih{' '}
                  <time dateTime={date} className="font-semibold text-heading">
                    {formatWorkDate.format(new Date(date))}
                  </time>
                </span>
              </div>
              <span className="text-default-600">
                {workDateRecords.length
                  ? `${workDateRecords.length} catatan scan`
                  : 'Belum ada scan untuk tanggal ini'}
              </span>
            </div>
          )}
          <div
            key={showHistory ? 'history' : 'day'}
            ref={showHistory ? historyTable : undefined}
            className={showHistory ? 'max-h-[60dvh] overflow-auto' : 'overflow-x-auto'}
            role={showHistory ? 'region' : undefined}
            aria-label={showHistory ? 'Daftar scan pegawai' : undefined}
            tabIndex={showHistory ? 0 : undefined}
          >
            <table
              className="min-w-full divide-y divide-default-200 text-sm"
              aria-label={showHistory ? 'Riwayat scan pada periode ini' : 'Catatan terkait'}
            >
              <thead
                className={`bg-default-100 text-default-700 ${showHistory ? 'sticky top-0' : ''}`}
              >
                <tr>
                  <th scope="col" className="whitespace-nowrap px-4 py-2 text-start">
                    {showHistory ? 'Tanggal Scan' : 'Tanggal'}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-2 text-start">
                    Jam Scan
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-2 text-start">
                    Jenis Absen
                  </th>
                  <th scope="col" className="px-4 py-2 text-start">
                    Keterangan
                  </th>
                  {showHistory ? (
                    <th scope="col" className="whitespace-nowrap px-4 py-2 text-start">
                      Tanggal Kerja
                    </th>
                  ) : (
                    <th scope="col" className="px-4 py-2 text-end">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200">
                {displayedRecords.map((record, index) => {
                  const workDate = workDates.get(record.id) ?? record.date;
                  const selectedDate = showHistory && date === workDate;
                  return (
                    <tr
                      key={record.id}
                      data-selected-date={selectedDate ? date : undefined}
                      className={selectedDate ? 'bg-primary/10' : undefined}
                    >
                      <td className="whitespace-nowrap px-4 py-2">{record.date || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2">{record.time || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {record.attendanceType || '—'}
                      </td>
                      <td className="min-w-28 break-words px-4 py-2">
                        {record.description || '—'}
                      </td>
                      {showHistory ? (
                        <td
                          className={`whitespace-nowrap px-4 py-2 ${selectedDate ? 'font-semibold text-primary' : ''}`}
                        >
                          {workDate || '—'}
                        </td>
                      ) : (
                        <td className="px-4 py-2 text-end">
                          <button
                            type="button"
                            className="btn btn-sm border border-default-200"
                            aria-label={`Edit catatan ${index + 1}`}
                            disabled={pending}
                            onClick={() => {
                              setError('');
                              setMessage('');
                              setEditingId(record.id);
                            }}
                          >
                            <LuPencil className="size-4" aria-hidden="true" /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {displayedRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3">
                      {showHistory
                        ? 'Belum ada catatan scan pegawai pada periode ini.'
                        : 'Belum ada catatan scan pada tanggal ini.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-default-200 px-5 py-3">
            {!showHistory && message && (
              <p role="status" className="me-auto text-sm text-success">
                {message}
              </p>
            )}
            <button
              type="button"
              className="btn btn-sm border border-default-200"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Tutup
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
