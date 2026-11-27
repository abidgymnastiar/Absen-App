'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { LuSheet, LuUpload, LuX } from 'react-icons/lu';
import type { Period } from './periods';

type AttendanceImportProps =
  | { periods: Period[]; period?: never }
  | { period: Period; periods?: never };

export default function AttendanceImport({ periods = [], period }: AttendanceImportProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'new' | 'append'>('new');
  const isAppend = Boolean(period) || mode === 'append';
  const [summary, setSummary] = useState<{
    id: string;
    count: number;
    skipped: number;
    newEmployeeCount: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  async function importExcel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const file = fileInput.current?.files?.[0];
    if (!file || !/\.(xlsx|xls)$/i.test(file.name)) {
      setError('Pilih file Excel dengan format .xlsx atau .xls.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch('/periode-absensi/import', { method: 'POST', body: data });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'File Excel gagal diimpor.');
        return;
      }
      dialog.current?.close();
      if (isAppend) setSummary(result);
      else router.push(`/periode-absensi/${result.id}`);
      router.refresh();
    } catch {
      setError('File Excel gagal diimpor. Coba lagi.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-sm bg-primary text-white"
        aria-haspopup="dialog"
        onClick={() => {
          setSummary(null);
          dialog.current?.showModal();
        }}
      >
        <LuUpload className="me-1 size-3.5" aria-hidden="true" />
        {period ? 'Impor Scan ke Periode Ini' : 'Impor Scan Absensi'}
      </button>
      {summary && (
        <p role="status" className="order-last basis-full text-sm text-success">
          {summary.newEmployeeCount} pegawai baru · {summary.count} scan ditambahkan ·{' '}
          {summary.skipped} scan sama dilewati.{' '}
          <Link href={`/periode-absensi/${summary.id}/ringkasan`} className="font-medium underline">
            Lihat ringkasan
          </Link>
        </p>
      )}
      <dialog
        ref={dialog}
        onCancel={event => {
          if (pending) event.preventDefault();
        }}
        aria-labelledby="attendance-import-title"
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-default-200 bg-card p-5 text-default-900 shadow-lg backdrop:bg-black/50 sm:p-6"
        onClose={() => {
          form.current?.reset();
          setMode('new');
          setFileName('');
          setError('');
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id="attendance-import-title" className="text-xl font-semibold sm:text-2xl">
            Impor Scan Absensi dari Excel
          </h2>
          <button
            type="button"
            className="btn size-8 text-default-500 hover:bg-default-100"
            aria-label="Tutup modal impor"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            <LuX className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form ref={form} onSubmit={importExcel} className="space-y-5">
          {period ? (
            <div className="rounded-lg border border-default-200 px-4 py-3 text-sm">
              <input type="hidden" name="mode" value="append" />
              <input type="hidden" name="periodId" value={period.id} />
              <p>
                Periode tujuan <strong>{period.name}</strong>
              </p>
              <p className="mt-1 text-default-600">
                Unggah file scan susulan. Tanggal yang lebih baru akan memperpanjang rentang
                periode.
              </p>
            </div>
          ) : (
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2" disabled={pending}>
              <legend className="mb-2 font-semibold">Tujuan impor</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="form-radio"
                  name="mode"
                  value="new"
                  checked={mode === 'new'}
                  onChange={() => setMode('new')}
                />
                Buat periode baru
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="form-radio"
                  name="mode"
                  value="append"
                  checked={mode === 'append'}
                  disabled={!periods.length}
                  onChange={() => setMode('append')}
                />
                Tambahkan ke periode yang ada
              </label>
            </fieldset>
          )}
          {!period &&
            (mode === 'append' ? (
              <label className="block space-y-2">
                <span className="block font-semibold">Periode tujuan</span>
                <select
                  name="periodId"
                  className="form-input"
                  defaultValue=""
                  required
                  disabled={pending}
                >
                  <option value="">Pilih periode</option>
                  {periods.map(period => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                      {period.startDate ? ` · ${period.start} – ${period.end}` : ''}
                    </option>
                  ))}
                </select>
                <span className="block text-sm text-default-500">
                  Scan dan pegawai dari file ini ditambahkan ke periode yang dipilih.
                </span>
              </label>
            ) : (
              <div>
                <label htmlFor="attendance-period-name" className="mb-2 block font-semibold">
                  Nama Periode / Kelompok
                </label>
                <input
                  id="attendance-period-name"
                  name="periodName"
                  type="text"
                  className="form-input w-full rounded-full px-4"
                  placeholder="Contoh: Gaji November 2026"
                  aria-describedby="period-name-help"
                  maxLength={150}
                  required
                />
                <p id="period-name-help" className="mt-2 text-sm text-default-500">
                  File scan akan disimpan sebagai periode baru.
                </p>
              </div>
            ))}

          <fieldset>
            <legend className="mb-2 font-semibold">File Excel Scan Absensi</legend>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-default-400 px-4 py-6 text-center">
              <LuSheet className="size-7 text-success" aria-hidden="true" />
              <p className="max-w-full break-all font-semibold" aria-live="polite">
                {fileName || 'Pilih file Excel'}
              </p>
              <p className="text-sm text-default-500">
                Format .xlsx atau .xls. Sheet pertama harus memuat ID Pegawai, Nama, dan Tanggal.
              </p>
              <input
                ref={fileInput}
                type="file"
                name="file"
                accept=".xlsx,.xls"
                hidden
                onChange={event => {
                  setError('');
                  const selected = event.currentTarget.files?.[0];
                  if (selected && !/\.(xlsx|xls)$/i.test(selected.name)) {
                    event.currentTarget.value = '';
                    setFileName('');
                    setError('Pilih file Excel dengan format .xlsx atau .xls.');
                    return;
                  }
                  setFileName(selected?.name ?? '');
                }}
              />
              <button
                type="button"
                className="btn rounded-full border border-default-300 px-4 text-default-700 hover:bg-default-100"
                onClick={() => fileInput.current?.click()}
              >
                Pilih File
              </button>
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="border-t border-default-200 pt-5">
            <button
              type="submit"
              disabled={pending}
              className="btn w-full rounded-full bg-neutral-950 py-3 text-white hover:bg-neutral-800"
            >
              {pending
                ? 'Mengimpor...'
                : isAppend
                  ? 'Impor ke Periode Ini'
                  : 'Impor dan Buat Periode'}
            </button>
            <p className="mt-3 text-center text-sm text-default-500">
              Gunakan sheet pertama laporan Rincian Scan Log yang memuat kolom ID Pegawai, Nama, dan
              Tanggal.
            </p>
          </div>
        </form>
      </dialog>
    </>
  );
}
