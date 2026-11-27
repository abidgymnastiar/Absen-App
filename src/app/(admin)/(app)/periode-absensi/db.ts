import { prisma } from '@/lib/prisma';
import type { AttendanceLog, DataGroup } from '@/generated/prisma/client';
import { attendanceDayKey, type Attendance } from './[id]/attendanceData';
import type { Period } from './periods';

const formatDate = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const jakartaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' });

export function databaseId(value: string) {
  if (!/^[1-9]\d{0,18}$/.test(value)) return null;
  const id = BigInt(value);
  return id <= BigInt('9223372036854775807') ? id : null;
}

function toPeriod(group: DataGroup, first: Date | null, last: Date | null): Period {
  const startDate = first?.toISOString().slice(0, 10) ?? '';
  const endDate = last?.toISOString().slice(0, 10) ?? '';
  const today = jakartaDate.format(new Date());
  return {
    id: String(group.id),
    name: group.groupName,
    startDate,
    endDate,
    start: first ? formatDate.format(first) : '—',
    end: last ? formatDate.format(last) : '—',
    status: !first
      ? 'Kosong'
      : today < startDate
        ? 'Dijadwalkan'
        : today > endDate
          ? 'Ditutup'
          : 'Aktif',
  };
}

function toAttendance(log: AttendanceLog): Attendance {
  return {
    id: String(log.id),
    employeeId: log.employeeId ?? '',
    employeeName: log.employeeName ?? '',
    site: log.site ?? '',
    department: log.department ?? '',
    position: log.position ?? '',
    date: log.attendanceDate?.toISOString().slice(0, 10) ?? '',
    time: log.scanTime?.toISOString().slice(11, 19) ?? '',
    attendanceType: log.attendanceType ?? '',
    shiftCode: log.shiftCode ?? '',
    description: log.description ?? '',
  };
}

export async function getPeriods() {
  const [groups, ranges] = await prisma.$transaction([
    prisma.dataGroup.findMany({ orderBy: { id: 'desc' } }),
    prisma.attendanceLog.groupBy({
      by: ['dataGroupId'],
      orderBy: { dataGroupId: 'asc' },
      _min: { attendanceDate: true },
      _max: { attendanceDate: true },
    }),
  ]);
  const byGroup = new Map(ranges.map(range => [range.dataGroupId, range]));
  return groups.map(group => {
    const range = byGroup.get(group.id);
    return toPeriod(
      group,
      range?._min?.attendanceDate ?? null,
      range?._max?.attendanceDate ?? null
    );
  });
}

export async function getPeriod(id: string) {
  const groupId = databaseId(id);
  if (!groupId) return null;
  const group = await prisma.dataGroup.findUnique({
    where: { id: groupId },
    include: {
      attendanceHolidaySchedules: { select: { employeeId: true, weekday: true } },
      attendanceCorrections: { select: { employeeId: true, date: true, status: true } },
      attendanceLogs: { orderBy: [{ attendanceDate: 'asc' }, { scanTime: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!group) return null;
  const dated = group.attendanceLogs.filter(log => log.attendanceDate !== null);
  return {
    period: toPeriod(group, dated[0]?.attendanceDate ?? null, dated.at(-1)?.attendanceDate ?? null),
    records: group.attendanceLogs.map(toAttendance),
    holidaySchedules: group.attendanceHolidaySchedules,
    corrections: Object.fromEntries(
      group.attendanceCorrections.map(({ employeeId, date, status }) => [
        attendanceDayKey(employeeId, date.toISOString().slice(0, 10)),
        status,
      ])
    ),
  };
}

export async function getAttendanceOvertimes(dataGroupId: bigint) {
  const entries = await prisma.attendanceOvertime.findMany({
    where: { dataGroupId },
    select: { employeeId: true, date: true, type: true, minutes: true },
  });
  return entries.map(entry => ({ ...entry, date: entry.date.toISOString().slice(0, 10) }));
}
