'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { databaseId } from './db';
import { dailyIndicators, type AttendanceStatus } from './[id]/attendanceData';
import { attendanceInput } from './attendanceInput';
import type { AttendanceOvertime } from './overtime';

export async function saveAttendance(periodId: string, recordId: string | null, form: FormData) {
  const dataGroupId = databaseId(periodId);
  const id = recordId === null ? null : databaseId(recordId);
  if (!dataGroupId || (recordId !== null && !id)) throw new Error('Data absensi tidak ditemukan.');

  const data = attendanceInput(key => form.get(key), recordId === null);
  await prisma.$transaction(async transaction => {
    if (id) {
      const result = await transaction.attendanceLog.updateMany({
        where: { id, dataGroupId },
        data,
      });
      if (!result.count) throw new Error('Data absensi tidak ditemukan.');
    } else {
      await transaction.attendanceLog.create({ data: { ...data, dataGroupId } });
    }
  });
  revalidatePath('/periode-absensi', 'layout');
}

export async function deleteAttendance(periodId: string, recordId: string) {
  const dataGroupId = databaseId(periodId);
  const id = databaseId(recordId);
  if (!dataGroupId || !id) throw new Error('Data absensi tidak ditemukan.');
  const result = await prisma.attendanceLog.deleteMany({ where: { id, dataGroupId } });
  if (!result.count) throw new Error('Data absensi tidak ditemukan.');
  revalidatePath('/periode-absensi', 'layout');
}

export async function renamePeriod(periodId: string, name: string) {
  const id = databaseId(periodId);
  const groupName = name.trim();
  if (!id || !groupName || groupName.length > 150) throw new Error('Nama periode tidak valid.');
  await prisma.dataGroup.update({ where: { id }, data: { groupName, updatedAt: new Date() } });
  revalidatePath('/periode-absensi', 'layout');
}

export async function deletePeriod(periodId: string) {
  const id = databaseId(periodId);
  if (!id) throw new Error('Periode tidak ditemukan.');
  // The period's foreign keys cascade to corrections, holiday schedules, and overtime.
  await prisma.$transaction([
    prisma.attendanceLog.deleteMany({ where: { dataGroupId: id } }),
    prisma.dataGroup.delete({ where: { id } }),
  ]);
  revalidatePath('/periode-absensi', 'layout');
}

export async function saveAttendanceCorrection(
  periodId: string,
  employeeId: string,
  date: string,
  status: AttendanceStatus | null
) {
  await updateAttendanceCorrections(periodId, [{ employeeId, date }], status);
}

type AttendanceDay = { employeeId: string; date: string };

export async function saveAttendanceHolidays(
  periodId: string,
  schedules: { employeeId: string; weekday: number | null }[]
) {
  const dataGroupId = databaseId(periodId);
  if (
    !dataGroupId ||
    !Array.isArray(schedules) ||
    !schedules.length ||
    schedules.some(
      entry =>
        !entry ||
        typeof entry.employeeId !== 'string' ||
        !entry.employeeId.trim() ||
        entry.employeeId.length > 50 ||
        (entry.weekday !== null &&
          (!Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6))
    )
  ) {
    throw new Error('Jadwal libur tidak valid.');
  }

  const updates = new Map(schedules.map(({ employeeId, weekday }) => [employeeId, weekday]));
  const employees = await prisma.attendanceLog.findMany({
    where: { dataGroupId, employeeId: { in: [...updates.keys()] } },
    distinct: ['employeeId'],
    select: { employeeId: true },
  });
  const validIds = new Set(employees.map(employee => employee.employeeId));
  if ([...updates.keys()].some(id => !validIds.has(id))) {
    throw new Error('Karyawan tidak termasuk dalam periode absensi.');
  }

  const removals: string[] = [];
  const values: Prisma.Sql[] = [];
  for (const [employeeId, weekday] of updates) {
    if (weekday === null) removals.push(employeeId);
    else values.push(Prisma.sql`(${dataGroupId}, ${employeeId}, ${weekday})`);
  }

  await prisma.$transaction(async transaction => {
    if (removals.length) {
      await transaction.attendanceHolidaySchedule.deleteMany({
        where: { dataGroupId, employeeId: { in: removals } },
      });
    }
    if (values.length) {
      await transaction.$executeRaw`
        INSERT INTO attendance_holiday_schedules (data_group_id, employee_id, weekday)
        VALUES ${Prisma.join(values)}
        ON DUPLICATE KEY UPDATE weekday = VALUES(weekday)
      `;
    }
  });
  revalidatePath('/periode-absensi', 'layout');
}

async function updateAttendanceCorrections(
  periodId: string,
  days: AttendanceDay[],
  status: AttendanceStatus | null
) {
  const dataGroupId = databaseId(periodId);
  if (
    !dataGroupId ||
    !Array.isArray(days) ||
    !days.length ||
    (status !== null &&
      (typeof status !== 'string' ||
        !Object.prototype.hasOwnProperty.call(dailyIndicators, status)))
  ) {
    throw new Error('Koreksi absensi tidak valid.');
  }

  const entries = days.map(day => {
    const { employeeId, date } = day ?? {};
    if (
      typeof employeeId !== 'string' ||
      !employeeId.trim() ||
      employeeId.length > 50 ||
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      throw new Error('Koreksi absensi tidak valid.');
    }
    const attendanceDate = new Date(date);
    if (
      Number.isNaN(attendanceDate.getTime()) ||
      attendanceDate.toISOString().slice(0, 10) !== date
    ) {
      throw new Error('Tanggal absensi tidak valid.');
    }
    return { employeeId, date, attendanceDate };
  });
  const ids = [...new Set(entries.map(({ employeeId }) => employeeId))];
  if (status === null) {
    const [{ employeeId, attendanceDate }] = entries;
    await prisma.attendanceCorrection.deleteMany({
      where: { dataGroupId, employeeId, date: attendanceDate },
    });
  } else {
    const [employees, range] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: { dataGroupId, employeeId: { in: ids } },
        distinct: ['employeeId'],
        select: { employeeId: true },
      }),
      prisma.attendanceLog.aggregate({
        where: { dataGroupId },
        _min: { attendanceDate: true },
        _max: { attendanceDate: true },
      }),
    ]);
    const validIds = new Set(employees.map(employee => employee.employeeId));
    const first = range._min.attendanceDate;
    const last = range._max.attendanceDate;
    if (
      !first ||
      !last ||
      entries.some(
        ({ employeeId, attendanceDate }) =>
          !validIds.has(employeeId) || attendanceDate < first || attendanceDate > last
      )
    ) {
      throw new Error('Karyawan atau tanggal tidak termasuk dalam periode absensi.');
    }

    const values = entries.map(
      ({ employeeId, date }) => Prisma.sql`(${dataGroupId}, ${employeeId}, ${date}, ${status})`
    );
    await prisma.$executeRaw`
      INSERT INTO attendance_corrections (data_group_id, employee_id, attendance_date, status)
      VALUES ${Prisma.join(values)}
      ON DUPLICATE KEY UPDATE status = ${status}
    `;
  }
  revalidatePath('/periode-absensi', 'layout');
}

export async function saveAttendanceOvertime(
  periodId: string,
  input: { date: string; entries: Omit<AttendanceOvertime, 'date'>[] }
) {
  const dataGroupId = databaseId(periodId);
  const { date, entries } = input ?? {};
  if (
    !dataGroupId ||
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Array.isArray(entries) ||
    !entries.length ||
    entries.some(
      entry =>
        !entry ||
        typeof entry.employeeId !== 'string' ||
        !entry.employeeId.trim() ||
        entry.employeeId.length > 50 ||
        (entry.type !== 'L' && entry.type !== 'LB') ||
        !Number.isInteger(entry.minutes) ||
        entry.minutes < 1 ||
        entry.minutes > 1440
    )
  ) {
    throw new Error('Data lembur tidak valid.');
  }
  const attendanceDate = new Date(date);
  if (
    Number.isNaN(attendanceDate.getTime()) ||
    attendanceDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error('Tanggal lembur tidak valid.');
  }

  const ids = [...new Set(entries.map(entry => entry.employeeId))];
  if (ids.length !== entries.length) throw new Error('Pegawai tercatat lebih dari sekali.');
  const [employees, range] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { dataGroupId, employeeId: { in: ids } },
      distinct: ['employeeId'],
      select: { employeeId: true },
    }),
    prisma.attendanceLog.aggregate({
      where: { dataGroupId },
      _min: { attendanceDate: true },
      _max: { attendanceDate: true },
    }),
  ]);
  const first = range._min.attendanceDate;
  const last = range._max.attendanceDate;
  const validIds = new Set(employees.map(employee => employee.employeeId));
  if (
    !ids.every(id => validIds.has(id)) ||
    !first ||
    !last ||
    attendanceDate < first ||
    attendanceDate > last
  ) {
    throw new Error('Karyawan atau tanggal tidak termasuk dalam periode absensi.');
  }

  const values = entries.map(
    ({ employeeId, type, minutes }) =>
      Prisma.sql`(${dataGroupId}, ${employeeId}, ${date}, ${type}, ${minutes})`
  );
  await prisma.$executeRaw`
    INSERT INTO attendance_overtimes (data_group_id, employee_id, attendance_date, overtime_type, minutes)
    VALUES ${Prisma.join(values)}
    ON DUPLICATE KEY UPDATE minutes = VALUES(minutes)
  `;
  revalidatePath('/periode-absensi', 'layout');
}
