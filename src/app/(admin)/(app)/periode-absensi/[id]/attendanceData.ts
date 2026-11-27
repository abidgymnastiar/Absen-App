export const dailyIndicators = {
  L: { status: 'Libur', label: 'Libur', color: 'bg-yellow-100 text-yellow-900' },
  I: { status: 'Izin', label: 'Izin', color: 'bg-orange-100 text-orange-900' },
  H: { status: 'Hadir', label: 'Masuk', color: 'bg-green-100 text-green-900' },
  OFF: { status: 'Tidak hadir', label: 'Tidak masuk', color: 'bg-red-100 text-red-900' },
} as const;

export type AttendanceStatus = keyof typeof dailyIndicators;
export const dailyIndicatorEntries = Object.entries(dailyIndicators) as [
  AttendanceStatus,
  (typeof dailyIndicators)[AttendanceStatus],
][];

export const fields = [
  { key: 'employeeId', label: 'ID Karyawan', type: 'text', maxLength: 50 },
  { key: 'employeeName', label: 'Nama Karyawan', type: 'text', maxLength: 150 },
  { key: 'site', label: 'Site', type: 'text', maxLength: 150 },
  { key: 'department', label: 'Departemen', type: 'text', maxLength: 100 },
  { key: 'position', label: 'Jabatan', type: 'text', maxLength: 150 },
  { key: 'date', label: 'Tanggal', type: 'date', maxLength: undefined },
  { key: 'time', label: 'Jam Scan', type: 'time', maxLength: undefined },
  { key: 'attendanceType', label: 'Jenis Absensi', type: 'text', maxLength: 50 },
  { key: 'shiftCode', label: 'Kode Shift', type: 'text', maxLength: 100 },
  { key: 'description', label: 'Keterangan', type: 'text', maxLength: 500 },
] as const;

export type Attendance = { id: string } & Record<(typeof fields)[number]['key'], string>;

export function attendanceDayKey(employeeId: string, date: string) {
  return JSON.stringify([employeeId, date]);
}

export function getAttendanceScans(records: Attendance[], includedDates?: ReadonlySet<string>) {
  const byEmployee = new Map<string, Map<string, { masuk: boolean; keluar: boolean }>>();

  for (const { employeeId, date, attendanceType } of records) {
    if (!employeeId || !date || (includedDates && !includedDates.has(date))) continue;

    const type = attendanceType.trim().toLowerCase();
    const masuk = type === 'masuk' || type === 'absen masuk';
    const keluar = ['keluar', 'pulang', 'absen keluar', 'absen pulang'].includes(type);
    if (!masuk && !keluar) continue;

    const days = byEmployee.get(employeeId) ?? new Map();
    byEmployee.set(employeeId, days);
    const scans = days.get(date) ?? { masuk: false, keluar: false };
    scans.masuk ||= masuk;
    scans.keluar ||= keluar;
    days.set(date, scans);
  }

  return byEmployee;
}

export function getDuplicateAttendance(records: Attendance[], includedDates?: ReadonlySet<string>) {
  const countsByEmployee = new Map<string, Map<string, Map<string, number>>>();

  for (const { employeeId, date, attendanceType } of records) {
    const type = attendanceType.trim().toLowerCase();
    if (!employeeId || !date || !type || (includedDates && !includedDates.has(date))) continue;

    const days = countsByEmployee.get(employeeId) ?? new Map<string, Map<string, number>>();
    countsByEmployee.set(employeeId, days);
    const counts = days.get(date) ?? new Map<string, number>();
    days.set(date, counts);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const byEmployee = new Map<string, Map<string, [type: string, count: number][]>>();
  let duplicateDayCount = 0;
  for (const [employeeId, days] of countsByEmployee) {
    const duplicateDays = new Map<string, [type: string, count: number][]>();
    for (const [date, counts] of days) {
      const duplicates = [...counts].filter(([, count]) => count > 1);
      if (duplicates.length) duplicateDays.set(date, duplicates);
    }
    if (duplicateDays.size) {
      byEmployee.set(employeeId, duplicateDays);
      duplicateDayCount += duplicateDays.size;
    }
  }
  return { byEmployee, duplicateDayCount };
}
