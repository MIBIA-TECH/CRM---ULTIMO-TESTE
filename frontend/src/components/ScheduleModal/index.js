// src/components/ScheduleModal/index.js

import React, { useState, useEffect, useContext, useRef, useMemo } from "react";

import * as Yup from "yup";
import { Formik, Form, Field, FieldArray } from "formik";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from "@material-ui/core";
import Autocomplete, {
  createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import moment from "moment";
import { AuthContext } from "../../context/Auth/AuthContext";
import { isArray, capitalize } from "lodash";
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import AttachFile from "@material-ui/icons/AttachFile";
import { head } from "lodash";
import ConfirmationModal from "../ConfirmationModal";
import MessageVariablesPicker from "../MessageVariablesPicker";
import useQueues from "../../hooks/useQueues";
import UserStatusIcon from "../UserModal/statusIcon";
import { Facebook, Instagram, WhatsApp, FlashOn } from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

// Schema base, será extendido dentro do componente com validação condicional
const baseScheduleSchema = Yup.object().shape({
  contactId: Yup.number().required("Obrigatório"),
  sendAt: Yup.string().required("Obrigatório"),
  reminderDate: Yup.string().nullable(),
  reminderMessage: Yup.string().nullable()
});

const ScheduleModal = ({
  open,
  onClose,
  scheduleId,
  contactId,
  cleanContact,
  reload,
  message, // Nova prop para pre-popular mensagem
  fromMessageInput = false, // Nova prop para identificar origem
  user
}) => {
  const classes = useStyles();
  const history = useHistory();
  const isMounted = useRef(true);
  const { companyId } = user;
  const isAdmin = user.profile === 'admin';

  const initialState = {
    body: message || "", // Pre-popular com mensagem se fornecida
    contactId: contactId || "", // Pre-popular com contactId se fornecido
    sendAt: moment().add(1, "hour").format("YYYY-MM-DDTHH:mm"),
    sentAt: "",
    openTicket: "enabled",
    ticketUserId: user.id,
    queueId: "",
    statusTicket: "open", // ✅ Status baseado na origem
    intervalo: 1,
    valorIntervalo: 0,
    enviarQuantasVezes: 1,
    tipoDias: 4,
    assinar: false,
    // Novos campos para lembrete
    reminderDate: "",
    reminderMessage: "",
  };

  const [schedule, setSchedule] = useState(initialState);
  const [currentContact, setCurrentContact] = useState(null); // Iniciar com null
  const [selectedContacts, setSelectedContacts] = useState([]); // Múltiplos contatos
  const [contacts, setContacts] = useState([]); // Iniciar com array vazio
  const [contactSearchInput, setContactSearchInput] = useState(""); // Input de busca
  const [loadingContacts, setLoadingContacts] = useState(false); // Loading
  const [intervalo, setIntervalo] = useState(1);
  const [tipoDias, setTipoDias] = useState(4);
  const [attachment, setAttachment] = useState(null);
  const attachmentFile = useRef(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const messageInputRef = useRef();
  const [channelFilter, setChannelFilter] = useState("whatsapp");
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsapps, setSelectedWhatsapps] = useState(""); // String vazia ao invés de array
  const [loading, setLoading] = useState(false);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const { findAll: findAllQueues } = useQueues();
  const [options, setOptions] = useState([]);
  const [searchParam, setSearchParam] = useState("");

  // Estados para quickMessages
  const [quickMessages, setQuickMessages] = useState([]);
  const [loadingQuickMessages, setLoadingQuickMessages] = useState(false);
  const [selectedQuickMessage, setSelectedQuickMessage] = useState("");
  const [quickMessageMedia, setQuickMessageMedia] = useState(null);
  // Estado para template
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Schema dinâmico com validação condicional para mensagem - MOVIDO PARA DEPOIS DA INICIALIZAÇÃO DE selectedTemplate
  // Helper para verificar se é uma conexão API Oficial
  const isOfficialConnection = useMemo(() => {
    const whatsapp = whatsapps.find(w => w.id?.toString() === selectedWhatsapps?.toString());
    return whatsapp && (
      whatsapp.provider === "oficial" || 
      whatsapp.provider === "beta" ||
      whatsapp.channel === "whatsapp-oficial" || 
      whatsapp.channel === "whatsapp_oficial"
    );
  }, [whatsapps, selectedWhatsapps]);
  
  const scheduleSchema = useMemo(() => {
    return baseScheduleSchema.shape({
      body: Yup.string().when(['selectedTemplate', 'whatsappId'], {
        is: (isTemplate, whatsappId) => {
          // Verificar se é template ou conexão da API Oficial
          const isSelectedTemplate = !!selectedTemplate;
          const isApiOficial = isOfficialConnection;
          console.log('Validando mensagem:', { isTemplate, isSelectedTemplate, isApiOficial, selectedWhatsapps });
          return isSelectedTemplate || isApiOficial;
        },
        then: Yup.string().nullable(), // Opcional para templates ou API Oficial
        otherwise: Yup.string().min(5, "Mensagem muito curta").required("Obrigatório")
      })
    });
  }, [selectedTemplate, isOfficialConnection, selectedWhatsapps]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        const list = await findAllQueues();
        setAllQueues(list);
        setQueues(list);
      };
      loadQueues();
    }
  }, []);

  // Buscar quickMessages quando o modal abrir ou o WhatsApp mudar
  useEffect(() => {
    if (open && user?.companyId) {
      console.group('🔍 [TEMPLATE-LOG] Carregando templates e respostas rápidas');
      console.log('WhatsApp selecionado:', selectedWhatsapps);
      console.log('Empresa ID:', user?.companyId);
      console.log('Usuário ID:', user?.id);
      fetchQuickMessages();
      console.groupEnd();
    }
  }, [open, user?.companyId, user?.id, selectedWhatsapps]); // ✅ CORREÇÃO: Recarregar quando o WhatsApp muda

  const fetchQuickMessages = async () => {
    console.group('📋 [TEMPLATE-LOG] Início do fetchQuickMessages');
    console.time('fetchQuickMessages');
    setLoadingQuickMessages(true);
    try {
      // ✅ CORREÇÃO 1: Buscar templates da API e mensagens rápidas separadamente
      const [quickMessagesResponse, templatesResponse] = await Promise.all([
        // 1. Buscar quick messages (respostas rápidas)
        api.get("/quick-messages/list", {
          params: {
            companyId: user?.companyId,
            userId: user?.id,
            isOficial: "false" // Apenas respostas rápidas normais
          }
        }),
        // 2. Buscar templates da API Oficial (endpoint correto)
        // ✅ CORREÇÃO: Só buscar templates se tiver um WhatsApp selecionado para evitar erro
        selectedWhatsapps ? 
          api.get(`/templates`, {
            params: {
              whatsappId: selectedWhatsapps
            }
          }) : 
          // Retornar objeto vazio para manter a estrutura da Promise quando não há WhatsApp
          Promise.resolve({ data: { data: [] } })
      ]);

      // Mensagens rápidas
      const quickMessages = quickMessagesResponse.data || [];
      console.log("✅ Respostas rápidas carregadas:", quickMessages.length);

      // Templates da Meta API
      const templates = templatesResponse.data?.data || [];
      console.log("✅ Templates Meta carregados:", templates.length);

      // Converter templates para formato compatível com quick messages
      const formattedTemplates = templates.map(template => {
        // ✅ Garantir que o nome do template (shortcode) esteja sempre definido
        // O nome do template da API Meta É o shortcode que precisamos usar na API
        if (!template.name) {
          console.error("❌ Template sem nome/shortcode!", template);
        }
        
        return {
          id: template.id,
          shortcode: template.name, // ✅ Este é o nome real que precisa ser usado na API
          message: template.components?.find(c => c.type === 'BODY')?.text || 'Template sem conteúdo',
          isOficial: true,
          metaID: template.id,
          language: template.language,
          components: template.components,
          // ✅ Garantir que templateName seja sempre preenchido
          templateName: template.name // ✅ Duplicando para garantir consistência
        };
      });
      
      // ✅ Log para debug dos templates carregados
      if (templates.length > 0) {
        console.log("✅ Primeiro template carregado:", {
          id: templates[0].id,
          name: templates[0].name,
          language: templates[0].language
        });
      }

      // Combinar ambas as fontes
      const combinedMessages = [...quickMessages, ...formattedTemplates];
      console.log("✅ Total de mensagens combinadas:", combinedMessages.length);
      
      // Log detalhado dos templates da Meta
      if (formattedTemplates.length > 0) {
        console.group('🔍 [TEMPLATE-LOG] Templates formatados');
        formattedTemplates.forEach((template, index) => {
          console.log(`Template #${index+1}:`, {
            id: template.id,
            shortcode: template.shortcode,
            templateName: template.templateName,
            metaID: template.metaID,
            tipo_id: typeof template.id,
            tipo_shortcode: typeof template.shortcode
          });
        });
        console.groupEnd();
      }
      
      setQuickMessages(combinedMessages || []);
    } catch (err) {
      console.error("❌ Erro ao buscar respostas rápidas ou templates:", err);
      toastError(err);
      setQuickMessages([]);
    } finally {
      setLoadingQuickMessages(false);
      console.timeEnd('fetchQuickMessages');
      console.groupEnd();
    }
  };

  // Função para baixar mídia da quickMessage
  const downloadQuickMessageMedia = async (mediaPath, mediaName, mediaType) => {
    try {
      // console.log(" Baixando mídia da quickMessage:", { mediaPath, mediaName, mediaType });

      // Construir URL correta usando a URL base do backend
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
      const downloadUrl = `${backendUrl}/public/company${user?.companyId}/quickMessage/${mediaName}`;

      // console.log(" URL de download:", downloadUrl);

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ao baixar mídia: ${response.status}`);
      }

      const blob = await response.blob();
      const file = new File([blob], mediaName, {
        type: blob.type || getMediaTypeFromExtension(mediaName, mediaType)
      });

      // console.log(" Mídia baixada com sucesso:", file);
      return file;
    } catch (err) {
      console.error(" Erro ao baixar mídia da quickMessage:", err);
      toastError(err);
      return null;
    }
  };

  // Função auxiliar para determinar o tipo MIME baseado na extensão
  const getMediaTypeFromExtension = (fileName, mediaType) => {
    const extension = fileName.split('.').pop().toLowerCase();

    switch (mediaType) {
      case 'image':
        return `image/${extension === 'jpg' ? 'jpeg' : extension}`;
      case 'audio':
        return `audio/${extension}`;
      case 'video':
        return `video/${extension}`;
      default:
        return 'application/octet-stream';
    }
  };

  // Carregar usuários ao abrir o modal
  useEffect(() => {
    if (open && isAdmin) {
      const fetchUsers = async () => {
        setLoading(true);
        try {
          const { data } = await api.get("/users/");
          console.log(" Usuários carregados:", data.users?.length || 0, data.users);
          setOptions(data.users);
          setLoading(false);
        } catch (err) {
          console.error(" Erro ao carregar usuários:", err);
          setLoading(false);
          toastError(err);
        }
      };
      fetchUsers();
    }
  }, [open, isAdmin]);

  // Limpar o campo de mensagem quando mudar para uma conexão API Oficial
  useEffect(() => {
    if (isOfficialConnection) {
      // Se mudou para uma conexão API Oficial, limpar o campo de mensagem
      setSchedule(prev => ({ ...prev, body: "" }));
    }
  }, [isOfficialConnection]);

  // Carregar WhatsApps ao abrir o modal
  useEffect(() => {
    if (open) {
      console.log(" Modal aberto - carregando WhatsApps iniciais");
      api
        .get(`/whatsapp`, {
          params: { channel: "whatsapp" },
        })
        .then(({ data }) => {
          console.log(" WhatsApps iniciais carregados:", data.length, data);
          // Filtrar apenas conexões conectadas
          const connectedWhatsapps = data.filter(w => w.status === "CONNECTED" || w.status === "OPENING");
          console.log(" WhatsApps conectados:", connectedWhatsapps.length, connectedWhatsapps);
          
          const mappedWhatsapps = connectedWhatsapps.map((whatsapp) => ({
            ...whatsapp,
            selected: false,
          }));
          setWhatsapps(mappedWhatsapps);
          if (mappedWhatsapps.length === 1) {
            setSelectedWhatsapps(mappedWhatsapps[0].id);
          }
        })
        .catch((err) => {
          console.error(" Erro ao carregar WhatsApps iniciais:", err);
        });
    }
  }, [open]);

  // Filtrar usuários conforme digitação (opcional)
  useEffect(() => {
    if (searchParam.length < 3) {
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam }
          });
          setOptions(data.users);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };

      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam]);

  useEffect(() => {
    if (selectedContacts.length > 0 || currentContact) {
      console.log(" Carregando WhatsApps - channelFilter:", channelFilter);
      api
        .get(`/whatsapp`, {
          params: { channel: channelFilter },
        })
        .then(({ data }) => {
          console.log(" WhatsApps carregados:", data.length, data);
          // Filtrar apenas conexões conectadas
          const connectedWhatsapps = data.filter(w => w.status === "CONNECTED" || w.status === "OPENING");
          console.log(" WhatsApps conectados filtrados:", connectedWhatsapps.length);
          
          const mappedWhatsapps = connectedWhatsapps.map((whatsapp) => ({
            ...whatsapp,
            selected: false,
          }));

          setWhatsapps(mappedWhatsapps);
          if (mappedWhatsapps.length && mappedWhatsapps?.length === 1) {
            setSelectedWhatsapps(mappedWhatsapps[0].id);
          }
        })
        .catch((err) => {
          console.error(" Erro ao carregar WhatsApps:", err);
        });
    }
  }, [currentContact, selectedContacts, channelFilter]);

  useEffect(() => {
    if (contactId && contacts.length) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact) {
        setCurrentContact(contact);
      }
    }
  }, [contactId, contacts]);

  // 🔍 UseEffect com debounce para buscar contatos
  useEffect(() => {
    const { companyId } = user;
    if (!open) return;

    // Debounce de 500ms
    const delayDebounceFn = setTimeout(async () => {
      try {
        // Carregar contatos com base no input de busca (se fornecido contactId, busca sempre)
        if (contactSearchInput.length >= 3 || contactId) {
          setLoadingContacts(true);
          const { data: contactList } = await api.get("/contacts/list", {
            params: { 
              companyId: companyId,
              searchParam: contactSearchInput || undefined
            },
          });

          let customList = contactList.map((c) => ({
            id: c.id,
            name: c.name,
            channel: c.channel,
          }));

          if (isArray(customList)) {
            setContacts(customList);
          }
          setLoadingContacts(false);
        } else if (!contactId && contactSearchInput.length === 0) {
          // Se não tem busca e não tem contactId, limpa a lista
          setContacts([]);
        }
      } catch (err) {
        setLoadingContacts(false);
        toastError(err);
      }
    }, 500); // Aguarda 500ms após parar de digitar

    return () => clearTimeout(delayDebounceFn);
  }, [contactSearchInput, open, user, contactId]);

  // MELHORIA: UseEffect otimizado com melhor lógica de inicialização
  useEffect(() => {
    const { companyId } = user;
    if (open) {
      try {
        (async () => {

          // MELHORIA: Lógica de inicialização aprimorada
          if (!scheduleId) {
            // Modal sendo aberto para criar novo agendamento
            const newScheduleState = {
              ...initialState,
              body: message || "", // ✅ Pre-popular mensagem
              contactId: contactId || "", // ✅ Pre-popular contato
            };

            setSchedule(newScheduleState);
            return;
          }

          // ✅ Carregamento de agendamento existente (lógica original)
          const { data } = await api.get(`/schedules/${scheduleId}`);
          setSchedule((prevState) => {
            return {
              ...prevState,
              ...data,
              sendAt: moment(data.sendAt).format("YYYY-MM-DDTHH:mm"),
              // ✅ Incluir campos de lembrete no carregamento
              reminderDate: data.reminderDate ? moment(data.reminderDate).format("YYYY-MM-DDTHH:mm") : "",
              reminderMessage: data.reminderMessage || "",
            };
          });

          console.log("📅 Agendamento carregado:", data);

          if (data.whatsapp) {
            setSelectedWhatsapps(data.whatsapp.id);
          }

          if (data.ticketUser) {
            setSelectedUser(data.ticketUser);
          }

          if (data.queueId) {
            setSelectedQueue(data.queueId);
          }

          if (data.intervalo) {
            setIntervalo(data.intervalo);
          }

          if (data.tipoDias) {
            setTipoDias(data.tipoDias);
          }

          // ✅ Carregar contato em ambos estados (compatibilidade)
          if (data.contact) {
            setCurrentContact(data.contact);
            setSelectedContacts([data.contact]); // Para exibir no Autocomplete múltiplo
          }
        })();
      } catch (err) {
        toastError(err);
      }
    }
  }, [scheduleId, contactId, open, user, message, fromMessageInput]);

  const filterOptions = createFilterOptions({
    trim: true,
  });

  const handleClose = () => {
    onClose();
    setAttachment(null);
    setSchedule(initialState);
    // ✅ MELHORIA: Reset do contato atual ao fechar
    setCurrentContact(null);
    setSelectedContacts([]); // ✅ Reset contatos múltiplos
    setContactSearchInput(""); // 🔍 Reset busca de contatos
    setContacts([]); // 🔍 Limpar lista de contatos
    // ✅ Reset de usuário selecionado
    setSelectedUser(null);
    setSelectedQueue("");
    // Reset do dropdown de quickMessages
    setSelectedQuickMessage("");
    setQuickMessageMedia(null);
    setSelectedTemplate(null); // ✅ Reset template
    // ✅ Reset dos campos de lembrete
    setSchedule(prevState => ({
      ...prevState,
      reminderDate: "",
      reminderMessage: "",
    }));
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };

  const IconChannel = (channel) => {
    switch (channel) {
      case "facebook":
        return (
          <Facebook style={{ color: "#3b5998", verticalAlign: "middle" }} />
        );
      case "instagram":
        return (
          <Instagram style={{ color: "#e1306c", verticalAlign: "middle" }} />
        );
      case "whatsapp":
        return (
          <WhatsApp style={{ color: "#25d366", verticalAlign: "middle" }} />
        );
      default:
        return "error";
    }
  };

  const renderOption = (option) => {
    if (option.name) {
      return (
        <>
          {IconChannel(option.channel)}
          <Typography
            component="span"
            style={{
              fontSize: 14,
              marginLeft: "10px",
              display: "inline-flex",
              alignItems: "center",
              lineHeight: "2",
            }}
          >
            {option.name}
          </Typography>
        </>
      );
    }
  };

  const handleSaveSchedule = async (values) => {
    console.group('💾 [TEMPLATE-LOG] Início do processo de salvamento');
    console.time('handleSaveSchedule');
    try {
      // Validar que whatsappId foi fornecido
      if (!selectedWhatsapps) {
        toast.error("Selecione uma conexão WhatsApp válida");
        return;
      }

      // ✅ Se múltiplos contatos, criar um agendamento para cada
      if (selectedContacts.length > 1) {
        console.log(`📅 Criando ${selectedContacts.length} agendamentos...`);
        
        for (const contact of selectedContacts) {
          const scheduleData = {
            ...values,
            userId: user.id,
            contactId: contact.id,
            whatsappId: selectedWhatsapps,
            ticketUserId: selectedUser?.id || null,
            queueId: selectedQueue || null,
            intervalo: intervalo || 1,
            tipoDias: tipoDias || 4,
            reminderDate: values.reminderDate || null,
            reminderMessage: values.reminderMessage && values.reminderMessage.trim() !== "" ? values.reminderMessage : null,
            // ✅ Incluir dados do template se selecionado (igual campanha)
            templateMetaId: selectedTemplate?.templateId || null, // ID da QuickMessage
            templateName: selectedTemplate?.templateName || null, // ✅ Nome (shortcode) do template
            templateLanguage: selectedTemplate?.language || null,
            templateComponents: selectedTemplate?.components || null,
            isTemplate: selectedTemplate ? true : false
          };

          console.log(" Salvando agendamento:", scheduleData);
          console.log(" Selected Template:", selectedTemplate);
          console.log(" Is Template:", scheduleData.isTemplate);
          console.log(" [SAVE-DEBUG] templateName:", scheduleData.templateName);
console.log(" [SAVE-DEBUG] templateMetaId:", scheduleData.templateMetaId);
console.log(" [SAVE-DEBUG] selectedTemplate detalhado:", JSON.stringify(selectedTemplate, null, 2));

// Verificação final para garantir que templateName está definido
if (!scheduleData.templateName && scheduleData.isTemplate) {
  console.warn(" templateName está undefined no momento do salvamento - aplicando correção");
  scheduleData.templateName = scheduleData.templateMetaId || "template_" + Date.now();
  console.log(" templateName corrigido para:", scheduleData.templateName);
}

          const { data } = await api.post("/schedules", scheduleData);
          
          if (attachment != null) {
            const formData = new FormData();
            formData.append("file", attachment);
            await api.post(`/schedules/${data.id}/media-upload`, formData);
          }
        }
        
        toast.success(`${selectedContacts.length} agendamentos criados com sucesso!`);
      } else {
        // Validar que pelo menos um contato foi selecionado
        if (!currentContact?.id && !scheduleId) {
          toast.error("Selecione um contato para o agendamento");
          return;
        }
        
        // ✅ Lógica original para um contato ou edição
        const scheduleData = {
          ...values,
          userId: user.id,
          contactId: currentContact?.id, // Garantir que contactId está definido
          whatsappId: selectedWhatsapps,
          ticketUserId: selectedUser?.id || null,
          queueId: selectedQueue || null,
          intervalo: intervalo || 1,
          tipoDias: tipoDias || 4,
          reminderDate: values.reminderDate || null,
          reminderMessage: values.reminderMessage && values.reminderMessage.trim() !== "" ? values.reminderMessage : null,
          // ✅ Incluir dados do template se selecionado (igual campanha)
          templateMetaId: selectedTemplate?.templateId?.toString() || null, // ID da QuickMessage
          templateName: selectedTemplate?.templateName || selectedTemplate?.templateId?.toString() || null, // ✅ Nome (shortcode) do template
          templateLanguage: selectedTemplate?.language || "pt_BR",
          templateComponents: selectedTemplate?.components || null,
          isTemplate: selectedTemplate ? true : false
        };
        
        // Log detalhado dos dados antes do envio
        console.group('📤 [TEMPLATE-LOG] Dados do template a serem enviados');
        console.log('selectedTemplate objeto completo:', selectedTemplate);
        console.log('templateMetaId:', {
          valor: scheduleData.templateMetaId,
          tipo: typeof scheduleData.templateMetaId,
          fonte_direta: selectedTemplate?.templateId,
          fonte_tipo: typeof selectedTemplate?.templateId
        });
        console.log('templateName:', {
          valor: scheduleData.templateName,
          tipo: typeof scheduleData.templateName,
          fonte_direta: selectedTemplate?.templateName,
          fonte_tipo: typeof selectedTemplate?.templateName
        });
        console.log('isTemplate:', scheduleData.isTemplate);

        console.log("💾 [SAVE-SINGLE] Salvando agendamento único...");
        console.log("💾 [SAVE-SINGLE] Is Template:", scheduleData.isTemplate);
        console.log("💾 [SAVE-SINGLE-DEBUG] templateName:", scheduleData.templateName);
        console.log("💾 [SAVE-SINGLE-DEBUG] templateMetaId:", scheduleData.templateMetaId);
        console.groupEnd(); // Fecha o grupo de dados do template

        if (scheduleId) {
          await api.put(`/schedules/${scheduleId}`, scheduleData);
          if (attachment != null) {
            const formData = new FormData();
            formData.append("file", attachment);
            await api.post(`/schedules/${scheduleId}/media-upload`, formData);
          }
        } else {
          const { data } = await api.post("/schedules", scheduleData);
          if (attachment != null) {
            const formData = new FormData();
            formData.append("file", attachment);
            await api.post(`/schedules/${data.id}/media-upload`, formData);
          }
        }

        toast.success(i18n.t("scheduleModal.success"));
      }

      if (typeof reload == "function") {
        reload();
      }

      if (contactId) {
        if (typeof cleanContact === "function") {
          cleanContact();
          history.push("/schedules");
        }
      }
    } catch (err) {
      console.error('❌ [TEMPLATE-LOG] Erro ao salvar agendamento:', err);
      toastError(err);
    } finally {
      console.timeEnd('handleSaveSchedule');
      console.groupEnd(); // Fecha o grupo principal do salvamento
    }

    setCurrentContact(null);
    setSelectedContacts([]);
    setSelectedTemplate(null); // ✅ Reset template após salvar
    setSchedule(initialState);
    // ✅ Reset dos campos de lembrete após salvar
    setSchedule(prevState => ({
      ...prevState,
      reminderDate: "",
      reminderMessage: "",
    }));
    handleClose();
  };

  const handleClickMsgVar = async (msgVar, setValueFunc) => {
    const el = messageInputRef.current;
    const firstHalfText = el.value.substring(0, el.selectionStart);
    const secondHalfText = el.value.substring(el.selectionEnd);
    const newCursorPos = el.selectionStart + msgVar.length;

    setValueFunc("body", `${firstHalfText}${msgVar}${secondHalfText}`);

    await new Promise((r) => setTimeout(r, 100));
    messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
  };

  // Função para lidar com seleção do dropdown de quickMessages
  const handleQuickMessageDropdownSelect = async (event, setFieldValue) => {
    console.group('🎯 [TEMPLATE-LOG] Seleção de template/resposta rápida');
    console.time('handleQuickMessageDropdownSelect');
    const selectedId = event.target.value;
    console.log("ID selecionado:", selectedId);
    console.log("Tipo do ID:", typeof selectedId);
    console.log("Total de QuickMessages disponíveis:", quickMessages.length);

    setSelectedQuickMessage(selectedId);

    if (selectedId && selectedId !== "") {
      const selectedMessage = quickMessages.find(qm => qm.id.toString() === selectedId.toString());
      console.log("🔍 Mensagem encontrada:", selectedMessage);

      if (selectedMessage) {
        console.log("📝 Mensagem selecionada completa:", selectedMessage);
        console.log("📝 ID:", selectedMessage.id, "tipo:", typeof selectedMessage.id);
        console.log("📝 shortcode:", selectedMessage.shortcode, "tipo:", typeof selectedMessage.shortcode);
        console.log("📝 isOficial:", selectedMessage.isOficial, "tipo:", typeof selectedMessage.isOficial);
        console.log("📝 metaID:", selectedMessage.metaID, "tipo:", typeof selectedMessage.metaID);
        console.log("📝 templateName:", selectedMessage.templateName, "tipo:", typeof selectedMessage.templateName);
        
        // ✅ Verificar se é um template da API Oficial
        if (selectedMessage.isOficial && selectedMessage.metaID) {
          console.log("📋 ✅ Template da API Oficial selecionado:", selectedMessage.metaID);
          
          // Salvar dados do template
          console.log("📋 [TEMPLATE-DEBUG] Valores do template antes de salvar:", {
            id: selectedMessage.id,
            shortcode: selectedMessage.shortcode,
            metaID: selectedMessage.metaID,
            templateName: selectedMessage.templateName,
            tipo_id: typeof selectedMessage.id,
            tipo_shortcode: typeof selectedMessage.shortcode,
            tipo_metaID: typeof selectedMessage.metaID,
            tipo_templateName: typeof selectedMessage.templateName
          });
          
          // ✅ Garantir que templateName seja definido (ordem de prioridade)
          let finalTemplateName = 
              selectedMessage.templateName || // Primeiro: valor pré-definido
              selectedMessage.shortcode ||  // Segundo: shortcode (mais comum)
              selectedMessage.name ||       // Terceiro: nome direto
              selectedMessage.metaID?.toString() || // Quarto: metaID como fallback
              selectedMessage.id?.toString() || // Quinto: ID como último recurso
              "unknown_template";          // Último: valor padrão
          
          console.log("📋 [TEMPLATE-DEBUG] Nome final do template:", finalTemplateName);
          
          const templateData = {
            templateId: selectedMessage.id?.toString() || selectedMessage.metaID?.toString(), // ✅ ID da QuickMessage (igual campanha)
            templateName: finalTemplateName, // ✅ Nome definitivo do template
            language: selectedMessage.language || "pt_BR",
            components: selectedMessage.components || []
          };
          
          // ✅ Verificação adicional para garantir que templateName está definido
          if (!templateData.templateName) {
            console.warn("❌ templateName está indefinido - usando ID como fallback");
            templateData.templateName = templateData.templateId?.toString() || "template_" + Date.now();
          }
          
          console.log("📋 [TEMPLATE-DEBUG] Template data para salvar:", templateData);
          setSelectedTemplate(templateData);

          // NÃO preencher o campo body para templates (campo fica desabilitado)
          // apenas limpar qualquer conteúdo anterior
          setFieldValue("body", "");
          
          console.log("✅ Template configurado:", {
            metaId: selectedMessage.metaID,
            templateId: templateData.templateId, 
            templateName: finalTemplateName, // ✅ Nome final do template
            language: selectedMessage.language,
            components: selectedMessage.components?.length || 0
          });
          
          console.timeEnd('handleQuickMessageDropdownSelect');
          console.groupEnd();
        } else {
          // Mensagem normal (não template)
          console.log("✅ Preenchendo campo body com:", selectedMessage.message);
          setFieldValue("body", selectedMessage.message || "");
          setSelectedTemplate(null); // Limpar template se não for oficial
        }

        // Se a mensagem tem mídia, baixar e definir como attachment
        if (selectedMessage.mediaPath && !selectedMessage.isOficial) {
          console.log("📎 Mensagem com mídia:", selectedMessage.mediaPath);

          try {
            const mediaFile = await downloadQuickMessageMedia(
              selectedMessage.mediaPath,
              selectedMessage.mediaName,
              selectedMessage.mediaType
            );

            if (mediaFile) {
              setAttachment(mediaFile);
              setQuickMessageMedia({
                path: selectedMessage.mediaPath,
                name: selectedMessage.mediaName,
                type: selectedMessage.mediaType
              });
              console.log("✅ Mídia da quickMessage definida como attachment:", mediaFile);
            }
          } catch (err) {
            console.error("❌ Erro ao processar mídia da quickMessage:", err);
          }
        } else {
          // Limpar mídia anterior se não há mídia na nova seleção
          setQuickMessageMedia(null);
          setAttachment(null);
          if (attachmentFile.current) {
            attachmentFile.current.value = null;
          }
        }
      } else {
        console.log("❌ Mensagem não encontrada para ID:", selectedId);
      }
    } else {
      // Limpar quando nenhuma quickMessage está selecionada
      setQuickMessageMedia(null);
      setAttachment(null);
      setSelectedTemplate(null);
      if (attachmentFile.current) {
        attachmentFile.current.value = null;
      }
    }
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    // Limpar mídia da quickMessage se existir
    if (quickMessageMedia) {
      setQuickMessageMedia(null);
    }

    if (schedule.mediaPath) {
      await api.delete(`/schedules/${schedule.id}/media-upload`);
      setSchedule((prev) => ({
        ...prev,
        mediaPath: null,
      }));
      toast.success(i18n.t("scheduleModal.toasts.deleted"));
      if (typeof reload == "function") {
        console.log(reload);
        console.log("1");
        reload();
      }
    }
  };

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={i18n.t("scheduleModal.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      >
        {i18n.t("scheduleModal.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          {schedule.status === "ERRO"
            ? "Erro de Envio"
            : `Mensagem ${capitalize(schedule.status)}`}
        </DialogTitle>
        <div style={{ display: "none" }}>
          <input
            type="file"
            accept=".png,.jpg,.jpeg"
            ref={attachmentFile}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>
        <Formik
          initialValues={schedule}
          enableReinitialize={true}
          validationSchema={scheduleSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveSchedule(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                <Grid container spacing={1}>
                  <Grid item xs={12} md={6} xl={6}>
                    <div className={classes.multFieldLine}>
                      <FormControl variant="outlined" fullWidth>
                        <Autocomplete
                          fullWidth
                          multiple
                          size="small"
                          value={selectedContacts}
                          options={contacts}
                          loading={loadingContacts}
                          inputValue={contactSearchInput}
                          onInputChange={(e, newInputValue) => {
                            setContactSearchInput(newInputValue);
                          }}
                          noOptionsText={
                            contactSearchInput.length < 3 && !contactId
                              ? "Digite 3 caracteres para buscar..."
                              : "Nenhum contato encontrado"
                          }
                          style={{ marginTop: "8px" }}
                          onChange={(e, newValue) => {
                            console.log("📞 Contatos selecionados:", newValue);
                            setSelectedContacts(newValue || []);
                            // Atualizar channelFilter com o primeiro contato
                            if (newValue && newValue.length > 0) {
                              setChannelFilter(newValue[0].channel || "whatsapp");
                              // Manter compatibilidade com código existente
                              setCurrentContact(newValue[0]);
                              setSchedule({ ...schedule, contactId: newValue[0].id });
                            } else {
                              setChannelFilter("whatsapp");
                              setCurrentContact(null);
                              setSchedule({ ...schedule, contactId: "" });
                            }
                          }}
                          getOptionLabel={(option) => option?.name || ""}
                          getOptionSelected={(option, value) => {
                            return option?.id === value?.id;
                          }}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                key={option.id}
                                variant="outlined"
                                style={{
                                  backgroundColor: "#bfbfbf",
                                  textShadow: "1px 1px 1px #000",
                                  color: "white",
                                }}
                                label={option.name}
                                {...getTagProps({ index })}
                                size="small"
                              />
                            ))
                          }
                          renderOption={renderOption}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              variant="outlined"
                              placeholder="Selecione os contatos"
                              label="Contatos"
                            />
                          )}
                        />
                      </FormControl>
                    </div>
                  </Grid>
                  <Grid item xs={12} md={6} xl={6}>
                    <Field
                      as={TextField}
                      label={i18n.t("scheduleModal.form.sendAt")}
                      type="datetime-local"
                      name="sendAt"
                      error={touched.sendAt && Boolean(errors.sendAt)}
                      helperText={touched.sendAt && errors.sendAt}
                      variant="outlined"
                      fullWidth
                      size="small"
                      style={{ marginTop: "8px" }}
                    />
                  </Grid>
                </Grid>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    rows={9}
                    multiline={true}
                    label={i18n.t("scheduleModal.form.body")}
                    name="body"
                    inputRef={messageInputRef}
                    error={touched.body && Boolean(errors.body)}
                    helperText={!!selectedTemplate || isOfficialConnection 
                      ? "Campo desabilitado para templates e API Oficial" 
                      : touched.body && errors.body
                    }
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={!!selectedTemplate || isOfficialConnection}
                  />
                </div>

                {/* Dropdown de Respostas Rápidas */}
                <div className={classes.multFieldLine}>
                  <FormControl variant="outlined" fullWidth margin="dense">
                    <InputLabel id="quick-message-select-label">
                      {i18n.t("ticketInfo.quickMessages")}
                    </InputLabel>
                    <Select
                      labelId="quick-message-select-label"
                      id="quick-message-select"
                      value={selectedQuickMessage}
                      onChange={(event) => handleQuickMessageDropdownSelect(event, setFieldValue)}
                      label={i18n.t("ticketInfo.quickMessages")}
                      disabled={loadingQuickMessages || quickMessages.length === 0}
                    >
                      <MenuItem value="">
                        <em>
                          {loadingQuickMessages
                            ? "Carregando..."
                            : quickMessages.length === 0
                              ? "Nenhuma resposta rápida disponível"
                              : "Selecione uma resposta rápida"
                          }
                        </em>
                      </MenuItem>
                      {quickMessages.map((quickMessage) => (
                        <MenuItem key={quickMessage.id} value={quickMessage.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                            <FlashOn style={{ fontSize: '16px', color: '#1976d2' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                {quickMessage.shortcode}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {quickMessage.message}
                              </div>
                            </div>
                            {quickMessage.mediaPath && (
                              <AttachFile style={{ fontSize: '14px', color: '#666' }} />
                            )}
                          </div>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </div>

                <Grid item xs={12} md={12} xl={12}>
                  <MessageVariablesPicker
                    disabled={isSubmitting}
                    onClick={(value) => handleClickMsgVar(value, setFieldValue)}
                  />
                </Grid>
                <Grid container spacing={1}>
                  <Grid item xs={12} md={6} xl={3}>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.formControl}
                    >
                      <InputLabel id="whatsapp-selection-label">
                        {i18n.t("campaigns.dialog.form.whatsapp")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("campaigns.dialog.form.whatsapp")}
                        placeholder={i18n.t("campaigns.dialog.form.whatsapp")}
                        labelId="whatsapp-selection-label"
                        id="whatsappIds"
                        name="whatsappIds"
                        required
                        error={!selectedWhatsapps} // ✅ Mostrar erro visual quando não há WhatsApp selecionado
                        value={selectedWhatsapps}
                        onChange={(event) => {
                          setSelectedWhatsapps(event.target.value);
                          // ✅ Forçar atualização dos templates quando o WhatsApp é alterado
                          if (event.target.value) fetchQuickMessages();
                        }}
                      >
                        {whatsapps &&
                          whatsapps.map((whatsapp) => (
                            <MenuItem key={whatsapp.id} value={whatsapp.id}>
                              {whatsapp.name}
                            </MenuItem>
                          ))}
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6} xl={3}>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.formControl}
                    >
                      <InputLabel id="openTicket-selection-label">
                        {i18n.t("campaigns.dialog.form.openTicket")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("campaigns.dialog.form.openTicket")}
                        placeholder={i18n.t("campaigns.dialog.form.openTicket")}
                        labelId="openTicket-selection-label"
                        id="openTicket"
                        name="openTicket"
                        error={touched.openTicket && Boolean(errors.openTicket)}
                      >
                        <MenuItem value={"enabled"}>
                          {i18n.t("campaigns.dialog.form.enabledOpenTicket")}
                        </MenuItem>
                        {/* <MenuItem value={"disabled"}>
                          {i18n.t("campaigns.dialog.form.disabledOpenTicket")}
                        </MenuItem> */}
                      </Field>
                    </FormControl>
                  </Grid>
                </Grid>
                <Grid spacing={1} container>
                  <Grid item xs={12} md={6} xl={4}>
                    {isAdmin ? (
                      <Autocomplete
                        style={{ marginTop: "8px" }}
                        className={classes.formControl}
                        size="small"
                        options={options}
                        value={selectedUser}
                        onChange={(e, newValue) => {
                          setSelectedUser(newValue);
                          // Lógica de queues baseada no usuário selecionado
                          if (newValue?.queues && Array.isArray(newValue.queues)) {
                            if (newValue.queues.length === 1) {
                              setSelectedQueue(newValue.queues[0].id);
                            }
                            setQueues(newValue.queues);
                          } else {
                            setQueues(allQueues);
                            setSelectedQueue("");
                          }
                        }}
                        getOptionLabel={(option) => option?.name || ""}
                        getOptionSelected={(option, value) => option?.id === value?.id}
                        filterOptions={filterOptions}
                        fullWidth
                        disabled={values.openTicket === "disabled"}
                        noOptionsText={i18n.t("transferTicketModal.noOptions")}
                        loading={loading}
                        renderOption={(option) => (
                          <span>
                            {" "}
                            <UserStatusIcon user={option} /> {option.name}
                          </span>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={i18n.t("transferTicketModal.fieldLabel")}
                            variant="outlined"
                            placeholder={i18n.t("transferTicketModal.fieldLabel")}
                            onChange={(e) => setSearchParam(e.target.value)}
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <React.Fragment>
                                  {loading ? (
                                    <CircularProgress color="inherit" size={20} />
                                  ) : null}
                                  {params.InputProps.endAdornment}
                                </React.Fragment>
                              ),
                            }}
                          />
                        )}
                      />
                    ) : (
                      <TextField
                        style={{ marginTop: "8px" }}
                        fullWidth
                        label="Usuário"
                        variant="outlined"
                        value={user.name}
                        disabled
                        size="small"
                      />
                    )}
                  </Grid>

                  <Grid item xs={12} md={6} xl={6}>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.formControl}
                    >
                      <InputLabel>
                        {i18n.t("transferTicketModal.fieldQueueLabel")}
                      </InputLabel>
                      <Select
                        value={selectedQueue}
                        onChange={(e) => setSelectedQueue(e.target.value)}
                        label={i18n.t(
                          "transferTicketModal.fieldQueuePlaceholder"
                        )}
                        disabled={values.openTicket === "disabled"}
                      >
                        {queues.map((queue) => (
                          <MenuItem key={queue.id} value={queue.id}>
                            {queue.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Grid spacing={1} container style={{ marginTop: "-10px" }}>
                  <Grid item xs={12} md={6} xl={6}>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.formControl}
                    >
                      <InputLabel id="statusTicket-selection-label">
                        {i18n.t("campaigns.dialog.form.statusTicket")}
                      </InputLabel>
                      <Field
                        as={Select}
                        disabled={values.openTicket === "disabled"}
                        label={i18n.t("campaigns.dialog.form.statusTicket")}
                        placeholder={i18n.t(
                          "campaigns.dialog.form.statusTicket"
                        )}
                        labelId="statusTicket-selection-label"
                        id="statusTicket"
                        name="statusTicket"
                        error={
                          touched.statusTicket && Boolean(errors.statusTicket)
                        }
                      >
                        <MenuItem value={"closed"}>
                          {i18n.t("campaigns.dialog.form.closedTicketStatus")}
                        </MenuItem>
                        <MenuItem value={"open"}>
                          {i18n.t("campaigns.dialog.form.openTicketStatus")}
                        </MenuItem>
                      </Field>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6} xl={6}>
                    <FormControlLabel
                      control={
                        <Field
                          as={Switch}
                          color="primary"
                          name="assinar"
                          checked={values.assinar}
                          disabled={values.openTicket === "disabled"}
                        />
                      }
                      label={i18n.t("scheduleModal.form.assinar")}
                    />
                  </Grid>
                </Grid>
                <br />
                {/* Seção de Lembrete */}
                  <h3>Lembrete (Opcional)</h3>
                  <p>Defina uma data e mensagem de lembrete que será enviada antes do agendamento principal</p>
                  <br />
                <Grid container spacing={1}>
                  
                  <Grid container spacing={1}>
                    <Grid item xs={12} md={6} xl={6}>
                      <Field
                        as={TextField}
                        label="Data do Lembrete"
                        type="datetime-local"
                        name="reminderDate"
                        error={touched.reminderDate && Boolean(errors.reminderDate)}
                        helperText={touched.reminderDate && errors.reminderDate}
                        variant="outlined"
                        fullWidth
                        size="small"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6} xl={6}>
                      <Field
                        as={TextField}
                        label="Mensagem do Lembrete"
                        name="reminderMessage"
                        multiline
                        rows={3}
                        error={touched.reminderMessage && Boolean(errors.reminderMessage)}
                        helperText={touched.reminderMessage && errors.reminderMessage}
                        variant="outlined"
                        fullWidth
                        size="small"
                        disabled={!values.reminderDate || values.reminderDate === ""}
                        placeholder={values.reminderDate && values.reminderDate !== "" ? "Digite a mensagem do lembrete..." : "Selecione uma data de lembrete primeiro"}
                      />
                    </Grid>
                  </Grid>
                </Grid>
                <br />

                <h3>{i18n.t("recurrenceSection.title")}</h3>
                <p>{i18n.t("recurrenceSection.description")}</p>
                <br />
                <Grid container spacing={1}>
                  <Grid item xs={12} md={4} xl={4}>
                    <FormControl size="small" fullWidth variant="outlined">
                      <InputLabel id="demo-simple-select-label">
                        {i18n.t("recurrenceSection.labelInterval")}
                      </InputLabel>
                      <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={intervalo}
                        onChange={(e) => setIntervalo(e.target.value || 1)}
                        label={i18n.t("recurrenceSection.labelInterval")}
                      >
                        <MenuItem value={1}>
                          {i18n.t("recurrenceSection.options.days")}
                        </MenuItem>
                        <MenuItem value={2}>
                          {i18n.t("recurrenceSection.options.weeks")}
                        </MenuItem>
                        <MenuItem value={3}>
                          {i18n.t("recurrenceSection.options.months")}
                        </MenuItem>
                        <MenuItem value={4}>
                          {i18n.t("recurrenceSection.options.minutes")}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={4} xl={4}>
                    <Field
                      as={TextField}
                      label={i18n.t("recurrenceSection.intervalFilterValue")}
                      name="valorIntervalo"
                      size="small"
                      error={
                        touched.valorIntervalo && Boolean(errors.valorIntervalo)
                      }
                      InputLabelProps={{ shrink: true }}
                      variant="outlined"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={4} xl={4}>
                    <Field
                      as={TextField}
                      label={i18n.t("recurrenceSection.sendAsManyTimes")}
                      name="enviarQuantasVezes"
                      size="small"
                      error={
                        touched.enviarQuantasVezes &&
                        Boolean(errors.enviarQuantasVezes)
                      }
                      variant="outlined"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={12} xl={12}>
                    <FormControl size="small" fullWidth variant="outlined">
                      <InputLabel id="demo-simple-select-label">
                        {i18n.t("recurrenceSection.sendAsManyTimes")}
                      </InputLabel>
                      <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={tipoDias}
                        onChange={(e) => setTipoDias(e.target.value || 4)}
                        label="Enviar quantas vezes"
                      >
                        <MenuItem value={4}>
                          {i18n.t(
                            "recurrenceSection.shipNormallyOnNonbusinessDays"
                          )}
                        </MenuItem>
                        <MenuItem value={5}>
                          {i18n.t("recurrenceSection.sendOneBusinessDayBefore")}
                        </MenuItem>
                        <MenuItem value={6}>
                          {" "}
                          {i18n.t("recurrenceSection.sendOneBusinessDayLater")}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                {(schedule.mediaPath || attachment || quickMessageMedia) && (
                  <Grid xs={12} item>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Button startIcon={<AttachFile />}>
                        {attachment ? attachment.name :
                          quickMessageMedia ? quickMessageMedia.name :
                            schedule.mediaName}
                      </Button>
                      {quickMessageMedia && (
                        <Chip
                          label="Da Resposta Rápida"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      <IconButton
                        onClick={() => setConfirmationOpen(true)}
                        color="secondary"
                      >
                        <DeleteOutline color="secondary" />
                      </IconButton>
                    </div>
                  </Grid>
                )}
              </DialogContent>
              <DialogActions>
                {!attachment && !schedule.mediaPath && !quickMessageMedia && (
                  <Button
                    color="primary"
                    onClick={() => attachmentFile.current.click()}
                    disabled={isSubmitting}
                    variant="outlined"
                  >
                    {i18n.t("quickMessages.buttons.attach")}
                  </Button>
                )}
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("scheduleModal.buttons.cancel")}
                </Button>
                {(schedule.sentAt === null || schedule.sentAt === "") && (
                  <Button
                    type="submit"
                    color="primary"
                    disabled={isSubmitting}
                    variant="contained"
                    className={classes.btnWrapper}
                  >
                    {scheduleId
                      ? `${i18n.t("scheduleModal.buttons.okEdit")}`
                      : `${i18n.t("scheduleModal.buttons.okAdd")}`}
                    {isSubmitting && (
                      <CircularProgress
                        size={24}
                        className={classes.buttonProgress}
                      />
                    )}
                  </Button>
                )}
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default ScheduleModal;