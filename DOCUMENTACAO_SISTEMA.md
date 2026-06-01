# 📘 Documentação de Funcionalidades do Sistema (CRM Multicanal)

Este documento descreve as principais funcionalidades, a arquitetura geral de funcionamento e todos os módulos (com suas respectivas abas e sub-abas) do sistema de atendimento e automação para WhatsApp (CRM Multicanal).

---

## 🏗️ 1. Como o Sistema Funciona (Visão Geral)

O sistema é uma plataforma de atendimento multicanal e automação voltada para o WhatsApp, operando sob o modelo SaaS (Software as a Service) Multi-tenant. Suas principais premissas de funcionamento são:

*   **Multi-tenant (Multi-empresas):** Permite isolar completamente os dados de diferentes empresas (clientes do sistema) em uma mesma base de dados. Cada empresa gerencia suas próprias conexões de WhatsApp, atendentes, contatos e automações.
*   **Multi-agente (Multi-atendentes):** Vários operadores humanos (atendentes) podem compartilhar os mesmos números de WhatsApp. O sistema gerencia o fluxo de distribuição das conversas de forma automática ou manual através de filas de atendimento.
*   **Distribuição por Filas (Departamentos):** O atendimento é estruturado em filas (como Suporte, Comercial, Financeiro). O cliente que entra em contato interage com um menu interativo e é direcionado para a fila correta e para os atendentes vinculados a essa fila.
*   **Automação Visual (Flowbuilder) e IA:** Além de atendimento humano, o sistema possui um construtor visual de fluxos de conversa (chatbot) com suporte a integrações com inteligências artificiais (OpenAI, Gemini), chatbots externos (Typebot, Dialogflow) e plataformas de automação (N8N, Webhooks).
*   **Controle de Conexões:** Utiliza bibliotecas modernas (como Baileys) para conectar números de WhatsApp via QR Code de forma estável, com suporte a envio de textos, botões, mídias e recebimento em tempo real via WebSockets.

---

## 📂 2. Estrutura de Módulos, Abas e Funcionalidades

Abaixo está o mapeamento detalhado de cada módulo presente no menu lateral do sistema, com suas respectivas rotas e recursos.

---

### 📊 Módulo: Gerência (Menu Retrátil)

Este módulo é restrito a administradores e usuários com permissão de visualização de relatórios/gerência.

*   **Dashboard (`/`):**
    *   Painel analítico inicial com gráficos e métricas de desempenho.
    *   Exibição de quantidade de atendimentos realizados, tempos médios de espera (TME), tempos médios de atendimento (TMA) e avaliações dos clientes.
*   **Relatórios (`/reports`):**
    *   Filtros avançados por período, conexão, fila e atendente.
    *   Histórico e exportação de atendimentos contendo ID do ticket, atendente, cliente, datas de abertura/fechamento, fila de atendimento, tempo de suporte e avaliação NPS (Net Promoter Score).
*   **Painel de Atendimentos (`/moments`):**
    *   Monitoramento em tempo real dos atendimentos que estão acontecendo na plataforma.
    *   Permite que o gerente veja quem está conversando com quem em tempo real para fins de auditoria e suporte operacional.
*   **Carteiras (`/wallets`):**
    *   Permite gerenciar o direcionamento direto de clientes/tickets para carteiras específicas (atendentes específicos de referência), garantindo atendimento personalizado para contas chaves.

---

### 💬 Módulo: Atendimentos (Tickets) (`/tickets`)

A tela principal do sistema onde os operadores realizam o atendimento ao cliente.

*   **Painel Lateral de Chats:**
    *   **Abertos:** Chats que estão sob atendimento de algum operador.
    *   **Aguardando:** Fila de espera de clientes aguardando aceitação manual por um operador ou direcionamento automático.
    *   **Grupos:** Área dedicada para conversas em grupos de WhatsApp.
    *   **Resolvidos (Aba Histórico):** Visualização de tickets que já foram finalizados.
*   **Área de Conversa (Chat Box):**
    *   Envio e recebimento de mensagens de texto, mídias (áudio gravado na hora, imagens, vídeos, arquivos), emojis e localização.
    *   **Opções de Fechamento:** Encerrar ticket enviando a mensagem de despedida padrão ou fechar sem enviar a mensagem.
    *   **Transferência de Chamados:** Transferir o ticket de forma simples para outro atendente ou outra fila de atendimento, permitindo incluir notas internas que não são vistas pelo cliente.
    *   **Devolver à Fila:** Desvincular-se do atendimento e colocá-lo novamente como "Aguardando" na fila.
    *   **Agendamento:** Atalho direto para programar um envio futuro para aquele contato.
    *   **Disparar Fluxo:** Permite que o atendente force o disparo manual de um chatbot (Fluxo do Flowbuilder) específico para aquele cliente.
    *   **Respostas Rápidas (Atalho `/`):** Seleção rápida de mensagens prontas para agilizar o atendimento.
    *   **Exportar PDF:** Download do histórico completo da conversa formatado.

---

### ⚡ Módulo: Respostas Rápidas (`/quick-messages`)

*   Cadastro de atalhos rápidos digitados pelo operador (ex: `/boasvindas` para enviar uma mensagem longa de saudação).
*   Suporte a mensagens com anexo de mídias/arquivos.
*   Opção de definir mensagens como globais (para toda a empresa) ou restritas a atendentes específicos.

---

### 📄 Módulo: Templates (`/templates`)

*   Gestão de modelos de mensagens pré-aprovados pela Meta (WhatsApp Business API/HSM).
*   Categorização (Autenticação, Marketing, Utilidade) e controle de idiomas.
*   Estruturação dos templates em Cabeçalho, Corpo, Rodapé e Botões interativos (Quick Reply, Link URL, Telefone).
*   Acompanhamento de status de aprovação oficial do template (Aprovado, Pendente, Rejeitado, Desabilitado).

---

### 📋 Módulo: Kanban (`/kanban`)

*   Visualização dos contatos/tickets em formato de quadro Kanban (colunas verticais).
*   Permite arrastar e soltar clientes entre diferentes colunas para controle de funil de vendas ou processos internos.
*   **Sub-abas / Divisões:**
    *   **Painel:** Visualização dos cards do Kanban.
    *   **Lanes (TagsKanban - `/TagsKanban`):** Cadastro e ordenação das colunas do quadro.

---

### 👥 Módulo: Contatos (`/contacts`)

*   Base de dados de clientes cadastrados.
*   Pesquisa de contatos por nome, telefone ou e-mail.
*   Criação manual de contatos ou importação em massa via planilha (CSV/XLSX) na rota `/contacts/import`.

---

### 📅 Módulo: Agendamentos (`/schedules`)

*   Listagem e criação de mensagens agendadas.
*   Permite selecionar o contato, definir a data/hora exata do envio, redigir a mensagem e escolher se deseja anexar a assinatura do atendente.

---

### 🏷️ Módulo: Tags (`/tags`)

*   Cadastro de etiquetas coloridas para categorização de clientes e conversas.
*   **Integração Kanban:** Cada tag pode ser configurada como uma coluna do Kanban, com regras de automação como:
    *   Tempo máximo de permanência do cliente na coluna.
    *   Redirecionamento automático de lane quando o tempo expira.
    *   Mensagem de saudação automática ao entrar na lane.
    *   Definição de lane de retorno ao retomar um atendimento.

---

### 💬 Módulo: Chat Interno (`/chats`)

*   Ferramenta de comunicação interna para a equipe da empresa.
*   Permite chats individuais privados entre atendentes ou criação de grupos/salas internas de discussão.

---

### 🎂 Módulo: Configurações de Aniversário (`/birthday-settings`)

*   **Aniversários de Usuários (Equipe):**
    *   Opção de habilitar/desabilitar notificações para aniversariantes internos da empresa.
    *   Criação automática de informativos visíveis para toda a equipe.
    *   Customização da mensagem com a variável `{nome}`.
*   **Aniversários de Contatos (Clientes):**
    *   Opção de disparar automaticamente uma mensagem de parabéns no WhatsApp do cliente no dia do aniversário dele.
    *   Customização da mensagem utilizando as variáveis `{nome}` e `{idade}`.
    *   Botão para realizar teste de envio sob demanda.
*   **Configurações Gerais:**
    *   Definição da hora exata do dia para verificação e envio automático das mensagens (ex: às 09:00).

---

### 🎯 Módulo: Campanhas (Menu Retrátil)

Destinado a disparos em massa e marketing de relacionamento.

*   **Listagem (`/campaigns`):**
    *   Criação de campanhas de envio em massa.
    *   Seleção da conexão de WhatsApp remetente, lista de contatos destinatária, tags de destino, data/hora de agendamento e até 5 variações de mensagens para rotacionar o envio e mitigar bloqueios.
    *   Opção de anexar mídias.
    *   Opção de definir o status que o ticket deve assumir no painel de atendimentos após o disparo da campanha (Aberto, Pendente, Fechado).
*   **Lista de contatos (`/contact-lists`):**
    *   Criação de listas de distribuição separadas para uso exclusivo em campanhas.
    *   Importação de contatos para a lista específica.
*   **Configurações (`/campaigns-config`):**
    *   Ajustes de segurança para evitar banimentos no WhatsApp.
    *   Configuração de intervalos randômicos de segundos entre mensagens e pausas automáticas maiores após o envio de uma quantidade determinada de mensagens (ex: pausar por X minutos a cada Y disparos).
*   **Relatório de Campanhas (`/campaign/:campaignId/report`):**
    *   Resumo estatístico com quantidade de contatos válidos, mensagens entregues, respostas/confirmações recebidas e status atual da campanha (Programada, Em Andamento, Finalizada, Cancelada).

---

### 🔀 Módulo: Flowbuilder (Automações/Fluxos - Menu Retrátil)

O coração de automação do sistema.

*   **Fluxo de Campanha (`/phrase-lists`):**
    *   Associa palavras-chave ou gatilhos textuais a campanhas ou regras de roteamento específicas.
*   **Fluxo de Conversa (`/flowbuilders`):**
    *   Visualizador e listador de fluxos de chatbot ativos na plataforma.
*   **Editor de Fluxos (`/flowbuilder/:id`):**
    *   Interface visual no estilo "drag and drop" (arrastar e soltar) para desenhar a árvore de decisão do robô.
    *   **Tipos de Blocos de Ação Disponíveis:**
        1.  *Texto:* Envia uma mensagem textual.
        2.  *Imagem / Vídeo / Áudio:* Envio de arquivos de mídia pré-configurados.
        3.  *Menu:* Apresenta opções numéricas de resposta para o cliente avançar no fluxo.
        4.  *Entrada (Pergunta):* Coleta um dado digitado pelo cliente e o salva em uma variável.
        5.  *Condição:* Desvia o caminho do fluxo comparando dados de variáveis (ex: se a variável "uf" é igual a "SP").
        6.  *Adicionar/Remover Tag:* Adiciona/remove etiquetas do contato de forma silenciosa.
        7.  *Definir Atendente:* Direciona o ticket diretamente para um operador específico.
        8.  *Mover para Fila (Ticket):* Envia o ticket para uma fila específica e altera o status para aberto para atendimento humano.
        9.  *Mover de Fluxo (Switch Flow):* Transfere o cliente de um fluxo de automação para outro.
        10. *Intervalo:* Aguarda um tempo determinado antes de seguir para a próxima ação.
        11. *Randomizador:* Distribui contatos aleatoriamente entre caminhos diferentes (A/B testing ou balanceamento de carga).
        12. *Integração Typebot:* Roda fluxos externos criados na plataforma Typebot de maneira transparente.
        13. *Integração OpenAI/Gemini:* Conecta a inteligência artificial generativa com prompts customizados para responder ao cliente.

---

### ⚙️ Módulo: Administração (Menu Retrátil)

Módulo gerencial completo voltado a administradores do sistema e super-usuários (saas owners).

*   **Informativos (`/announcements`):**
    *   Área para cadastro de comunicados e novidades da plataforma, com suporte a prioridade (Alta, Média, Baixa) e anexo de mídias. Visível aos usuários na dashboard.
*   **API (`/messages-api`):**
    *   Documentação integrada para integração do sistema com sistemas externos.
    *   Permite gerar tokens de acesso para envio de mensagens de texto e mídia a partir de ERPs, CRMs externos, etc.
*   **Usuários (`/users`):**
    *   Gerenciamento da equipe de atendimento da empresa.
    *   Configuração de nome, e-mail, senha, conexão padrão de WhatsApp, horário de expediente (início e término de trabalho) e perfil (User/Admin).
    *   **Permissões avançadas:** Visualizar chamados sem fila, ver conversas de outras filas, ver conversas de outros usuários, permitir fechar tickets pendentes, visualizar tickets pendentes, permitir visualização de relatórios, acesso ao painel de atendimento e permissão para gerenciar conexões.
*   **Filas & Chatbot (`/queues`):**
    *   Criação de departamentos/setores de atendimento com cores específicas.
    *   Configuração de mensagem de saudação do departamento.
    *   Configuração de botões/opções de resposta automática de primeiro nível (chatbot básico integrado à fila).
*   **Talk.Ai (`/prompts`):**
    *   Gerenciamento de prompts da Inteligência Artificial (OpenAI/ChatGPT).
    *   Configuração do comportamento do bot, temperatura da resposta, tokens máximos e instruções de personalidade para o assistente virtual.
*   **Integrações (`/queue-integration`):**
    *   Configuração de conectores com ferramentas como Typebot, Dialogflow, Webhooks gerais de saída e fluxos N8N.
*   **Conexões (`/connections`):**
    *   Gerenciamento de canais ativos na empresa.
    *   Exibe o QR Code para pareamento do WhatsApp.
    *   Indica status do canal (qrcode, pairing, conectado, desconectado).
    *   Configuração de mensagem de saudação global, mensagem de despedida global, mensagem de fora do expediente, tempo de inatividade para fechamento automático e token da API da conexão.
*   **Gerenciar Conexões (`/allConnections` - SuperAdmin):**
    *   Visão global de todas as conexões ativas no sistema em todas as empresas inquilinas da plataforma.
*   **Financeiro (`/financeiro`):**
    *   Painel onde a empresa visualiza seu plano ativo, data de vencimento e histórico de faturas.
    *   Integração para pagamento de faturas via PIX, MercadoPago ou Stripe.
*   **Configurações (`/settings`):**
    *   Configurações gerais da empresa: fuso horário padrão, limite de tempo de atendimento, roteamento automático de carteiras, seleção de tema visual inicial (Claro/Escuro), upload de logos personalizadas e customização de cores da aplicação.
*   **Empresas (`/companies` - SuperAdmin):**
    *   Gerenciamento de todas as empresas clientes do SaaS.
    *   Permite criar novas empresas, alterar planos de assinatura, definir limites de atendentes, conexões e filas permitidas, habilitar/desabilitar módulos específicos (Campanhas, API externa, Chat Interno, Agendamento) e definir vencimento da licença.
*   **Backup de Mensagens (`/backup`):**
    *   Gerenciamento e download de backups do banco de dados contendo mensagens do WhatsApp e do Chat Interno.
    *   **Backups Automáticos:** Gerados diariamente às 02:00 e mantidos por 15 dias.
    *   **Backups Sob Demanda:** Geração de arquivos CSV de períodos customizados (limite de 30 dias por lote).

---

### 📝 Outras Funcionalidades

*   **Lista de Tarefas (`/todolist`):**
    *   Agenda simples de tarefas/lembretes integrada no sistema para que cada atendente possa gerenciar suas obrigações diárias de suporte diretamente na plataforma.
