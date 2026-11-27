'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { databaseId } from './db';
import { dailyIndicators, type AttendanceStatus } from './[id]/attendanceData';
import { attendanceInput } from './attendanceInput';

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
  const dataGroupId = databaseId(periodId);
  const attendanceDate = new Date(date);
  if (
    !dataGroupId ||
    !employeeId.trim() ||
    employeeId.length > 50 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(attendanceDate.getTime()) ||
    attendanceDate.toISOString().slice(0, 10) !== date ||
    (status !== null &&
      (typeof status !== 'string' ||
        !Object.prototype.hasOwnProperty.call(dailyIndicators, status)))
  )
    throw new Error('Koreksi absensi tidak valid.');

  const key = { dataGroupId, employeeId, date: attendanceDate };
  if (status === null) {
    await prisma.attendanceCorrection.deleteMany({ where: key });
  } else {
    const record = await prisma.attendanceLog.findFirst({
      where: { dataGroupId, employeeId, attendanceDate },
      select: { id: true },
    });
    if (!record) throw new Error('Catatan absensi tidak ditemukan.');
    await prisma.$executeRaw`
      INSERT INTO attendance_corrections (data_group_id, employee_id, attendance_date, status)
      VALUES (${dataGroupId}, ${employeeId}, ${date}, ${status})
      ON DUPLICATE KEY UPDATE status = ${status}
    `;
  }
  revalidatePath('/periode-absensi', 'layout');
}
