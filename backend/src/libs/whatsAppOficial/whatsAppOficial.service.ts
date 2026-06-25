import axios, { AxiosError } from "axios";
import { ICreateConnectionWhatsAppOficial, ICreateConnectionWhatsAppOficialWhatsApp, IDataCreateUserApiOficial, IPayloadAPIWhatsAppOficial, IResultTemplates, IReturnConnectionCreateAPIWhatsAppOficial, IReturnCreateCompanyAPIWhatsAppOficial, IReturnMessageMeta, ISendMessageOficial, IUpdateonnectionWhatsAppOficialWhatsApp, IUserApiOficial } from "./IWhatsAppOficial.interfaces";
import fs from 'fs';
import mime from "mime-types";
import FormData from "form-data";
import campaignLogger from "../../utils/campaignLogger";
import logger from "../../utils/logger";
import {
  withCircuitBreaker,
  isTransientError,
  CircuitOpenError,
  getCircuitStatus
} from "./circuitBreaker";

const useOficial = process.env.USE_WHATSAPP_OFICIAL;
const urlApi = process.env.URL_API_OFICIAL;
const token = process.env.TOKEN_API_OFICIAL;

/** Timeout por requisição — 15s para dar margem a uploads de mídia */
const REQUEST_TIMEOUT_MS = 15_000;

/** Configuração de retry: tentativas após a 1ª falha */
const RETRY_CONFIG = {
  maxRetries: 2,
  delaysMs: [1_000, 3_000], // Esperas entre tentativas
};

/**
 * Chave de circuit breaker derivada do token.
 * Usa os primeiros 15 caracteres para identificar a conexão sem expor o token completo.
 */
function getCircuitKey(token: string): string {
  return `whatsapp-oficial:${token.substring(0, 15)}`;
}

/**
 * Realiza a chamada HTTP de envio de mensagem para a API Oficial.
 * Função interna — sem retry ou circuit breaker (gerenciados pelo caller).
 */
async function doSendRequest(
  filePath: string,
  token: string,
  data: ISendMessageOficial
): Promise<IReturnMessageMeta> {
  const formData = new FormData();

  if (filePath) {
    const file = fs.readFileSync(filePath);
    const mimeType = mime.lookup(filePath);
    formData.append("file", file, {
      filename: filePath.split("/").pop(),
      contentType: mimeType || "application/octet-stream",
    });
  }

  formData.append("data", JSON.stringify(data));

  const res = await axios.post(
    `${urlApi}/v1/send-message-whatsapp/${token}`,
    formData,
    {
      headers: { ...formData.getHeaders() },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );

  if (res.status === 200 || res.status === 201) {
    return res.data as IReturnMessageMeta;
  }

  throw new Error("Falha em enviar a mensagem para a API da Meta");
}

/**
 * Envia mensagem via API Oficial do WhatsApp com:
 * - Circuit Breaker por conexão (token)
 * - Retry com backoff exponencial para erros transitórios
 * - Timeout configurável por requisição
 */
export const sendMessageWhatsAppOficial = async (
  filePath: string,
  token: string,
  data: ISendMessageOficial
): Promise<IReturnMessageMeta> => {
  const circuitKey = getCircuitKey(token);

  campaignLogger.apiRequest(
    "POST",
    `/v1/send-message-whatsapp/${token.substring(0, 10)}...`,
    { to: data.to, type: data.type, hasFile: !!filePath }
  );

  console.log("📋 [WHATSAPP-OFICIAL] Enviando mensagem:", JSON.stringify(data, null, 2));

  // Executa com Circuit Breaker (lança CircuitOpenError se estiver OPEN)
  return withCircuitBreaker(
    circuitKey,
    async () => {
      let lastError: Error | null = null;

      // Loop de retry (tentativa 0 = primeira chamada, tentativas 1..N = retries)
      for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = RETRY_CONFIG.delaysMs[attempt - 1] ?? 3_000;
            logger.info(
              `[WHATSAPP-OFICIAL] Retry ${attempt}/${RETRY_CONFIG.maxRetries} ` +
              `para ${data.to} em ${delay}ms...`
            );
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const result = await doSendRequest(filePath, token, data);

          campaignLogger.apiResponse(
            "POST",
            `/v1/send-message-whatsapp/${token.substring(0, 10)}...`,
            200,
            { status: "ok" }
          );

          return result;
        } catch (err) {
          const error = err as Error;
          lastError = error;
          const transient = isTransientError(err);

          // Erro de negócio (4xx) → não retenta, falha imediata
          if (!transient) {
            const metaDetail =
              (err as AxiosError<any>)?.response?.data?.error?.message ||
              (err as AxiosError<any>)?.response?.data?.message ||
              (err as AxiosError<any>)?.response?.data?.detail ||
              null;

            const msg = metaDetail
              ? `Meta API: ${metaDetail}`
              : `Mensagem não enviada para a meta: ${error.message}`;

            logger.error(`[WHATSAPP-OFICIAL] Erro de negócio (sem retry): ${msg}`);
            campaignLogger.error("Erro de negócio ao enviar mensagem (sem retry)", err, {
              to: data.to,
              type: data.type,
              response: (err as AxiosError<any>)?.response?.data,
            });

            throw new Error(msg);
          }

          // Erro transitório — loga e tenta novamente (se houver tentativas restantes)
          logger.warn(
            `[WHATSAPP-OFICIAL] Erro transitório na tentativa ${attempt + 1}` +
            `/${RETRY_CONFIG.maxRetries + 1}: ${error.message}`
          );
        }
      }

      // Todas as tentativas esgotadas
      campaignLogger.error("Timeout/rede após todas as tentativas", lastError, {
        to: data.to,
        type: data.type,
        apiUrl: urlApi,
      });

      logger.error(
        `[WHATSAPP-OFICIAL] Todas as ${RETRY_CONFIG.maxRetries + 1} tentativas falharam ` +
        `para ${data.to}. Último erro: ${lastError?.message}`
      );

      throw lastError ?? new Error("Falha ao enviar mensagem via API Oficial");
    }
  );
}

export const CreateCompanyConnectionOficial = async (data: ICreateConnectionWhatsAppOficial) => {
    try {

        const { company, whatsApp } = data;

        const companySaved = await CreateCompanyWhatsAppOficial(company.companyId, company.companyName);

        console.log(`Empresa: ${companySaved.id}`)

        const connection = await CreateConnectionWhatsAppOficial(whatsApp);

        console.log(`Conexão criada: ${JSON.stringify(connection)}`);

        const webhookLink = `${urlApi}/v1/webhook/${companySaved.id}/${connection.id}`;

        // salvar o webhook no banco? se for salvar tem que salvar o id da company e o da connection ou somente o link o token do webhook é do mult100
        return { webhookLink, connectionId: connection.id };

    } catch (error) {
        console.log(`CreateCompanyConnectionOficial: ${error.message}`);
        throw new Error(error.message || `Falha ao criar a empresa `);
    }
}

export const checkAPIOficial = async () => {
    try {

        if (!useOficial || !urlApi || !token) throw new Error('API oficial não configurada');

        const res = await axios.get(`${urlApi}`);

        if (res.status == 200 || res.status == 201) {
            console.log('API ONLINE')
            return res.data as string;
        }

        throw new Error('API Oficial não configurada ou esta offline');

    } catch (error) {
        console.log(`checkAPIOficial: ${error.message}`);
        throw new Error(error.message || `API não esta disponivel`);
    }
}

export const CreateCompanyWhatsAppOficial = async (companyId: string, companyName: string) => {
    try {

        const resCompanies = await axios.get(`${urlApi}/v1/companies`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const companies = resCompanies.data as Array<IReturnCreateCompanyAPIWhatsAppOficial>;

        const company = companies.find(c => String(c.idEmpresaMult100) == companyId);

        if (!!company) {
            console.log(`CreateCompanyWhatsAppOficial: data ${JSON.stringify(company)}`);
            return company
        }

        const res = await axios.post(`${urlApi}/v1/companies`, {
            idEmpresaMult100: +companyId,
            name: companyName
        },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IReturnCreateCompanyAPIWhatsAppOficial;
            console.log(`CreateCompanyWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error('Falha em criar a empresa na API Oficial do WhatsApp');

    } catch (error) {
        console.log(`CreateCompanyWhatsAppOficial: ${JSON.stringify(error?.response?.data)}`);
        throw new Error(error.message || `Não foi possível criar a empresa na API Oficial do WhatsApp`);
    }
}

export const CreateConnectionWhatsAppOficial = async (data: ICreateConnectionWhatsAppOficialWhatsApp) => {
    try {

        const res = await axios.post(`${urlApi}/v1/whatsapp-oficial`, { ...data },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IReturnConnectionCreateAPIWhatsAppOficial;
            console.log(`CreateConnectionWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em criar a empresa na API Oficial do WhatsApp');

    } catch (error) {
        console.log(`CreateConnectionWhatsAppOficial: ${JSON.stringify(error?.response?.data)}`);
        throw new Error(error.message || `Não foi possível criar a empresa na API Oficial do WhatsApp`);
    }
}

export const UpdateConnectionWhatsAppOficial = async (idWhatsApp: number, data: IUpdateonnectionWhatsAppOficialWhatsApp) => {
    try {
        console.log(`UpdateConnectionWhatsAppOficial ${idWhatsApp}: data ${JSON.stringify(data)}`);
        const res = await axios.put(`${urlApi}/v1/whatsapp-oficial/${idWhatsApp}`, { ...data },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IReturnConnectionCreateAPIWhatsAppOficial;
            console.log(`UpdateConnectionWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em criar a empresa na API Oficial do WhatsApp');

    } catch (error) {
        console.log(`UpdateConnectionWhatsAppOficial: ${JSON.stringify(error?.response?.data)}`);
        throw new Error(error.message || `Não foi possível atualizar a empresa na API Oficial do WhatsApp`);
    }
}

export const DeleteConnectionWhatsAppOficial = async (idWhatsapp: number) => {
    try {
        const res = await axios.delete(`${urlApi}/v1/whatsapp-oficial/${idWhatsapp}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IReturnConnectionCreateAPIWhatsAppOficial;
            console.log(`DeleteConnectionWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em criar a empresa na API Oficial do WhatsApp');

    } catch (error) {
        console.log(`DeleteConnectionWhatsAppOficial: ${JSON.stringify(error?.response?.data)}`);
        throw new Error(error.message || `Não foi possível deletar a empresa na API Oficial do WhatsApp`);
    }
}

export const getTemplatesWhatsAppOficial = async (multi100_token: string) => {
    try {
        console.log(`${urlApi}/v1/templates-whatsapp/${multi100_token}`)
        const res = await axios.get(`${urlApi}/v1/templates-whatsapp/${multi100_token}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IResultTemplates;
            console.log(`getTemplatesWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em listar os templates da API Oficial do WhatsApp');

    } catch (error) {
        console.log(`getTemplatesWhatsAppOficial: ${JSON.stringify(error?.response?.data)}`);
        throw new Error(error.message || `Falha em listar os templates da API Oficial do WhatsApp`);
    }
}

export const setReadMessageWhatsAppOficial = async (token: string, messageId: string) => {
    try {

        const res = await axios.post(`${urlApi}/v1/send-message-whatsapp/read-message/${token}/${messageId}`,

        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as { success: string };
            console.log(`setReadMessageWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em marcar a mensagem como lida API Oficial do WhatsApp');

    } catch (error) {
        console.log(`setReadMessageWhatsAppOficial: ${JSON.stringify(error?.response?.data)}`);
        throw new Error(error.message || `Falha em marcar a mensagem como lida API Oficial do WhatsApp`);
    }
}