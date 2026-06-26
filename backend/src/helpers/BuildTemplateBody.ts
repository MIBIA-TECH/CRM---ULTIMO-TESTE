import QuickMessage from "../models/QuickMessage";
import QuickMessageComponent from "../models/QuickMessageComponent";
import Ticket from "../models/Ticket";
import formatBody from "./Mustache";
import logger from "../utils/logger";

/**
 * Reconstrói o texto do template com variáveis e botões para salvar no banco de dados.
 * 
 * @param templateMetaId ID do template (QuickMessage) no banco
 * @param templateComponents Componentes de template enviados no agendamento
 * @param templateName Nome do template (fallback)
 * @param ticket O Ticket correspondente para processar variáveis do Mustache (nome do contato, etc)
 */
export const buildTemplateBody = async (
  templateMetaId: string | number,
  templateComponents: any[],
  templateName: string,
  ticket?: Ticket
): Promise<string> => {
  try {
    let componentsToUse = templateComponents || [];

    // Tentar carregar o template local do banco de dados para obter o texto original caso o templateComponents esteja vazio
    let dbTemplate: QuickMessage | null = null;
    if (templateMetaId) {
      const templateId = parseInt(String(templateMetaId), 10);
      if (!isNaN(templateId)) {
        dbTemplate = await QuickMessage.findByPk(templateId, {
          include: [{ model: QuickMessageComponent, as: "components" }]
        });
      }
    }

    let headerText = "";
    let bodyText = "";
    let footerText = "";
    let buttonsList: any[] = [];

    // 1. Tentar mapear a partir do banco de dados (tabela de componentes)
    if (dbTemplate && Array.isArray(dbTemplate.components)) {
      dbTemplate.components.forEach((comp) => {
        const type = String(comp.type).toUpperCase();
        if (type === "BODY") {
          bodyText = comp.text || "";
        } else if (type === "HEADER" && comp.format === "TEXT") {
          headerText = comp.text || "";
        } else if (type === "FOOTER") {
          footerText = comp.text || "";
        } else if (type === "BUTTONS" && comp.buttons) {
          try {
            buttonsList = JSON.parse(comp.buttons);
          } catch (e) {
            // Ignora erro de parse de botões
          }
        }
      });
    }

    // 2. Se os textos ainda estiverem vazios, usar o templateComponents enviado no agendamento
    if (!bodyText && Array.isArray(componentsToUse)) {
      componentsToUse.forEach((comp) => {
        const type = String(comp.type).toUpperCase();
        if (type === "BODY") {
          bodyText = comp.text || "";
        } else if (type === "HEADER" && comp.format === "TEXT") {
          headerText = comp.text || "";
        } else if (type === "FOOTER") {
          footerText = comp.text || "";
        }
      });
    }

    // 3. Substituir os placeholders {{1}}, {{2}}... pelos parâmetros fornecidos no agendamento
    if (Array.isArray(componentsToUse)) {
      componentsToUse.forEach((comp) => {
        const type = String(comp.type).toUpperCase();
        
        if (Array.isArray(comp.parameters) && comp.parameters.length > 0) {
          comp.parameters.forEach((param: any, index: number) => {
            const placeholder = `{{${index + 1}}}`;
            let paramValue = "";

            if (param.type === "text" && param.text) {
              paramValue = param.text;
            } else if (param.type === "coupon_code" && param.coupon_code) {
              paramValue = param.coupon_code;
            } else if (param.type === "image" && param.image && param.image.link) {
              paramValue = param.image.link;
            } else if (param.type === "video" && param.video && param.video.link) {
              paramValue = param.video.link;
            } else if (param.type === "document" && param.document && param.document.link) {
              paramValue = param.document.link;
            }

            // Aplicar Mustache no parâmetro se tiver ticket (para preencher variáveis como {{name}})
            if (ticket && paramValue) {
              paramValue = formatBody(paramValue, ticket);
              
              // Fallback manual se o formatBody retornar vazio
              if (!paramValue || paramValue.trim() === "") {
                paramValue = (param.text || "")
                  .replace(/\{\{\s*name\s*\}\}/g, ticket.contact?.name || "")
                  .replace(/\{\{\s*firstName\s*\}\}/g, ticket.contact?.name ? ticket.contact.name.split(" ")[0] : "")
                  .replace(/\{\{\s*ticket_id\s*\}\}/g, ticket.id?.toString() || "");
              }
            }

            if (type === "BODY") {
              bodyText = bodyText.replace(placeholder, paramValue);
            } else if (type === "HEADER") {
              headerText = headerText.replace(placeholder, paramValue);
            }
          });
        }
      });
    }

    // 4. Substituir variáveis tipo Mustache (ex: {{name}}) no texto principal se houver
    if (ticket) {
      if (headerText) headerText = formatBody(headerText, ticket);
      if (bodyText) bodyText = formatBody(bodyText, ticket);
      if (footerText) footerText = formatBody(footerText, ticket);
    }

    // 5. Juntar cabeçalho, corpo e rodapé em uma string amigável
    let fullBody = "";
    if (headerText) {
      fullBody += `${headerText}\n\n`;
    }
    if (bodyText) {
      fullBody += bodyText;
    } else {
      fullBody += `📋 Template: ${templateName}`;
    }
    if (footerText) {
      fullBody += `\n\n${footerText}`;
    }

    // 6. Concatenar botões no formato que o frontend espera (separados por '||||')
    if (buttonsList && buttonsList.length > 0) {
      fullBody += `||||${JSON.stringify(buttonsList)}`;
    }

    return fullBody;
  } catch (error: any) {
    logger.error(`[BuildTemplateBody] Erro ao construir corpo do template: ${error.message}`);
    return `📋 Template: ${templateName}`;
  }
};
