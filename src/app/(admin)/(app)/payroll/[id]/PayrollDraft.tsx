'use client';

import { useState, type FormEvent } from 'react';
import { savePayrollDraft } from '../actions';
import {
  calculatePayroll,
  defaultComponents,
  maxRupiah,
  rateFields,
  rupiah,
  type PayrollComponents,
  type PayrollConfig,
  type PayrollEmployee,
} from '../payrollData';

import PayrollComponentsDialog from './PayrollComponentsDialog';

const payColumns = [
  { key: 'basePay', label: 'Gaji Pokok' },
  { key: 'allowance', label: 'Tunjangan' },
  { key: 'incentive', label: 'Insentif Pencapaian Target' },
  { key: 'baseSubtotal', label: 'Gaji Pokok + Tunjangan + Insentif' },
  { key: 'overtime', label: 'Subtotal Lembur' },
  { key: 'gross', label: 'Subtotal Upah' },
  { key: 'otherDeduction', label: 'Potongan' },
  { key: 'net', label: 'Gaji Diterima' },
] as const;

const columns = [
  'Pegawai',
  'Skema',
  'Hari hadir',
  'Durasi L',
  'Durasi LB',
  ...payColumns.map(column => column.label),
  'Komponen',
];

function formatDuration(minutes: number) {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  return [hours ? `${hours} j` : '', minutes % 60 ? `${minutes % 60} m` : '']
    .filter(Boolean)
    .join(' ');
}

export default function PayrollDraft({
  periodId,
  employees,
  initialConfig,
  initialVersion,
}: {
  periodId: string;
  employees: PayrollEmployee[];
  initialConfig: PayrollConfig;
  initialVersion: number;
}) {
  const [rates, setRates] = useState(initialConfig.rates);
  const [adjustments, setAdjustments] = useState(
    () =>
      new Map(initialConfig.employees.map(({ employeeId, components }) => [employeeId, components]))
  );
  const [version, setVersion] = useState(initialVersion);
  const [activeEmployee, setActiveEmployee] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const rows = employees.map(employee => {
    const components = adjustments.get(employee.employeeId) ?? defaultComponents;
    return { employee, components, result: calculatePayroll(employee, rates, components) };
  });
  const selected = rows.find(({ employee }) => employee.employeeId === activeEmployee);
  const missingMonthlyBase = rows.some(
    ({ components }) => components.scheme === 'monthly' && !components.monthlyBase
  );
  const gross = rows.reduce((total, row) => total + row.result.gross, 0);
  const net = rows.reduce((total, row) => total + row.result.net, 0);
  const query = search.trim().toLowerCase();
  const visibleRows = rows.filter(({ employee }) =>
    `${employee.name} ${employee.employeeId}`.toLowerCase().includes(query)
  );

  function updateComponents(employeeId: string, components: PayrollComponents) {
    setMessage('');
    setAdjustments(previous => new Map(previous).set(employeeId, components));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      const config = {
        rates,
        employees: employees.flatMap(({ employeeId }) => {
          const components = adjustments.get(employeeId);
          return components ? [{ employeeId, components }] : [];
        }),
      };
      setVersion(await savePayrollDraft(periodId, version, config));
      setMessage('Draf payroll tersimpan.');
    } catch {
      setError(
        'Draf gagal disimpan. Periksa nilai yang diisi atau muat ulang jika draf diubah di tempat lain.'
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={pending} className="space-y-5">
          <section className="card" aria-labelledby="rates-heading">
            <div className="card-header flex-wrap gap-2">
              <h2 id="rates-heading" className="font-semibold text-heading">
                Tarif Payroll
              </h2>
              <button type="submit" className="btn btn-sm bg-primary text-white">
                {pending ? 'Menyimpan…' : 'Simpan Draf'}
              </button>
            </div>
            <div className="card-body space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {rateFields.map(({ key, label }) => (
                  <label key={key} className="block space-y-1 text-sm">
                    <span className="font-medium">{label} (Rp)</span>
                    <input
                      type="number"
                      min={key === 'daily' ? 1 : 0}
                      max={maxRupiah}
                      step={1}
                      required
                      className="form-input tabular-nums"
                      value={rates[key] || (key === 'daily' ? '' : 0)}
                      onChange={event => {
                        setMessage('');
                        setRates(previous => ({ ...previous, [key]: Number(event.target.value) }));
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className="text-sm text-default-500">
                Tarif awal mengikuti Excel referensi. Potongan BPJS karyawan mengikuti rumus
                workbook, yaitu 2% untuk TK dan 1% untuk Kesehatan dari dasar di atas.
              </p>
              {message && (
                <p role="status" className="text-sm text-success">
                  {message}
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          </section>
          <section className="card" aria-labelledby="payroll-detail-heading">
            <div className="card-header flex-wrap gap-3">
              <div>
                <h2 id="payroll-detail-heading" className="font-semibold text-heading">
                  Draf Payroll
                </h2>
                <p className="text-sm text-default-500">
                  {employees.length} pegawai · Isi tunjangan, insentif, dan potongan manual dalam
                  rupiah.
                </p>
              </div>
              <input
                type="search"
                className="form-input form-input-sm sm:w-60!"
                aria-label="Cari nama atau ID pegawai"
                placeholder="Cari nama atau ID pegawai"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-default-200 px-5 py-3 text-sm">
              <p>
                Total kotor <strong className="ms-1">{rupiah.format(gross)}</strong>
              </p>
              <p>
                Total diterima <strong className="ms-1">{rupiah.format(net)}</strong>
              </p>
            </div>
            {missingMonthlyBase && (
              <p className="bg-warning/10 px-5 py-3 text-sm">
                Ada pegawai bulanan dengan gaji pokok Rp0. Pilih Atur untuk mengisi gaji pokok.
              </p>
            )}
            <div
              className="max-h-[65vh] overflow-auto"
              tabIndex={0}
              role="region"
              aria-label="Tabel draf payroll"
            >
              <table className="min-w-full divide-y divide-default-200 text-sm">
                <thead className="sticky top-0 z-20 bg-default-100 text-default-800">
                  <tr>
                    {columns.map((column, index) => (
                      <th
                        key={column}
                        scope="col"
                        className={`px-3 py-3 font-medium ${index === 0 ? 'sticky start-0 bg-default-100 text-start' : index < 5 ? 'whitespace-nowrap text-center' : 'min-w-28 text-end'}`}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {visibleRows.map(({ employee, components, result }) => {
                    const { employeeId, name, position } = employee;
                    const label = name || employeeId;
                    return (
                      <tr key={employeeId} className="whitespace-nowrap">
                        <th
                          scope="row"
                          className="sticky start-0 z-10 min-w-40 max-w-52 whitespace-normal break-words bg-card px-3 py-3 text-start font-medium"
                        >
                          {label}
                          {position && (
                            <span className="block text-xs font-normal text-default-500">
                              {position}
                            </span>
                          )}
                        </th>
                        <td className="px-3 py-2 text-center">
                          {components.scheme === 'monthly' ? 'Bulanan' : 'Harian'}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">{employee.workDays}</td>
                        <td className="px-3 py-2 text-center tabular-nums">
                          {formatDuration(employee.minutesL)}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">
                          {formatDuration(employee.minutesLB)}
                        </td>
                        {payColumns.map(({ key }) => {
                          const manual =
                            key === 'allowance' || key === 'incentive' || key === 'otherDeduction';
                          const value = manual ? components[key] : result[key];
                          return (
                            <td
                              key={key}
                              className={`px-3 py-2 text-end tabular-nums ${key === 'gross' || key === 'net' ? 'font-semibold' : ''}`}
                            >
                              {manual && !value ? '–' : rupiah.format(value)}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-end">
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-label={`Atur komponen ${label}`}
                            className="btn btn-sm border border-default-200"
                            onClick={() => setActiveEmployee(employeeId)}
                          >
                            Atur
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="p-5 text-center text-default-500">
                        Pegawai tidak ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </fieldset>
      </form>
      {selected && (
        <PayrollComponentsDialog
          key={selected.employee.employeeId}
          employee={selected.employee}
          rates={rates}
          initialComponents={selected.components}
          onApply={components => updateComponents(selected.employee.employeeId, components)}
          onClose={() => setActiveEmployee(null)}
        />
      )}
    </>
  );
}
