import cron from "node-cron";
import fs from "fs";
import path from "path";
import Company from "../models/Company";
import GenerateBackupService from "../services/BackupService/GenerateBackupService";
import logger from "../utils/logger";

const publicFolder = path.resolve(__dirname, "..", "..", "public");
const BACKUP_RETENTION_DAYS = 15;

const cleanOldBackups = async (companyId: number): Promise<void> => {
  const backupDir = path.resolve(publicFolder, `company${companyId}`, "backups");

  if (!fs.existsSync(backupDir)) return;

  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const retentionMs = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const filePath = path.resolve(backupDir, file);
    const stat = fs.statSync(filePath);

    if (now - stat.mtimeMs > retentionMs) {
      fs.unlinkSync(filePath);
      logger.info(`Backup removed (older than ${BACKUP_RETENTION_DAYS} days): ${file}`);
    }
  }
};

const runDailyBackup = async (): Promise<void> => {
  logger.info("Starting daily message backup job...");

  try {
    const companies = await Company.findAll({
      where: { status: true },
      attributes: ["id"],
    });

    for (const company of companies) {
      try {
        await GenerateBackupService({ companyId: company.id });
        await cleanOldBackups(company.id);
      } catch (error) {
        logger.error(`Error generating backup for company ${company.id}:`, error);
      }
    }

    logger.info("Daily message backup job completed successfully");
  } catch (error) {
    logger.error("Error in daily message backup job:", error);
  }
};

export const startMessageBackupJob = (): void => {
  // Run daily at 02:00 AM (America/Sao_Paulo)
  cron.schedule("0 2 * * *", runDailyBackup, {
    timezone: "America/Sao_Paulo",
  });

  logger.info("Message backup cron job initialized - will run daily at 02:00 AM (America/Sao_Paulo)");
};

export default { startMessageBackupJob, runDailyBackup };
