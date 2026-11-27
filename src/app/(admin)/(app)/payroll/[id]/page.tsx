import PageBreadcrumb from '@/components/PageBreadcrumb';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getAttendanceOvertimes, getPeriod } from '../../periode-absensi/db';
import { defaultPayrollConfig, getPayrollEmployees, type PayrollConfig } from '../payrollData';
import PayrollDraft from './PayrollDraft';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPeriod(id);
  if (!data) notFound();
  const { period, records, corrections, holidaySchedules } = data;
  const dataGroupId = BigInt(period.id);
  const [overtime, draft] = await Promise.all([
    getAttendanceOvertimes(dataGroupId),
    prisma.payrollDraft.findUnique({ where: { dataGroupId } }),
  ]);
  const employees = getPayrollEmployees(period, records, corrections, holidaySchedules, overtime);

  return (
    <main>
      <PageBreadcrumb title={`Payroll · ${period.name}`} subtitle="Payroll" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-default-600">
          {period.startDate ? `${period.start} – ${period.end}` : 'Periode belum memiliki tanggal.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/payroll" className="btn btn-sm border border-default-200">
            Kembali ke Payroll
          </Link>
          <Link
            href={`/periode-absensi/${id}/ringkasan`}
            className="btn btn-sm border border-default-200"
          >
            Lihat Ringkasan Absensi
          </Link>
        </div>
      </div>
      {employees.length > 0 ? (
        <PayrollDraft
          key={period.id}
          periodId={period.id}
          employees={employees}
          initialConfig={(draft?.config as PayrollConfig | undefined) ?? defaultPayrollConfig}
          initialVersion={draft?.version ?? 0}
        />
      ) : (
        <div className="card">
          <p className="card-body">Belum ada pegawai di periode ini.</p>
        </div>
      )}
    </main>
  );
}
