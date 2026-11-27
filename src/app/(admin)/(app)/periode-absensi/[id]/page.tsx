import PageBreadcrumb from '@/components/PageBreadcrumb';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LuArrowLeft } from 'react-icons/lu';
import { getPeriod } from '../db';
import AttendanceRecords from './AttendanceRecords';
import AttendanceSummaryCards from './AttendanceSummaryCards';
import { getAttendanceScans, getDuplicateAttendance } from './attendanceData';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPeriod(id);
  if (!data) notFound();
  const { period, records } = data;
  const { duplicateDayCount } = getDuplicateAttendance(records);
  const employees = new Set<string>();
  const presentEmployees = [...getAttendanceScans(records).values()].filter(days =>
    [...days.values()].some(({ masuk, keluar }) => masuk && keluar)
  );
  const recordedDays = new Set<string>();
  for (const record of records) {
    if (record.employeeId) employees.add(record.employeeId);
    if (record.date) recordedDays.add(record.date);
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
          presentEmployeeCount={presentEmployees.length}
          recordCount={records.length}
          recordedDayCount={recordedDays.size}
          duplicateDayCount={duplicateDayCount}
        />
      </section>
      <AttendanceRecords key={period.id} period={period} records={records} />
    </main>
  );
}
