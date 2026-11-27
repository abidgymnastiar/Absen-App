import PageBreadcrumb from '@/components/PageBreadcrumb';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LuArrowLeft } from 'react-icons/lu';
import { getPeriod } from '../db';
import AttendanceRecords from './AttendanceRecords';
import AttendanceSummaryCards from './AttendanceSummaryCards';
import { attendanceDayKey, getAttendanceScans, getDuplicateAttendance } from './attendanceData';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPeriod(id);
  if (!data) notFound();
  const { period, records, corrections } = data;
  const { duplicateDayCount } = getDuplicateAttendance(records);
  const employees = new Set<string>();
  const scans = getAttendanceScans(records);
  const presentEmployees = new Set<string>();
  const recordedDays = new Set<string>();
  for (const record of records) {
    if (record.employeeId) employees.add(record.employeeId);
    if (!record.date) continue;
    recordedDays.add(record.date);
    if (!record.employeeId) continue;
    const day = scans.get(record.employeeId)?.get(record.date);
    const correction = corrections[attendanceDayKey(record.employeeId, record.date)];
    if (correction === undefined ? day?.masuk && day.keluar : correction === 'H') {
      presentEmployees.add(record.employeeId);
    }
  }

  return (
    <main>
      <PageBreadcrumb title={`Detail Periode Absensi · ${period.name}`} subtitle="Apps" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-default-600">
          {period.start} – {period.end} · {period.status}
        </p>
        <Link
          href="/periode-absensi"
          className="btn btn-sm border border-default-200 text-default-700"
        >
          <LuArrowLeft className="size-4" aria-hidden="true" /> Kembali
        </Link>
      </div>
      <section aria-labelledby="period-summary-heading">
        <h2 id="period-summary-heading" className="mb-3 text-base font-semibold text-heading">
          Ringkasan Periode
        </h2>
        <AttendanceSummaryCards
          employeeCount={employees.size}
          presentEmployeeCount={presentEmployees.size}
          recordCount={records.length}
          recordedDayCount={recordedDays.size}
          duplicateDayCount={duplicateDayCount}
        />
      </section>
      <AttendanceRecords key={period.id} period={period} records={records} />
    </main>
  );
}
