import Campaign from "../../models/Campaign";
import { campaignQueue } from "../../queues";
import { CheckCampaignLimit } from "../../helpers/CheckCampaignLimit";
import AppError from "../../errors/AppError";

export async function RestartService(id: number) {
  const campaign = await Campaign.findByPk(id);
  
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  const campaignDate = campaign.nextScheduledAt || campaign.scheduledAt;
  const isLimitReached = await CheckCampaignLimit(campaign.companyId, campaignDate, campaign.id);
  if (isLimitReached) {
    throw new AppError("Já existem 4 campanhas ativas para este dia. O limite é de 4 envios simultâneos.", 400);
  }

  await campaign.update({ status: "EM_ANDAMENTO" });

  await campaignQueue.add("ProcessCampaign", {
    id: campaign.id,
    delay: 3000
  });
}
