'use client';

import { useRef, useState } from 'react';
import { LuCheck, LuSearch, LuX } from 'react-icons/lu';
import type { Period } from '../../periods';
import AttendanceSummaryCards from '../AttendanceSummaryCards';
import { getAttendanceScans, getDuplicateAttendance, type Attendance } from '../attendanceData';
import DuplicateAttendanceDialog from './DuplicateAttendanceDialog';

const recapColumns = [
  { label: 'Hadir', statuses: ['Hadir'] },
  {
    label: 'Absen belum lengkap',
    statuses: ['Belum absen keluar', 'Belum absen masuk', 'Absen belum lengkap'],
  },
  { label: 'Sakit', statuses: ['s', 'sakit'] },
  { label: 'Izin / Alpa', statuses: ['i', 'izin', 'a', 'Tidak hadir'] },
] as const;

type DuplicateSelection = {
  employeeId: string;
  employeeName: string;
  date: string;
  type: string;
  recordIds: Set<string>;
};

export default function AttendanceSummary({
  period,
  records,
}: {
  period: Period;
  records: Attendance[];
}) {
  const [showDaily, setShowDaily] = useState(false);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<DuplicateSelection | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const duplicateButton = useRef<HTMLButtonElement>(null);
  const [from, setFrom] = useState<string>(period.startDate);
  const [to, setTo] = useState(() => {
    if (!period.startDate) return '';
    const limit = new Date(period.startDate);
    limit.setUTCDate(limit.getUTCDate() + 30);
    const firstMonth = limit.toISOString().slice(0, 10);
    return firstMonth < period.endDate ? firstMonth : period.endDate;
  });
  const dates: string[] = [];
  const first = from > period.startDate ? from : period.startDate;
  const last = to < period.endDate ? to : period.endDate;
  const cursor = new Date(first);
  const rangeTooLong = Date.parse(last) - cursor.getTime() >= 366 * 86_400_000;
  if (first && last && !rangeTooLong && !Number.isNaN(cursor.getTime())) {
    while (cursor.toISOString().slice(0, 10) <= last) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const roster = new Map<string, { name: string; position: string; days: Map<string, string> }>();
  const dateSet = new Set(dates);
  const { byEmployee: duplicatesByEmployee, duplicateDayCount } = getDuplicateAttendance(
    records,
    dateSet
  );
  const scansByEmployee = getAttendanceScans(records, dateSet);
  let scanCount = 0;
  const loggedDates = new Set<string>();
  for (const record of records) {
    const employee = roster.get(record.employeeId) ?? {
      name: record.employeeName,
      position: record.position,
      days: new Map<string, string>(),
    };
    if (!employee.position) employee.position = record.position;
    roster.set(record.employeeId, employee);
    if (dateSet.has(record.date)) {
      const type = record.attendanceType.trim().toLowerCase();
      const scans = scansByEmployee.get(record.employeeId)?.get(record.date);
      const isAbsent = ['alpa', 'absen', 'alpha', 'tidak hadir'].includes(type);
      let status = record.attendanceType;
      if (scans?.masuk && scans.keluar) status = 'Hadir';
      else if (scans?.masuk) status = 'Belum absen keluar';
      else if (scans?.keluar) status = 'Belum absen masuk';
      else if (type === 'hadir') status = 'Absen belum lengkap';
      else if (isAbsent) status = 'Tidak hadir';
      if (type || !employee.days.has(record.date)) employee.days.set(record.date, status);
      loggedDates.add(record.date);
      scanCount++;
    }
  }

  const employees = [...roster].filter(([id, employee]) =>
    `${id} ${employee.name}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  const presentEmployees = [...roster.values()].filter(employee =>
    [...employee.days.values()].includes('Hadir')
  );

  const visibleDates = showDaily ? dates : [];

  function openDuplicate(employeeId: string, employeeName: string, date: string, type: string) {
    const recordIds = new Set(
      records
        .filter(
          record =>
            record.employeeId === employeeId &&
            record.date === date &&
            record.attendanceType.trim().toLowerCase() === type
        )
        .map(record => record.id)
    );
    setSelection({ employeeId, employeeName, date, type, recordIds });
  }

  return (
    <>
      <AttendanceSummaryCards
        employeeCount={roster.size}
        presentEmployeeCount={presentEmployees.length}
        recordCount={scanCount}
        recordedDayCount={loggedDates.size}
        duplicateDayCount={duplicateDayCount}
      />

      <div className="card mb-5">
        <div className="card-header flex-wrap gap-3 py-3">
          <div className="relative">
            <LuSearch
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-default-500"
              aria-hidden="true"
            />
            <input
              ref={searchInput}
              type="search"
              className="form-input form-input-sm ps-9"
              placeholder="Cari karyawan..."
              aria-label="Cari karyawan"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-default-600">
            <label className="flex items-center gap-2">
              Dari
              <input
                type="date"
                className="form-input form-input-sm"
                min={period.startDate}
                max={to}
                value={from}
                onChange={event => setFrom(event.target.value || period.startDate)}
              />
            </label>
            <label className="flex items-center gap-2">
              Sampai
              <input
                type="date"
                className="form-input form-input-sm"
                min={from}
                max={period.endDate}
                value={to}
                onChange={event => setTo(event.target.value || period.endDate)}
              />
            </label>
          </div>
          <button
            type="button"
            className="btn btn-sm border border-default-200"
            aria-pressed={showDaily}
            onClick={() => setShowDaily(value => !value)}
          >
            Rincian harian
          </button>
        </div>
        <div className="overflow-x-auto">
          <table
            aria-label="Rekap absensi per karyawan"
            className="min-w-full divide-y divide-default-200 whitespace-nowrap text-sm"
          >
            <thead className="bg-default-100 text-default-800">
              <tr>
                <th scope="col" className="px-3.5 py-3 text-start font-medium">
                  Nama Karyawan
                </th>
                {recapColumns.map(({ label }) => (
                  <th key={label} scope="col" className="px-3.5 py-3 font-medium">
                    {label}
                  </th>
                ))}
                {visibleDates.map(date => (
                  <th key={date} scope="col" className="px-3.5 py-3 font-medium">
                    {date.slice(8)}/{date.slice(5, 7)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-default-200 text-default-800">
              {dates.length > 0 &&
                employees.map(([id, employee]) => (
                  <tr key={id}>
                    <th scope="row" className="px-3.5 py-3 text-start font-medium">
                      {employee.name}
                      {employee.position && (
                        <div className="text-xs font-normal text-default-500">
                          {employee.position}
                        </div>
                      )}
                    </th>
                    {recapColumns.map(({ label, statuses }) => (
                      <td key={label} className="px-3.5 py-3 text-center tabular-nums">
                        {
                          [...employee.days.values()].filter(status =>
                            statuses.some(
                              value => value === status || value === status.trim().toLowerCase()
                            )
                          ).length
                        }
                      </td>
                    ))}
                    {visibleDates.map(date => {
                      const status = employee.days.get(date);
                      const duplicates = duplicatesByEmployee.get(id)?.get(date);
                      return (
                        <td key={date} className="px-3.5 py-3 text-center">
                          {status === 'Hadir' ? (
                            <LuCheck
                              className="inline size-4 text-success"
                              role="img"
                              aria-label="Hadir"
                            />
                          ) : status === 'Tidak hadir' ? (
                            <LuX
                              className="inline size-4 text-danger"
                              role="img"
                              aria-label="Tidak hadir"
                            />
                          ) : (
                            <span
                              className="text-default-500"
                              aria-label={status ? undefined : 'Belum tercatat'}
                            >
                              {status || '–'}
                            </span>
                          )}
                          {duplicates?.map(([type, count]) => (
                            <button
                              key={type}
                              type="button"
                              className="ms-1 inline-flex cursor-pointer rounded-full bg-warning/15 px-1.5 py-0.5 align-middle text-xs font-semibold text-warning hover:bg-warning/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
                              aria-haspopup="dialog"
                              aria-label={`Buka ${count} catatan duplikat ${type} untuk ${employee.name} pada ${date}`}
                              onClick={event => {
                                duplicateButton.current = event.currentTarget;
                                openDuplicate(id, employee.name, date, type);
                              }}
                            >
                              <span className="capitalize">
                                {type} {count}×
                              </span>
                            </button>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              {(dates.length === 0 || employees.length === 0) && (
                <tr>
                  <td
                    colSpan={visibleDates.length + recapColumns.length + 1}
                    className="p-5 text-center text-default-500"
                  >
                    {dates.length === 0
                      ? rangeTooLong
                        ? 'Pilih rentang hingga 366 hari.'
                        : 'Belum ada catatan pada rentang tanggal ini.'
                      : 'Karyawan tidak ditemukan.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-footer flex-wrap py-2 text-sm text-default-500">
          {showDaily ? (
            <p>
              ✓ Hadir · × Tidak hadir · – Belum tercatat · Klik lencana duplikat untuk mengedit
              catatannya.
            </p>
          ) : (
            <p>Jumlah hari per karyawan dalam rentang yang dipilih.</p>
          )}
        </div>
      </div>
      {selection && (
        <DuplicateAttendanceDialog
          periodId={period.id}
          employeeId={selection.employeeId}
          employeeName={selection.employeeName}
          date={selection.date}
          type={selection.type}
          records={records.filter(record => selection.recordIds.has(record.id))}
          onClose={() => {
            setSelection(null);
            if (duplicateButton.current?.isConnected) {
              duplicateButton.current.focus();
            } else {
              searchInput.current?.focus();
            }
          }}
        />
      )}
    </>
  );
}
