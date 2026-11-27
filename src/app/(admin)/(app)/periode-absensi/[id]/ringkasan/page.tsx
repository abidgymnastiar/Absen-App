import PageBreadcrumb from '@/components/PageBreadcrumb';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LuArrowLeft } from 'react-icons/lu';
import { getPeriod } from '../../db';
import AttendanceSummary from './AttendanceSummary';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPeriod(id);
  if (!data) notFound();
  const { period, records, corrections } = data;

  return (
    <main>
      <PageBreadcrumb title={`Ringkasan Absensi · ${period.name}`} subtitle="Periode Absensi" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-default-600">
          {period.start} – {period.end}
        </p>
        <Link
          href={`/periode-absensi/${period.id}`}
          className="btn btn-sm border border-default-200 text-default-700"
        >
          <LuArrowLeft className="size-4" aria-hidden="true" /> Kembali ke Detail
        </Link>
      </div>
      <AttendanceSummary
        key={period.id}
        period={period}
        records={records}
        corrections={corrections}
      />
    </main>
  );
}
