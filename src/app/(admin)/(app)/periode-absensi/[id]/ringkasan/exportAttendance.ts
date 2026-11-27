import type { Style } from 'exceljs';
import { attendanceDayKey, dailyIndicatorEntries, type AttendanceStatus } from '../attendanceData';
import template from './attendanceExportStyles.json';

type EmployeeAttendance = {
  name: string;
  position: string;
  automaticDays: ReadonlyMap<string, string>;
};

const totalHeaders = ['Jml Hari Kerja', 'LEMBUR', 'S', 'A+I', 'BG+R', 'TOTAL ABSEN'];
const statusFills = new Map<string, string>(
  dailyIndicatorEntries.map(([code, { excelFill }]) => [code, excelFill])
);

function automaticCode(status: string | undefined) {
  const indicator = dailyIndicatorEntries.find(([, item]) => item.status === status);
  if (indicator) return indicator[0];
  if (!status || status.startsWith('Belum absen') || status === 'Absen belum lengkap') return 'OFF';
  return status.trim().toLowerCase() === 'sakit' ? 'S' : status.trim().toUpperCase();
}

export async function exportAttendance(
  periodName: string,
  dates: string[],
  employees: [string, EmployeeAttendance][],
  corrections: Record<string, AttendanceStatus>
) {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Rekap Absen Admin');
  const days = dates.map(date => new Date(date));
  const isSunday = days.map(day => day.getUTCDay() === 0);
  const weekdays = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
  const dateLabel = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'UTC' });
  const lastDateColumn = dates.length + 3;
  const lastColumn = lastDateColumn + totalHeaders.length;
  // The style samples contain the three identity columns, a weekday, a Sunday, and the six totals.
  const styleColumns = [0, 1, 2, ...isSunday.map(sunday => (sunday ? 4 : 3)), 5, 6, 7, 8, 9, 10];

  styleColumns.forEach((sample, index) => {
    sheet.getColumn(index + 1).width = template.widths[sample];
  });
  // The reference workbook hides the supporting totals between Hari Kerja and Total Absen.
  for (let column = lastDateColumn + 2; column < lastColumn; column++) {
    sheet.getColumn(column).hidden = true;
  }

  function applyRowStyle(rowNumber: number, sampleRow: number) {
    const row = sheet.getRow(rowNumber);
    row.height = template.heights[sampleRow - 1];
    styleColumns.forEach((sampleColumn, index) => {
      const useWeekdayStyle = sampleRow >= 9 && sampleColumn === 4;
      const styleIndex = template.grid[sampleRow - 1][useWeekdayStyle ? 3 : sampleColumn];
      row.getCell(index + 1).style = template.styles[styleIndex] as Partial<Style>;
    });
  }

  for (let row = 1; row <= 8; row++) applyRowStyle(row, row);
  for (const row of [6, 7, 8]) sheet.getRow(row).hidden = true;

  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.getCell('A1').value = `Absensi · ${periodName}`;
  const legendCells = ['A2', 'A3', 'C2', 'C3'];
  dailyIndicatorEntries.forEach(([code, { label, excelFill }], index) => {
    const cell = sheet.getCell(legendCells[index]);
    cell.value = `${code} = ${label}`;
    cell.style = {
      ...cell.style,
      alignment: { horizontal: 'left' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: excelFill } },
    };
  });
  sheet.mergeCells('A2:B2');
  sheet.mergeCells('A3:B3');
  sheet.mergeCells('C2:D2');
  sheet.mergeCells('C3:D3');
  sheet.getCell('A4').value = 'NO.';
  sheet.getCell('B4').value = 'NAMA';
  sheet.getCell('C4').value = 'JABATAN';
  if (days.length > 1) sheet.mergeCells(4, 4, 4, lastDateColumn);
  sheet.getCell('D4').value =
    `Periode : ${dateLabel.format(days[0])} s.d. ${dateLabel.format(days[days.length - 1])}`;
  days.forEach((day, index) => {
    sheet.getCell(5, index + 4).value = day;
    sheet.getCell(6, index + 4).value = weekdays[day.getUTCDay()];
  });
  totalHeaders.forEach((label, index) => {
    const column = lastDateColumn + index + 1;
    sheet.mergeCells(4, column, 6, column);
    sheet.getCell(4, column).value = label;
  });

  employees.forEach(([id, employee], index) => {
    const row = 9 + index * 3;
    applyRowStyle(row, 9);
    applyRowStyle(row + 1, 10);
    applyRowStyle(row + 2, 11);

    sheet.getCell(row, 1).value = index + 1;
    sheet.getCell(row, 2).value = employee.name;
    sheet.getCell(row, 3).value = employee.position;
    const effective: string[] = [];
    dates.forEach((date, dateIndex) => {
      const automatic = automaticCode(employee.automaticDays.get(date));
      const manual = corrections[attendanceDayKey(id, date)];
      effective.push(manual ?? automatic);
      for (const [targetRow, status] of [
        [row, automatic],
        [row + 1, manual],
      ] as const) {
        if (!status) continue;
        const cell = sheet.getCell(targetRow, dateIndex + 4);
        cell.value = status;
        const color = statusFills.get(status);
        if (color) {
          cell.style = {
            ...cell.style,
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: color } },
          };
        }
      }
    });

    const workDays = effective.filter(code => ['H', 'BC', 'SD', 'CT'].includes(code)).length;
    const sick = effective.filter(code => code === 'S').length;
    const absences = effective.filter(code => code === 'A' || code === 'I').length;
    const other = effective.filter(code => code === 'BG' || code === 'R').length;
    [workDays, null, sick, absences, other, sick + absences + other].forEach((value, offset) => {
      sheet.getCell(row, lastDateColumn + offset + 1).value = value;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const file = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rekap-absensi-${dates[0]}-${dates.at(-1)}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
