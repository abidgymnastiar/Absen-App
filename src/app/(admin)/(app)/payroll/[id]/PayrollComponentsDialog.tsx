import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  calculatePayroll,
  maxRupiah,
  rupiah,
  type PayrollComponents,
  type PayrollEmployee,
  type PayrollRates,
} from '../payrollData';

const fields = [
  { key: 'monthlyBase', label: 'Gaji pokok bulanan (Rp)', max: maxRupiah, monthly: true },
  { key: 'deductedDays', label: 'Hari potong absensi', max: 366, monthly: true },
  { key: 'allowance', label: 'Tunjangan (Rp)', max: maxRupiah },
  { key: 'incentive', label: 'Insentif Pencapaian Target (Rp)', max: maxRupiah },
  { key: 'otherDeduction', label: 'Potongan (Rp)', max: maxRupiah },
] as const;

export default function PayrollComponentsDialog({
  employee,
  rates,
  initialComponents,
  onApply,
  onClose,
}: {
  employee: PayrollEmployee;
  rates: PayrollRates;
  initialComponents: PayrollComponents;
  onApply: (components: PayrollComponents) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [components, setComponents] = useState(initialComponents);
  const result = calculatePayroll(employee, rates, components);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(components);
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="payroll-components-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-11/12 max-w-lg overflow-y-auto rounded-lg bg-card text-default-800 backdrop:bg-black/50"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="space-y-1 border-b border-default-200 px-5 py-4">
          <h2 id="payroll-components-title" className="font-semibold text-heading">
            Atur Komponen Gaji
          </h2>
          <p className="text-sm text-default-600">{employee.name || employee.employeeId}</p>
        </div>
        <div className="grid gap-3 p-5 text-sm sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span>Skema gaji</span>
            <select
              className="form-input"
              value={components.scheme}
              onChange={event => {
                const scheme = event.target.value === 'monthly' ? 'monthly' : 'daily';
                setComponents(previous => ({ ...previous, scheme }));
              }}
            >
              <option value="daily">Harian</option>
              <option value="monthly">Bulanan</option>
            </select>
          </label>
          {fields.map(field =>
            'monthly' in field && components.scheme !== 'monthly' ? null : (
              <label key={field.key} className="space-y-1">
                <span>{field.label}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={field.max}
                  step={1}
                  className="form-input tabular-nums"
                  placeholder="–"
                  value={components[field.key] || ''}
                  onChange={event => {
                    const value = Number(event.target.value);
                    setComponents(previous => ({ ...previous, [field.key]: value }));
                  }}
                />
              </label>
            )
          )}
          <p className="text-xs text-default-600 sm:col-span-2">
            BPJS TK {rupiah.format(result.bpjsTk)} · BPJS Kesehatan {rupiah.format(result.bpjsKes)}
            {components.scheme === 'monthly' &&
              ` · Potongan absensi ${rupiah.format(result.attendanceDeduction)}`}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-default-200 px-5 py-3">
          <button
            type="button"
            className="btn btn-sm border border-default-200"
            onClick={() => dialog.current?.close()}
          >
            Batal
          </button>
          <button type="submit" className="btn btn-sm bg-primary text-white">
            Terapkan
          </button>
        </div>
      </form>
    </dialog>
  );
}
