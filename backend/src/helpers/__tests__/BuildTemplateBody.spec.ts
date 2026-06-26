import { buildTemplateBody } from "../BuildTemplateBody";
import QuickMessage from "../../models/QuickMessage";

// Mock do modelo QuickMessage e de Mustache
jest.mock("../../models/QuickMessage", () => {
  return {
    findByPk: jest.fn()
  };
});

jest.mock("../Mustache", () => {
  return jest.fn((text, ticket) => {
    // Mock simplificado do Mustache que substitui {{name}} por ticket.contact.name
    if (!text) return "";
    let result = text;
    if (ticket && ticket.contact && ticket.contact.name) {
      result = result.replace(/\{\{\s*name\s*\}\}/g, ticket.contact.name);
    }
    return result;
  });
});

describe("BuildTemplateBody Helper Test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve retornar o fallback padrão quando nenhum template ou componente for fornecido", async () => {
    const result = await buildTemplateBody("", [], "meu_template");
    expect(result).toBe("📋 Template: meu_template");
  });

  it("deve reconstruir o template a partir dos componentes locais passados se não encontrar no banco", async () => {
    (QuickMessage.findByPk as jest.Mock).mockResolvedValue(null);

    const components = [
      {
        type: "BODY",
        text: "Olá! Obrigado por agendar sua reunião."
      }
    ];

    const result = await buildTemplateBody(123, components, "lembrete");
    expect(result).toBe("Olá! Obrigado por agendar sua reunião.");
  });

  it("deve substituir placeholders {{1}} e {{2}} pelos parâmetros fornecidos", async () => {
    (QuickMessage.findByPk as jest.Mock).mockResolvedValue(null);

    const components = [
      {
        type: "BODY",
        text: "Olá {{1}}! Sua reunião está confirmada para {{2}}.",
        parameters: [
          { type: "text", text: "Beatriz" },
          { type: "text", text: "Sexta-feira às 14h" }
        ]
      }
    ];

    const result = await buildTemplateBody(123, components, "lembrete");
    expect(result).toBe("Olá Beatriz! Sua reunião está confirmada para Sexta-feira às 14h.");
  });

  it("deve processar Mustache com os dados do ticket nos parâmetros e no texto", async () => {
    (QuickMessage.findByPk as jest.Mock).mockResolvedValue(null);

    const components = [
      {
        type: "BODY",
        text: "Olá {{1}}! Como vai?",
        parameters: [
          { type: "text", text: "{{name}}" }
        ]
      }
    ];

    const ticketMock = {
      id: 1,
      contact: {
        id: 10,
        name: "Beatriz Soares"
      }
    } as any;

    const result = await buildTemplateBody(123, components, "lembrete", ticketMock);
    expect(result).toBe("Olá Beatriz Soares! Como vai?");
  });

  it("deve adicionar botões no formato esperado pelo frontend se houver componente BUTTONS", async () => {
    // Simulando que encontrou o template no banco com componentes e botões
    const mockDbTemplate = {
      id: 123,
      shortcode: "template_com_botoes",
      components: [
        {
          type: "BODY",
          text: "Clique no botão abaixo para acessar."
        },
        {
          type: "BUTTONS",
          buttons: JSON.stringify([
            { type: "URL", text: "Acessar Site", url: "https://mibia.com.br" }
          ])
        }
      ]
    };

    (QuickMessage.findByPk as jest.Mock).mockResolvedValue(mockDbTemplate);

    const result = await buildTemplateBody(123, [], "template_com_botoes");
    
    // O resultado deve conter o corpo e os botões serializados separados por '||||'
    expect(result).toContain("Clique no botão abaixo para acessar.");
    expect(result).toContain("||||");
    expect(result).toContain("Acessar Site");
  });
});
