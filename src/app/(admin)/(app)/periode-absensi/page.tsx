import PageBreadcrumb from '@/components/PageBreadcrumb';
import type { Metadata } from 'next';
import { getPeriods } from './db';
import AttendancePeriods from './AttendancePeriods';

export const metadata: Metadata = { title: 'Periode Absensi' };

export const dynamic = 'force-dynamic';

export default async function Page() {
  return (
    <main>
      <PageBreadcrumb title="Periode Absensi" subtitle="Apps" />
      <AttendancePeriods periods={await getPeriods()} />
    </main>
  );
}
