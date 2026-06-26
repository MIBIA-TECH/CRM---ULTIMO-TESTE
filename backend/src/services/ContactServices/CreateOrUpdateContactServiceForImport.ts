import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import { Op } from "sequelize";

interface ExtraInfo {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  commandBot?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  companyId: number;
  whatsappId?: number;
  empresa?: string;
  cpf?: string;
}

const CreateOrUpdateContactServiceForImport = async ({
  name,
  number: rawNumber,
  profilePicUrl,
  isGroup,
  email = "",
  commandBot = "",
  extraInfo = [],
  companyId,
  whatsappId,
  empresa = "",
  cpf = ""
}: Request): Promise<Contact> => {
  // Normalizar número de telefone para evitar duplicações com formatos diferentes
  const number = isGroup ? rawNumber : rawNumber.replace(/[^0-9]/g, "");
  
  const io = getIO();
  let contact: Contact | null;

  try {
    // Buscar contato existente com conciliação do 9º dígito (Brasil)
    const numbersToSearch = [number];

    if (!isGroup && number.startsWith("55")) {
      if (number.length === 13 && number[4] === "9") {
        const numberWithoutNine = number.slice(0, 4) + number.slice(5);
        numbersToSearch.push(numberWithoutNine);
      } else if (number.length === 12) {
        const numberWithNine = number.slice(0, 4) + "9" + number.slice(4);
        numbersToSearch.push(numberWithNine);
      }
    }

    contact = await Contact.findOne({
      where: {
        number: { [Op.in]: numbersToSearch },
        companyId
      }
    });

    if (contact) {
      // Atualizar contato existente
      if (contact.companyId === null) {
        await contact.update({ 
          name, 
          profilePicUrl, 
          companyId,
          email: email || contact.email,
          whatsappId: whatsappId || contact.whatsappId,
          empresa: empresa || contact.empresa,
          cpf: cpf || contact.cpf
        });
      } else {
        await contact.update({ 
          name, 
          profilePicUrl,
          email: email || contact.email,
          whatsappId: whatsappId || contact.whatsappId,
          empresa: empresa || contact.empresa,
          cpf: cpf || contact.cpf
        });
      }

      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "update",
          contact
        });
    } else {
      // Criar novo contato
      contact = await Contact.create({
        name,
        companyId,
        number,
        profilePicUrl,
        email,
        commandBot,
        isGroup,
        extraInfo,
        whatsappId,
        empresa,
        cpf
      });

      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "create",
          contact
        });
    }

    return contact;
  } catch (error) {
    throw new Error(`Erro ao criar/atualizar contato: ${error.message}`);
  }
};

export default CreateOrUpdateContactServiceForImport;
