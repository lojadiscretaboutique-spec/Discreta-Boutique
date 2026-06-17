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

export default function DiscreetDeliveryPage() {
  const { currentTheme } = useTheme();
  const bgText = currentTheme.backgroundTextColor || getContrastColor(currentTheme.backgroundColor);
  const isBgDark = bgText === '#ffffff';
  const subtitleColor = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.6)';
  const descColor = isBgDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(9, 9, 11, 0.85)';
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
        <header className="text-center space-y-3">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-6xl font-black uppercase tracking-tighter italic"
          >
            Entrega <span style={{ color: currentTheme.primaryColor }}>Discreta</span> e Sigilosa
          </motion.h1>
          <p 
            className="font-medium uppercase tracking-[0.3em] text-[10px] md:text-xs"
            style={{ color: subtitleColor }}
          >
            Seu segredo e sua privacidade são nossa prioridade máxima.
          </p>
        </header>

        <div className="space-y-8">
          <div 
            className="p-8 rounded-3xl border space-y-4"
            style={{
              backgroundColor: cardColorBg,
              borderColor: borderColorHex
            }}
          >
            <h2 className="text-2xl font-black tracking-tight italic uppercase">
              Privacidade Absoluta
            </h2>
            <p className="leading-relaxed text-sm md:text-base" style={{ color: descColor }}>
              Na Discreta Boutique, compreendemos perfeitamente a importância da sua privacidade. Por isso, desenvolvemos um padrão de envio e entrega extremamente discreto, garantindo que ninguém — além de você — saiba o conteúdo da sua encomenda.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div 
              className="p-6 rounded-3xl border space-y-3"
              style={{
                backgroundColor: cardColorBg,
                borderColor: borderColorHex
              }}
            >
              <h3 className="font-bold text-lg uppercase italic text-red-500" style={{ color: currentTheme.primaryColor }}>
                1. Embalagem Externa Neutra
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: descColor }}>
                Suas compras são enviadas em caixas ou envelopes de segurança de cor parda ou preta, totalmente lisos, sem logotipos, desenhos ou menções sobre sex shop ou lingeries. O pacote externo é idêntico a qualquer entrega comum de e-commerce.
              </p>
            </div>

            <div 
              className="p-6 rounded-3xl border space-y-3"
              style={{
                backgroundColor: cardColorBg,
                borderColor: borderColorHex
              }}
            >
              <h3 className="font-bold text-lg uppercase italic text-red-500" style={{ color: currentTheme.primaryColor }}>
                2. Remetente Discreto
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: descColor }}>
                Na etiqueta de postagem ou frete, o remetente não conterá o nome "Discreta Boutique" ou termos sugestivos. Será impresso de forma genérica com o nome corporativo ou pessoal do remetente, garantindo sigilo absoluto caso o pacote seja recebido por terceiros (familiares, vizinhos ou portaria).
              </p>
            </div>

            <div 
              className="p-6 rounded-3xl border space-y-3"
              style={{
                backgroundColor: cardColorBg,
                borderColor: borderColorHex
              }}
            >
              <h3 className="font-bold text-lg uppercase italic text-red-500" style={{ color: currentTheme.primaryColor }}>
                3. Entrega Expressa em Icó - CE
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: descColor }}>
                Para entregas locais e regionais na cidade de Icó, Ceará, contamos com motoqueiros parceiros altamente confiáveis e que operam sob protocolo de confidencialidade estrita. Os pacotes são entregues lacrados com lacres de segurança e o entregador não tem conhecimento do teor dos itens.
              </p>
            </div>

            <div 
              className="p-6 rounded-3xl border space-y-3"
              style={{
                backgroundColor: cardColorBg,
                borderColor: borderColorHex
              }}
            >
              <h3 className="font-bold text-lg uppercase italic text-red-500" style={{ color: currentTheme.primaryColor }}>
                4. Sigilo no Faturamento
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: descColor }}>
                A cobrança em sua fatura de cartão de crédito ou extrato bancário não exibirá termos íntimos. Em vez disso, constará apenas a designação comercial simplificada de processamento de pagamentos, preservando sua total privacidade também no ambiente financeiro.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
