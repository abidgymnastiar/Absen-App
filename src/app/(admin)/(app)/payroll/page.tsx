import PageBreadcrumb from '@/components/PageBreadcrumb';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPeriods } from '../periode-absensi/db';

export const metadata: Metadata = { title: 'Payroll' };

export const dynamic = 'force-dynamic';

export default async function Page() {
  const periods = await getPeriods();

  return (
    <main>
      <PageBreadcrumb title="Payroll" subtitle="Apps" />
      <section className="card mb-5" aria-labelledby="payroll-periods-heading">
        <div className="card-header">
          <h2 id="payroll-periods-heading" className="font-semibold text-heading">
            Periode Absensi
          </h2>
        </div>
        {periods.length === 0 ? (
          <div className="card-body space-y-3">
            <p className="text-sm text-default-600">Belum ada periode absensi.</p>
            <Link href="/periode-absensi" className="btn btn-sm border border-default-200">
              Buka Periode Absensi
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              aria-labelledby="payroll-periods-heading"
              className="min-w-full divide-y divide-default-200 whitespace-nowrap text-sm"
            >
              <thead className="bg-default-100 text-default-700">
                <tr>
                  <th scope="col" className="px-3.5 py-3 text-start">
                    Periode
                  </th>
                  <th scope="col" className="px-3.5 py-3 text-start">
                    Rentang tanggal
                  </th>
                  <th scope="col" className="px-3.5 py-3 text-start">
                    Status absensi
                  </th>
                  <th scope="col" className="px-3.5 py-3 text-end">
                    Ringkasan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200 text-default-800">
                {periods.map(period => (
                  <tr key={period.id}>
                    <th scope="row" className="px-3.5 py-3 text-start font-medium">
                      {period.name}
                    </th>
                    <td className="px-3.5 py-3">
                      {period.startDate ? (
                        <>
                          {period.start} – {period.end}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3.5 py-3">{period.status}</td>
                    <td className="px-3.5 py-3 text-end">
                      <Link
                        href={`/periode-absensi/${period.id}/ringkasan`}
                        className="btn btn-sm border border-default-200"
                        aria-label={`Lihat ringkasan absensi ${period.name}`}
                      >
                        Lihat Ringkasan
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
