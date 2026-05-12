import Whatsapp from "../../models/Whatsapp";
import { UpdateConnectionWhatsAppOficial } from "../../libs/whatsAppOficial/whatsAppOficial.service";
import logger from "../../utils/logger";

const SyncOfficialConnectionsService = async (): Promise<void> => {
  const whatsapps = await Whatsapp.findAll({
    where: {
      channel: "whatsapp_oficial",
      status: "CONNECTED"
    }
  });

  for (const whatsapp of whatsapps) {
    try {
      if (whatsapp.waba_webhook_id) {
        await UpdateConnectionWhatsAppOficial(whatsapp.waba_webhook_id, {
          token_mult100: whatsapp.token,
          phone_number_id: whatsapp.phone_number_id,
          waba_id: whatsapp.waba_id,
          send_token: whatsapp.send_token,
          business_id: whatsapp.business_id,
          phone_number: whatsapp.phone_number
        });
        logger.info(`[SYNC-OFICIAL] Conexão ${whatsapp.name} sincronizada automaticamente.`);
      }
    } catch (error) {
      logger.error(`[SYNC-OFICIAL] Erro na sincronização automática de ${whatsapp.name}: ${error.message}`);
    }
  }
};

export default SyncOfficialConnectionsService;
