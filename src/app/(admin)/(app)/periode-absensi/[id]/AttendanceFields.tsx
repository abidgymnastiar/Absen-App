import { fields, type Attendance } from './attendanceData';

export default function AttendanceFields({
  record,
  required = false,
}: {
  record?: Attendance;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(({ key, label, type, maxLength }) => (
        <label key={key} className="space-y-1 text-sm">
          <span>{label}</span>
          <input
            className="form-input"
            name={key}
            type={type}
            maxLength={maxLength}
            defaultValue={record?.[key] ?? ''}
            required={required && ['employeeId', 'employeeName', 'date'].includes(key)}
            step={type === 'time' ? 1 : undefined}
          />
        </label>
      ))}
    </div>
  );
}
