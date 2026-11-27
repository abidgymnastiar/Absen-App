export const dailyIndicators = {
  L: {
    status: 'Libur',
    label: 'Libur',
    color: 'bg-yellow-100 text-yellow-900',
    excelFill: 'FFFEF9C2',
  },
  I: {
    status: 'Izin',
    label: 'Izin',
    color: 'bg-orange-100 text-orange-900',
    excelFill: 'FFFFEDD4',
  },
  H: {
    status: 'Hadir',
    label: 'Masuk',
    color: 'bg-green-100 text-green-900',
    excelFill: 'FFDCFCE7',
  },
  OFF: {
    status: 'Tidak hadir',
    label: 'Tidak masuk',
    color: 'bg-red-100 text-red-900',
    excelFill: 'FFFFE2E2',
  },
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

export type AttendanceHolidaySchedule = { employeeId: string; weekday: number };

export function isScheduledHoliday(date: string, weekday: number | undefined) {
  return weekday !== undefined && new Date(date).getUTCDay() === weekday;
}

export function attendanceDayKey(employeeId: string, date: string) {
  return JSON.stringify([employeeId, date]);
}

type TimedScan = { id: string; seconds: number | null };
type DailyScans = { entries: TimedScan[]; exits: TimedScan[] };

const hour = 3600;
const day = 24 * hour;
const morningEnd = 10 * hour;
const maxNightShift = 16 * hour;
const repeatEntryWindow = 90 * 60;

export const attendanceShifts = {
  Pagi: { start: 8 * hour, end: 16 * hour, label: '08.00–16.00' },
  Siang: { start: 16 * hour, end: day, label: '16.00–00.00' },
  Malam: { start: 23 * hour, end: day + 7 * hour, label: '23.00–07.00' },
} as const;

export type AttendanceShift = keyof typeof attendanceShifts;
export type AttendanceDayScans = {
  masuk: boolean;
  keluar: boolean;
  shift?: AttendanceShift;
};

export function offsetAttendanceDate(date: string, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function scanSeconds(time: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return null;
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  return hours * hour + minutes * 60 + seconds;
}

function inferShift(entry: number, exit?: number) {
  let best: AttendanceShift | undefined;
  let bestDistance = Infinity;
  for (const shift of Object.keys(attendanceShifts) as AttendanceShift[]) {
    const { start, end } = attendanceShifts[shift];
    // A late scan after midnight can be closer to the previous evening's planned shift.
    for (const offset of [-day, 0, day]) {
      const distance =
        Math.abs(entry - (start + offset)) +
        (exit === undefined ? 0 : Math.abs(exit - (end + offset)));
      if (distance < bestDistance) {
        best = shift;
        bestDistance = distance;
      }
    }
  }
  return best;
}

function linkOvernightScans(
  nextScans: DailyScans,
  latestEntry: number,
  unassigned: (scan: TimedScan) => boolean
) {
  const morningExits = nextScans.exits.filter(
    (scan): scan is TimedScan & { seconds: number } =>
      unassigned(scan) &&
      scan.seconds !== null &&
      scan.seconds <= (latestEntry < 17 * hour ? 3 * hour : morningEnd) &&
      day - latestEntry + scan.seconds <= maxNightShift
  );
  if (!morningExits.length) return undefined;

  const firstMorningExit = Math.min(...morningExits.map(scan => scan.seconds));
  // A repeat arrival just after midnight can be part of the same shift.
  const repeatEntries = nextScans.entries.filter(
    scan =>
      unassigned(scan) &&
      scan.seconds !== null &&
      scan.seconds < firstMorningExit &&
      day - latestEntry + scan.seconds <= repeatEntryWindow
  );
  const repeats = new Set(repeatEntries.map(scan => scan.id));
  const nextEntry = Math.min(
    ...nextScans.entries
      .filter(scan => unassigned(scan) && !repeats.has(scan.id))
      .map(scan => scan.seconds ?? 0)
  );
  const exits = morningExits.filter(scan => scan.seconds < nextEntry);
  return exits.length
    ? { checkout: day + firstMorningExit, scans: [...exits, ...repeatEntries] }
    : undefined;
}

export function getAttendanceScans(records: Attendance[]) {
  const grouped = new Map<string, Map<string, DailyScans>>();
  for (const { id, employeeId, date, time, attendanceType } of records) {
    if (!employeeId || !date) continue;

    const type = attendanceType.trim().toLowerCase();
    const masuk = type === 'masuk' || type === 'absen masuk';
    const keluar = ['keluar', 'pulang', 'absen keluar', 'absen pulang'].includes(type);
    if (!masuk && !keluar) continue;

    const days = grouped.get(employeeId) ?? new Map<string, DailyScans>();
    grouped.set(employeeId, days);
    const scans = days.get(date) ?? { entries: [], exits: [] };
    const target = masuk ? scans.entries : scans.exits;
    target.push({ id, seconds: scanSeconds(time) });
    days.set(date, scans);
  }

  const byEmployee = new Map<string, Map<string, AttendanceDayScans>>();
  const workDates = new Map<string, string>();
  const unassigned = (scan: TimedScan) => !workDates.has(scan.id);
  for (const [employeeId, days] of grouped) {
    const summary = new Map<string, AttendanceDayScans>();
    byEmployee.set(employeeId, summary);
    for (const date of [...days.keys()].sort()) {
      const scans = days.get(date)!;
      const entries = scans.entries.filter(unassigned);
      const exits = scans.exits.filter(unassigned);
      if (!entries.length && !exits.length) continue;

      const timedEntries = entries.flatMap(scan => (scan.seconds === null ? [] : [scan.seconds]));
      const latestEntry = Math.max(...timedEntries);
      const earliestEntry = Math.min(...timedEntries);
      const lastTimedExit = Math.max(...exits.map(scan => scan.seconds ?? -Infinity));
      const untimedPair =
        entries.length > 0 &&
        exits.length > 0 &&
        (entries.some(scan => scan.seconds === null) || exits.some(scan => scan.seconds === null));
      const sameDayPair = Number.isFinite(earliestEntry) && earliestEntry <= lastTimedExit;
      let shift: AttendanceShift | undefined;
      let overnight = false;
      if (
        latestEntry >= attendanceShifts.Siang.start - hour &&
        latestEntry > lastTimedExit &&
        !untimedPair
      ) {
        const nextScans = days.get(offsetAttendanceDate(date, 1));
        const linked = nextScans && linkOvernightScans(nextScans, latestEntry, unassigned);
        if (linked) {
          for (const scan of linked.scans) workDates.set(scan.id, date);
          shift = inferShift(latestEntry, linked.checkout);
          overnight = true;
        }
      }
      if (!shift && Number.isFinite(earliestEntry)) {
        if (sameDayPair) shift = inferShift(earliestEntry, lastTimedExit);
        else shift = inferShift(untimedPair ? earliestEntry : latestEntry);
      }

      summary.set(date, {
        masuk: entries.length > 0,
        keluar: entries.length === 0 ? exits.length > 0 : sameDayPair || untimedPair || overnight,
        shift,
      });
    }
  }
  return { byEmployee, workDates };
}

export function getDuplicateAttendance(
  records: Attendance[],
  includedDates?: ReadonlySet<string>,
  workDates?: ReadonlyMap<string, string>
) {
  const countsByEmployee = new Map<string, Map<string, Map<string, number>>>();

  for (const { id, employeeId, date: scanDate, attendanceType } of records) {
    const date = workDates?.get(id) ?? scanDate;
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
