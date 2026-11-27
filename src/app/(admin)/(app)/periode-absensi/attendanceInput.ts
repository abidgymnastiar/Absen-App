import { fields } from './[id]/attendanceData';

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number(value.slice(0, 4)) < 1000 ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Tanggal absensi tidak valid.');
  }
  return date;
}

function parseTime(value: string) {
  if (!value) return null;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
    throw new Error('Jam scan tidak valid.');
  }
  return new Date(`1970-01-01T${value.length === 5 ? value + ':00' : value}.000Z`);
}

export function attendanceInput(
  get: (key: (typeof fields)[number]['key']) => unknown,
  requireDetails = false
) {
  const values = Object.fromEntries(
    fields.map(({ key, label, maxLength }) => {
      const value = String(get(key) ?? '').trim();
      if (maxLength && value.length > maxLength)
        throw new Error(`${label} maksimal ${maxLength} karakter.`);
      return [key, value];
    })
  ) as Record<(typeof fields)[number]['key'], string>;

  if (requireDetails && (!values.employeeId || !values.employeeName || !values.date)) {
    throw new Error('Lengkapi ID Karyawan, Nama Karyawan, dan Tanggal Absensi.');
  }
  const { date, time, ...text } = values;
  return {
    ...text,
    attendanceDate: parseDate(date),
    scanTime: parseTime(time),
  };
}
