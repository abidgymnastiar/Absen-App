export const overtimeLabels = {
  L: 'Lembur (L)',
  LB: 'Lembur Biasa (LB)',
} as const;

export type OvertimeType = keyof typeof overtimeLabels;

export type AttendanceOvertime = {
  employeeId: string;
  date: string;
  type: OvertimeType;
  minutes: number;
};
