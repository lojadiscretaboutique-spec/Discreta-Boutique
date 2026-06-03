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

export default function ExchangePolicyPage() {
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
            Política de <span style={{ color: currentTheme.primaryColor }}>Troca</span>
          </motion.h1>
          <p 
            className="font-medium uppercase tracking-[0.2em] text-[10px] md:text-xs"
            style={{ color: subtitleColor }}
          >
            Transparência e respeito ao Código de Defesa do Consumidor.
          </p>
        </header>

        <section 
          className="border rounded-[2.5rem] p-8 md:p-12 space-y-10 leading-relaxed shadow-xl"
          style={{
            backgroundColor: cardColorBg,
            borderColor: borderColorHex,
            color: descColor
          }}
        >
          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight italic" style={{ color: bgText }}>Devolução por Arrependimento</h2>
            <p>
              O cliente tem o prazo de até 7 dias corridos a contar do recebimento do produto para desistir da compra. O produto deve estar em sua embalagem original, lacrado e sem qualquer indício de uso.
            </p>
          </div>

          <div 
            className="space-y-4 p-6 border rounded-2xl"
            style={{
              backgroundColor: `${currentTheme.primaryColor}08`,
              borderColor: `${currentTheme.primaryColor}25`
            }}
          >
            <h2 
              className="text-lg font-black uppercase tracking-tight italic"
              style={{ color: currentTheme.primaryColor }}
            >
              Resguardo de Higiene
            </h2>
            <p className="text-xs font-bold leading-relaxed">
              Devido à natureza íntima de nossos produtos, por questões de saúde pública e segurança sanitária, <strong style={{ color: currentTheme.highlightColor || currentTheme.primaryColor }}>não aceitamos trocas ou devoluções de produtos cujo lacre de segurança tenha sido rompido</strong>, exceto em casos comprovados de vício de fabricação.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight italic" style={{ color: bgText }}>Produtos com Defeito</h2>
            <p>
              Caso receba um produto com defeito de fabricação, o prazo para comunicação à nossa central de atendimento é de 30 dias. Realizaremos a análise e, constatado o defeito, a troca será efetuada sem custos operacionais adicionais para o cliente.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight italic" style={{ color: bgText }}>Procedimento</h2>
            <p>
              Todo processo de troca deve ser iniciado através do nosso canal de suporte ao cliente, informando o número do pedido e anexando evidências (fotos/vídeos) caso o motivo seja defeito técnico.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
