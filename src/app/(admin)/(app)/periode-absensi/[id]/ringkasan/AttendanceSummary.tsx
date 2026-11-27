'use client';

import { useRef, useState } from 'react';
import { LuSearch } from 'react-icons/lu';
import type { Period } from '../../periods';
import AttendanceSummaryCards from '../AttendanceSummaryCards';
import {
  attendanceDayKey,
  dailyIndicators,
  dailyIndicatorEntries,
  type AttendanceStatus,
  getAttendanceScans,
  getDuplicateAttendance,
  type Attendance,
} from '../attendanceData';
import AttendanceDayDialog from './AttendanceDayDialog';

const recapColumns = [
  { label: 'Hadir', statuses: ['Hadir'] },
  {
    label: 'Absen belum lengkap',
    statuses: ['Belum absen keluar', 'Belum absen masuk', 'Absen belum lengkap'],
  },
  { label: 'Libur', statuses: ['libur'] },
  { label: 'Sakit', statuses: ['s', 'sakit'] },
  { label: 'Izin / Tidak hadir', statuses: ['i', 'izin', 'a', 'Tidak hadir'] },
] as const;

type DaySelection = {
  employeeId: string;
  employeeName: string;
  date: string;
  type?: string;
};

export default function AttendanceSummary({
  period,
  records,
  corrections,
}: {
  period: Period;
  records: Attendance[];
  corrections: Record<string, AttendanceStatus>;
}) {
  const [showDaily, setShowDaily] = useState(false);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<DaySelection | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
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
      const isAbsent = [
        'a',
        'alpa',
        'absen',
        'alpha',
        'off',
        'tidak hadir',
        'tidak masuk',
      ].includes(type);
      let status = record.attendanceType;
      if (scans?.masuk && scans.keluar) status = 'Hadir';
      else if (scans?.masuk) status = 'Belum absen keluar';
      else if (scans?.keluar) status = 'Belum absen masuk';
      else if (type === 'hadir') status = 'Absen belum lengkap';
      else if (isAbsent) status = 'Tidak hadir';
      else if (type === 'l' || type === 'libur') status = 'Libur';
      else if (type === 'i' || type === 'izin') status = 'Izin';
      const correction = corrections[attendanceDayKey(record.employeeId, record.date)];
      if (correction !== undefined) status = dailyIndicators[correction].status;
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

  const visibleDates = showDaily
    ? dates.map(date => ({ date, isSunday: new Date(date).getUTCDay() === 0 }))
    : [];

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
        <div
          className="max-h-[65vh] overflow-auto"
          role="region"
          aria-label="Tabel rekap absensi"
          tabIndex={0}
        >
          <table
            aria-label="Rekap absensi per karyawan"
            className="min-w-full divide-y divide-default-200 whitespace-nowrap text-sm"
          >
            <thead className="sticky top-0 z-20 bg-default-100 text-default-800">
              <tr>
                <th
                  scope="col"
                  className="sticky start-0 z-10 min-w-40 max-w-52 whitespace-normal border-e border-default-200 bg-default-100 px-3.5 py-3 text-start font-medium"
                >
                  Nama Karyawan
                </th>
                {recapColumns.map(({ label }) => (
                  <th key={label} scope="col" className="px-3.5 py-3 font-medium">
                    {label}
                  </th>
                ))}
                {visibleDates.map(({ date, isSunday }) => (
                  <th
                    key={date}
                    scope="col"
                    className={`px-3.5 py-3 font-medium ${isSunday ? 'bg-warning/20' : ''}`}
                  >
                    {date.slice(8)}/{date.slice(5, 7)}
                    {isSunday && <span className="sr-only">, Minggu</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-default-200 text-default-800">
              {dates.length > 0 &&
                employees.map(([id, employee]) => (
                  <tr key={id}>
                    <th
                      scope="row"
                      className="sticky start-0 z-10 max-w-52 whitespace-normal break-words border-e border-default-200 bg-card px-3.5 py-3 text-start font-medium"
                    >
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
                    {visibleDates.map(({ date, isSunday }) => {
                      const status = employee.days.get(date);
                      const indicator = dailyIndicatorEntries.find(
                        ([, indicator]) => indicator.status === status
                      );
                      const hasCorrection = corrections[attendanceDayKey(id, date)] !== undefined;
                      const duplicates = hasCorrection
                        ? undefined
                        : duplicatesByEmployee.get(id)?.get(date);
                      return (
                        <td
                          key={date}
                          className={`px-3.5 py-3 text-center ${isSunday ? 'bg-warning/10' : ''}`}
                        >
                          {status !== undefined ? (
                            <button
                              type="button"
                              className="cursor-pointer rounded px-1 py-0.5 text-default-700 hover:bg-default-100 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                              aria-haspopup="dialog"
                              aria-label={`Edit absensi ${employee.name} pada ${date}, ${status || 'catatan tanpa jenis'}`}
                              onClick={event => {
                                editButton.current = event.currentTarget;
                                setSelection({ employeeId: id, employeeName: employee.name, date });
                              }}
                            >
                              {indicator ? (
                                <span
                                  className={`inline-block rounded px-2 py-0.5 font-semibold ${indicator[1].color}`}
                                >
                                  {indicator[0]}
                                </span>
                              ) : (
                                status || '–'
                              )}
                            </button>
                          ) : (
                            <span className="text-default-500" aria-label="Belum tercatat">
                              –
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
                                editButton.current = event.currentTarget;
                                setSelection({
                                  employeeId: id,
                                  employeeName: employee.name,
                                  date,
                                  type,
                                });
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
              {dailyIndicatorEntries.map(([code, { label, color }]) => (
                <span key={code} className="me-3 inline-block">
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${color}`}>{code}</span>{' '}
                  {label}
                </span>
              ))}
              <span>– Belum tercatat. Klik status untuk mengedit.</span>
            </p>
          ) : (
            <p>Jumlah hari per karyawan dalam rentang yang dipilih.</p>
          )}
        </div>
      </div>
      {selection && (
        <AttendanceDayDialog
          periodId={period.id}
          employeeId={selection.employeeId}
          employeeName={selection.employeeName}
          date={selection.date}
          type={selection.type}
          correction={corrections[attendanceDayKey(selection.employeeId, selection.date)]}
          records={records.filter(
            record =>
              record.employeeId === selection.employeeId &&
              record.date === selection.date &&
              (!selection.type || record.attendanceType.trim().toLowerCase() === selection.type)
          )}
          onClose={() => {
            setSelection(null);
            if (editButton.current?.isConnected) {
              editButton.current.focus();
            } else {
              searchInput.current?.focus();
            }
          }}
        />
      )}
    </>
  );
}
