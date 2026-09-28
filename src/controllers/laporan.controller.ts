import { Request, Response } from "express";
import { buildExportWorkbook, sendXlsx } from "../utils/excel";
import { ApiError } from "../middlewares/errorHandler";

export const laporanController = {
  async exportXlsx(req: Request, res: Response) {
    const { sheetName, headers, rows, filename } = req.body as {
      sheetName?: string;
      headers?: string[];
      rows?: (string | number)[][];
      filename?: string;
    };
    if (!Array.isArray(headers) || headers.length === 0) throw new ApiError(400, "headers wajib diisi");
    if (!Array.isArray(rows)) throw new ApiError(400, "rows wajib diisi");

    const buffer = buildExportWorkbook((sheetName || "Laporan").slice(0, 31), headers, rows);
    sendXlsx(res, buffer, filename || "laporan.xlsx");
  },
};
