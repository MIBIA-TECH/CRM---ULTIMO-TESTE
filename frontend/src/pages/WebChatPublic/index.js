import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import socketIOClient from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import {
  makeStyles,
  Paper,
  InputBase,
  IconButton,
  Typography,
  Avatar,
  CircularProgress,
  Dialog,
  DialogContent
} from "@material-ui/core";
import SendIcon from "@material-ui/icons/Send";
import ChatIcon from "@material-ui/icons/Chat";
import CloudDownloadIcon from "@material-ui/icons/GetApp";
import SignalCellularConnectedNoInternet0BarIcon from "@material-ui/icons/SignalCellularConnectedNoInternet0Bar";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: "#f0f2f5",
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(2),
    [theme.breakpoints.down("xs")]: {
      padding: 0
    }
  },
  container: {
    width: "100%",
    maxWidth: "500px",
    height: "90vh",
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    [theme.breakpoints.down("xs")]: {
      height: "100vh",
      borderRadius: 0
    }
  },
  header: {
    backgroundColor: "#1976d2",
    color: "#fff",
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(0,0,0,0.08)"
  },
  headerInfo: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5)
  },
  headerText: {
    display: "flex",
    flexDirection: "column"
  },
  onlineIndicatorWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "5px"
  },
  onlineDot: {
    width: "8px",
    height: "8px",
    backgroundColor: "#4caf50",
    borderRadius: "50%",
    boxShadow: "0 0 0 0 rgba(76, 175, 80, 0.7)",
    animation: "$pulse 1.5s infinite"
  },
  "@keyframes pulse": {
    "0%": {
      transform: "scale(0.95)",
      boxShadow: "0 0 0 0 rgba(76, 175, 80, 0.7)"
    },
    "70%": {
      transform: "scale(1)",
      boxShadow: "0 0 0 6px rgba(76, 175, 80, 0)"
    },
    "100%": {
      transform: "scale(0.95)",
      boxShadow: "0 0 0 0 rgba(76, 175, 80, 0)"
    }
  },
  chatArea: {
    flex: 1,
    padding: theme.spacing(2.5),
    backgroundColor: "#f5f7fb",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    position: "relative"
  },
  message: {
    maxWidth: "80%",
    padding: "10px 14px",
    borderRadius: "12px",
    fontSize: "0.95rem",
    lineHeight: 1.4,
    position: "relative",
    wordBreak: "break-word",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  },
  sent: {
    alignSelf: "flex-end",
    backgroundColor: "#e3f2fd",
    color: "#0d47a1",
    borderBottomRightRadius: "2px"
  },
  received: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    color: "#333",
    borderBottomLeftRadius: "2px"
  },
  messageMeta: {
    fontSize: "0.68rem",
    color: "rgba(0,0,0,0.45)",
    marginTop: "4px",
    textAlign: "right"
  },
  mediaImage: {
    maxWidth: "100%",
    maxHeight: "200px",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: theme.spacing(0.5)
  },
  mediaAudio: {
    width: "100%",
    marginTop: theme.spacing(0.5),
    outline: "none"
  },
  mediaDoc: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    color: "inherit",
    textDecoration: "none",
    padding: theme.spacing(1),
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: "6px",
    marginTop: theme.spacing(0.5),
    "&:hover": {
      backgroundColor: "rgba(0,0,0,0.08)"
    }
  },
  systemLog: {
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "0.8rem",
    color: "#555",
    textAlign: "center",
    maxWidth: "90%"
  },
  systemLogError: {
    backgroundColor: "#ffebee",
    color: "#c62828"
  },
  inputArea: {
    padding: theme.spacing(1.5),
    borderTop: "1px solid rgba(0,0,0,0.08)",
    display: "flex",
    gap: theme.spacing(1.5),
    backgroundColor: "#fff",
    alignItems: "center"
  },
  inputWrapper: {
    flex: 1,
    border: "1px solid #ccc",
    borderRadius: "24px",
    padding: "6px 16px",
    display: "flex",
    alignItems: "center",
    backgroundColor: "#fff",
    "&:focus-within": {
      borderColor: "#1976d2"
    }
  },
  input: {
    flex: 1,
    fontSize: "0.95rem"
  },
  sendButton: {
    backgroundColor: "#1976d2",
    color: "#fff",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "opacity 0.2s",
    "&:hover": {
      backgroundColor: "#115293",
      opacity: 0.9
    },
    "&:disabled": {
      backgroundColor: "#ccc",
      color: "#fff"
    }
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%"
  },
  errorPage: {
    textAlign: "center",
    padding: theme.spacing(4),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(2)
  }
}));

const WebChatPublic = () => {
  const classes = useStyles();
  const { companyId } = useParams();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const socketRef = useRef(null);
  const chatEndRef = useRef(null);
  const allowedCompanies = ["2", "6"];

  useEffect(() => {
    // 1. Validar se a empresa é permitida
    if (!allowedCompanies.includes(String(companyId))) {
      setErrorMsg("Este canal de WebChat não está disponível para esta empresa.");
      setLoading(false);
      return;
    }

    // 2. Obter ou gerar o UUID do visitante
    const storageKey = `webchat_visitor_uuid_${companyId}`;
    let visitorUuid = localStorage.getItem(storageKey);
    if (!visitorUuid) {
      visitorUuid = `wbc_${uuidv4().replace(/-/g, "")}`;
      localStorage.setItem(storageKey, visitorUuid);
    }

    // 3. Inicializar a conexão Socket.io
    const backendUrl = api.defaults.baseURL;
    socketRef.current = socketIOClient(`${backendUrl}/webchat-client`, {
      query: {
        companyId,
        visitorUuid
      },
      transports: ["websocket", "polling"]
    });

    socketRef.current.on("connect", () => {
      setConnected(true);
      setLoading(false);
      setErrorMsg("");
    });

    socketRef.current.on("history", (historyMessages) => {
      setMessages(historyMessages);
    });

    socketRef.current.on("message", (data) => {
      if (data.action === "create" && data.message) {
        setMessages((prev) => {
          // Evitar mensagens duplicadas
          if (prev.some((m) => m.id === data.message.id)) {
            return prev;
          }
          return [...prev, data.message];
        });
      }
    });

    socketRef.current.on("auth_error", (data) => {
      setErrorMsg(data.message || "Acesso negado.");
      setLoading(false);
    });

    socketRef.current.on("disconnect", () => {
      setConnected(false);
    });

    socketRef.current.on("connect_error", () => {
      setConnected(false);
      setLoading(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [companyId]);

  // Rolar até o final sempre que chegarem novas mensagens
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !socketRef.current || !connected) return;

    setInputText("");

    socketRef.current.emit("message", { body: text }, (res) => {
      if (!res || !res.ok) {
        console.error("Erro ao enviar mensagem:", res?.error);
        setInputText(text);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const renderMedia = (msg) => {
    if (!msg.mediaUrl) return null;

    if (msg.mediaType === "image" || (msg.mediaType && msg.mediaType.startsWith("image/"))) {
      return (
        <img
          src={msg.mediaUrl}
          alt="Imagem enviada"
          className={classes.mediaImage}
          onClick={() => setSelectedImage(msg.mediaUrl)}
        />
      );
    }

    if (msg.mediaType === "audio" || (msg.mediaType && msg.mediaType.startsWith("audio/"))) {
      return (
        <audio controls className={classes.mediaAudio}>
          <source src={msg.mediaUrl} type="audio/ogg" />
          <source src={msg.mediaUrl} type="audio/mpeg" />
          <source src={msg.mediaUrl} type="audio/wav" />
          Seu navegador não suporta player de áudio.
        </audio>
      );
    }

    // Outras mídias / documentos
    return (
      <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className={classes.mediaDoc}>
        <CloudDownloadIcon fontSize="small" />
        <Typography variant="body2" noWrap style={{ maxWidth: "200px" }}>
          {msg.body || "Download Arquivo"}
        </Typography>
      </a>
    );
  };

  if (errorMsg) {
    return (
      <div className={classes.root}>
        <Paper className={classes.container}>
          <div className={classes.errorPage}>
            <SignalCellularConnectedNoInternet0BarIcon color="error" style={{ fontSize: 48 }} />
            <Typography variant="h6" color="error">
              Falha de Conexão
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {errorMsg}
            </Typography>
          </div>
        </Paper>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <Paper className={classes.container}>
        {/* Cabeçalho */}
        <div className={classes.header}>
          <div className={classes.headerInfo}>
            <Avatar style={{ backgroundColor: "#fff", color: "#1976d2" }}>
              <ChatIcon />
            </Avatar>
            <div className={classes.headerText}>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                Atendimento Online
              </Typography>
              <div className={classes.onlineIndicatorWrapper}>
                {connected ? (
                  <>
                    <div className={classes.onlineDot}></div>
                    <Typography variant="caption">Online</Typography>
                  </>
                ) : (
                  <Typography variant="caption" style={{ color: "#ffebee" }}>
                    Conectando...
                  </Typography>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Área de Chat */}
        <div className={classes.chatArea}>
          {loading ? (
            <div className={classes.loadingContainer}>
              <CircularProgress />
            </div>
          ) : (
            <>
              {messages.length === 0 && (
                <div className={classes.systemLog}>
                  Olá! Digite sua dúvida abaixo para iniciar o atendimento.
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${classes.message} ${msg.fromMe ? classes.received : classes.sent}`}
                >
                  {/* Se for apenas texto */}
                  {msg.mediaType === "extendedTextMessage" || !msg.mediaType ? (
                    <Typography variant="body2">{msg.body}</Typography>
                  ) : (
                    // Se for mídia, renderiza player ou imagem e um subtítulo se houver
                    <>
                      {renderMedia(msg)}
                      {msg.body && msg.body !== msg.mediaUrl && (
                        <Typography variant="body2" style={{ marginTop: "4px" }}>
                          {msg.body}
                        </Typography>
                      )}
                    </>
                  )}
                  <div className={classes.messageMeta}>
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Área de Input */}
        <div className={classes.inputArea}>
          <div className={classes.inputWrapper}>
            <InputBase
              className={classes.input}
              placeholder={connected ? "Digite uma mensagem..." : "Conectando ao atendimento..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!connected || loading}
              multiline
              maxRows={3}
            />
          </div>
          <IconButton
            className={classes.sendButton}
            onClick={handleSend}
            disabled={!connected || !inputText.trim() || loading}
          >
            <SendIcon style={{ fontSize: "1.2rem" }} />
          </IconButton>
        </div>
      </Paper>

      {/* Modal para Visualização de Imagem em Tela Cheia */}
      <Dialog
        open={Boolean(selectedImage)}
        onClose={() => setSelectedImage(null)}
        maxWidth="md"
      >
        <DialogContent style={{ padding: 0, overflow: "hidden" }}>
          <img
            src={selectedImage}
            alt="Imagem expandida"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebChatPublic;
