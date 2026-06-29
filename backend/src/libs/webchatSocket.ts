import { Server as SocketIO, Socket } from "socket.io";
import logger from "../utils/logger";
import ReceiveWebChatMessageService from "../services/WebChatServices/ReceiveWebChatMessageService";

export const initWebChatSocket = (io: SocketIO): void => {
  const nsp = io.of("/webchat-client");

  nsp.on("connection", (socket: Socket) => {
    const { companyId, visitorUuid } = socket.handshake.query;

    logger.info(`WebChat Visitor connected: companyId=${companyId}, visitorUuid=${visitorUuid}`);

    // Validação de Tenant (Timbre): 2 ("Timbre") ou 6 ("Timbre Seleção")
    const allowedCompanyIds = [2, 6];
    if (!companyId || !allowedCompanyIds.includes(Number(companyId))) {
      logger.warn(`WebChat connection rejected: companyId ${companyId} not allowed`);
      socket.emit("auth_error", { message: "Access Denied: Company not allowed." });
      socket.disconnect();
      return;
    }

    if (!visitorUuid) {
      logger.warn("WebChat connection rejected: visitorUuid is missing");
      socket.emit("auth_error", { message: "Access Denied: visitorUuid is missing." });
      socket.disconnect();
      return;
    }

    // O visitante entra na sala correspondente ao seu próprio UUID
    const roomName = `visitor-${visitorUuid}`;
    socket.join(roomName);
    logger.info(`WebChat Visitor ${visitorUuid} joined room: ${roomName}`);

    // Ouvinte para mensagens enviadas pelo visitante
    socket.on("message", async (data: { body: string }, callback?: (response: any) => void) => {
      try {
        if (!data || !data.body || data.body.trim() === "") {
          if (callback) callback({ ok: false, error: "Message body cannot be empty" });
          return;
        }

        logger.info(`WebChat message received from visitor ${visitorUuid}: "${data.body}"`);

        // Invocar o serviço para receber a mensagem e criar/reabrir o ticket no CRM
        const message = await ReceiveWebChatMessageService({
          body: data.body,
          visitorUuid: String(visitorUuid),
          companyId: Number(companyId)
        });

        // Retornar os dados da mensagem criada para o widget do cliente
        if (callback) {
          callback({
            ok: true,
            message: {
              id: message.id,
              body: message.body,
              fromMe: message.fromMe,
              createdAt: message.createdAt,
              mediaType: message.mediaType,
              mediaUrl: message.mediaUrl
            }
          });
        }
      } catch (err: any) {
        logger.error(`Error processing WebChat message: ${err.message}`);
        if (callback) {
          callback({ ok: false, error: err.message || "Internal server error" });
        }
      }
    });

    socket.on("disconnect", () => {
      logger.info(`WebChat Visitor disconnected: visitorUuid=${visitorUuid}`);
    });
  });
};
