import { motion } from "motion/react";
import { useTheme } from "../../contexts/ThemeContext";

function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

export default function LGPDPage() {
  const { currentTheme } = useTheme();
  const bgText = currentTheme.backgroundTextColor || getContrastColor(currentTheme.backgroundColor);
  const isBgDark = bgText === '#ffffff';
  const subtitleColor = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.6)';
  const descColor = isBgDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(9, 9, 11, 0.8)';
  const cardColorBg = currentTheme.cardColor || (isBgDark ? 'rgba(24, 24, 27, 0.5)' : 'rgba(244, 244, 245, 0.5)');
  const borderColorHex = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.08)';

  return (
    <div 
      className="flex-1 py-24 px-4 min-h-screen transition-all duration-300"
      style={{
        backgroundColor: currentTheme.backgroundColor,
        color: bgText
      }}
    >
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black uppercase tracking-tighter italic"
          >
            Proteção de <span style={{ color: currentTheme.primaryColor }}>Dados (LGPD)</span>
          </motion.h1>
          <p 
            className="font-medium uppercase tracking-[0.2em] text-[10px] md:text-xs"
            style={{ color: subtitleColor }}
          >
            Conformidade integral com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
        </header>

        <section 
          className="border rounded-[2.5rem] p-8 md:p-12 space-y-8 leading-relaxed shadow-xl"
          style={{
            backgroundColor: cardColorBg,
            borderColor: borderColorHex,
            color: descColor
          }}
        >
          <p>
            A Discreta Boutique reafirma seu compromisso com a transparência e a autodeterminação informativa no tratamento de seus dados pessoais.
          </p>

          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight" style={{ color: bgText }}>Seus Direitos como Titular</h2>
            <ul className="list-disc pl-5 space-y-3">
              <li>Confirmação da existência de tratamento dos seus dados.</li>
              <li>Acesso irrestrito aos seus dados armazenados em nossa plataforma.</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.</li>
              <li>Portabilidade dos dados a outro fornecedor de serviço, de acordo com regulamentações.</li>
              <li>Revogação do consentimento para tratamento de dados a qualquer momento.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight" style={{ color: bgText }}>Como Exercer Seus Direitos</h2>
            <p>
              Para qualquer solicitação referente à LGPD, o titular dos dados pode entrar em contato diretamente com nossa equipe de Compliance através do e-mail de suporte. Processaremos suas requisições com a agilidade exigida pela legislação vigente.
            </p>
          </div>

          <div className="pt-8 border-t" style={{ borderColor: borderColorHex }}>
            <p className="text-[10px] uppercase tracking-widest font-black italic" style={{ color: subtitleColor }}>
              Última atualização: Junho de 2026.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
