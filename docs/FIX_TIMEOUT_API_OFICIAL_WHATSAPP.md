# 🔧 FIX — Lentidão no Sistema por Timeout em Cascata na API Oficial do WhatsApp

**Data:** 24/06/2026  
**Severidade:** 🔴 Crítica  
**Ambiente:** Produção  
**Reportado por:** Cliente (via suporte)  
**Investigado e corrigido por:** Natanael — Mibia Digital

---

## 📋 Sumário

- [Sintoma Relatado](#sintoma-relatado)
- [Investigação](#investigação)
- [Causa Raiz](#causa-raiz)
- [Por que a Lentidão era Intermitente](#por-que-a-lentidão-era-intermitente)
- [Solução Implementada](#solução-implementada)
- [Arquivos Alterados](#arquivos-alterados)
- [Como Monitorar Após o Fix](#como-monitorar-após-o-fix)

---

## Sintoma Relatado

O cliente relatou lentidão ao usar o CRM, especialmente ao **abrir conversas** — o sistema ficava carregando por vários segundos antes de exibir as mensagens. A lentidão ocorria em **momentos específicos do dia**, não de forma constante.

A equipe de TI do cliente verificou:
- ✅ Firewall SonicWall: nenhum bloqueio
- ✅ Links Embratel e Vivo: funcionando normalmente
- ✅ Acesso pelo 4G/5G: funciona rápido

Conclusão do lado do cliente: **o problema não era a rede deles**.

---

## Investigação

Após análise do servidor, foram coletados os seguintes dados:

### Logs do Backend (prova do problema)

```
AxiosError: timeout of 10000ms exceeded
  → sendMessageWhatsAppOficial (whatsAppOficial.service.js:37)
  → handleDispatchCampaign (queues.js:2129)

AxiosError: timeout of 10000ms exceeded
  → sendMessageWhatsAppOficial (whatsAppOficial.service.js:37)
  → ReceivedWhatsApp.getMessage (ReceivedWhatsApp.js:554)
  → RabbitMQListener.js:83
```

Esse erro aparecia **dezenas de vezes seguidas** nos logs, em sequência.

### Dados do servidor no momento da análise

| Métrica | Valor | Situação |
|---|---|---|
| Restarts do backend | **10 vezes** | ⚠️ Crashes por timeout em cascata |
| Chaves Bull no Redis | **79.045** | ⚠️ Acúmulo histórico de jobs |
| Memória PostgreSQL cache (`shared_buffers`) | **128 MB** para BD de 2,2 GB | ⚠️ Subotimizado |
| Erros por timeout na API Oficial | **Dezenas por hora** | 🔴 Causa raiz |

---

## Causa Raiz

### O fluxo problemático

O sistema possui dois canais de WhatsApp:
- **Baileys** — conexão via QR Code (WhatsApp Web)
- **API Oficial** — conexão via servidor intermediário próprio (`apiwpp.mibiadigital.com.br`)

Para enviar/receber mensagens pela API Oficial, o backend fazia uma chamada HTTP para o servidor intermediário:

```typescript
// CÓDIGO ANTES DA CORREÇÃO — whatsAppOficial.service.ts
const res = await axios.post(
  `https://apiwpp.mibiadigital.com.br/v1/send-message-whatsapp/${token}`,
  formData,
  {
    timeout: 10000  // Aguardava ATÉ 10 segundos por resposta
  }
);
// Se não viesse resposta em 10s → lançava erro e o worker ficava travado por 10s
```

### Por que isso derrubava o sistema inteiro?

O Node.js opera com uma **única thread de execução (event loop)**. Quando o código faz `await axios.post(...)`, ele aguarda a resposta antes de continuar. Durante essa espera (até 10 segundos), o worker da fila fica **bloqueado**.

Com **múltiplos workers de fila (Bull) rodando em paralelo** e o servidor intermediário lento, a situação era:

```
Worker 1 → chama API Oficial → espera 10s → timeout ❌ (travado)
Worker 2 → chama API Oficial → espera 10s → timeout ❌ (travado)
Worker 3 → chama API Oficial → espera 10s → timeout ❌ (travado)
Worker 4 → chama API Oficial → espera 10s → timeout ❌ (travado)
Worker N → chama API Oficial → espera 10s → timeout ❌ (travado)
...
```

Com **dezenas de workers travados simultaneamente**, o event loop do Node.js ficava saturado gerenciando todos esses timeouts ao mesmo tempo.

**Resultado:** Operações completamente não relacionadas à API Oficial — como abrir uma conversa, carregar tickets, renderizar a interface — ficavam lentas porque o servidor estava "sufocado".

### Diagrama do problema

```
[Servidor da Meta / apiwpp lento]
          ↓
  Todas as chamadas → esperam 10s cada
          ↓
  20 chamadas em paralelo → 20 workers travados por 10s cada
          ↓
  Event loop do Node.js saturado
          ↓
  Sistema inteiro lento (inclusive operações sem relação com a API)
          ↓
  Usuário: "O sistema está lento ao abrir conversas"
```

---

## Por que a Lentidão era Intermitente

A lentidão ocorria **exatamente nos momentos de maior tráfego da API Oficial**:

1. **Horários de pico de mensagens** — muitas mensagens chegando/saindo pela API Oficial ao mesmo tempo
2. **Execução de campanhas** — o `handleDispatchCampaign` disparava muitas chamadas simultâneas
3. **Cron `VerifyCampaignsDaatabase`** — roda a cada 20 segundos e pode acionar múltiplos jobs

Nos horários de baixo tráfego, o sistema funcionava normalmente — o que coincidia com o relato: *"naquele momento o acesso estava normal, mas confirma que a lentidão ocorre em momentos específicos do dia"*.

---

## Solução Implementada

A correção foi implementada em **3 camadas de proteção**, sem alterar a lógica de negócio existente.

---

### Camada 1 — Circuit Breaker por Conexão

**Arquivo criado:** `backend/src/libs/whatsAppOficial/circuitBreaker.ts`

O **Circuit Breaker** (disjuntor) é um padrão de resiliência que "abre o circuito" ao detectar falhas consecutivas, parando de chamar a API por um período de recuperação, e tentando novamente após esse período.

**Funcionamento:**

```
Estado CLOSED (normal)
  ↓ 3 falhas transitórias consecutivas
Estado OPEN (bloqueado por 30 segundos)
  → Qualquer chamada falha IMEDIATAMENTE em 0ms (sem aguardar timeout)
  ↓ após 30 segundos
Estado HALF-OPEN (teste de recuperação)
  → Permite 1 chamada de teste
  ↓ sucesso → volta para CLOSED ✅
  ↓ falha   → volta para OPEN por mais 30s
```

**Cada token de conexão WhatsApp possui seu próprio circuit breaker.** Se uma conexão tiver problema, apenas ela é bloqueada — as demais continuam funcionando normalmente.

**O ganho:** Antes, cada falha custava **10 segundos** de worker bloqueado. Com o circuit breaker aberto, a falha acontece em **~0 milissegundos**, liberando o worker imediatamente.

```typescript
// EXEMPLO DO NOVO COMPORTAMENTO
// Após 3 falhas seguidas:
[Circuit Breaker] "whatsapp-oficial:tC05q1MBOB..." → OPEN
// Próximas 50 chamadas falham em 0ms, em vez de esperar 15s cada
[Circuit Breaker] Circuito ABERTO. Aguardando recuperação em 28s.
// Após 30s:
[Circuit Breaker] "whatsapp-oficial:tC05q1MBOB..." → HALF_OPEN
// Testa uma chamada:
[Circuit Breaker] "whatsapp-oficial:tC05q1MBOB..." → CLOSED ✅
```

---

### Camada 2 — Retry com Backoff Exponencial

**Arquivo modificado:** `backend/src/libs/whatsAppOficial/whatsAppOficial.service.ts`

**O que mudou:**

| | Antes | Depois |
|---|---|---|
| Timeout | 10 segundos | **15 segundos** (margem para mídia) |
| Tentativas | 1 (sem retry) | **3 tentativas** (1 inicial + 2 retries) |
| Delay entre tentativas | — | **1s → 3s** (backoff exponencial) |
| Erros 4xx (negócio) | Tentava de novo | **Falha imediata** (sem retry inútil) |

**Fluxo do retry:**

```
1ª tentativa → timeout/rede → aguarda 1s
2ª tentativa → timeout/rede → aguarda 3s  
3ª tentativa → timeout/rede → erro definitivo → Circuit Breaker conta +1 falha

Se erro 400/401/403 (Meta recusou):
  → Falha imediata, sem retry (tentar de novo não adiantaria)
```

---

### Camada 3 — Tratamento Específico no Handler de Envio

**Arquivo modificado:** `backend/src/services/WhatsAppOficial/SendWhatsAppOficialMessage.ts`

Adicionado tratamento explícito do `CircuitOpenError`:

```typescript
} catch (err) {
  // Circuit Breaker aberto — falha rápida, sem processamento desnecessário
  if (err instanceof CircuitOpenError) {
    logger.warn(
      `[WHATSAPP OFICIAL - CIRCUIT OPEN] Envio bloqueado pelo Circuit Breaker ` +
      `(Ticket: ${ticket.id}, Recuperação em ${Math.ceil(err.recoveryIn / 1000)}s).`
    );
    throw new AppError("ERR_WHATSAPP_OFICIAL_UNAVAILABLE");
  }
  // ... tratamento de outros erros
}
```

Isso garante que quando o circuit breaker está aberto, o sistema:
1. Loga de forma clara com o tempo de recuperação restante
2. Não tenta salvar mensagem no banco (inútil se não foi enviada)
3. Retorna um código de erro específico (`ERR_WHATSAPP_OFICIAL_UNAVAILABLE`) em vez do genérico

---

## Antes vs. Depois

```
ANTES:
──────
API Oficial lenta/offline
  ↓
Chamada 1 → espera 10s → ❌ (worker travado 10s)
Chamada 2 → espera 10s → ❌ (worker travado 10s)
Chamada 3 → espera 10s → ❌ (worker travado 10s)
... 20 workers travados simultaneamente ...
  ↓
Event loop saturado
  ↓
Sistema inteiro lento — usuários reclamam

DEPOIS:
───────
API Oficial lenta/offline
  ↓
Chamada 1 → 3 tentativas com retry → ❌ → Circuit OPEN
Chamada 2 → Circuit OPEN → ❌ em 0ms (worker livre imediatamente)
Chamada 3 → Circuit OPEN → ❌ em 0ms (worker livre imediatamente)
... 20 workers → todos livres em ms ...
  ↓
Event loop livre
  ↓
Sistema responde normalmente para os usuários

Após 30s:
  → Circuit HALF-OPEN → testa → API voltou? → Circuit CLOSED ✅
  → Mensagens voltam a ser enviadas normalmente
```

---

## Arquivos Alterados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `backend/src/libs/whatsAppOficial/circuitBreaker.ts` | **NOVO** | Implementação completa do Circuit Breaker |
| `backend/src/libs/whatsAppOficial/whatsAppOficial.service.ts` | Modificado | Integração do Circuit Breaker + retry + timeout 15s |
| `backend/src/services/WhatsAppOficial/SendWhatsAppOficialMessage.ts` | Modificado | Tratamento específico do `CircuitOpenError` |

---

## Como Monitorar Após o Fix

Monitore os logs do backend para ver o circuit breaker em ação:

```bash
# Ver todos os eventos do circuit breaker em tempo real
pm2 logs backend | grep -i "circuit"

# Ver erros de timeout (devem diminuir drasticamente)
pm2 logs backend | grep -i "timeout"
```

### O que você verá nos logs quando a API Oficial tiver instabilidade:

```
# Antes (ainda tentando com retries):
WARN [WHATSAPP-OFICIAL] Erro transitório na tentativa 1/3: timeout...
WARN [WHATSAPP-OFICIAL] Retry 1/2 para 5511999999999 em 1000ms...
WARN [WHATSAPP-OFICIAL] Erro transitório na tentativa 2/3: timeout...
WARN [WHATSAPP-OFICIAL] Retry 2/2 para 5511999999999 em 3000ms...

# Circuit abrindo (após 3 falhas):
WARN [Circuit Breaker] "whatsapp-oficial:tC05q1MBOB..." → OPEN após 3 falha(s)

# Chamadas seguintes bloqueadas imediatamente:
WARN [WHATSAPP OFICIAL - CIRCUIT OPEN] Envio bloqueado (Ticket: 105400, Recuperação em 28s)
WARN [WHATSAPP OFICIAL - CIRCUIT OPEN] Envio bloqueado (Ticket: 105401, Recuperação em 26s)

# API se recuperou:
INFO [Circuit Breaker] "whatsapp-oficial:tC05q1MBOB..." → HALF_OPEN. Testando...
INFO [Circuit Breaker] "whatsapp-oficial:tC05q1MBOB..." → CLOSED. API recuperada ✅
```

---

## Observações Adicionais

Além do problema principal corrigido, a análise identificou outros pontos de atenção para futuras melhorias:

1. **PostgreSQL `shared_buffers = 128 MB`** — configuração padrão de instalação, nunca otimizada. Para um banco de 2,2 GB, o recomendado é 512 MB. Ajuste deve ser feito em janela de manutenção com restart do PostgreSQL.

2. **79.045 chaves Bull no Redis** — acúmulo de jobs históricos (completados/falhados) nunca limpos. Adicionar `removeOnComplete: { count: 500 }` nas filas em versão futura.

3. **Tabela `Messages` com 1,96 GB** — considerar arquivamento de mensagens com mais de 6 meses para manter performance das queries.
