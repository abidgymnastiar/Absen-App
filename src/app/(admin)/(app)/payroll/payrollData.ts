import {
  attendanceDayKey,
  getAttendanceScans,
  isScheduledHoliday,
  type Attendance,
  type AttendanceHolidaySchedule,
  type AttendanceStatus,
} from '../periode-absensi/[id]/attendanceData';
import type { AttendanceOvertime } from '../periode-absensi/overtime';
import type { Period } from '../periode-absensi/periods';

export const rateFields = [
  { key: 'daily', label: 'Upah per hari' },
  { key: 'overtimeL', label: 'L per jam' },
  { key: 'overtimeLB', label: 'LB per jam' },
  { key: 'bpjsBase', label: 'Dasar BPJS karyawan' },
] as const;

export const defaultRates = {
  daily: 199823,
  overtimeL: 26780,
  overtimeLB: 30506,
  bpjsBase: 5195401,
};

export const defaultComponents = {
  scheme: 'daily' as 'daily' | 'monthly',
  monthlyBase: 0,
  deductedDays: 0,
  allowance: 0,
  incentive: 0,
  otherDeduction: 0,
};

export type PayrollComponents = typeof defaultComponents;
export type PayrollRates = typeof defaultRates;
export type PayrollConfig = {
  rates: PayrollRates;
  employees: { employeeId: string; components: PayrollComponents }[];
};
export type PayrollEmployee = {
  employeeId: string;
  name: string;
  position: string;
  workDays: number;
  minutesL: number;
  minutesLB: number;
};

export const defaultPayrollConfig: PayrollConfig = { rates: defaultRates, employees: [] };
export const maxRupiah = 1_000_000_000;
export const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function calculatePayroll(
  employee: PayrollEmployee,
  rates: PayrollRates,
  components: PayrollComponents
) {
  const monthly = components.scheme === 'monthly';
  const attendanceDeduction = monthly
    ? Math.round((rates.daily + components.allowance / 26) * components.deductedDays)
    : 0;
  const basePay = monthly ? components.monthlyBase : employee.workDays * rates.daily;
  const overtime = Math.round(
    (employee.minutesL * rates.overtimeL + employee.minutesLB * rates.overtimeLB) / 60
  );
  const baseSubtotal = basePay + components.allowance + components.incentive;
  const gross = baseSubtotal + overtime;
  const bpjsTk = Math.round((rates.bpjsBase * 2) / 100);
  const bpjsKes = Math.round(rates.bpjsBase / 100);
  const deductions = attendanceDeduction + bpjsTk + bpjsKes + components.otherDeduction;
  const net = gross - deductions;
  return {
    basePay,
    baseSubtotal,
    overtime,
    attendanceDeduction,
    gross,
    bpjsTk,
    bpjsKes,
    deductions,
    net,
  };
}

export function getPayrollEmployees(
  period: Period,
  records: Attendance[],
  corrections: Record<string, AttendanceStatus>,
  schedules: AttendanceHolidaySchedule[],
  overtime: AttendanceOvertime[]
): PayrollEmployee[] {
  const roster = new Map<string, PayrollEmployee>();
  for (const { employeeId, employeeName, position } of records) {
    if (!employeeId) continue;
    const employee = roster.get(employeeId);
    if (employee) {
      if (!employee.position) employee.position = position;
      if (!employee.name) employee.name = employeeName;
    } else {
      roster.set(employeeId, {
        employeeId,
        name: employeeName,
        position,
        workDays: 0,
        minutesL: 0,
        minutesLB: 0,
      });
    }
  }
  const inPeriod = (date: string) =>
    date !== '' && date >= period.startDate && date <= period.endDate;
  const { byEmployee: scans } = getAttendanceScans(records);
  const weekdays = new Map(schedules.map(({ employeeId, weekday }) => [employeeId, weekday]));
  for (const employee of roster.values()) {
    for (const [date, scan] of scans.get(employee.employeeId) ?? []) {
      if (
        inPeriod(date) &&
        scan.masuk &&
        scan.keluar &&
        corrections[attendanceDayKey(employee.employeeId, date)] === undefined &&
        !isScheduledHoliday(date, weekdays.get(employee.employeeId))
      ) {
        employee.workDays++;
      }
    }
  }
  for (const [key, status] of Object.entries(corrections)) {
    if (status !== 'H') continue;
    const [employeeId, date] = JSON.parse(key) as [string, string];
    const employee = roster.get(employeeId);
    if (employee && inPeriod(date)) employee.workDays++;
  }
  for (const { employeeId, date, type, minutes } of overtime) {
    const employee = roster.get(employeeId);
    if (!employee || !inPeriod(date)) continue;
    if (type === 'L') employee.minutesL += minutes;
    else employee.minutesLB += minutes;
  }
  return [...roster.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
}
