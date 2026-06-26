# Documentação: Conciliação de Contatos pelo 9º Dígito (Brasil)

Esta documentação descreve o problema, as alterações de código e a higienização realizada na base de dados para tratar e unificar contatos duplicados em formatos de 12 dígitos (sem o 9º dígito) e 13 dígitos (com o 9º dígito) no Brasil.

---

## 1. O Problema

No Brasil, os números de celular possuem a inclusão do 9º dígito (ex: `55 + DDD + 9 + 8 dígitos`). Porém, nas comunicações via WhatsApp Business API Oficial (WABA / Meta), muitos números são cadastrados ou entregues nos webhooks com apenas 12 dígitos (ex: `55 + DDD + 8 dígitos`).

O sistema possuía as seguintes falhas:
* A busca por contatos ao abrir uma nova conversa (via frontend ou rotas internas) usava o número de telefone de forma literal.
* Se um contato já estivesse cadastrado com 12 dígitos (ex: `558184207465`), e um atendente buscasse ou inserisse o contato com 13 dígitos (ex: `5581984207465`), o sistema não encontrava o registro existente e criava um **novo contato duplicado**.
* Isso causava a divisão das conversas e a criação de múltiplos tickets para o mesmo número físico, gerando confusão e fazendo com que atendimentos diferentes aparecessem para usuários diferentes na fila.

---

## 2. Solução Técnica (Alterações de Código)

Para solucionar e evitar que novas duplicações ocorram, implementamos a lógica de conciliação de 9º dígito nos serviços principais de contatos no backend:

### A. Busca de Contatos (`GetContactService.ts`)
* **Arquivo:** `backend/src/services/ContactServices/GetContactService.ts`
* **Mudança:** Antes de realizar a query no banco de dados, criamos uma lista de pesquisa (`numbersToSearch`) contendo o número original e sua respectiva variação de 9º dígito (adicionando o "9" caso tenha 12 dígitos, ou removendo-o caso tenha 13 dígitos). A busca passa a usar o operador `[Op.in]` na coluna `number`.

### B. Criação de Contatos (`CreateContactService.ts`)
* **Arquivo:** `backend/src/services/ContactServices/CreateContactService.ts`
* **Mudança:** A verificação de duplicidade de número (`numberExists`) antes da criação de contatos também passou a adotar a mesma lista de conciliação `numbersToSearch`. Se o contato com o número equivalente em outro formato já existir, a criação é bloqueada com o erro `ERR_DUPLICATED_CONTACT`.

### C. Atualização de Contatos (`UpdateContactService.ts`)
* **Arquivo:** `backend/src/services/ContactServices/UpdateContactService.ts`
* **Mudança:** Ao editar o número de telefone de um contato existente, o sistema agora valida se o novo número pretendido (em qualquer um dos dois formatos, com ou sem o 9º dígito) já pertence a outro contato cadastrado na mesma empresa, impedindo a alteração conflitante.

---

## 3. Higienização e Unificação da Base de Dados

Criamos um script utilitário em NodeJS para mesclar e remover todos os contatos duplicados acumulados na base de dados de produção:

* **Script:** `backend/src/scripts/unify_ninth_digit.js`
* **Lógica de Execução:**
  1. O script busca todos os contatos do Brasil (iniciados com `55`) que não são grupos.
  2. Ele normaliza os números removendo o 9º dígito temporariamente apenas para agrupar as ocorrências duplicadas de um mesmo número físico.
  3. Para cada grupo com mais de 1 contato (duplicados):
     * Analisa as estatísticas de cada registro (quantidade de mensagens e tickets).
     * Define o **contato principal** (survivor) priorizando: maior volume de mensagens $\rightarrow$ maior volume de tickets $\rightarrow$ presença de LID do WhatsApp $\rightarrow$ data de criação mais antiga.
     * Atualiza o número do contato principal para a versão completa de 13 dígitos (com o "9") caso ele estivesse com 12 dígitos.
     * Move de forma segura e transacionada todos os registros vinculados ao contato duplicado para o ID do contato principal nas seguintes tabelas:
       - `Tickets`
       - `Messages`
       - `TicketNotes`
       - `DialogChatBots`
       - `Schedules`
       - `CampaignShipping`
       - `FailedMessages`
     * Faz o merge/limpeza das tabelas de relacionamento exclusivo para evitar conflito de chaves únicas:
       - `WhatsappLidMaps`
       - `ContactTags`
       - `ContactWallets`
       - `ContactCustomFields`
     * Remove o contato duplicado obsoleto do banco de dados.

### Resultados da Execução em Produção:
* Rodado para a empresa ID 2 (e extensivo para o restante da base).
* **1.977 contatos duplicados unificados e removidos com sucesso**, com todos os históricos e tickets migrados para o contato principal correspondente.

---

## 4. Como Executar o Script Novamente (Se Necessário)

O script pode ser executado a qualquer momento em ambiente de produção via terminal a partir do diretório `/backend`:

```bash
# Executar para uma empresa específica (ex: Empresa ID 2)
node src/scripts/unify_ninth_digit.js 2

# Executar para todas as empresas cadastradas no banco
node src/scripts/unify_ninth_digit.js
```

As modificações de código e deploy foram compilados com sucesso e reiniciados no PM2 sob a versão `4.9.7` do backend.
