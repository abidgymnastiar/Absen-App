import { revalidatePath } from 'next/cache';
import { read, SSF, utils } from 'xlsx';
import { prisma } from '@/lib/prisma';
import { attendanceInput } from '../attendanceInput';
import { fields } from '../[id]/attendanceData';
import { databaseId } from '../db';

const aliases = {
  employeeId: ['employeeid', 'empid', 'idkaryawan', 'idpegawai', 'nik', 'pin', 'idnumber'],
  employeeName: ['employeename', 'namakaryawan', 'nama', 'name'],
  site: ['site', 'lokasi'],
  department: ['department', 'departemen', 'divisi'],
  position: ['position', 'jabatan'],
  date: ['attendancedate', 'tanggal', 'tanggalabsensi', 'date', 'scandate'],
  time: ['scantime', 'jamscan', 'jam', 'time'],
  attendanceType: ['attendancetype', 'jenisabsensi', 'jenisabsen', 'status', 'tipeabsensi'],
  shiftCode: ['shiftcode', 'kodeshift', 'shift'],
  description: ['description', 'keterangan', 'catatan'],
} satisfies Record<(typeof fields)[number]['key'], string[]>;

const pad = (value: number | string) => String(value).padStart(2, '0');

function excelDate(value: unknown, date1904: boolean) {
  if (typeof value === 'number') {
    const parsed = SSF.parse_date_code(value, { date1904 });
    if (!parsed) throw new Error('Tanggal Excel tidak valid.');
    return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
  }

  const text = String(value ?? '').trim();
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T].*)?$/.exec(text);
  if (iso) return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  const local = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text);
  return local ? `${local[3]}-${pad(local[2])}-${pad(local[1])}` : text;
}

function excelTime(value: unknown) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new Error('Jam scan Excel tidak valid.');
    const seconds = Math.round((value % 1) * 86400) % 86400;
    return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
      .map(pad)
      .join(':');
  }

  const text = String(value ?? '').trim();
  const clock = /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\s*([AP]M))?$/i.exec(text);
  if (!clock) return text;
  let hour = Number(clock[1]);
  if (clock[4]) {
    if (hour < 1 || hour > 12) return text;
    hour = (hour % 12) + (clock[4].toUpperCase() === 'PM' ? 12 : 0);
  }
  return `${pad(hour)}:${clock[2]}:${clock[3] ?? '00'}`;
}

function readAttendance(buffer: ArrayBuffer) {
  const workbook = read(buffer, { type: 'array', sheets: 0, cellNF: true, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.['!ref']) throw new Error('Sheet pertama kosong.');
  const range = utils.decode_range(sheet['!ref']);
  if (range.e.r - range.s.r > 20_000 || range.e.c - range.s.c > 200) {
    throw new Error('File Excel melebihi batas 20.000 baris atau 200 kolom.');
  }

  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true });
  const headings = rows.map(row =>
    row.map(value =>
      String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    )
  );
  const headerIndex = headings.findIndex(
    row =>
      row.some(value => aliases.employeeId.includes(value)) &&
      row.some(value => aliases.employeeName.includes(value)) &&
      row.some(value => aliases.date.includes(value))
  );
  if (headerIndex < 0) throw new Error('Header Excel harus memuat ID Pegawai, Nama, dan Tanggal.');

  const header = headings[headerIndex];
  const columns = new Map(
    fields.map(({ key }) => [key, header.findIndex(value => aliases[key].includes(value))])
  );
  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  return rows.slice(headerIndex + 1).flatMap((row, index) => {
    const column = (key: (typeof fields)[number]['key']) => columns.get(key) ?? -1;
    const get = (key: (typeof fields)[number]['key']) => row[column(key)];
    if (fields.every(({ key }) => String(get(key) ?? '').trim() === '')) return [];
    try {
      const data = attendanceInput(key => {
        const indexInSheet = column(key);
        const cell =
          indexInSheet < 0
            ? undefined
            : sheet[
                utils.encode_cell({
                  r: range.s.r + headerIndex + index + 1,
                  c: range.s.c + indexInSheet,
                })
              ];
        // Read the original date/time serial before sheet_to_json applies timezone conversion.
        const value = key === 'date' || key === 'time' ? (cell?.v ?? get(key)) : get(key);
        if (key === 'date') return excelDate(value, date1904);
        if (key === 'time') return excelTime(value);
        if (key === 'employeeId') {
          if (typeof value === 'number' && !Number.isSafeInteger(value)) {
            throw new Error('Simpan ID Pegawai sebagai teks di Excel agar digitnya tetap utuh.');
          }
          if (typeof value === 'number' && /^0+$/.test(cell?.z ?? '')) return cell.w ?? value;
        }
        return value;
      });
      if (!data.employeeId || !data.employeeName || !data.attendanceDate) {
        throw new Error('Isi ID Pegawai, Nama, dan Tanggal.');
      }
      return [data];
    } catch (error) {
      throw new Error(
        `Baris ${range.s.r + headerIndex + index + 2}: ${error instanceof Error ? error.message : 'Data tidak valid.'}`
      );
    }
  });
}

function scanKey(scan: {
  employeeId: string | null;
  attendanceDate: Date | null;
  scanTime: Date | null;
  attendanceType: string | null;
}) {
  return JSON.stringify([
    scan.employeeId?.trim() ?? '',
    scan.attendanceDate?.toISOString().slice(0, 10) ?? '',
    scan.scanTime?.toISOString().slice(11, 19) ?? '',
    scan.attendanceType?.trim().toLowerCase() ?? '',
  ]);
}

export async function POST(request: Request) {
  let groupName: string;
  let destinationId: bigint | null = null;
  let logs: ReturnType<typeof readAttendance>;
  try {
    const form = await request.formData();
    groupName = String(form.get('periodName') ?? '').trim();
    const file = form.get('file');
    const mode = form.get('mode') ?? 'new';
    if (mode === 'append') {
      destinationId = databaseId(String(form.get('periodId') ?? ''));
      if (!destinationId) throw new Error('Pilih periode tujuan.');
    } else if (mode !== 'new') {
      throw new Error('Tujuan impor tidak valid.');
    } else if (!groupName || groupName.length > 150) {
      throw new Error('Masukkan nama periode maksimal 150 karakter.');
    }
    if (!(file instanceof File) || !/\.(xlsx|xls)$/i.test(file.name) || !file.size)
      throw new Error('Pilih file Excel .xlsx atau .xls yang berisi data.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran file Excel maksimal 10 MB.');
    const buffer = await file.arrayBuffer();
    const signature = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
    const isZip = signature[0] === 0x50 && signature[1] === 0x4b;
    const isOle = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every(
      (byte, index) => signature[index] === byte
    );
    if (!isZip && !isOle) throw new Error('Isi file tidak sesuai format Excel.');
    logs = readAttendance(buffer);
    if (!logs.length) throw new Error('File Excel belum berisi data absensi.');
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'File Excel tidak dapat dibaca.' },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async transaction => {
        let dataGroupId: bigint;
        let newLogs = logs;
        let newEmployeeCount = new Set(logs.map(log => log.employeeId)).size;
        if (destinationId !== null) {
          // Serialize uploads into the same period so retries cannot insert the same scan twice.
          const groups = await transaction.$queryRaw<{ id: bigint }[]>`
            SELECT id FROM data_groups WHERE id = ${destinationId} FOR UPDATE
          `;
          if (!groups.length) return null;
          dataGroupId = destinationId;
          const existing = await transaction.attendanceLog.findMany({
            where: { dataGroupId },
            select: {
              employeeId: true,
              attendanceDate: true,
              scanTime: true,
              attendanceType: true,
            },
          });
          const employeeIds = new Set(existing.map(log => log.employeeId));
          const scanned = new Set(existing.map(scanKey));
          newLogs = logs.filter(log => {
            const key = scanKey(log);
            if (scanned.has(key)) return false;
            scanned.add(key);
            return true;
          });
          newEmployeeCount = new Set(
            newLogs.filter(log => !employeeIds.has(log.employeeId)).map(log => log.employeeId)
          ).size;
        } else {
          const group = await transaction.dataGroup.create({ data: { groupName } });
          dataGroupId = group.id;
        }

        for (let offset = 0; offset < newLogs.length; offset += 1000) {
          await transaction.attendanceLog.createMany({
            data: newLogs.slice(offset, offset + 1000).map(log => ({ ...log, dataGroupId })),
          });
        }
        return {
          id: String(dataGroupId),
          count: newLogs.length,
          skipped: logs.length - newLogs.length,
          newEmployeeCount,
        };
      },
      { timeout: 30_000 }
    );
    if (!result)
      return Response.json({ error: 'Periode tujuan tidak ditemukan.' }, { status: 404 });
    revalidatePath('/periode-absensi', 'layout');
    return Response.json(result, { status: destinationId === null ? 201 : 200 });
  } catch (error) {
    console.error('Gagal menyimpan impor absensi', error);
    return Response.json({ error: 'Data absensi gagal disimpan.' }, { status: 500 });
  }
}
