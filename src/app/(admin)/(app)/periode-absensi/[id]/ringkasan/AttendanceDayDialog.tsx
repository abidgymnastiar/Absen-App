import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LuPencil } from 'react-icons/lu';
import { saveAttendance, saveAttendanceCorrection } from '../../actions';
import { dailyIndicatorEntries, type Attendance, type AttendanceStatus } from '../attendanceData';
import AttendanceFields from '../AttendanceFields';

export default function AttendanceDayDialog({
  periodId,
  employeeName,
  employeeId,
  date,
  type,
  correction,
  scheduledHoliday,
  records,
  onClose,
}: {
  periodId: string;
  employeeName: string;
  employeeId: string;
  date: string;
  type?: string;
  correction?: AttendanceStatus;
  scheduledHoliday: boolean;
  records: Attendance[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const editing = records.find(record => record.id === editingId);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

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
      <div className="space-y-1 border-b border-default-200 px-5 py-4">
        <h2 id="attendance-day-title" className="text-base font-semibold">
          {editing
            ? 'Edit Catatan Absensi'
            : type
              ? 'Catatan Absensi Duplikat'
              : 'Catatan Absensi Harian'}
        </h2>
        <p className="text-sm text-default-600">
          {employeeName || employeeId} · <time dateTime={date}>{date}</time>
          {type && <span className="capitalize"> · {type}</span>}
        </p>
      </div>
      {editing ? (
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
          <div className="overflow-x-auto">
            <table
              className="min-w-full divide-y divide-default-200 text-sm"
              aria-label="Catatan terkait"
            >
              <thead className="bg-default-100 text-default-700">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-4 py-2 text-start">
                    Tanggal
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
                  <th scope="col" className="px-4 py-2 text-end">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200">
                {records.map((record, index) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap px-4 py-2">{record.date || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2">{record.time || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2">{record.attendanceType || '—'}</td>
                    <td className="min-w-28 break-words px-4 py-2">{record.description || '—'}</td>
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
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3">
                      Belum ada catatan scan pada tanggal ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-default-200 px-5 py-3">
            {message && (
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
