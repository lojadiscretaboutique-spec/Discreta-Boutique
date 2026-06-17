import { useState } from "react";
import { motion } from "motion/react";
import { useTheme } from "../../contexts/ThemeContext";
import { Mail, Phone, MapPin, CheckCircle } from "lucide-react";

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

export default function ContactPage() {
  const { currentTheme } = useTheme();
  const bgText = currentTheme.backgroundTextColor || getContrastColor(currentTheme.backgroundColor);
  const isBgDark = bgText === '#ffffff';
  const subtitleColor = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.6)';
  const descColor = isBgDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(9, 9, 11, 0.85)';
  const cardColorBg = currentTheme.cardColor || (isBgDark ? 'rgba(24, 24, 27, 0.5)' : 'rgba(244, 244, 245, 0.5)');
  const borderColorHex = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.08)';

  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.message) return;
    setSubmitted(true);
  };

  return (
    <div 
      className="flex-1 py-24 px-4 min-h-screen transition-all duration-300"
      style={{
        backgroundColor: currentTheme.backgroundColor,
        color: bgText
      }}
    >
      <div className="max-w-5xl mx-auto space-y-16">
        <header className="text-center space-y-3">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-black uppercase tracking-tighter italic"
          >
            Fale <span style={{ color: currentTheme.primaryColor }}>Conosco</span>
          </motion.h1>
          <p 
            className="font-medium uppercase tracking-[0.3em] text-[10px] md:text-sm"
            style={{ color: subtitleColor }}
          >
            Atendimento humanizado, discreto e totalmente sigiloso.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Informações de Contato */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase mb-4">
                Canais de Atendimento
              </h2>
              <p className="leading-relaxed text-sm md:text-base mb-6" style={{ color: descColor }}>
                Tem alguma dúvida sobre tamanho, material, funcionamento de algum estimulador ou deseja ajuda com um pedido personalizado? Entre em contato por qualquer um dos nossos canais.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div 
                  className="p-3 rounded-full border text-red-500"
                  style={{ backgroundColor: cardColorBg, borderColor: borderColorHex }}
                >
                  <Phone size={18} style={{ color: currentTheme.primaryColor }} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs uppercase tracking-wider">WhatsApp & Telefone</h4>
                  <a 
                    href="https://wa.me/5588992340317" 
                    target="_blank" 
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold hover:underline"
                    style={{ color: currentTheme.secondaryColor || currentTheme.primaryColor }}
                  >
                    +55 (88) 99234-0317
                  </a>
                  <p className="text-[10px] text-zinc-500">Atendimento de Segunda a Sábado, das 09:00 às 20:00.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div 
                  className="p-3 rounded-full border text-red-500"
                  style={{ backgroundColor: cardColorBg, borderColor: borderColorHex }}
                >
                  <Mail size={18} style={{ color: currentTheme.primaryColor }} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs uppercase tracking-wider">E-mail</h4>
                  <p className="text-sm font-semibold" style={{ color: descColor }}>lojadiscretaboutique@gmail.com</p>
                  <p className="text-[10px] text-zinc-500">Respondemos em até 24 horas úteis.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div 
                  className="p-3 rounded-full border text-red-500"
                  style={{ backgroundColor: cardColorBg, borderColor: borderColorHex }}
                >
                  <MapPin size={18} style={{ color: currentTheme.primaryColor }} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs uppercase tracking-wider">Localização & Retirada</h4>
                  <p className="text-sm font-semibold" style={{ color: descColor }}>Centro, Icó - CE, Brasil</p>
                  <p className="text-[10px] text-zinc-500">Atendemos Icó, Iguatu, Orós, Cedro e toda região do Centro-Sul cearense.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Formulário de Envio */}
          <div 
            className="p-8 rounded-3xl border"
            style={{
              backgroundColor: cardColorBg,
              borderColor: borderColorHex
            }}
          >
            {submitted ? (
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-12">
                <CheckCircle size={48} className="text-emerald-500" />
                <h3 className="text-xl font-bold">Mensagem Enviada!</h3>
                <p className="text-xs max-w-xs" style={{ color: subtitleColor }}>
                  Agradecemos seu contato. Nossa equipe de fadas madrinhas responderá sua mensagem com a maior discrição possível, através do e-mail ou WhatsApp.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: "", email: "", message: "" }); }}
                  className="mt-4 px-4 py-2 border rounded-full text-xs font-semibold hover:bg-zinc-800 transition-colors"
                  style={{ borderColor: borderColorHex }}
                >
                  Enviar outra mensagem
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h3 className="text-xl font-black italic uppercase">Formulário de Contato</h3>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider block">Seu Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border outline-none bg-black/25 text-sm transition-focus"
                    placeholder="Como prefere ser chamado?"
                    style={{ borderColor: borderColorHex, color: bgText }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider block">Seu E-mail ou WhatsApp</label>
                  <input
                    type="text"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border outline-none bg-black/25 text-sm transition-focus"
                    placeholder="Seu e-mail ou número de telefone..."
                    style={{ borderColor: borderColorHex, color: bgText }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider block">Sua Mensagem</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border outline-none bg-black/25 text-sm transition-focus resize-none"
                    placeholder="Escreva sua mensagem aqui com total privacidade..."
                    style={{ borderColor: borderColorHex, color: bgText }}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-opacity hover:opacity-90 shadow-lg text-white"
                  style={{ backgroundColor: currentTheme.primaryColor }}
                >
                  Enviar Mensagem com Sigilo
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
