'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import {
  LuCalendarCheck,
  LuCalendarDays,
  LuCalendarClock,
  LuFileChartColumn,
  LuInfo,
  LuPencil,
  LuSearch,
  LuTrash2,
} from 'react-icons/lu';

import AttendanceImport from './AttendanceImport';
import { deletePeriod, renamePeriod } from './actions';
import type { Period } from './periods';

const statusColors = {
  Aktif: 'bg-success/15 text-success',
  Dijadwalkan: 'bg-warning/15 text-warning',
  Ditutup: 'bg-default-200 text-default-600',
  Kosong: 'bg-default-200 text-default-600',
};

const summaries = [
  {
    label: 'Total Periode',
    status: null,
    icon: LuFileChartColumn,
    color: 'text-info bg-info/10',
  },
  {
    label: 'Aktif',
    status: 'Aktif',
    icon: LuCalendarDays,
    color: 'text-success bg-success/10',
  },
  {
    label: 'Dijadwalkan',
    status: 'Dijadwalkan',
    icon: LuCalendarClock,
    color: 'text-warning bg-warning/10',
  },
  {
    label: 'Ditutup',
    status: 'Ditutup',
    icon: LuCalendarCheck,
    color: 'text-secondary bg-secondary/10',
  },
];

const columns = ['#', 'Nama Periode', 'Tanggal Mulai', 'Tanggal Selesai', 'Status'];

export default function AttendancePeriods({ periods }: { periods: Period[] }) {
  const [search, setSearch] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ period: Period; mode: 'edit' | 'delete' } | null>(
    null
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function openPeriodAction(period: Period, mode: 'edit' | 'delete') {
    setError('');
    setSelected({ period, mode });
    if (nameInput.current) nameInput.current.value = period.name;
    dialog.current?.showModal();
  }

  async function submitPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      if (selected.mode === 'edit') {
        const name = String(data.get('name') ?? '').trim();
        if (!name) {
          setError('Masukkan nama periode.');
          return;
        }
        await renamePeriod(selected.period.id, name);
      } else {
        await deletePeriod(selected.period.id);
      }
      dialog.current?.close();
    } catch {
      setError(
        selected.mode === 'delete'
          ? 'Periode gagal dihapus. Coba lagi.'
          : 'Perubahan periode gagal disimpan. Coba lagi.'
      );
    } finally {
      setPending(false);
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = periods.filter(period =>
    [period.name, period.start, period.end, period.status].some(value =>
      value.toLowerCase().includes(query)
    )
  );
  return (
    <>
      <div className="grid grid-cols-1 gap-5 mb-5 md:grid-cols-2 lg:grid-cols-4">
        {summaries.map(({ label, status, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <div className={`btn ${color} size-12 flex items-center justify-center`}>
                  <Icon size={24} aria-hidden="true" />
                </div>
                <div>
                  <p className="mb-1 text-base text-heading font-semibold">
                    {status
                      ? periods.filter(period => period.status === status).length
                      : periods.length}
                  </p>
                  <p className="text-default-500">{label}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="card mb-5">
        <div className="card-header flex-wrap gap-3">
          <div className="relative">
            <LuSearch
              aria-hidden="true"
              className="absolute top-1/2 start-3 size-4 -translate-y-1/2 text-default-500 pointer-events-none"
            />
            <input
              type="search"
              className="ps-11 form-input form-input-sm"
              placeholder="Cari periode..."
              aria-label="Cari periode absensi"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <AttendanceImport />
        </div>
        <div className="overflow-x-auto">
          <table
            className="min-w-full divide-y divide-default-200"
            aria-label="Daftar periode absensi"
          >
            <thead className="bg-default-150">
              <tr className="text-sm whitespace-nowrap text-default-500">
                {columns.map(column => (
                  <th key={column} scope="col" className="px-3.5 py-3 text-start">
                    {column}
                  </th>
                ))}
                <th scope="col" className="px-3.5 py-3 text-end">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-200">
              {filtered.map(period => (
                <tr key={period.id} className="text-sm text-default-800 whitespace-nowrap">
                  <td className="px-3.5 py-2.5">{String(period.id).padStart(2, '0')}</td>
                  <td className="px-3.5 py-2.5">{period.name}</td>
                  <td className="px-3.5 py-2.5">{period.start}</td>
                  <td className="px-3.5 py-2.5">{period.end}</td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className={`inline-flex rounded px-2.5 py-0.5 text-xs font-medium ${statusColors[period.status]}`}
                    >
                      {period.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-end">
                    <Link
                      href={`/periode-absensi/${period.id}`}
                      className="btn size-8 bg-primary/20 text-primary hover:bg-primary hover:text-white"
                      aria-label={`Detail periode ${period.name}`}
                    >
                      <LuInfo className="size-4" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="btn ms-2 size-8 bg-default-200 text-default-700"
                      aria-label={`Edit periode ${period.name}`}
                      onClick={() => openPeriodAction(period, 'edit')}
                    >
                      <LuPencil className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn ms-2 size-8 bg-danger/10 text-danger"
                      aria-label={`Hapus periode ${period.name}`}
                      onClick={() => openPeriodAction(period, 'delete')}
                    >
                      <LuTrash2 className="size-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-3.5 py-5 text-center text-sm text-default-500"
                  >
                    {periods.length
                      ? 'Periode tidak ditemukan.'
                      : 'Belum ada periode. Pilih Import untuk menambahkan data absensi.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer">
          <p className="text-default-500 text-sm" aria-live="polite">
            Menampilkan <b>{filtered.length}</b> dari <b>{periods.length}</b> periode
          </p>
        </div>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="period-action-title"
        className="fixed inset-0 m-auto w-11/12 max-w-md rounded-xl border border-default-200 bg-card p-5 text-default-900 backdrop:bg-black/50"
        onCancel={event => {
          if (pending) event.preventDefault();
        }}
      >
        <form onSubmit={submitPeriod} className="space-y-4">
          <h2 id="period-action-title" className="text-lg font-semibold">
            {selected?.mode === 'delete' ? 'Hapus Periode' : 'Edit Periode'}
          </h2>
          <label className="space-y-2" hidden={selected?.mode === 'delete'}>
            <span>Nama Periode / Kelompok</span>
            <input
              ref={nameInput}
              name="name"
              maxLength={150}
              required={selected?.mode === 'edit'}
              disabled={selected?.mode === 'delete'}
              className="form-input w-full"
            />
          </label>
          {selected?.mode === 'delete' && (
            <p>
              Hapus periode <strong>{selected.period.name}</strong> beserta semua catatan scan,
              koreksi absensi, dan jadwal liburnya?
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
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
              className={`btn btn-sm text-white ${selected?.mode === 'delete' ? 'bg-danger' : 'bg-primary'}`}
              disabled={pending}
            >
              {pending ? 'Memproses...' : selected?.mode === 'delete' ? 'Hapus' : 'Simpan'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
