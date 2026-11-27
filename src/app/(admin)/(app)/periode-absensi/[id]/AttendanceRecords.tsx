'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LuFileChartColumn, LuInfo, LuPencil, LuPlus, LuSearch, LuTrash2 } from 'react-icons/lu';
import { deleteAttendance, saveAttendance } from '../actions';
import AttendanceImport from '../AttendanceImport';
import type { Period } from '../periods';

import { fields, type Attendance } from './attendanceData';
import AttendanceFields from './AttendanceFields';

type Editor = { mode: 'add' } | { mode: 'view' | 'edit' | 'delete'; record: Attendance };

export default function AttendanceRecords({
  period,
  records,
}: {
  period: Period;
  records: Attendance[];
}) {
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement>(null);

  useEffect(() => {
    if (editor && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [editor]);

  const visible = records.filter(record =>
    fields.some(({ key }) => record[key].toLowerCase().includes(query.trim().toLowerCase()))
  );

  function openEditor(next: Editor, button: HTMLElement) {
    trigger.current = button;
    setError('');
    setEditor(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || editor.mode === 'view' || pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      if (editor.mode === 'delete') {
        await deleteAttendance(period.id, editor.record.id);
      } else {
        await saveAttendance(period.id, editor.mode === 'edit' ? editor.record.id : null, form);
      }
      dialog.current?.close();
    } catch {
      setError('Perubahan gagal disimpan. Periksa data dan coba lagi.');
    } finally {
      setPending(false);
    }
  }

  const title = {
    add: 'Tambah Absensi',
    view: 'Detail Absensi',
    edit: 'Edit Absensi',
    delete: 'Hapus Absensi',
  };

  return (
    <div className="card mb-5">
      <div className="card-header flex-wrap gap-3 py-3">
        <div className="relative">
          <LuSearch
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-default-500"
            aria-hidden="true"
          />
          <input
            className="form-input form-input-sm ps-9"
            type="search"
            aria-label="Cari data absensi"
            placeholder="Cari data absensi..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <AttendanceImport period={period} />
          <Link
            href={`/periode-absensi/${period.id}/ringkasan`}
            className="btn btn-sm border border-default-200 text-default-700"
          >
            <LuFileChartColumn className="size-4" aria-hidden="true" /> Ringkasan
          </Link>
          <button
            type="button"
            className="btn btn-sm bg-primary text-white"
            onClick={event => openEditor({ mode: 'add' }, event.currentTarget)}
          >
            <LuPlus className="size-4" aria-hidden="true" /> Tambah Absensi
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-default-200" aria-label="Data absensi periode">
          <thead className="bg-default-150">
            <tr className="whitespace-nowrap text-sm text-default-500">
              {fields.map(field => (
                <th key={field.key} scope="col" className="px-3.5 py-3 text-start">
                  {field.label}
                </th>
              ))}
              <th scope="col" className="px-3.5 py-3 text-end">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default-200">
            {visible.map(record => (
              <tr key={record.id} className="text-sm text-default-800">
                {fields.map(({ key }) => (
                  <td key={key} className="whitespace-nowrap px-3.5 py-2.5">
                    {record[key] || '—'}
                  </td>
                ))}
                <td className="px-3.5 py-2.5">
                  <div className="flex justify-end gap-2">
                    {(
                      [
                        [
                          'view',
                          'Detail',
                          LuInfo,
                          'bg-primary/20 text-primary hover:bg-primary hover:text-white',
                        ],
                        [
                          'edit',
                          'Edit',
                          LuPencil,
                          'bg-default-200 text-default-700 hover:bg-default-600 hover:text-white',
                        ],
                        [
                          'delete',
                          'Hapus',
                          LuTrash2,
                          'bg-danger/10 text-danger hover:bg-danger hover:text-white',
                        ],
                      ] as const
                    ).map(([mode, label, Icon, color]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`btn size-8 ${color}`}
                        title={label}
                        aria-label={`${label} absensi ${record.employeeName}`}
                        onClick={event => openEditor({ mode, record }, event.currentTarget)}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={fields.length + 1}
                  className="p-5 text-center text-sm text-default-500"
                >
                  Data absensi tidak ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card-footer">
        <p aria-live="polite" className="text-sm text-default-500">
          Menampilkan {visible.length} dari {records.length} data
        </p>
      </div>
      {!editor && error && (
        <p role="alert" className="px-5 pb-4 text-sm text-danger">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        onCancel={event => {
          if (pending) event.preventDefault();
        }}
        aria-labelledby="attendance-dialog-title"
        className="fixed inset-0 m-auto max-h-[90dvh] w-11/12 max-w-lg overflow-y-auto rounded bg-card text-default-800 backdrop:bg-black/50"
        onClose={() => {
          setEditor(null);
          trigger.current?.focus();
        }}
      >
        {editor && (
          <form onSubmit={submit}>
            <h2
              id="attendance-dialog-title"
              className="border-b border-default-200 px-5 py-4 text-base font-semibold"
            >
              {title[editor.mode]}
            </h2>
            <div className="space-y-3 p-5">
              {editor.mode === 'delete' ? (
                <p>
                  Hapus absensi {editor.record.employeeName} pada {editor.record.date}?
                </p>
              ) : editor.mode === 'view' ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {fields.map(({ key, label }) => (
                    <div key={key}>
                      <dt className="text-default-500">{label}</dt>
                      <dd className="break-words">{editor.record[key] || '—'}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <AttendanceFields
                  record={editor.mode === 'edit' ? editor.record : undefined}
                  required={editor.mode === 'add'}
                />
              )}
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
                {editor.mode === 'view' ? 'Tutup' : 'Batal'}
              </button>
              {editor.mode !== 'view' && (
                <button
                  type="submit"
                  disabled={pending}
                  className={`btn btn-sm text-white ${editor.mode === 'delete' ? 'bg-danger' : 'bg-primary'}`}
                >
                  {pending ? 'Memproses...' : editor.mode === 'delete' ? 'Hapus' : 'Simpan'}
                </button>
              )}
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
