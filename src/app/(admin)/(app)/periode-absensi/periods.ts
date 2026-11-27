export type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  start: string;
  end: string;
  status: 'Aktif' | 'Dijadwalkan' | 'Ditutup' | 'Kosong';
};
