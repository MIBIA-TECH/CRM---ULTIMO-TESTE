# 🔧 Otimização de Performance — CRM Multicanal

**Data:** 24–26/06/2026  
**Ambiente:** Produção  
**Reportado por:** Clientes (lentidão intermitente ao usar o sistema)  
**Executado por:** Natanael — Mibia Digital

---

## 📋 Índice

1. [Contexto — O que estava acontecendo](#1-contexto)
2. [Diagnóstico realizado](#2-diagnóstico)
3. [Correção 1 — Circuit Breaker na API Oficial do WhatsApp](#3-correção-1--circuit-breaker-na-api-oficial-do-whatsapp)
4. [Correção 2 — Limpeza e manutenção do Redis Bull](#4-correção-2--limpeza-e-manutenção-do-redis-bull)
5. [Correção 3 — Otimização do PostgreSQL](#5-correção-3--otimização-do-postgresql)
6. [Correção 4 — Campanhas travadas em EM_ANDAMENTO (26/06)](#6-correção-4--campanhas-travadas-em-em_andamento-2606)
7. [Situação atual e pendências](#7-situação-atual-e-pendências)

---

## 1. Contexto

Clientes reportaram **lentidão intermitente** ao usar o CRM — especialmente ao abrir conversas, que ficavam "carregando" por vários segundos. A lentidão ocorria em momentos específicos do dia, não de forma constante.

A equipe de TI do cliente verificou a rede e o firewall (SonicWall, links Embratel e Vivo) e não encontrou nenhum bloqueio externo. O problema era **interno ao servidor do CRM**.

---

## 2. Diagnóstico

Após análise dos logs, banco de dados e Redis, foram identificados os seguintes problemas:

| # | Problema | Gravidade |
|---|---|---|
| 1 | Timeouts em cascata na API Oficial do WhatsApp saturando o event loop do Node.js | 🔴 Crítico |
| 2 | Backend com 10 restarts (crashes causados pelo problema #1) | 🟠 Alto |
| 3 | 79.045 chaves Bull acumuladas no Redis (jobs históricos nunca limpos) | 🟠 Alto |
| 4 | PostgreSQL com `shared_buffers = 128MB` para um banco de 2,2 GB (nunca otimizado) | 🟠 Alto |
| 5 | Tabela `Messages` com 901 mil registros e subconsultas correlacionadas | 🟡 Médio |
| 6 | Cron de fechamento automático sem controle de concorrência | 🟡 Médio |

Os problemas 1, 3 e 4 foram corrigidos nesta sessão. Os problemas 5 e 6 ficaram registrados para futuras sprints.

---

## 3. Correção 1 — Circuit Breaker na API Oficial do WhatsApp

**Data:** 24/06/2026

### O problema

O backend chamava o servidor intermediário da API Oficial (`apiwpp.mibiadigital.com.br`) via HTTP para enviar/receber mensagens. Quando esse servidor ficava lento, cada chamada aguardava até **10 segundos** de timeout.

Com múltiplos workers de fila (Bull) rodando em paralelo, dezenas de chamadas simultâneas ficavam travadas aguardando timeout ao mesmo tempo, **saturando o event loop do Node.js** e tornando todo o sistema lento — inclusive operações sem relação com a API Oficial (como abrir conversas).

```
Antes:
  Worker 1 → API lenta → espera 10s → timeout (travado)
  Worker 2 → API lenta → espera 10s → timeout (travado)
  Worker N → API lenta → espera 10s → timeout (travado)
  → Event loop saturado → sistema inteiro lento

Depois:
  Worker 1 → API lenta → 3 tentativas → Circuit OPEN
  Worker 2 → Circuit OPEN → falha em 0ms (livre!)
  Worker N → Circuit OPEN → falha em 0ms (livre!)
  → Event loop livre → sistema responde normalmente
  → Após 30s → testa novamente → API voltou? → Circuit CLOSED ✅
```

### Solução implementada (3 camadas)

#### Camada 1 — Circuit Breaker por conexão
**Arquivo criado:** `backend/src/libs/whatsAppOficial/circuitBreaker.ts`

Implementa o padrão Circuit Breaker com 3 estados:
- **CLOSED** → operação normal
- **OPEN** → API indisponível, chamadas falham em 0ms por 30 segundos
- **HALF_OPEN** → teste de recuperação após 30s

Cada token de conexão WhatsApp tem seu próprio circuit breaker — se uma conexão tem problema, as outras continuam funcionando.

#### Camada 2 — Retry com backoff exponencial
**Arquivo modificado:** `backend/src/libs/whatsAppOficial/whatsAppOficial.service.ts`

- Timeout ajustado de 10s para **15s** (margem para upload de mídia)
- **2 retries** automáticos para erros transitórios (rede/timeout): aguarda 1s → tenta → aguarda 3s → tenta
- Erros de negócio (400/401/403 da Meta) falham imediatamente sem retry

#### Camada 3 — Tratamento do CircuitOpenError
**Arquivo modificado:** `backend/src/services/WhatsAppOficial/SendWhatsAppOficialMessage.ts`

Quando o circuit breaker está aberto, o erro é capturado e logado claramente com o tempo de recuperação restante, sem tentar operações desnecessárias no banco.

### Como monitorar

```bash
# Ver eventos do circuit breaker em tempo real
pm2 logs backend | grep -i "circuit"

# Ver erros de timeout
pm2 logs backend | grep -i "timeout"
```

**Log esperado quando a API estiver instável:**
```
WARN [Circuit Breaker] "whatsapp-oficial:tC05q1MBOB..." → OPEN após 3 falha(s)
WARN [WHATSAPP OFICIAL - CIRCUIT OPEN] Envio bloqueado (Ticket: 105400, Recuperação em 28s)
INFO [Circuit Breaker] "whatsapp-oficial:tC05q1MBOB..." → CLOSED. API recuperada ✅
```

---

## 4. Correção 2 — Limpeza e manutenção do Redis Bull

**Data:** 25/06/2026

### O problema

O Redis acumulou **79.045 chaves** de jobs Bull que já haviam sido processados e nunca foram limpos. O maior acúmulo era na `CampaignQueue:completed` com **72.457 jobs** de campanhas antigas.

> ⚠️ **Importante:** Apenas os jobs `:completed` e `:failed` (histórico) foram limpos. Os jobs `:delayed` (agendados para o futuro), `:repeat` (configuração dos crons) e `:active` (em execução) **não foram tocados**.

### O que foi feito

#### Limpeza imediata via Redis CLI
Removidas as chaves de jobs históricos acumulados:

```bash
redis-cli DEL "bull:CampaignQueue:completed"       # 72.457 jobs
redis-cli DEL "bull:SendSacheduledMessages:failed"  # 113 jobs
# + demais filas :completed e :failed
```

**Resultado:** `CampaignQueue:completed` de 72.457 → **21 jobs** (apenas os recentes)

#### Configuração automática de limpeza futura
**Arquivo modificado:** `backend/src/queues.ts`

Adicionado `defaultJobOptions` em todas as 7 filas Bull:

```typescript
const defaultJobOptions: BullQueue.JobOptions = {
  removeOnComplete: { count: 200 }, // mantém só os últimos 200 completed
  removeOnFail: { count: 50 }       // mantém só os últimos 50 failed
};
```

Aplicado em: `userMonitor`, `scheduleMonitor`, `sendScheduledMessages`, `campaignQueue`, `queueMonitor`, `lidRetryQueue`, `messageQueue`.

**Resultado:** O Redis nunca mais vai acumular dezenas de milhares de jobs históricos.

### Verificação pós-limpeza

```bash
# Verificar que crons continuam intactos
redis-cli ZRANGE "bull:CampaignQueue:repeat" 0 -1
redis-cli ZRANGE "bull:ScheduleMonitor:repeat" 0 -1

# Verificar tamanho atual das filas
redis-cli ZCARD "bull:CampaignQueue:completed"
```

---

## 5. Correção 3 — Otimização do PostgreSQL

**Data:** 25/06/2026  
**Backup criado:** `/etc/postgresql/17/main/postgresql.conf.backup_20260625_093647`

### O problema

O PostgreSQL estava com as configurações padrão de instalação — nunca ajustadas para o tamanho real do servidor. Com `shared_buffers = 128MB` para um banco de **2,2 GB**, apenas 5,8% dos dados cabia em memória RAM. O restante precisava ser lido do disco a cada query, resultando em ~45% de cache miss.

### Parâmetros ajustados

**Arquivo:** `/etc/postgresql/17/main/postgresql.conf`

| Parâmetro | Antes | Depois | Motivo |
|---|---|---|---|
| `shared_buffers` | `128MB` | **`512MB`** | Cache de dados em RAM (~23% do banco) |
| `work_mem` | `4MB` (desativado) | **`16MB`** | Memória para sorts e joins por operação |
| `effective_cache_size` | `4GB` (desativado) | **`8GB`** | Dica para o planner — não aloca RAM |
| `maintenance_work_mem` | `64MB` (desativado) | **`256MB`** | VACUUM e criação de índices mais rápidos |
| `checkpoint_completion_target` | padrão | **`0.9`** | Distribui I/O de checkpoint, reduz picos |

**Servidor:** 15 GB RAM, 4 CPUs — todos os valores dentro de limites seguros.

### Impactos

| Parâmetro | Impacto negativo |
|---|---|
| `shared_buffers` | Nenhum — servidor tem RAM de sobra |
| `work_mem` | Baixo — no pior caso absoluto (500 conexões simultâneas com sort) usaria 8GB. Na prática com 20-50 conexões ativas = 320-800MB |
| `effective_cache_size` | Nenhum — não aloca memória, é só uma dica |
| `maintenance_work_mem` | Nenhum — só usado em operações de manutenção |
| `checkpoint_completion_target` | Nenhum — puramente positivo |

### Reversão (se necessário)

```bash
cp /etc/postgresql/17/main/postgresql.conf.backup_20260625_093647 /etc/postgresql/17/main/postgresql.conf
systemctl restart postgresql
```

---

## 6. Correção 4 — Campanhas travadas em EM_ANDAMENTO

**Data:** 26/06/2026

### O problema

Em 26/06 às 11:54 (horário de Brasília), clientes reportaram lentidão severa. O diagnóstico revelou:

- **75 campanhas com status `EM_ANDAMENTO`** no banco, sendo a mais antiga de **02/02/2026** (mais de 4 meses travada)
- O cron `VerifyCampaignsDaatabase` rodava **a cada 20 segundos** e processava todas as 75 campanhas em cada ciclo
- Cada ciclo gerava dezenas de queries pesadas no banco simultaneamente
- O backend estava com **1,1 GB de memória** (normal: ~300 MB) e **21 restarts**

```
A cada 20 segundos:
  → Busca 75 campanhas EM_ANDAMENTO
  → Para cada uma: faz queries no banco, verifica limites, tenta processar
  → 75 x queries pesadas = banco sobrecarregado
  → Backend acumula memória → crash → restart → sistema lento
```

### Causa raiz

O código de finalização de campanhas (`verifyAndFinalizeCampaign`) dependia de ser chamado corretamente após o envio. Em casos de crash, timeout ou race condition, a campanha ficava em `EM_ANDAMENTO` para sempre — sem nenhum mecanismo automático de limpeza.

### Solução aplicada (2 partes)

#### Parte 1 — Limpeza manual imediata

```sql
-- Finalizou 59 campanhas travadas há mais de 24h
UPDATE "Campaigns"
SET status = 'CANCELADA'
WHERE status = 'EM_ANDAMENTO'
  AND "scheduledAt" < NOW() - INTERVAL '24 hours';
-- UPDATE 59

-- Finalizou as 3 de ontem que restaram
UPDATE "Campaigns"
SET status = 'FINALIZADA', "completedAt" = NOW()
WHERE status = 'EM_ANDAMENTO'
  AND "scheduledAt" < CURRENT_DATE;
-- UPDATE 3
```

**Resultado:** 75 campanhas → 9 (só as legítimas do dia)

#### Parte 2 — Auto-finalização no código (permanente)

**Arquivo modificado:** `backend/src/queues.ts` — função `handleVerifyCampaigns`

Adicionado bloco de verificação que roda **a cada 5 minutos** dentro do cron existente, detectando e finalizando campanhas travadas em 2 casos:

**CASO 1 — Campanha nunca processou nada:**
```sql
SELECT c.id FROM "Campaigns" c
WHERE c.status = 'EM_ANDAMENTO'
  AND c."updatedAt" < NOW() - INTERVAL '6 hours'
  AND NOT EXISTS (SELECT 1 FROM "CampaignShipping" cs WHERE cs."campaignId" = c.id)
  AND (c."isRecurring" = false OR c."isRecurring" IS NULL)
-- Se encontrar: marca como FINALIZADA
```

**CASO 2 — Campanha processou mas não fechou:**
```sql
SELECT c.id FROM "Campaigns" c
WHERE c.status = 'EM_ANDAMENTO'
  AND c."updatedAt" < NOW() - INTERVAL '2 hours'
  AND (c."isRecurring" = false OR c."isRecurring" IS NULL)
  AND EXISTS (SELECT 1 FROM "CampaignShipping" cs WHERE cs."campaignId" = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM "CampaignShipping" cs
    WHERE cs."campaignId" = c.id
      AND cs."deliveredAt" IS NULL AND cs."failedAt" IS NULL
  )
-- Se encontrar: marca como FINALIZADA
```

**Variável de controle de throttle** adicionada no módulo:
```typescript
let lastStaleCheckAt = 0; // controla que só roda a cada 5 minutos
```

**Log esperado quando atuar:**
```
[CAMPAIGN-VERIFY] ✅ 2 campanha(s) travada(s) finalizadas automaticamente. IDs: 1012, 1013
```

### Resultado

| Métrica | Antes | Depois |
|---|---|---|
| Campanhas `EM_ANDAMENTO` | **75** | **6** (só as ativas do dia) |
| Memória do backend | **1,1 GB** 🔴 | **300–600 MB** 🟢 |
| Carga no banco | Múltiplas queries pesadas a cada 20s | Apenas campanhas reais |
| Intervenção manual futura | Necessária | Desnecessária (auto-fix) |

---

## 7. Situação atual e pendências

### ✅ Corrigido

| Item | Status |
|---|---|
| Timeouts em cascata (Circuit Breaker) | ✅ Em produção desde 24/06/2026 |
| Redis Bull — limpeza dos 72k jobs | ✅ Feito em 25/06/2026 |
| Redis Bull — limpeza automática futura | ✅ Em produção desde 25/06/2026 |
| PostgreSQL — otimização de memória | ✅ Feito em 25/06/2026 |
| Backend restarts por timeouts | ✅ Resolvido como consequência do Circuit Breaker |
| 75 campanhas travadas sobrecarregando o banco | ✅ Resolvido em 26/06/2026 |
| Auto-finalização de campanhas travadas | ✅ Em produção desde 26/06/2026 |

### 📅 Pendente (próximas sprints)

| Item | Prioridade | Descrição |
|---|---|---|
| Subconsultas em `ListTicketsService.ts` | 🟡 Médio | Reescrever subconsultas correlacionadas na tabela `Messages` (901k registros, 1,96 GB) usando JOINs para melhorar listagem de tickets |
| Cron de fechamento automático | 🟡 Médio | Substituir `companies.map(async ...)` por `for...of` com await para serializar execução e evitar pico de carga no banco a cada 1 minuto |
| Archival de mensagens antigas | 🟡 Médio | Considerar arquivamento de mensagens com mais de 6 meses para manter performance das queries na tabela `Messages` |

---

## Status do servidor pós-otimização (26/06/2026)

```bash
pm2 list
# backend     → online ✅ (~300-600 MB)
# frontend    → online ✅
# api-oficial → online ✅

systemctl is-active postgresql
# active ✅

# Campanhas EM_ANDAMENTO (só as legítimas do dia)
SELECT COUNT(*) FROM "Campaigns" WHERE status = 'EM_ANDAMENTO';
# 6 (antes do fix: 75)
```
