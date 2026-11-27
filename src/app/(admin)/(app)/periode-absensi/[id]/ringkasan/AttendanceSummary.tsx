'use client';

import { useRef, useState } from 'react';
import { LuCalendarDays, LuClock, LuDownload, LuSearch } from 'react-icons/lu';
import type { Period } from '../../periods';
import AttendanceSummaryCards from '../AttendanceSummaryCards';
import {
  attendanceDayKey,
  dailyIndicators,
  dailyIndicatorEntries,
  type AttendanceStatus,
  getAttendanceScans,
  getDuplicateAttendance,
  isScheduledHoliday,
  type AttendanceHolidaySchedule,
  type Attendance,
} from '../attendanceData';
import AttendanceDayDialog from './AttendanceDayDialog';
import AttendanceHolidayDialog from './AttendanceHolidayDialog';
import AttendanceOvertimeDialog from './AttendanceOvertimeDialog';
import type { AttendanceOvertime } from '../../overtime';
import { exportAttendance } from './exportAttendance';

const recapColumns = [
  { label: 'Hadir', statuses: ['Hadir'], color: 'bg-green-100 text-green-900' },
  {
    label: 'Absen belum lengkap',
    statuses: ['Belum absen keluar', 'Belum absen masuk', 'Absen belum lengkap'],
    color: 'bg-warning/15 text-default-900',
  },
  { label: 'Libur', statuses: ['libur'], color: dailyIndicators.L.color },
  { label: 'Sakit', statuses: ['s', 'sakit'], color: 'bg-default-100 text-default-800' },
  {
    label: 'Izin / Tidak hadir',
    statuses: ['i', 'izin', 'a', 'Tidak hadir'],
    color: 'bg-default-100 text-default-800',
  },
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
  holidaySchedules,
  overtimeEntries,
}: {
  period: Period;
  records: Attendance[];
  corrections: Record<string, AttendanceStatus>;
  holidaySchedules: AttendanceHolidaySchedule[];
  overtimeEntries: AttendanceOvertime[];
}) {
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [overtimeMessage, setOvertimeMessage] = useState('');
  const overtimeButton = useRef<HTMLButtonElement>(null);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState('');
  const holidayButton = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
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

  const roster = new Map<
    string,
    {
      name: string;
      position: string;
      days: Map<string, string>;
      automaticDays: Map<string, string>;
    }
  >();
  const dateSet = new Set(dates);
  const { byEmployee: scansByEmployee, workDates } = getAttendanceScans(records);
  const { byEmployee: duplicatesByEmployee, duplicateDayCount } = getDuplicateAttendance(
    records,
    dateSet,
    workDates
  );
  let scanCount = 0;
  const loggedDates = new Set<string>();
  for (const record of records) {
    const employee = roster.get(record.employeeId) ?? {
      name: record.employeeName,
      position: record.position,
      days: new Map<string, string>(),
      automaticDays: new Map<string, string>(),
    };
    if (!employee.position) employee.position = record.position;
    roster.set(record.employeeId, employee);
    if (dateSet.has(record.date)) {
      loggedDates.add(record.date);
      scanCount++;
    }
    const workDate = workDates.get(record.id) ?? record.date;
    if (dateSet.has(workDate)) {
      const type = record.attendanceType.trim().toLowerCase();
      const scans = scansByEmployee.get(record.employeeId)?.get(workDate);
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
      if (type || !employee.automaticDays.has(workDate)) {
        employee.automaticDays.set(workDate, status);
      }
      if (type || !employee.days.has(workDate)) employee.days.set(workDate, status);
    }
  }

  const holidayByEmployee = new Map(
    holidaySchedules.map(({ employeeId, weekday }) => [employeeId, weekday])
  );
  const effectiveCorrections = { ...corrections };
  for (const [employeeId, weekday] of holidayByEmployee) {
    if (!roster.has(employeeId)) continue;
    for (const date of dates) {
      if (isScheduledHoliday(date, weekday)) {
        const key = attendanceDayKey(employeeId, date);
        effectiveCorrections[key] ??= 'L';
      }
    }
  }

  for (const [key, correction] of Object.entries(effectiveCorrections)) {
    const [employeeId, date] = JSON.parse(key) as [string, string];
    if (dateSet.has(date))
      roster.get(employeeId)?.days.set(date, dailyIndicators[correction].status);
  }

  const periodEmployees = [...roster].filter(([id]) => id.trim());
  const employees = [...roster].filter(([id, employee]) =>
    `${id} ${employee.name}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  const presentEmployees = [...roster.values()].filter(employee =>
    [...employee.days.values()].includes('Hadir')
  );

  const visibleDates = showDaily
    ? dates.map(date => ({ date, isSunday: new Date(date).getUTCDay() === 0 }))
    : [];

  async function downloadExcel() {
    setExporting(true);
    setExportError('');
    try {
      await exportAttendance(period.name, dates, employees, effectiveCorrections);
    } catch {
      setExportError('Rekap Excel gagal diunduh. Coba lagi.');
    } finally {
      setExporting(false);
    }
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
        <div className="space-y-4 border-b border-default-200 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-heading">Rekap per Karyawan</h2>
              <p className="text-xs text-default-600" aria-live="polite">
                {dates.length > 0 ? employees.length : 0} karyawan · {dates.length} hari
              </p>
            </div>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Aksi absensi"
            >
              <button
                type="button"
                className="btn btn-sm bg-primary text-white whitespace-nowrap"
                disabled={exporting || dates.length === 0 || employees.length === 0}
                onClick={downloadExcel}
              >
                <LuDownload className="size-4" aria-hidden="true" />
                {exporting ? 'Menyiapkan Excel…' : 'Unduh Rekap Excel'}
              </button>
              <button
                ref={holidayButton}
                type="button"
                className="btn btn-sm border border-default-200 whitespace-nowrap"
                aria-haspopup="dialog"
                disabled={!period.startDate || !periodEmployees.length}
                onClick={() => {
                  setHolidayMessage('');
                  setHolidayOpen(true);
                }}
              >
                <LuCalendarDays className="size-4" aria-hidden="true" />
                List Libur
              </button>
              <button
                ref={overtimeButton}
                type="button"
                className="btn btn-sm border border-default-200 whitespace-nowrap"
                aria-haspopup="dialog"
                disabled={!period.startDate || !periodEmployees.length}
                onClick={() => {
                  setOvertimeMessage('');
                  setOvertimeOpen(true);
                }}
              >
                <LuClock className="size-4" aria-hidden="true" />
                Input Lembur
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative min-w-0 sm:w-60">
              <LuSearch
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-default-500"
                aria-hidden="true"
              />
              <input
                ref={searchInput}
                type="search"
                className="form-input form-input-sm ps-9"
                placeholder="Cari nama atau ID pegawai"
                aria-label="Cari karyawan"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-default-700">
              <label className="block min-w-0 space-y-1">
                <span className="block text-xs font-medium">Dari</span>
                <input
                  type="date"
                  className="form-input form-input-sm min-w-0 sm:w-36!"
                  min={period.startDate}
                  max={to}
                  value={from}
                  onChange={event => setFrom(event.target.value || period.startDate)}
                />
              </label>
              <label className="block min-w-0 space-y-1">
                <span className="block text-xs font-medium">Sampai</span>
                <input
                  type="date"
                  className="form-input form-input-sm min-w-0 sm:w-36!"
                  min={from}
                  max={period.endDate}
                  value={to}
                  onChange={event => setTo(event.target.value || period.endDate)}
                />
              </label>
            </div>

            <div
              className="inline-flex w-fit items-center rounded-md border border-default-200 bg-default-100 p-0.5 sm:ms-auto"
              role="group"
              aria-label="Tampilan absensi"
            >
              {[
                { daily: false, label: 'Rekap' },
                { daily: true, label: 'Harian' },
              ].map(({ daily, label }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={showDaily === daily}
                  className={`cursor-pointer rounded px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${showDaily === daily ? 'bg-card text-primary shadow-sm' : 'text-default-600 hover:text-heading'}`}
                  onClick={() => setShowDaily(daily)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {overtimeMessage && (
            <p role="status" className="text-sm text-success">
              {overtimeMessage}
            </p>
          )}
          {holidayMessage && (
            <p role="status" className="text-sm text-success">
              {holidayMessage}
            </p>
          )}
          {exportError && (
            <p role="alert" className="text-sm text-danger">
              {exportError}
            </p>
          )}
        </div>
        {showDaily && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-default-200 px-4 py-3 text-xs text-default-700 sm:px-5">
            {dailyIndicatorEntries.map(([code, { label, color }]) => (
              <span key={code} className="inline-flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 font-semibold ${color}`}>{code}</span>
                {label}
              </span>
            ))}
            <span>– Belum tercatat</span>
            <span>Shift malam mengikuti tanggal masuk.</span>
            <span className="text-default-500 sm:ms-auto">Klik status untuk mengedit.</span>
          </div>
        )}
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
                {recapColumns.map(({ label }) => (
                  <th key={label} scope="col" className="px-3.5 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-default-200 text-default-800">
              {dates.length > 0 &&
                employees.map(([id, employee]) => (
                  <tr key={id} className="group hover:bg-default-50">
                    <th
                      scope="row"
                      className="sticky start-0 z-10 max-w-52 whitespace-normal break-words border-e border-default-200 bg-card px-3.5 py-2.5 text-start font-medium group-hover:bg-default-50"
                    >
                      {employee.name}
                      {employee.position && (
                        <div className="text-xs font-normal text-default-500">
                          {employee.position}
                        </div>
                      )}
                    </th>
                    {visibleDates.map(({ date, isSunday }) => {
                      const status = employee.days.get(date);
                      const indicator = dailyIndicatorEntries.find(
                        ([, indicator]) => indicator.status === status
                      );
                      const hasCorrection =
                        effectiveCorrections[attendanceDayKey(id, date)] !== undefined;
                      const duplicates = hasCorrection
                        ? undefined
                        : duplicatesByEmployee.get(id)?.get(date);
                      return (
                        <td
                          key={date}
                          className={`px-3.5 py-3 text-center ${isSunday ? 'bg-warning/10' : ''}`}
                        >
                          {id ? (
                            <button
                              type="button"
                              className="cursor-pointer rounded px-1 py-0.5 text-default-700 hover:bg-default-100 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                              aria-haspopup="dialog"
                              aria-label={`Edit absensi ${employee.name} pada ${date}, ${status || 'Belum tercatat'}`}
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
                    {recapColumns.map(({ label, statuses, color }) => {
                      const count = [...employee.days.values()].filter(status =>
                        statuses.some(
                          value => value === status || value === status.trim().toLowerCase()
                        )
                      ).length;
                      return (
                        <td key={label} className="px-3.5 py-2.5 text-center tabular-nums">
                          <span
                            className={`inline-block min-w-8 rounded px-1.5 py-0.5 ${count ? `font-semibold ${color}` : 'text-default-500'}`}
                          >
                            {count}
                          </span>
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
        {!showDaily && (
          <div className="card-footer py-2 text-sm text-default-500">
            <p>Jumlah hari per karyawan dalam rentang yang dipilih.</p>
          </div>
        )}
      </div>
      {overtimeOpen && (
        <AttendanceOvertimeDialog
          period={period}
          initialDate={dates[0] ?? period.startDate}
          employees={periodEmployees}
          entries={overtimeEntries}
          onSaved={setOvertimeMessage}
          onClose={() => {
            setOvertimeOpen(false);
            overtimeButton.current?.focus();
          }}
        />
      )}
      {holidayOpen && (
        <AttendanceHolidayDialog
          period={period}
          employees={periodEmployees}
          holidayByEmployee={holidayByEmployee}
          onSaved={setHolidayMessage}
          onClose={() => {
            setHolidayOpen(false);
            holidayButton.current?.focus();
          }}
        />
      )}
      {selection && (
        <AttendanceDayDialog
          periodId={period.id}
          employeeId={selection.employeeId}
          employeeName={selection.employeeName}
          date={selection.date}
          type={selection.type}
          correction={corrections[attendanceDayKey(selection.employeeId, selection.date)]}
          scans={scansByEmployee.get(selection.employeeId)?.get(selection.date)}
          scheduledHoliday={isScheduledHoliday(
            selection.date,
            holidayByEmployee.get(selection.employeeId)
          )}
          employeeRecords={records.filter(record => record.employeeId === selection.employeeId)}
          workDates={workDates}
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
