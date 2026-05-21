// CSV export helper — raporlardan veri indirme.
// Excel uyumlu (UTF-8 BOM) + virgül escape + tırnak işareti güvenliği.

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/**
 * Veriyi CSV string'e çevir.
 */
export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (val: string | number): string => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerRow = columns.map((c) => escape(c.header)).join(',');
  const dataRows = rows.map((row) =>
    columns.map((c) => escape(c.accessor(row))).join(','),
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * CSV dosyasını tarayıcıdan indir.
 * filename otomatik olarak tarih ekler.
 */
export function downloadCsv(csv: string, filenameBase: string): void {
  // Excel UTF-8 BOM
  const BOM = '﻿';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameBase}_${date}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * One-shot: veri + kolonlar → CSV indir.
 */
export function exportToCsv<T>(rows: T[], columns: CsvColumn<T>[], filenameBase: string): void {
  const csv = buildCsv(rows, columns);
  downloadCsv(csv, filenameBase);
}
