import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import CreateContactService from "./CreateContactService";
import logger from "../../utils/logger";
import { ENABLE_LID_DEBUG } from "../../config/debug";

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  companyId: number;
  email?: string;
  acceptAudioMessage?: boolean;
  active?: boolean;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
}

const GetContactService = async ({
  name,
  number,
  companyId
}: Request): Promise<Contact> => {
  // if (ENABLE_LID_DEBUG) {
  //   logger.info(
  //     `[RDS-LID] Buscando contato: number=${number}, companyId=${companyId}`
  //   );
  // }
  
  // Conciliação de 9º dígito (Brasil)
  const numbersToSearch = [number];
  if (number.startsWith("55")) {
    if (number.length === 13 && number[4] === "9") {
      const numberWithoutNine = number.slice(0, 4) + number.slice(5);
      numbersToSearch.push(numberWithoutNine);
    } else if (number.length === 12) {
      const numberWithNine = number.slice(0, 4) + "9" + number.slice(4);
      numbersToSearch.push(numberWithNine);
    }
  }

  const numberExists = await Contact.findOne({
    where: {
      number: { [Op.in]: numbersToSearch },
      companyId
    }
  });

  if (!numberExists) {
    // logger.info(
    //   `[RDS-LID] Contato não encontrado, criando novo: number=${number}`
    // );
    const contact = await CreateContactService({
      name,
      number,
      companyId
    });

    if (contact == null) throw new AppError("CONTACT_NOT_FIND");
    else {
      if (ENABLE_LID_DEBUG) {
        logger.info(
          `[RDS-LID] Novo contato criado: id=${contact.id}, number=${contact.number}, jid=${contact.remoteJid}, lid=${contact.lid}`
        );
      }
      return contact;
    }
  }
  // if (ENABLE_LID_DEBUG) {
  //   logger.info(
  //     `[RDS-LID] Contato encontrado: id=${numberExists.id}, number=${numberExists.number}, jid=${numberExists.remoteJid}, lid=${numberExists.lid}`
  //   );
  // }
  return numberExists;
};

export default GetContactService;
