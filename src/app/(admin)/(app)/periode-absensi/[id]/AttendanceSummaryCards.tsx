import { LuCalendarDays, LuClipboardList, LuFingerprint, LuLayers, LuUsers } from 'react-icons/lu';

type AttendanceSummaryCardsProps = {
  employeeCount: number;
  presentEmployeeCount: number;
  recordCount: number;
  recordedDayCount: number;
  duplicateDayCount: number;
};

export default function AttendanceSummaryCards({
  employeeCount,
  presentEmployeeCount,
  recordCount,
  recordedDayCount,
  duplicateDayCount,
}: AttendanceSummaryCardsProps) {
  const summaries = [
    {
      label: 'Karyawan Tercatat',
      value: employeeCount,
      icon: LuUsers,
      color: 'bg-info/10 text-info',
    },
    {
      label: 'Karyawan Hadir',
      value: presentEmployeeCount,
      icon: LuFingerprint,
      color: 'bg-success/10 text-success',
    },
    {
      label: 'Catatan Absensi',
      value: recordCount,
      icon: LuClipboardList,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: 'Hari dengan Catatan',
      value: recordedDayCount,
      icon: LuCalendarDays,
      color: 'bg-warning/10 text-warning',
    },
  ];

  return (
    <div className="mb-5 space-y-3">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {summaries.map(({ label, value, icon: Icon, color }) => (
          <div className="card" key={label}>
            <div className="card-body flex items-center gap-3">
              <div className={`btn size-12 ${color}`}>
                <Icon className="size-6" aria-hidden="true" />
              </div>
              <dl className="flex flex-col">
                <dt className="text-default-500">{label}</dt>
                <dd className="order-first mb-1 font-semibold text-heading">{value}</dd>
              </dl>
            </div>
          </div>
        ))}
      </div>
      {duplicateDayCount > 0 && (
        <p className="flex items-center gap-2 rounded-md bg-info/10 px-3 py-2 text-sm text-default-800">
          <LuLayers className="size-4 shrink-0 text-info" aria-hidden="true" />
          <span>
            Ada <strong>{duplicateDayCount}</strong> kejadian duplikat untuk jenis absen yang sama,
            pada pegawai dan tanggal yang sama.
          </span>
        </p>
      )}
    </div>
  );
}
