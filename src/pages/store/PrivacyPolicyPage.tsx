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

export default function PrivacyPolicyPage() {
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
            Política de <span style={{ color: currentTheme.primaryColor }}>Privacidade</span>
          </motion.h1>
          <p 
            className="font-medium uppercase tracking-[0.2em] text-[10px] md:text-xs"
            style={{ color: subtitleColor }}
          >
            Sua segurança e privacidade são nossa prioridade máxima.
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
          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight" style={{ color: bgText }}>1. Coleta de Informações</h2>
            <p>
              Coletamos informações essenciais para processar seus pedidos e proporcionar uma experiência personalizada. Isso inclui dados cadastrais como nome, e-mail, telefone e endereço de entrega.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight" style={{ color: bgText }}>2. Uso de Dados</h2>
            <p>
              Seus dados são utilizados exclusivamente para o processamento de compras, melhoria da interface do sistema e comunicações pertinentes aos seus pedidos. Não compartilhamos informações pessoais com terceiros para fins publicitários sem consentimento explícito.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight" style={{ color: bgText }}>3. Segurança</h2>
            <p>
              Utilizamos tecnologias de criptografia de ponta a ponta e camadas de segurança sistêmica para garantir que suas informações estejam protegidas contra acessos não autorizados. No ambiente da Discreta Boutique, tratamos cada dado com o rigor necessário para manter a integridade da nossa plataforma.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-tight" style={{ color: bgText }}>4. Cookies</h2>
            <p>
              Empregamos cookies para reconhecer seu navegador e oferecer funcionalidades como o carrinho de compras persistente e recomendações baseadas no seu perfil de navegação.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
