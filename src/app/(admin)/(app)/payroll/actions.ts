'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { databaseId } from '../periode-absensi/db';
import { maxRupiah, rateFields, type PayrollConfig } from './payrollData';

function isMoney(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maxRupiah;
}

export async function savePayrollDraft(periodId: string, version: number, config: PayrollConfig) {
  const dataGroupId = databaseId(periodId);
  if (
    !dataGroupId ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    !config?.rates ||
    !rateFields.every(({ key }) => isMoney(config.rates[key])) ||
    config.rates.daily === 0 ||
    !Array.isArray(config.employees)
  ) {
    throw new Error('Pengaturan payroll tidak valid.');
  }

  const ids = new Set<string>();
  for (const entry of config.employees) {
    const { employeeId, components } = entry ?? {};
    if (
      typeof employeeId !== 'string' ||
      !employeeId.trim() ||
      employeeId.length > 50 ||
      ids.has(employeeId) ||
      !components ||
      (components.scheme !== 'daily' && components.scheme !== 'monthly') ||
      ![
        components.monthlyBase,
        components.allowance,
        components.incentive,
        components.otherDeduction,
      ].every(isMoney) ||
      !Number.isSafeInteger(components.deductedDays) ||
      components.deductedDays < 0 ||
      components.deductedDays > 366
    ) {
      throw new Error('Komponen payroll pegawai tidak valid.');
    }
    ids.add(employeeId);
  }
  const employees = await prisma.attendanceLog.findMany({
    where: { dataGroupId, employeeId: { in: [...ids] } },
    distinct: ['employeeId'],
    select: { employeeId: true },
  });
  const validIds = new Set(employees.map(employee => employee.employeeId));
  if ([...ids].some(id => !validIds.has(id))) {
    throw new Error('Daftar pegawai periode telah berubah.');
  }

  if (version === 0) {
    await prisma.payrollDraft.create({ data: { dataGroupId, config } });
  } else {
    const result = await prisma.payrollDraft.updateMany({
      where: { dataGroupId, version },
      data: { config, version: { increment: 1 } },
    });
    if (!result.count) throw new Error('Draf sudah berubah. Muat ulang halaman.');
  }
  revalidatePath(`/payroll/${periodId}`);
  return version + 1;
}
