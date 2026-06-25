/**
 * Circuit Breaker para a API Oficial do WhatsApp
 *
 * Padrão Circuit Breaker:
 *   CLOSED    → Operação normal. Falhas são contadas.
 *   OPEN      → API indisponível. Chamadas falham imediatamente (sem esperar timeout).
 *   HALF_OPEN → Período de teste. Permite 1 chamada para verificar se API voltou.
 *
 * Benefício: Evita que múltiplos workers fiquem travados esperando timeout de 10s
 * simultaneamente, o que saturava o event loop do Node.js.
 */

import logger from "../../utils/logger";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  /** Número de falhas consecutivas para abrir o circuito */
  failureThreshold?: number;
  /** Tempo em ms que o circuito fica aberto antes de tentar novamente */
  recoveryTimeMs?: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureAt: number | null;
}

// Mapa de estados por chave (ex: token truncado da conexão)
const circuits = new Map<string, CircuitBreakerState>();

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RECOVERY_TIME_MS = 30_000; // 30 segundos

/**
 * Erro lançado quando o circuito está aberto.
 * Permite distinguir falha de circuit breaker de falha real da API.
 */
export class CircuitOpenError extends Error {
  public readonly key: string;
  public readonly recoveryIn: number;

  constructor(key: string, recoveryIn: number) {
    super(
      `[Circuit Breaker] Circuito ABERTO para conexão "${key}". ` +
      `Aguardando recuperação em ${Math.ceil(recoveryIn / 1000)}s.`
    );
    this.name = "CircuitOpenError";
    this.key = key;
    this.recoveryIn = recoveryIn;
  }
}

/**
 * Determina se um erro é transitório (rede/timeout) ou de negócio (4xx da API).
 * Apenas erros transitórios incrementam o contador do circuit breaker.
 */
export function isTransientError(error: any): boolean {
  // Timeouts do Axios
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") return true;
  // Erros de conexão/rede
  if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") return true;
  // Axios timeout
  if (error?.message?.includes("timeout")) return true;
  // Status 5xx = servidor com problema (transitório)
  const status = error?.response?.status;
  if (status && status >= 500) return true;
  // Status 4xx = erro de negócio (token inválido, número inválido, etc.) — não é transitório
  return false;
}

function getCircuit(key: string): CircuitBreakerState {
  if (!circuits.has(key)) {
    circuits.set(key, {
      state: "CLOSED",
      failures: 0,
      lastFailureAt: null,
    });
  }
  return circuits.get(key)!;
}

/**
 * Verifica se o circuito permite a chamada.
 * Lança CircuitOpenError se o circuito estiver OPEN e não tiver expirado.
 */
export function checkCircuit(
  key: string,
  recoveryTimeMs: number = DEFAULT_RECOVERY_TIME_MS
): void {
  const circuit = getCircuit(key);

  if (circuit.state === "CLOSED") return;

  if (circuit.state === "OPEN") {
    const elapsed = Date.now() - (circuit.lastFailureAt ?? 0);
    const remaining = recoveryTimeMs - elapsed;

    if (elapsed >= recoveryTimeMs) {
      // Tempo expirou → testa recuperação (HALF_OPEN)
      circuit.state = "HALF_OPEN";
      logger.info(`[Circuit Breaker] "${key}" → HALF_OPEN. Testando se API voltou...`);
      return;
    }

    throw new CircuitOpenError(key, remaining);
  }

  // HALF_OPEN → permite a chamada de teste
}

/**
 * Registra um sucesso — fecha o circuito.
 */
export function onSuccess(key: string): void {
  const circuit = getCircuit(key);

  if (circuit.state !== "CLOSED") {
    logger.info(`[Circuit Breaker] "${key}" → CLOSED. API recuperada com sucesso.`);
  }

  circuit.state = "CLOSED";
  circuit.failures = 0;
  circuit.lastFailureAt = null;
}

/**
 * Registra uma falha — abre o circuito se atingir o threshold.
 */
export function onFailure(
  key: string,
  error: Error,
  transient: boolean,
  failureThreshold: number = DEFAULT_FAILURE_THRESHOLD
): void {
  const circuit = getCircuit(key);

  if (!transient) {
    // Erro de negócio não abre o circuito — apenas loga
    logger.warn(
      `[Circuit Breaker] "${key}" → Erro de negócio (não conta para abertura): ${error.message}`
    );
    return;
  }

  circuit.failures += 1;
  circuit.lastFailureAt = Date.now();

  if (circuit.state === "HALF_OPEN" || circuit.failures >= failureThreshold) {
    circuit.state = "OPEN";
    logger.warn(
      `[Circuit Breaker] "${key}" → OPEN após ${circuit.failures} falha(s) transitória(s). ` +
      `Bloqueando chamadas por ${DEFAULT_RECOVERY_TIME_MS / 1000}s. Erro: ${error.message}`
    );
    return;
  }

  logger.warn(
    `[Circuit Breaker] "${key}" → Falha transitória ${circuit.failures}/${failureThreshold}. ` +
    `Circuito ainda CLOSED.`
  );
}

/**
 * Retorna o estado atual de um circuito (para diagnóstico).
 */
export function getCircuitStatus(key: string): {
  state: CircuitState;
  failures: number;
  lastFailureAt: number | null;
} {
  const circuit = getCircuit(key);
  return {
    state: circuit.state,
    failures: circuit.failures,
    lastFailureAt: circuit.lastFailureAt,
  };
}

/**
 * Wrapper de alto nível: executa uma função com proteção de circuit breaker.
 *
 * @param key             Chave de identificação (ex: primeiros 15 chars do token)
 * @param fn              Função async a ser protegida
 * @param options         Configurações opcionais
 */
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  options: {
    failureThreshold?: number;
    recoveryTimeMs?: number;
  } = {}
): Promise<T> {
  const {
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    recoveryTimeMs = DEFAULT_RECOVERY_TIME_MS,
  } = options;

  // Verifica se pode chamar (lança CircuitOpenError se OPEN)
  checkCircuit(key, recoveryTimeMs);

  try {
    const result = await fn();
    onSuccess(key);
    return result;
  } catch (error) {
    const err = error as Error;
    const transient = isTransientError(error);
    onFailure(key, err, transient, failureThreshold);
    throw err;
  }
}
