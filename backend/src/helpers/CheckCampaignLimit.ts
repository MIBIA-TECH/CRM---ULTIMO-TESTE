import { Op, fn, col, where } from "sequelize";
import moment from "moment";
import Campaign from "../models/Campaign";

/**
 * Verifica se a empresa atingiu o limite de 4 campanhas em andamento para um determinado dia.
 * Retorna true se o limite de 4 campanhas em andamento foi atingido.
 */
export async function CheckCampaignLimit(
  companyId: number,
  scheduledAt: Date | string | null | undefined,
  excludeCampaignId?: number
): Promise<boolean> {
  const targetDateStr = scheduledAt
    ? moment(scheduledAt).format("YYYY-MM-DD")
    : moment().format("YYYY-MM-DD");

  const whereCondition: any = {
    companyId,
    status: "EM_ANDAMENTO",
    [Op.or]: [
      where(
        fn("date", col("scheduledAt")),
        "=",
        targetDateStr
      ),
      where(
        fn("date", col("nextScheduledAt")),
        "=",
        targetDateStr
      )
    ]
  };

  if (excludeCampaignId) {
    whereCondition.id = { [Op.ne]: excludeCampaignId };
  }

  const count = await Campaign.count({
    where: whereCondition
  });

  return count >= 4;
}
