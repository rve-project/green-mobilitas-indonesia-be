import * as XLSX from "xlsx";
import { Response } from "express";

const INSTRUCTION_MARKER = "[";

export function hasSheet(buffer: Buffer, sheetName: string): boolean {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames.includes(sheetName);
}

export function parseSheetRows(buffer: Buffer, sheetName?: string): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const name = sheetName && workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .map((row) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[key.trim()] = String(value ?? "").trim();
      }
      return normalized;
    })
    .filter((row) => {
      const values = Object.values(row);
      const isInstructionRow = values.every((v) => !v || v.startsWith(INSTRUCTION_MARKER));
      const isEmptyRow = values.every((v) => !v);
      return !isInstructionRow && !isEmptyRow;
    });
}

export function buildTemplateWorkbook(sheetName: string, headers: string[], instructions: string[]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, instructions]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildExportWorkbook(sheetName: string, headers: string[], rows: (string | number)[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function buildMultiSheetWorkbook(sheets: { name: string; headers: string[]; rows: (string | number)[][] }[]): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]), sheet.name);
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function sendXlsx(res: Response, buffer: Buffer, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportSummary {
  created: number;
  updated?: number;
  failed: number;
  errors: ImportRowError[];
}
