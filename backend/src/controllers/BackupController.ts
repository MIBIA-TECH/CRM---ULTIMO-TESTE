import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import GenerateBackupService from "../services/BackupService/GenerateBackupService";
import AppError from "../errors/AppError";
import logger from "../utils/logger";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

interface BackupInfo {
  filename: string;
  type: "whatsapp" | "chat";
  date: string;
  size: number;
  sizeFormatted: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const extractDateFromFilename = (filename: string): string => {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
};

const extractTypeFromFilename = (filename: string): "whatsapp" | "chat" => {
  if (filename.startsWith("whatsapp_")) return "whatsapp";
  if (filename.startsWith("chat_")) return "chat";
  return "whatsapp";
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const backupDir = path.resolve(publicFolder, `company${companyId}`, "backups");

  if (!fs.existsSync(backupDir)) {
    return res.json([]);
  }

  const files = fs.readdirSync(backupDir);

  const backups: BackupInfo[] = files
    .filter((file) => file.endsWith(".csv"))
    .map((file) => {
      const filePath = path.resolve(backupDir, file);
      const stat = fs.statSync(filePath);
      return {
        filename: file,
        type: extractTypeFromFilename(file),
        date: extractDateFromFilename(file),
        size: stat.size,
        sizeFormatted: formatBytes(stat.size),
      };
    })
    .sort((a, b) => b.filename.localeCompare(a.filename));

  return res.json(backups);
};

export const download = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { filename } = req.params;

  // Prevent path traversal
  const sanitizedFilename = path.basename(filename);
  const backupDir = path.resolve(publicFolder, `company${companyId}`, "backups");
  const filePath = path.resolve(backupDir, sanitizedFilename);

  // Ensure the resolved path is within the backup directory
  if (!filePath.startsWith(backupDir)) {
    throw new AppError("Invalid file path", 400);
  }

  if (!fs.existsSync(filePath)) {
    throw new AppError("Backup file not found", 404);
  }

  res.download(filePath, sanitizedFilename);
  return res;
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { filename } = req.params;

  const sanitizedFilename = path.basename(filename);
  const backupDir = path.resolve(publicFolder, `company${companyId}`, "backups");
  const filePath = path.resolve(backupDir, sanitizedFilename);

  if (!filePath.startsWith(backupDir)) {
    throw new AppError("Invalid file path", 400);
  }

  if (!fs.existsSync(filePath)) {
    throw new AppError("Backup file not found", 404);
  }

  fs.unlinkSync(filePath);
  logger.info(`Backup deleted by user: ${sanitizedFilename} (company ${companyId})`);

  return res.status(200).json({ message: "Backup deleted successfully" });
};

export const generate = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { dateFrom, dateTo } = req.body;

  try {
    const files = await GenerateBackupService({
      companyId,
      dateFrom,
      dateTo,
    });

    const result = files.map((f) => ({
      filename: f.filename,
      type: f.type,
    }));

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error generating backup on demand:", error);
    throw new AppError("Error generating backup", 500);
  }
};

export default {
  index,
  download,
  remove,
  generate,
};
