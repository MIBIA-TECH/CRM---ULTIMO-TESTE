import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  makeStyles
} from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  content: {
    maxHeight: "400px",
    overflowY: "auto",
    paddingRight: "10px",
  },
  sectionTitle: {
    fontWeight: "bold",
    color: "#182229",
    fontSize: "15px",
  },
  sectionBody: {
    marginTop: "4px",
    marginBottom: "16px",
    lineHeight: "1.6",
  },
}));

const TermsOfUseModal = ({ open, onClose }) => {
  const classes = useStyles();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle style={{ textAlign: "center", fontWeight: "bold" }}>
        Termos e Condições de Uso - Mibia CRM
      </DialogTitle>
      <DialogContent dividers>
        <div className={classes.content}>
          <Typography variant="subtitle2" className={classes.sectionTitle}>
            1. Introdução
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            Bem-vindo ao nosso sistema de CRM. Estes Termos e Condições regem o uso do sistema e definem as responsabilidades do usuário e da nossa empresa. Ao utilizar o sistema, você concorda integralmente com estes Termos. Caso não concorde, não utilize o sistema.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            2. Definições
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            <strong>Mibia CRM:</strong> A plataforma disponibilizada para gestão de contatos, vendas, tickets e outras funcionalidades de relacionamento com clientes.<br />
            <strong>Usuário:</strong> Pessoa física ou jurídica que utiliza o sistema.<br />
            <strong>Empresa:</strong> Mibia Digital LTDA (CNPJ 37.617.938/0001-65) - A detentora dos direitos e operadora do sistema.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            3. Licença de Uso
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            O usuário recebe uma licença não exclusiva, intransferível e limitada para utilizar o sistema conforme previsto nestes Termos. O uso do sistema é permitido somente para fins legais e dentro do escopo contratado.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            4. Responsabilidades do Usuário
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            4.1. O usuário é responsável pela veracidade e pela atualização das informações inseridas no sistema.<br />
            4.2. O usuário deve manter a confidencialidade de suas credenciais de acesso e notificar imediatamente a empresa em caso de acesso não autorizado.<br />
            4.3. O uso do sistema para atividades ilícitas ou para qualquer finalidade que viole legislações vigentes é estritamente proibido.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            5. Disponibilidade e Suporte
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            5.1. A empresa se esforçará para garantir que o sistema esteja disponível 24 horas por dia, 7 dias por semana, salvo interrupções necessárias para manutenção, atualizações ou fatores além do controle da empresa.<br />
            5.2. O suporte será fornecido nos canais indicados pela empresa, durante o horário comercial, salvo disposição em contrato.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            6. Propriedade Intelectual
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            Todos os direitos de propriedade intelectual relativos ao sistema, incluindo códigos-fonte, designs e marcas, são de titularidade exclusiva da empresa. O usuário não está autorizado a reproduzir, modificar, distribuir ou criar derivações do sistema.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            7. Planos, Pagamentos e Suspensão
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            7.1. O uso do sistema está sujeito ao pagamento do plano contratado, conforme valores, conditions e periodicidade previamente acordados.<br />
            7.2. Caso o pagamento não seja realizado até 7 (sete) dias após a data de vencimento, o acesso ao sistema será automaticamente bloqueado até que o pagamento seja regularizado.<br />
            7.3. A regularização financeira restabelecerá o acesso ao sistema em até 24 (vinte e quatro) horas após a confirmação do pagamento.<br />
            7.4. Não será concedida compensação ou reembolso por eventuais interrupções de serviço devido ao não pagamento.<br />
            7.5. Os valores referentes ao plano contratado contemplam exclusivamente a utilização do Mibia CRM. Custos decorrentes de serviços de terceiros, incluindo, mas não se limitando à API Oficial do WhatsApp, provedores de mensagens, hospedagem complementar, integrações ou serviços adicionais, serão cobrados separadamente e serão de responsabilidade exclusiva do usuário.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            8. Integração com WhatsApp API Oficial (Meta)
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            8.1. O Mibia CRM poderá ser integrado à API Oficial do WhatsApp Business, fornecida e gerenciada pela Meta Platforms, Inc. ("Meta"), por meio de parceiros autorizados.<br />
            8.2. O usuário declara estar ciente de que a utilização da API Oficial do WhatsApp está sujeita aos Termos de Uso, Políticas Comerciais, Políticas de Mensagens e demais regras estabelecidas pela Meta, podendo estas ser alteradas a qualquer momento sem interferência da Empresa.<br />
            8.3. A Empresa não possui qualquer controle sobre decisões, restrições, suspensões, bloqueios, limitações, banimentos ou cancelamentos de números telefônicos, contas comerciais ou serviços promovidos pela Meta, não podendo ser responsabilizada por perdas, indisponibilidades, interrupções, bloqueios temporários ou definitivos, perda de número, perda de acesso à conta ou quaisquer prejuízos decorrentes de ações realizadas pela Meta.<br />
            8.4. O usuário é integralmente responsável pelo conteúdo das mensagens enviadas, pela observância das políticas da Meta e pela obtenção dos consentimentos necessários para comunicação com seus contatos, isentando a Empresa de qualquer responsabilidade decorrente do uso inadequado da plataforma ou da API Oficial do WhatsApp.<br />
            8.5. Todos os custos, tarifas, cobranças por mensagens, conversas, templates, autenticações, utilidades, marketing, taxas de provedores oficiais (BSPs) e quaisquer outros valores relacionados à utilização da API Oficial do WhatsApp serão de exclusiva responsabilidade do usuário, não estando incluídos nos valores dos planos do Mibia CRM, salvo quando expressamente previsto em contrato.<br />
            8.6. A Empresa não se responsabiliza por reajustes, alterações de preços, mudanças operacionais, limitações técnicas ou descontinuidade dos serviços promovidos pela Meta ou pelos provedores oficiais da API do WhatsApp.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            9. Limitação de Responsabilidade
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            A empresa não se responsabiliza por danos diretos, indiretos, incidentais ou consequentes decorrentes do uso ou da impossibilidade de uso do sistema, exceto nos casos em que houver dolo ou culpa grave comprovados.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            10. Privacidade e Proteção de Dados
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            O uso dos dados do usuário estará em conformidade com a legislação aplicável de proteção de dados. Para mais detalhes, consulte nossa Política de Privacidade.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            11. Rescisão
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            A empresa se reserva o direito de rescindir o acesso do usuário ao sistema em caso de violação destes Termos, sem prejuízo de cobranças de valores devidos.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            12. Alterações nos Termos
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            Estes Termos podem ser atualizados pela empresa a qualquer momento. As alterações serão comunicadas aos usuários e entrarão em vigor na data indicada na notificação.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            13. Disposições Gerais
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            12.1. Caso alguma disposição destes Termos seja considerada inválida ou inexequível, as demais disposições permanecerão em pleno vigor e efeito.<br />
            12.2. Estes Termos serão regidos pelas leis brasileiras. Qualquer controvérsia será dirimida no foro da comarca da sede da empresa.
          </Typography>

          <Typography variant="subtitle2" className={classes.sectionTitle}>
            14. Contato
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionBody}>
            Dúvidas ou solicitações relacionadas a estes Termos devem ser enviadas para o e-mail suporte@mibiadigital.com.br
          </Typography>
        </div>
      </DialogContent>
      <DialogActions style={{ padding: "16px 24px" }}>
        <Button
          onClick={onClose}
          color="primary"
          variant="contained"
        >
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TermsOfUseModal;
