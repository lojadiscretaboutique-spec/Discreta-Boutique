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

export default function AboutUsPage() {
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
      <div className="max-w-5xl mx-auto space-y-16">
        <header className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-black uppercase tracking-tighter italic"
          >
            Quem <span style={{ color: currentTheme.primaryColor }}>Somos</span>
          </motion.h1>
          <p 
            className="font-medium uppercase tracking-[0.3em] text-[10px] md:text-xs"
            style={{ color: subtitleColor }}
          >
            A essência da sofisticação e do prazer.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
              Nossa <br/> Trajetória
            </h2>
            <p className="leading-relaxed" style={{ color: descColor }}>
              A Discreta Boutique nasceu da visão de transformar o mercado de bem-estar e prazer em uma experiência de luxo, discrição e seleção impecável. Acreditamos que cada momento é único e merece ser celebrado com produtos que unam qualidade superior e design inovador.
            </p>
            <p className="leading-relaxed" style={{ color: descColor }}>
              Mais do que uma loja, somos um refúgio para quem busca explorar seus desejos com segurança, elegância e o suporte de especialistas comprometidos com a satisfação do cliente.
            </p>
          </div>
          
          <div 
            className="relative aspect-square rounded-[3rem] overflow-hidden border"
            style={{
              backgroundColor: cardColorBg,
              borderColor: borderColorHex
            }}
          >
             <div 
               className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center p-12"
               style={{
                 background: `linear-gradient(135deg, ${currentTheme.primaryColor}20 0%, transparent 100%)`
               }}
             >
                <span 
                  className="text-7xl md:text-9xl font-black italic opacity-10 md:opacity-20 select-none pb-4"
                  style={{ color: currentTheme.primaryColor }}
                >
                  D
                </span>
             </div>
          </div>
        </div>

        <section 
          className="grid md:grid-cols-3 gap-8 pt-12 border-t"
          style={{ borderColor: borderColorHex }}
        >
          <div className="space-y-3">
            <div className="h-1 w-12 rounded-full" style={{ backgroundColor: currentTheme.primaryColor }}></div>
            <h3 className="font-italic font-black text-xs uppercase tracking-widest">Qualidade</h3>
            <p style={{ color: subtitleColor }} className="text-xs leading-relaxed">Selecionamos apenas marcas que seguem rigorosos padrões internacionais de segurança e durabilidade.</p>
          </div>
          <div className="space-y-3">
            <div className="h-1 w-12 rounded-full" style={{ backgroundColor: currentTheme.secondaryColor || '#555555' }}></div>
            <h3 className="font-italic font-black text-xs uppercase tracking-widest">Discrição</h3>
            <p style={{ color: subtitleColor }} className="text-xs leading-relaxed">Toda a jornada, da navegação à entrega, é pensada para garantir sua total privacidade.</p>
          </div>
          <div className="space-y-3">
            <div className="h-1 w-12 rounded-full" style={{ backgroundColor: currentTheme.highlightColor || currentTheme.primaryColor }}></div>
            <h3 className="font-italic font-black text-xs uppercase tracking-widest">Seleção</h3>
            <p style={{ color: subtitleColor }} className="text-xs leading-relaxed">Produtos escolhidos por especialistas para proporcionar experiências sensoriais inesquecíveis.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
