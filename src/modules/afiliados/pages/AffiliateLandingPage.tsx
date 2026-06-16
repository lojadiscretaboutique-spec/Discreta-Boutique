import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  Coins, 
  Award, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertCircle, 
  LogOut, 
  HelpCircle, 
  Calculator, 
  ChevronDown, 
  DollarSign, 
  ExternalLink,
  Lock,
  Smartphone,
  Share2,
  Key,
  User,
  Mail,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../../lib/firebase';
import { auth } from '../../../lib/auth';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { affiliateService, Affiliate, Commission, AffiliateSettings } from '../services/affiliateService';
import { useTheme } from '../../../contexts/ThemeContext';

// Helper for contrasting text calculation
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

// Format currency in Reais
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);
};

export function AffiliateLandingPage() {
  const { currentTheme } = useTheme();
  
  // Dynamic color configuration helper vars
  const bgText = currentTheme.backgroundTextColor || getContrastColor(currentTheme.backgroundColor);
  const isBgDark = bgText === '#ffffff';
  const labelColor = isBgDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(9, 9, 11, 0.6)';
  const secondaryText = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.5)';
  const cardColorBg = currentTheme.cardColor || (isBgDark ? '#161616' : '#f4f4f5');
  const cardText = currentTheme.cardTextColor || getContrastColor(cardColorBg);
  const isCardDark = cardText === '#ffffff';
  const cardBorderHex = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.08)';

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('register');
  const [dashTab, setDashTab] = useState<'stats' | 'links' | 'profile'>('stats');

  // Registration Form
  const [regSlug, setRegSlug] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regPixKey, setRegPixKey] = useState('');
  const [regPixType, setRegPixType] = useState('cpf');
  const [regPassword, setRegPassword] = useState('');
  
  // Checking states
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const slugCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Link generator
  const [customOriginalUrl, setCustomOriginalUrl] = useState('');
  const [generatedCustomUrl, setGeneratedCustomUrl] = useState('');

  // Simulator State
  const [simClicks, setSimClicks] = useState(2000);
  const [simConversion, setSimConversion] = useState(1.5); // %
  const [simTicket, setSimTicket] = useState(120); // BRL

  // UI state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Load configuration and listen to auth state
  useEffect(() => {
    async function loadConfig() {
      const activeSettings = await affiliateService.getSettings();
      setSettings(activeSettings);
    }
    loadConfig();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadAffiliateData(user.uid);
      } else {
        setAffiliate(null);
        setCommissions([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  async function loadAffiliateData(uid: string) {
    setLoading(true);
    try {
      const aff = await affiliateService.getAffiliateByUid(uid);
      if (aff) {
        setAffiliate(aff);
        const globalSettings = await affiliateService.getSettings();
        const commData = await affiliateService.getCommissionsAndOrders(aff, globalSettings.defaultCommissionRate);
        setCommissions(commData);
      }
    } catch (e) {
      console.error("Erro ao carregar dados do afiliado:", e);
      showToast("Erro ao carregar seu painel de afiliada.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Real-time Slug checker
  useEffect(() => {
    if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current);

    const slugCleaned = regSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!slugCleaned) {
      setSlugStatus('idle');
      return;
    }

    setSlugStatus('checking');
    slugCheckTimeout.current = setTimeout(async () => {
      try {
        const isAvail = await affiliateService.isSlugAvailable(slugCleaned);
        setSlugStatus(isAvail ? 'available' : 'taken');
      } catch (err) {
        setSlugStatus('idle');
      }
    }, 600);

    return () => {
      if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current);
    };
  }, [regSlug]);

  // Auth Operations
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slugStatus !== 'available') {
      showToast("Por favor, selecione um código de afiliado disponível.", "warning");
      return;
    }
    if (!regName.trim() || !regEmail.trim() || !regPassword || !regWhatsapp) {
      showToast("Todos os campos obrigatórios devem ser preenchidos.", "warning");
      return;
    }

    setAuthLoading(true);
    try {
      const finalSlug = regSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const credential = await createUserWithEmailAndPassword(auth, regEmail.trim(), regPassword);
      
      await affiliateService.registerAffiliate({
        id: finalSlug,
        uid: credential.user.uid,
        name: regName,
        email: regEmail,
        whatsapp: regWhatsapp,
        pixKey: regPixKey,
        pixType: regPixType
      });

      showToast("Inscrição efetuada com sucesso!", "success");
      await loadAffiliateData(credential.user.uid);
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Erro ao realizar inscrição. Verifique os dados.";
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = "Este e-mail já está sendo utilizado por outro usuário.";
      } else if (err.code === 'auth/weak-password') {
        errorMsg = "A senha deve conter no mínimo 6 caracteres.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      showToast(errorMsg, "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      showToast("Preencha e-mail e senha correspondentes.", "warning");
      return;
    }

    setAuthLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      showToast("Login efetuado com sucesso!", "success");
      await loadAffiliateData(credential.user.uid);
    } catch (err: any) {
      console.error(err);
      let errorMsg = "Senha incorreta ou e-mail não registrado.";
      if (err.code === 'auth/user-not-found') {
        errorMsg = "E-mail não cadastrado.";
      } else if (err.code === 'auth/wrong-password') {
        errorMsg = "Senha incorreta.";
      }
      showToast(errorMsg, "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAffiliate(null);
      setCommissions([]);
      showToast("Desconectado com sucesso.");
    } catch (e) {
      showToast("Erro ao deslogar.", "error");
    }
  };

  // Generate customized product tracking url
  const handleGenerateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliate) return;

    let target = customOriginalUrl.trim();
    if (!target) {
      showToast("Insira um endereço válido para prosseguir.", "warning");
      return;
    }

    try {
      // Clean and append ref link
      const urlObj = new URL(target.startsWith('http') ? target : `https://${target}`);
      urlObj.searchParams.set('ref', affiliate.id);
      setGeneratedCustomUrl(urlObj.toString());
      showToast("Link personalizado gerado!", "success");
    } catch (e) {
      // Fallback
      if (target.includes('?')) {
        setGeneratedCustomUrl(`${target}&ref=${affiliate.id}`);
      } else {
        setGeneratedCustomUrl(`${target}?ref=${affiliate.id}`);
      }
      showToast("Link gerado (formato alternativo).", "success");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Link copiado para a área de transferência!", "success");
  };

  // Simulator calculations
  const simSales = Math.round(simClicks * (simConversion / 100));
  const simTotalVolume = simSales * simTicket;
  const currentRate = affiliate?.commissionRate || settings?.defaultCommissionRate || 10;
  const simEarnings = (simTotalVolume * currentRate) / 100;

  // Earnings calculations for active affiliate
  const stats = (() => {
    const totalClicks = affiliate?.clicks || 0;
    const totalOrders = commissions.length;
    const conversions = commissions.filter(c => c.status === 'APPROVED' || c.status === 'PAID').length;
    
    let pendingComms = 0;
    let approvedComms = 0; // available
    let paidComms = 0;

    commissions.forEach(c => {
      if (c.status === 'PENDING') {
        pendingComms += c.commissionValue;
      } else if (c.status === 'APPROVED') {
        approvedComms += c.commissionValue;
      } else if (c.status === 'PAID') {
        paidComms += c.commissionValue;
      }
    });

    const conversionPercent = totalClicks > 0 
      ? parseFloat(((conversions / totalClicks) * 100).toFixed(1)) 
      : 0;

    return {
      clicks: totalClicks,
      totalOrders,
      conversions,
      conversionPercent,
      pending: pendingComms,
      approved: approvedComms,
      paid: paidComms
    };
  })();

  const primaryRefUrl = `${window.location.origin}/?ref=${affiliate?.id}`;
  const catalogRefUrl = `${window.location.origin}/catalogo?ref=${affiliate?.id}`;

  return (
    <div 
      className="min-h-screen font-sans transition-colors duration-300"
      style={{
        backgroundColor: currentTheme.backgroundColor,
        color: bgText
      }}
    >
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[10000] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold max-w-sm w-full leading-snug ${
              toastMessage.type === 'error' ? 'bg-red-950/90 border border-red-500/50 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.2)]' :
              toastMessage.type === 'warning' ? 'bg-yellow-950/90 border border-yellow-500/50 text-yellow-100' :
              'bg-zinc-900/95 border border-green-500/50 text-green-100 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
            }`}
          >
            {toastMessage.type === 'error' ? <AlertCircle className="shrink-0 text-red-500" /> : <Check className="shrink-0 text-green-400" />}
            <span className="flex-1">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant Header */}
      <nav 
        className="border-b backdrop-blur-xl sticky top-0 z-40 transition-colors"
        style={{
          backgroundColor: `${currentTheme.cardColor}b0` || 'rgba(0,0,0,0.6)',
          borderColor: cardBorderHex
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span 
              className="text-xl md:text-2xl font-black italic tracking-tighter"
              style={{ color: currentTheme.primaryColor }}
            >
              DISCRETA <span style={{ color: bgText }}>BOUTIQUE</span>
            </span>
            <span 
              className="hidden sm:inline-block text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border font-bold"
              style={{ 
                backgroundColor: currentTheme.backgroundColor,
                borderColor: `${currentTheme.primaryColor}33`,
                color: labelColor
              }}
            >
              Afiliados
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a href="#como-funciona" className="hidden md:block text-xs uppercase tracking-wider font-bold hover:opacity-85 transition-opacity" style={{ color: labelColor }}>
              Como Funciona
            </a>
            <a href="#simulador" className="hidden md:block text-xs uppercase tracking-wider font-bold hover:opacity-85 transition-opacity" style={{ color: labelColor }}>
              Simulador
            </a>
            <a href="#faq" className="hidden md:block text-xs uppercase tracking-wider font-bold hover:opacity-85 transition-opacity" style={{ color: labelColor }}>
              Dúvidas
            </a>
            {currentUser ? (
              <button 
                onClick={() => {
                  const element = document.getElementById('affiliate-panel');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-full transition-all flex items-center gap-2"
                style={{
                  backgroundColor: currentTheme.primaryColor,
                  color: currentTheme.primaryTextColor || '#ffffff'
                }}
              >
                <Compass size={14} className="animate-spin" style={{ animationDuration: '6s' }} /> Meu Painel
              </button>
            ) : (
              <a 
                href="#painel" 
                className="border font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all"
                style={{
                  backgroundColor: `${currentTheme.primaryColor}13`,
                  borderColor: `${currentTheme.primaryColor}33`,
                  color: currentTheme.primaryColor
                }}
              >
                Área do Afiliado
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* Logged Out / Home Presentation */}
      {!currentUser && (
        <>
          {/* HERO SECTION */}
          <section 
            className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32 transition-all"
            style={{
              backgroundImage: `radial-gradient(circle at top, ${currentTheme.primaryColor}20 0%, transparent 60%)`
            }}
          >
            <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none"></div>

            <div className="max-w-5xl mx-auto px-4 md:px-6 relative z-10 text-center">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="flex flex-col items-center"
              >
                <div 
                  className="border text-[10px] font-black uppercase tracking-[0.25em] px-4 py-1.5 rounded-full mb-6"
                  style={{
                    backgroundColor: `${currentTheme.primaryColor}1c`,
                    borderColor: `${currentTheme.primaryColor}50`,
                    color: currentTheme.primaryColor
                  }}
                >
                  🔥 OPORTUNIDADE EXCLUSIVA
                </div>

                <h1 className="text-4xl md:text-7xl font-black tracking-tight uppercase leading-[0.95]" style={{ color: bgText }}>
                  FATURE ATÉ <span className="text-transparent bg-clip-text drop-shadow-[0_0_25px_rgba(239,68,68,0.2)]" style={{ backgroundImage: `linear-gradient(to right, ${currentTheme.primaryColor}, ${currentTheme.highlightColor || currentTheme.primaryColor})` }}>{settings?.defaultCommissionRate || 10}%</span> DE COMISSÃO
                </h1>
                <p className="text-2xl md:text-4xl font-extrabold italic mt-2" style={{ color: secondaryText }}>
                  Divulgando os Lingeries e Produtos Eróticos Mais Desejados!
                </p>

                <p className="max-w-2xl text-sm md:text-base mt-6 leading-relaxed" style={{ color: labelColor }}>
                  A <strong>Discreta Boutique</strong> é referência em sofisticação e discrição absoluta. Cadastre-se como parceira de vendas e use suas redes sociais ou WhatsApp para indicar nossos produtos com entrega em embalagens 100% secretas. Você vende sem estoque e saca no PIX!
                </p>

                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md px-4">
                  <a 
                    href="#painel" 
                    onClick={() => setActiveTab('register')}
                    className="w-full sm:w-auto px-6 py-4 text-center rounded-2xl flex items-center justify-center font-black uppercase tracking-wider text-xs md:text-sm transition-all shadow-[0_0_30px_rgba(220,38,38,0.3)] active:scale-95"
                    style={{
                      backgroundColor: currentTheme.primaryColor,
                      color: currentTheme.primaryTextColor || '#ffffff'
                    }}
                  >
                    Começar a Faturar Hoje
                  </a>
                  <a 
                    href="#como-funciona" 
                    className="w-full sm:w-auto px-6 py-4 text-center rounded-2xl flex items-center justify-center font-bold uppercase tracking-wider text-xs border hover:opacity-90 transition-opacity"
                    style={{
                      backgroundColor: `${cardColorBg}d0`,
                      borderColor: cardBorderHex,
                      color: bgText
                    }}
                  >
                    Entender Como Funciona
                  </a>
                </div>

                <div className="mt-14 grid grid-cols-3 gap-3 md:gap-12 text-center w-full max-w-2xl border-t pt-10" style={{ borderColor: cardBorderHex }}>
                  <div>
                    <div className="text-2xl md:text-4xl font-black" style={{ color: currentTheme.primaryColor }}>100%</div>
                    <div className="text-[8px] md:text-[9px] uppercase tracking-wider font-bold mt-1" style={{ color: secondaryText }}>Gratuito e Sem Taxas</div>
                  </div>
                  <div>
                    <div className="text-2xl md:text-4xl font-black" style={{ color: bgText }}>Até 15%</div>
                    <div className="text-[8px] md:text-[9px] uppercase tracking-wider font-bold mt-1" style={{ color: secondaryText }}>De Comissão Real</div>
                  </div>
                  <div>
                    <div className="text-2xl md:text-4xl font-black" style={{ color: bgText }}>PIX</div>
                    <div className="text-[8px] md:text-[9px] uppercase tracking-wider font-bold mt-1" style={{ color: secondaryText }}>Saque Rápido</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* SIMULATOR */}
          <section id="simulador" className="py-20 border-t bg-black/20" style={{ borderColor: cardBorderHex }}>
            <div className="max-w-4xl mx-auto px-4 md:px-6">
              <div className="text-center mb-12">
                <span className="font-black text-[10px] tracking-widest uppercase" style={{ color: currentTheme.primaryColor }}>🤑 SIMULADOR DE GANHOS EXCLUSIVO</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase mt-1" style={{ color: bgText }}>Quanto posso ganhar sendo afiliada?</h2>
                <p className="text-xs mt-2" style={{ color: secondaryText }}>Ajuste os controles abaixo e veja uma projeção realista baseada nas suas indicações.</p>
              </div>

              <div 
                className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center rounded-3xl border p-6 md:p-10 shadow-2xl relative overflow-hidden"
                style={{
                  backgroundColor: cardColorBg,
                  borderColor: cardBorderHex
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-950/5 via-transparent to-transparent pointer-events-none"></div>
                
                {/* Sliders */}
                <div className="space-y-6 relative z-10">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span style={{ color: cardText }}>Cliques no Link (Mensal):</span>
                      <span style={{ color: currentTheme.primaryColor }}>{simClicks.toLocaleString()} Cliques</span>
                    </div>
                    <input 
                      type="range" 
                      min="100" 
                      max="20000" 
                      step="100"
                      value={simClicks}
                      onChange={(e) => setSimClicks(parseInt(e.target.value))}
                      className="w-full bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer accent-red-600"
                      style={{ accentColor: currentTheme.primaryColor }}
                    />
                    <div className="flex justify-between text-[10px] mt-1 font-semibold" style={{ color: secondaryText }}>
                      <span>100</span>
                      <span>10.000</span>
                      <span>20.000</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span style={{ color: cardText }}>Taxa de Conversão em Venda:</span>
                      <span style={{ color: currentTheme.primaryColor }}>{simConversion}% de sucesso</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="10" 
                      step="0.5"
                      value={simConversion}
                      onChange={(e) => setSimConversion(parseFloat(e.target.value))}
                      className="w-full bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer accent-red-600"
                      style={{ accentColor: currentTheme.primaryColor }}
                    />
                    <div className="flex justify-between text-[10px] mt-1 font-semibold" style={{ color: secondaryText }}>
                      <span>0.5% (Iniciante)</span>
                      <span>5.0% (Alto giro)</span>
                      <span>10% (Profissional)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span style={{ color: cardText }}>Valor Médio da Compra (Ticket):</span>
                      <span style={{ color: currentTheme.primaryColor }}>{formatCurrency(simTicket)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="400" 
                      step="10"
                      value={simTicket}
                      onChange={(e) => setSimTicket(parseInt(e.target.value))}
                      className="w-full bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer accent-red-600"
                      style={{ accentColor: currentTheme.primaryColor }}
                    />
                    <div className="flex justify-between text-[10px] mt-1 font-semibold" style={{ color: secondaryText }}>
                      <span>R$ 50</span>
                      <span>R$ 200</span>
                      <span>R$ 400</span>
                    </div>
                  </div>
                </div>

                {/* Results Screen */}
                <div 
                  className="border rounded-2xl p-6 text-center flex flex-col justify-center relative z-10 min-h-[220px]"
                  style={{
                    backgroundColor: currentTheme.backgroundColor,
                    borderColor: cardBorderHex
                  }}
                >
                  <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: secondaryText }}>Seus Ganhos Mensais Estimados</div>
                  <div 
                    className="text-4xl md:text-5xl font-black drop-shadow-[0_0_20px_rgba(34,197,94,0.15)] animate-pulse"
                    style={{ color: currentTheme.highlightColor || '#22c55e' }}
                  >
                    {formatCurrency(simEarnings)}
                  </div>
                  <div className="h-px my-4" style={{ backgroundColor: cardBorderHex }}></div>
                  
                  <div className="space-y-1.5 text-left">
                    <div className="flex justify-between text-[10px]" style={{ color: labelColor }}>
                      <span>Vendas Estimadas:</span>
                      <span className="font-bold" style={{ color: bgText }}>{simSales} vendas/mês</span>
                    </div>
                    <div className="flex justify-between text-[10px]" style={{ color: labelColor }}>
                      <span>Volume de Venda:</span>
                      <span className="font-bold" style={{ color: bgText }}>{formatCurrency(simTotalVolume)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]" style={{ color: labelColor }}>
                      <span>Sua Comissão Média ({currentRate}%):</span>
                      <span className="font-bold" style={{ color: currentTheme.primaryColor }}>{formatCurrency(simEarnings)}</span>
                    </div>
                  </div>

                  <p className="text-[8px] leading-relaxed mt-4" style={{ color: secondaryText }}>
                    *Esta é uma estimativa simulada baseada em referências históricas e nas métricas do painel Discreta Boutique. Os resultados reais podem variar dependendo da sua dedicação e métodos de compartilhamento.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* STEP BY STEP (COMO FUNCIONA) */}
          <section id="como-funciona" className="py-20 border-t relative" style={{ borderColor: cardBorderHex }}>
            <div className="max-w-5xl mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <span className="font-black text-[10px] tracking-widest uppercase" style={{ color: currentTheme.primaryColor }}>🛠️ SIMPLES E EFICAZ</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase mt-1" style={{ color: bgText }}>Como Funciona em 3 Passos?</h2>
                <p className="text-xs mt-2" style={{ color: secondaryText }}>Veja como é barbada começar a receber comissões pelas suas recomendações.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative z-10">
                <div 
                  className="p-8 rounded-3xl border flex flex-col items-center" 
                  style={{ backgroundColor: `${currentTheme.cardColor}50`, borderColor: cardBorderHex }}
                >
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center border font-black text-xl mb-6"
                    style={{
                      backgroundColor: `${currentTheme.primaryColor}1a`,
                      borderColor: `${currentTheme.primaryColor}33`,
                      color: currentTheme.primaryColor
                    }}
                  >
                    1
                  </div>
                  <h3 className="text-lg font-black uppercase mb-3" style={{ color: bgText }}>Abra sua Conta de Graça</h3>
                  <p className="text-xs leading-relaxed" style={{ color: labelColor }}>
                    Escolha um nome de afiliada exclusivo (ex: <strong>mariasilva</strong>) ao criar seu cadastro. Isso gerará seu link pessoal e intransferível de divulgação instantaneamente.
                  </p>
                </div>

                <div 
                  className="p-8 rounded-3xl border flex flex-col items-center" 
                  style={{ backgroundColor: `${currentTheme.cardColor}50`, borderColor: cardBorderHex }}
                >
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center border font-black text-xl mb-6"
                    style={{
                      backgroundColor: `${currentTheme.primaryColor}1a`,
                      borderColor: `${currentTheme.primaryColor}33`,
                      color: currentTheme.primaryColor
                    }}
                  >
                    2
                  </div>
                  <h3 className="text-lg font-black uppercase mb-3" style={{ color: bgText }}>Recomende Nossos Coleções</h3>
                  <p className="text-xs leading-relaxed" style={{ color: labelColor }}>
                    Copie seu link de indicação do painel. Poste-o na biografia do Instagram, envie no privado, crie stories sensuais mostrando nossas fotos ou envie nos grupos de ofertas do WhatsApp!
                  </p>
                </div>

                <div 
                  className="p-8 rounded-3xl border flex flex-col items-center" 
                  style={{ backgroundColor: `${currentTheme.cardColor}50`, borderColor: cardBorderHex }}
                >
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center border font-black text-xl mb-6"
                    style={{
                      backgroundColor: `${currentTheme.primaryColor}1a`,
                      borderColor: `${currentTheme.primaryColor}33`,
                      color: currentTheme.primaryColor
                    }}
                  >
                    3
                  </div>
                  <h3 className="text-lg font-black uppercase mb-3" style={{ color: bgText }}>Receba Comissões via PIX</h3>
                  <p className="text-xs leading-relaxed" style={{ color: labelColor }}>
                    Sempre que alguém visitar a Discreta Boutique pelo seu link e efetuar uma compra, sua comissão será exibida no painel. Assim que o pedido for entregue, solicite o saque imediato.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ADVANTAGES */}
          <section className="py-20 border-t bg-black/10" style={{ borderColor: cardBorderHex }}>
            <div className="max-w-5xl mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <span className="font-black text-[10px] tracking-widest uppercase" style={{ color: currentTheme.primaryColor }}>💎 VANTAGENS EXCLUSIVAS</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase mt-1" style={{ color: bgText }}>Por que escolher o programa de afiliadas Discreta?</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    icon: Coins,
                    title: "Margem Premium",
                    desc: "Até 15% de remuneração por venda. Perfeito para complementar sua renda de forma recorrente."
                  },
                  {
                    icon: ShieldCheck,
                    title: "Embalagem Totalmente Secreta",
                    desc: "Postagens em embalagens blindadas de papel kraft ou caixas brancas comuns. Ninguém sabe o que tem dentro."
                  },
                  {
                    icon: DynamicClickIcon,
                    title: "Rastreio por Cookies",
                    desc: "Nossos cookies ficam salvos e garantem que o cliente finalize a compra mesmo que dias após o clique com comissão para você."
                  },
                  {
                    icon: TrendingUp,
                    title: "Alta Conversão",
                    desc: "Produtos de alto desejo, lingeries premium, fantasias e cosméticos adultos. Vendas extremamente fáceis."
                  }
                ].map((item, index) => (
                  <div 
                    key={index} 
                    className="border rounded-3xl p-6 transition-all duration-300 transform hover:-translate-y-1"
                    style={{ 
                      backgroundColor: cardColorBg, 
                      borderColor: cardBorderHex 
                    }}
                  >
                    <item.icon className="w-10 h-10 mb-4" style={{ color: currentTheme.primaryColor }} />
                    <h3 className="text-base font-black uppercase mb-2" style={{ color: bgText }}>{item.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: labelColor }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* AUTHENTICATION PORTAL (LOGIN / REGISTER) */}
          <section id="painel" className="py-20 border-t relative" style={{ borderColor: cardBorderHex }}>
            <div className="max-w-md mx-auto px-4">
              <div 
                className="border rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden"
                style={{
                  backgroundColor: cardColorBg,
                  borderColor: cardBorderHex
                }}
              >
                <div className="absolute top-0 inset-x-0 h-1.5" style={{ backgroundColor: currentTheme.primaryColor }}></div>

                <div 
                  className="flex p-1 rounded-2xl mb-8"
                  style={{ backgroundColor: `${currentTheme.backgroundColor}c0` }}
                >
                  <button 
                    onClick={() => setActiveTab('register')}
                    className="flex-1 py-3 text-center rounded-xl text-xs uppercase tracking-wider font-extrabold transition-all"
                    style={{
                      backgroundColor: activeTab === 'register' ? currentTheme.primaryColor : 'transparent',
                      color: activeTab === 'register' ? (currentTheme.primaryTextColor || '#ffffff') : labelColor
                    }}
                  >
                    Quero Me Cadastrar
                  </button>
                  <button 
                    onClick={() => setActiveTab('login')}
                    className="flex-1 py-3 text-center rounded-xl text-xs uppercase tracking-wider font-extrabold transition-all"
                    style={{
                      backgroundColor: activeTab === 'login' ? currentTheme.primaryColor : 'transparent',
                      color: activeTab === 'login' ? (currentTheme.primaryTextColor || '#ffffff') : labelColor
                    }}
                  >
                    Entrar no Painel
                  </button>
                </div>

                {activeTab === 'register' ? (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-black uppercase" style={{ color: bgText }}>Criar Cadastro</h3>
                      <p className="text-[10px] mt-1 pb-4 border-b" style={{ color: secondaryText, borderColor: cardBorderHex }}>Preencha corretamente seus dados para gerar suas credenciais.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider mb-1.5" style={{ color: labelColor }}>Código Exclusivo de Afiliada (Slug)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono font-bold" style={{ color: secondaryText }}>ref=</span>
                        <input 
                          type="text"
                          required
                          value={regSlug}
                          onChange={(e) => setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                          placeholder="mariasilva"
                          className="w-full h-12 border focus:outline-none rounded-xl px-4 pl-12 text-sm font-semibold transition-colors font-mono"
                          style={{
                            backgroundColor: currentTheme.backgroundColor,
                            color: bgText,
                            borderColor: slugStatus === 'available' ? '#22c55e' : slugStatus === 'taken' ? '#ef4444' : cardBorderHex
                          }}
                        />
                        {slugStatus === 'checking' && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: currentTheme.primaryColor }}></div>
                        )}
                        {slugStatus === 'available' && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-green-500 uppercase">✓ Disponível</span>
                        )}
                        {slugStatus === 'taken' && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-red-500 uppercase">✗ Indisponível</span>
                        )}
                      </div>
                      <span className="text-[9px] mt-1 block leading-tight" style={{ color: secondaryText }}>Será usado no final do seu link: discretaboutique.com.br/?ref={regSlug || '...'}</span>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider mb-1.5" style={{ color: labelColor }}>Nome Completo</label>
                      <input 
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Ex: Maria Silva Ramos"
                        className="w-full h-12 border focus:outline-none rounded-xl px-4 text-sm font-semibold"
                        style={{
                          backgroundColor: currentTheme.backgroundColor,
                          color: bgText,
                          borderColor: cardBorderHex
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider mb-1.5" style={{ color: labelColor }}>WhatsApp com DDD</label>
                      <input 
                        type="tel"
                        required
                        value={regWhatsapp}
                        onChange={(e) => setRegWhatsapp(e.target.value.replace(/\D/g, ''))}
                        placeholder="Ex: 51999999999"
                        className="w-full h-12 border focus:outline-none rounded-xl px-4 text-sm font-mono font-semibold"
                        style={{
                          backgroundColor: currentTheme.backgroundColor,
                          color: bgText,
                          borderColor: cardBorderHex
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider mb-1.5" style={{ color: labelColor }}>Endereço de E-mail</label>
                      <input 
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="Ex: seuemail@gmail.com"
                        className="w-full h-12 border focus:outline-none rounded-xl px-4 text-sm font-semibold"
                        style={{
                          backgroundColor: currentTheme.backgroundColor,
                          color: bgText,
                          borderColor: cardBorderHex
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider mb-1.5" style={{ color: labelColor }}>Chave PIX (Para Receber Comissões)</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        {['cpf', 'email', 'telefone', 'outro'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setRegPixType(t)}
                            className="py-2 text-center text-[10px] uppercase font-black rounded-lg border transition-colors cursor-pointer"
                            style={{
                              backgroundColor: regPixType === t ? `${currentTheme.primaryColor}1a` : 'transparent',
                              borderColor: regPixType === t ? currentTheme.primaryColor : cardBorderHex,
                              color: regPixType === t ? currentTheme.primaryColor : labelColor
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <input 
                        type="text"
                        required
                        value={regPixKey}
                        onChange={(e) => setRegPixKey(e.target.value)}
                        placeholder="Insira sua chave correspondente"
                        className="w-full h-12 border focus:outline-none rounded-xl px-4 text-sm font-mono"
                        style={{
                          backgroundColor: currentTheme.backgroundColor,
                          color: bgText,
                          borderColor: cardBorderHex
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider mb-1.5" style={{ color: labelColor }}>Crie sua Senha</label>
                      <input 
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full h-12 border focus:outline-none rounded-xl px-4 text-sm"
                        style={{
                          backgroundColor: currentTheme.backgroundColor,
                          color: bgText,
                          borderColor: cardBorderHex
                        }}
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={authLoading}
                      className="w-full h-14 font-black uppercase tracking-wider text-xs rounded-xl transition-colors mt-6 shadow-md"
                      style={{
                        backgroundColor: authLoading ? `${currentTheme.primaryColor}80` : currentTheme.primaryColor,
                        color: currentTheme.primaryTextColor || '#ffffff'
                      }}
                    >
                      {authLoading ? 'Registrando Informações...' : 'Finalizar Cadastro de Afiliada'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-black uppercase" style={{ color: bgText }}>Entrar no Sistema</h3>
                      <p className="text-[10px] mt-1 pb-4 border-b" style={{ color: secondaryText, borderColor: cardBorderHex }}>Acesse seu extrato, relatórios de cliques e links exclusivos.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider mb-1.5" style={{ color: labelColor }}>E-mail Cadastrado</label>
                      <input 
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="nome@email.com"
                        className="w-full h-12 border focus:outline-none rounded-xl px-4 text-sm font-semibold"
                        style={{
                          backgroundColor: currentTheme.backgroundColor,
                          color: bgText,
                          borderColor: cardBorderHex
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider mb-1.5" style={{ color: labelColor }}>Senha de Acesso</label>
                      <input 
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Digite sua senha cadastrada"
                        className="w-full h-12 border focus:outline-none rounded-xl px-4 text-sm"
                        style={{
                          backgroundColor: currentTheme.backgroundColor,
                          color: bgText,
                          borderColor: cardBorderHex
                        }}
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={authLoading}
                      className="w-full h-14 font-black uppercase tracking-wider text-xs rounded-xl transition-colors mt-6 shadow-md"
                      style={{
                        backgroundColor: authLoading ? `${currentTheme.primaryColor}80` : currentTheme.primaryColor,
                        color: currentTheme.primaryTextColor || '#ffffff'
                      }}
                    >
                      {authLoading ? 'Conectando...' : 'Acessar Meu Painel'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>

          {/* FAQ SECTION */}
          <section id="faq" className="py-20 border-t bg-black/5" style={{ borderColor: cardBorderHex }}>
            <div className="max-w-3xl mx-auto px-4">
              <div className="text-center mb-12">
                <span className="font-black text-[10px] tracking-widest uppercase" style={{ color: currentTheme.primaryColor }}>💬 SUPORTE & DÚVIDAS</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase mt-1" style={{ color: bgText }}>Perguntas Frequentes</h2>
              </div>

              <div className="space-y-4">
                {[
                  {
                    q: "É cobrado algum tipo de mensalidade para ser afiliada?",
                    a: "Não. O cadastro, uso do painel, geração de links e acesso às mídias de suporte são 100% gratuitos. Nós ganhamos quando você vende."
                  },
                  {
                    q: "Como o sistema sabe que a venda foi minha?",
                    a: "Nosso sistema utiliza cookies e códigos de rastreamento inteligentes integrados ao navegador do cliente. Quando o cliente clica no seu link de indicação, o celular ou computador dele guarda o seu código. Se ele fizer a compra dentro de até 30 dias, a comissão é creditada para você."
                  },
                  {
                    q: "Qual o limite mínimo de saque?",
                    a: "O valor mínimo padrão de resgate é configurável no sistema. Atualmente você pode resgatar seu saldo consolidado direto no PIX assim que ultrapassar R$ 50,00 de comissões aprovadas."
                  },
                  {
                    q: "O cliente descobre que comprei por um link de afiliada?",
                    a: "Absolutamente não! O processo de checkout é inteiramente limpo e padrão. O cliente final não nota nenhuma diferença de navegação."
                  },
                  {
                    q: "Como as embalagens de postagem são despachadas?",
                    a: "Todos os produtos são embalados com sigilo extremo da Discreta Boutique. Usamos pacotes externos pardos/kraft ou cinzas comuns, lacrados com fita gomada neutra. Não há nenhuma menção a erotismo, sexshop ou lingeries na etiqueta externa, garantindo 100% de privacidade para quem compra."
                  }
                ].map((faq, idx) => (
                  <div 
                    key={idx} 
                    className="border rounded-2xl overflow-hidden transition-all duration-300"
                    style={{
                      backgroundColor: cardColorBg,
                      borderColor: cardBorderHex
                    }}
                  >
                    <button 
                      onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                      className="w-full px-6 py-5 text-left flex justify-between items-center bg-transparent cursor-pointer font-bold"
                    >
                      <span className="text-sm" style={{ color: cardText }}>{faq.q}</span>
                      <ChevronDown size={16} className="transition-transform" style={{ color: faqOpen === idx ? currentTheme.primaryColor : secondaryText, transform: faqOpen === idx ? 'rotate(180deg)' : 'none' }} />
                    </button>
                    {faqOpen === idx && (
                      <div className="px-6 pb-5 text-xs leading-relaxed pt-3 border-t" style={{ borderColor: cardBorderHex, color: labelColor }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Logged In Affiliate Panel View */}
      {currentUser && (
        <section id="affiliate-panel" className="py-8 md:py-12 max-w-6xl mx-auto px-4 md:px-6">
          {loading ? (
            <div className="py-24 text-center">
              <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: currentTheme.primaryColor, borderTopColor: 'transparent' }}></div>
              <p className="text-xs uppercase tracking-widest font-bold" style={{ color: secondaryText }}>Buscando seu relatório...</p>
            </div>
          ) : !affiliate ? (
            <div className="py-16 text-center max-w-md mx-auto">
              <AlertCircle size={40} className="mx-auto mb-4" style={{ color: currentTheme.primaryColor }} />
              <h2 className="text-xl font-black uppercase mb-2" style={{ color: bgText }}>Cadastro Não Localizado</h2>
              <p className="text-xs leading-relaxed mb-6" style={{ color: labelColor }}>
                Detectamos seu login, mas você ainda não está cadastrado formalmente como integrante do time de afiliados da Discreta Boutique.
              </p>
              
              {/* Fallback to bind user to affiliate */}
              <div 
                className="border p-6 rounded-3xl text-left space-y-4"
                style={{ backgroundColor: cardColorBg, borderColor: cardBorderHex }}
              >
                <h3 className="text-sm font-black uppercase" style={{ color: cardText }}>Criar Perfil de Afiliada</h3>
                <div>
                  <label className="block text-[10px] uppercase font-black mb-1" style={{ color: labelColor }}>Slug da sua Indicação</label>
                  <input 
                    type="text" 
                    value={regSlug}
                    onChange={(e) => setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="mariasilva"
                    className="w-full text-sm h-11 border focus:outline-none rounded-xl px-4 uppercase font-mono"
                    style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: cardBorderHex }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black mb-1" style={{ color: labelColor }}>WhatsApp de Contato</label>
                  <input 
                    type="tel" 
                    value={regWhatsapp}
                    onChange={(e) => setRegWhatsapp(e.target.value.replace(/\D/g, ''))}
                    placeholder="DDD + Número"
                    className="w-full text-sm h-11 border focus:outline-none rounded-xl px-4 font-mono"
                    style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: cardBorderHex }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black mb-1" style={{ color: labelColor }}>Chave PIX e Tipo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select 
                      value={regPixType} 
                      onChange={(e) => setRegPixType(e.target.value)}
                      className="border rounded-xl px-3 text-xs focus:outline-none"
                      style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: cardBorderHex }}
                    >
                      <option value="cpf">CPF</option>
                      <option value="email">E-mail</option>
                      <option value="telefone">Telefone</option>
                      <option value="outro">Aleatória/Outra</option>
                    </select>
                    <input 
                      type="text" 
                      value={regPixKey}
                      onChange={(e) => setRegPixKey(e.target.value)}
                      placeholder="Chave"
                      className="text-sm border focus:outline-none rounded-xl px-3 font-mono"
                      style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: cardBorderHex }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (!regSlug.trim() || !regWhatsapp) {
                      showToast("Preencha todos os dados solicitados.", "warning");
                      return;
                    }
                    try {
                      await affiliateService.registerAffiliate({
                        id: regSlug.replace(/[^a-z0-9_-]/g, ''),
                        uid: currentUser.uid,
                        name: currentUser.displayName || 'Afiliada',
                        email: currentUser.email || '',
                        whatsapp: regWhatsapp,
                        pixKey: regPixKey,
                        pixType: regPixType
                      });
                      showToast("Parabéns! Conta de afiliada criada com sucesso.", "success");
                      await loadAffiliateData(currentUser.uid);
                    } catch (e: any) {
                      showToast(e.message || "Erro ao registrar.", "error");
                    }
                  }}
                  className="w-full h-12 font-black uppercase text-xs tracking-wider rounded-xl transition-all"
                  style={{
                    backgroundColor: currentTheme.primaryColor,
                    color: currentTheme.primaryTextColor || '#ffffff'
                  }}
                >
                  Registrar Agora
                </button>
              </div>

              <button onClick={handleLogout} className="mt-6 hover:opacity-80 transition-opacity text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 mx-auto" style={{ color: currentTheme.primaryColor }}>
                <LogOut size={12} /> Sair da Conta
              </button>
            </div>
          ) : (
            <div>
              {/* Welcome banner */}
              <div 
                className="border rounded-[2rem] p-6 mb-8 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden"
                style={{
                  backgroundColor: cardColorBg,
                  borderColor: cardBorderHex
                }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full filter blur-2xl pointer-events-none" style={{ backgroundColor: `${currentTheme.primaryColor}1a` }}></div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: currentTheme.primaryColor }}>💰 PARCEIRA OFICIAL</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold border ${
                      affiliate.status === 'approved' ? 'bg-green-950/40 border-green-500/50 text-green-400' :
                      affiliate.status === 'rejected' ? 'bg-red-950/40 border-red-500/30 text-red-400' :
                      'bg-yellow-950/40 border-yellow-500/30 text-yellow-400'
                    }`}>
                      {affiliate.status === 'approved' ? 'Link Ativado' : affiliate.status === 'rejected' ? 'Recusado' : 'Em Análise'}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-3xl font-black uppercase" style={{ color: cardText }}>Olá, {affiliate.name}!</h2>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: labelColor }}>
                    Sua porcentagem atual por indicação de sucesso: <strong className="font-black" style={{ color: currentTheme.primaryColor }}>{affiliate.commissionRate || settings?.defaultCommissionRate || 10}%</strong>
                  </p>
                  {affiliate.status !== 'approved' && (
                    <div className="bg-yellow-950/30 border border-yellow-500/20 text-yellow-500/90 text-[10px] p-3 rounded-xl mt-3 max-w-xl font-semibold leading-relaxed">
                      ⏳ Seu cadastro de afiliada está em análise pela Discreta Boutique. Você já pode visualizar o painel e gerar seus links de indicação, porém a aprovação oficial das vendas comissões ocorrerá após a liberação do seu registro.
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={handleLogout} 
                    className="h-11 px-4 border hover:opacity-90 rounded-xl transition-all text-xs font-bold uppercase flex items-center gap-2 cursor-pointer"
                    style={{
                      backgroundColor: currentTheme.backgroundColor,
                      borderColor: cardBorderHex,
                      color: bgText
                    }}
                  >
                    <LogOut size={14} /> Sair
                  </button>
                </div>
              </div>

              {/* Dashboard Sub-tabs */}
              <div className="flex border-b mb-8 overflow-x-auto gap-2 no-scrollbar" style={{ borderColor: cardBorderHex }}>
                {[
                  { id: 'stats', label: 'Desempenho & Saques' },
                  { id: 'links', label: 'Meus Links de Divulgação' },
                  { id: 'profile', label: 'Dados de Pagamento (PIX)' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDashTab(t.id as any)}
                    className="py-4 px-4 font-black text-xs uppercase tracking-wider relative shrink-0 cursor-pointer transition-colors"
                    style={{
                      color: dashTab === t.id ? currentTheme.primaryColor : labelColor,
                      borderBottom: dashTab === t.id ? `2px solid ${currentTheme.primaryColor}` : 'none'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: STATISTICS */}
              {dashTab === 'stats' && (
                <div className="space-y-8">
                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div 
                      className="border rounded-2xl p-5 relative overflow-hidden"
                      style={{
                        backgroundColor: cardColorBg,
                        borderColor: cardBorderHex
                      }}
                    >
                      <div className="text-[10px] font-bold uppercase mb-1.5 flex justify-between items-center" style={{ color: currentTheme.primaryColor }}>
                        <span>Cliques no Link</span>
                        <Share2 size={12} style={{ color: currentTheme.primaryColor }} />
                      </div>
                      <div className="text-2xl md:text-3xl font-black" style={{ color: cardText }}>{stats.clicks}</div>
                      <p className="text-[9px] mt-1" style={{ color: secondaryText }}>Visitantes únicos rastreados</p>
                    </div>

                    <div 
                      className="border rounded-2xl p-5 relative overflow-hidden"
                      style={{
                        backgroundColor: cardColorBg,
                        borderColor: cardBorderHex
                      }}
                    >
                      <div className="text-[10px] font-bold uppercase mb-1.5 flex justify-between items-center" style={{ color: '#eab308' }}>
                        <span>Saldo Pendente</span>
                        <Clock size={12} style={{ color: '#eab308' }} />
                      </div>
                      <div className="text-2xl md:text-3xl font-black text-yellow-500">{formatCurrency(stats.pending)}</div>
                      <p className="text-[9px] mt-1" style={{ color: secondaryText }}>Pedidos aguardando entrega</p>
                    </div>

                    <div 
                      className="border rounded-2xl p-5 relative overflow-hidden"
                      style={{
                        backgroundColor: cardColorBg,
                        borderColor: cardBorderHex
                      }}
                    >
                      <div className="text-[10px] font-bold uppercase mb-1.5 flex justify-between items-center" style={{ color: '#22c55e' }}>
                        <span>Saldo Disponível</span>
                        <Coins size={12} style={{ color: '#22c55e' }} />
                      </div>
                      <div className="text-2xl md:text-3xl font-black text-green-500">{formatCurrency(stats.approved)}</div>
                      <p className="text-[9px] mt-1" style={{ color: secondaryText }}>Consolidado pronto para PIX</p>
                    </div>

                    <div 
                      className="border rounded-2xl p-5 relative overflow-hidden"
                      style={{
                        backgroundColor: cardColorBg,
                        borderColor: cardBorderHex
                      }}
                    >
                      <div className="text-[10px] font-bold uppercase mb-1.5 flex justify-between items-center" style={{ color: currentTheme.primaryColor }}>
                        <span>Total Pago</span>
                        <Award size={12} style={{ color: currentTheme.primaryColor }} />
                      </div>
                      <div className="text-2xl md:text-3xl font-black" style={{ color: cardText }}>{formatCurrency(stats.paid)}</div>
                      <p className="text-[9px] mt-1" style={{ color: secondaryText }}>Comissões recebidas na conta</p>
                    </div>
                  </div>

                  {/* Min Payout & Request Saque banner */}
                  <div 
                    className="border p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    style={{ backgroundColor: cardColorBg, borderColor: cardBorderHex }}
                  >
                    <div>
                      <h4 className="text-xs font-black uppercase text-zinc-300">Como Recebo meu Saldo Disponível?</h4>
                      <p className="text-[10px] max-w-xl mt-1 leading-relaxed" style={{ color: labelColor }}>
                        O limite mínimo padrão para saques é de <strong>{formatCurrency(settings?.minimumPayoutAmount || 50)}</strong>. Quando seu "Saldo Disponível" atingir este montante, nossa equipe financeira realizará a transferência de pagamento para a sua chave PIX cadastrada (<strong>{affiliate.pixType.toUpperCase()}: {affiliate.pixKey}</strong>). Se precisar de ajuda, entre em contato diretamente com o suporte.
                      </p>
                    </div>

                    <a 
                      href={`https://wa.me/5588992340317?text=Ol%C3%A1!+Meu+nome+%C3%A9+${encodeURIComponent(affiliate.name)}+e+gostaria+de+solicitar+o+resgate+de+minhas+comiss%C3%B5es+de+afiliada+da+Discreta+Boutique.+Meu+ID:+${affiliate.id}+-+Saldo+Dispon%C3%ADvel:+${encodeURIComponent(formatCurrency(stats.approved))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`h-11 px-5 rounded-xl uppercase font-black text-xs flex items-center justify-center tracking-wider transition-colors shrink-0`}
                      style={{
                        backgroundColor: stats.approved >= (settings?.minimumPayoutAmount || 50) ? '#22c55e' : `${currentTheme.backgroundColor}`,
                        borderColor: cardBorderHex,
                        color: stats.approved >= (settings?.minimumPayoutAmount || 50) ? '#ffffff' : secondaryText
                      }}
                      onClick={(e) => {
                        if (stats.approved < (settings?.minimumPayoutAmount || 50)) {
                          e.preventDefault();
                          showToast(`Seu saldo de comissões deve ser de no mínimo ${formatCurrency(settings?.minimumPayoutAmount || 50)} para solicitar o resgate.`, "warning");
                        }
                      }}
                    >
                      Solicitar Saque via WhatsApp
                    </a>
                  </div>

                  {/* Commissions History */}
                  <div>
                    <h3 className="text-sm font-black uppercase mb-4" style={{ color: bgText }}>Relatório Detalhado de Vendas e Comissões</h3>
                    
                    {commissions.length === 0 ? (
                      <div 
                        className="border p-12 rounded-3xl text-center"
                        style={{ backgroundColor: cardColorBg, borderColor: cardBorderHex }}
                      >
                        <AlertCircle className="mx-auto mb-3" size={32} style={{ color: secondaryText }} />
                        <h4 className="text-xs font-bold uppercase" style={{ color: cardText }}>Nenhuma Venda Identificada</h4>
                        <p className="text-[10px] mt-1 max-w-xs mx-auto" style={{ color: labelColor }}>Seus cliques estão sendo contados, mas ainda não localizamos pedidos aprovados vinculados ao seu código.</p>
                      </div>
                    ) : (
                      <div 
                        className="border rounded-2xl overflow-hidden"
                        style={{ backgroundColor: cardColorBg, borderColor: cardBorderHex }}
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[700px]">
                            <thead>
                              <tr 
                                className="border-b text-[10px] font-bold uppercase tracking-wider"
                                style={{ backgroundColor: `${currentTheme.backgroundColor}70`, borderColor: cardBorderHex, color: currentTheme.primaryColor }}
                              >
                                <th className="p-4">Pedido ID</th>
                                <th className="p-4">Data</th>
                                <th className="p-4">Cliente / Status</th>
                                <th className="p-4 text-right">Valor Venda</th>
                                <th className="p-4 text-center">Sua Taxa</th>
                                <th className="p-4 text-right">Sua Comissão</th>
                                <th className="p-4 text-right">Status do Recebimento</th>
                              </tr>
                            </thead>
                            <tbody>
                              {commissions.map((comm, idx) => (
                                <tr key={idx} className="border-b transition-colors hover:bg-black/10" style={{ borderColor: cardBorderHex }}>
                                  <td className="p-4 font-black font-mono text-xs">
                                    #{comm.orderShortId}
                                  </td>
                                  <td className="p-4 font-mono text-[11px]" style={{ color: labelColor }}>
                                    {comm.orderDate.toLocaleDateString('pt-BR')} {comm.orderDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-4">
                                    <div className="font-extrabold" style={{ color: cardText }}>{comm.customerName}</div>
                                    <div className="text-[9px] uppercase tracking-wider font-black" style={{ color: secondaryText }}>{comm.orderStatus}</div>
                                  </td>
                                  <td className="p-4 text-right font-mono font-medium" style={{ color: labelColor }}>
                                    {formatCurrency(comm.orderTotal)}
                                  </td>
                                  <td className="p-4 text-center font-bold" style={{ color: currentTheme.primaryColor }}>
                                    {comm.commissionRate}%
                                  </td>
                                  <td className="p-4 text-right font-black font-semibold text-green-500">
                                    {formatCurrency(comm.commissionValue)}
                                  </td>
                                  <td className="p-4 text-right">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold border ${
                                      comm.status === 'PAID' ? 'bg-green-950/30 border-green-500/40 text-green-400' :
                                      comm.status === 'APPROVED' ? 'bg-sky-950/30 border-sky-500/40 text-sky-400' :
                                      comm.status === 'CANCELLED' ? 'bg-red-950/30 border-red-500/40 text-red-400' :
                                      'bg-yellow-950/30 border-yellow-500/40 text-yellow-400'
                                    }`}>
                                      {comm.status === 'PAID' ? 'Pago' :
                                       comm.status === 'APPROVED' ? 'Disponível' :
                                       comm.status === 'CANCELLED' ? 'Cancelado' :
                                       'Aguardando Entrega'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: LINK GENERATORS */}
              {dashTab === 'links' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Primary Link card */}
                    <div 
                      className="border p-6 rounded-3xl space-y-4"
                      style={{ backgroundColor: cardColorBg, borderColor: cardBorderHex }}
                    >
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest block" style={{ color: currentTheme.primaryColor }}>🏠 LINK OFICIAL DA LOJA</span>
                        <h4 className="text-base font-black uppercase mt-1" style={{ color: cardText }}>Página Inicial</h4>
                        <p className="text-[10px] mt-1 leading-relaxed" style={{ color: labelColor }}>
                          Indicado para postar na biografia do seu Instagram, TikTok ou enviar como recomendação geral de catálogo. Se o cliente acessar e comprar qualquer coisa, a comissão é sua.
                        </p>
                      </div>

                      <div 
                        className="flex border rounded-xl overflow-hidden h-12 items-center"
                        style={{ backgroundColor: currentTheme.backgroundColor, borderColor: cardBorderHex }}
                      >
                        <span className="flex-1 text-xs truncate select-all px-4 font-semibold font-mono" style={{ color: bgText }}>
                          {primaryRefUrl}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(primaryRefUrl)}
                          className="h-full px-4 hover:opacity-85 transition-opacity flex items-center justify-center shrink-0 cursor-pointer"
                          style={{ backgroundColor: currentTheme.primaryColor }}
                        >
                          <Copy size={16} style={{ color: currentTheme.primaryTextColor || '#ffffff' }} />
                        </button>
                      </div>
                    </div>

                    {/* Catalog Link card */}
                    <div 
                      className="border p-6 rounded-3xl space-y-4"
                      style={{ backgroundColor: cardColorBg, borderColor: cardBorderHex }}
                    >
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest block" style={{ color: currentTheme.primaryColor }}>🛍️ CATÁLOGO COMPLETO</span>
                        <h4 className="text-base font-black uppercase mt-1" style={{ color: cardText }}>Página do Catálogo</h4>
                        <p className="text-[10px] mt-1 leading-relaxed" style={{ color: labelColor }}>
                          Leva o cliente diretamente para a grade de filtros, buscas rápidas de lingeries, fantasias sensuais e categorias eróticas organizadas.
                        </p>
                      </div>

                      <div 
                        className="flex border rounded-xl overflow-hidden h-12 items-center"
                        style={{ backgroundColor: currentTheme.backgroundColor, borderColor: cardBorderHex }}
                      >
                        <span className="flex-1 text-xs truncate select-all px-4 font-semibold font-mono" style={{ color: bgText }}>
                          {catalogRefUrl}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(catalogRefUrl)}
                          className="h-full px-4 hover:opacity-85 transition-opacity flex items-center justify-center shrink-0 cursor-pointer"
                          style={{ backgroundColor: currentTheme.primaryColor }}
                        >
                          <Copy size={16} style={{ color: currentTheme.primaryTextColor || '#ffffff' }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Product Link Generator */}
                  <div 
                    className="border p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden"
                    style={{ backgroundColor: cardColorBg, borderColor: cardBorderHex }}
                  >
                    <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: currentTheme.primaryColor }}></div>

                    <div className="max-w-xl">
                      <span className="text-[10px] font-black uppercase tracking-widest block" style={{ color: currentTheme.primaryColor }}>🛠️ DIRECIONAMENTO DE PRODUTOS</span>
                      <h3 className="text-lg md:text-xl font-black uppercase mt-1" style={{ color: cardText }}>Gerador Inteligente de Links Personalizados</h3>
                      <p className="text-xs leading-relaxed mt-2" style={{ color: labelColor }}>
                        Quer indicar um lingerie ou produto de sexshop específico da nossa loja? É simples! Copie a URL do produto que viu na nossa loja tradicional (ex: <code>discretaboutique.com.br/produto/calcinha-renda</code>), cole no campo abaixo e gere o seu código correspondente.
                      </p>

                      <form onSubmit={handleGenerateLink} className="space-y-4 mt-6">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input 
                            type="text"
                            value={customOriginalUrl}
                            onChange={(e) => setCustomOriginalUrl(e.target.value)}
                            placeholder="Cole aqui o link do produto (ex: discretaboutique.com.br/produto/...)"
                            className="flex-1 h-12 border focus:outline-none rounded-xl px-4 text-xs"
                            style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: cardBorderHex }}
                          />
                          <button 
                            type="submit"
                            className="h-12 font-black text-xs uppercase tracking-wider px-6 rounded-xl transition-all hover:opacity-90 cursor-pointer"
                            style={{
                              backgroundColor: currentTheme.primaryColor,
                              color: currentTheme.primaryTextColor || '#ffffff'
                            }}
                          >
                            Gerar Link
                          </button>
                        </div>
                      </form>

                      {generatedCustomUrl && (
                        <div 
                          className="mt-6 p-4 rounded-2xl border space-y-2"
                          style={{ backgroundColor: currentTheme.backgroundColor, borderColor: cardBorderHex }}
                        >
                          <span className="text-[9px] font-black uppercase tracking-wider block text-green-500">✓ Link Gerado com Sucesso</span>
                          <div className="flex border rounded-xl overflow-hidden h-11 items-center" style={{ borderColor: cardBorderHex }}>
                            <span className="flex-1 text-[11px] truncate select-all px-4 font-mono font-medium" style={{ color: bgText }}>
                              {generatedCustomUrl}
                            </span>
                            <button 
                              onClick={() => copyToClipboard(generatedCustomUrl)}
                              className="h-full px-4 hover:opacity-90 flex items-center justify-center shrink-0 cursor-pointer"
                              style={{ backgroundColor: currentTheme.primaryColor }}
                            >
                              <Copy size={14} style={{ color: currentTheme.primaryTextColor || '#ffffff' }} />
                            </button>
                          </div>
                          <p className="text-[9px] leading-tight" style={{ color: secondaryText }}>Envie este link direto para o cliente. Quando ele comprar este ou qualquer outro produto na sessão gerada, sua comissão será registrada.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PROFILE CONTROLS */}
              {dashTab === 'profile' && (
                <div className="max-w-xl">
                  <div 
                    className="border p-6 md:p-8 rounded-[2.5rem] space-y-6"
                    style={{ backgroundColor: cardColorBg, borderColor: cardBorderHex }}
                  >
                    <div>
                      <h3 className="text-lg font-black uppercase" style={{ color: cardText }}>Dados Financeiros (Para Saques no PIX)</h3>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: labelColor }}>
                        Mantenha sua chave PIX atualizada corretamente. Todos os pagamentos automáticos do fechamento mensal de afiliadas serão depositados nesta conta.
                      </p>
                    </div>

                    <div className="h-px" style={{ backgroundColor: cardBorderHex }}></div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] uppercase font-black mb-1.5" style={{ color: labelColor }}>Nome Completo do Titular</label>
                        <input 
                          type="text" 
                          disabled
                          value={affiliate.name}
                          className="w-full h-11 border rounded-xl px-4 text-xs font-bold focus:outline-none"
                          style={{ backgroundColor: `${currentTheme.backgroundColor}70`, color: secondaryText, borderColor: cardBorderHex }}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black mb-1.5" style={{ color: labelColor }}>Tipo de Chave PIX</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {['cpf', 'email', 'telefone', 'outro'].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setAffiliate({ ...affiliate, pixType: t });
                              }}
                              className="py-2 text-[10px] uppercase font-black rounded-lg border transition-all cursor-pointer"
                              style={{
                                backgroundColor: affiliate.pixType === t ? `${currentTheme.primaryColor}1a` : 'transparent',
                                borderColor: affiliate.pixType === t ? currentTheme.primaryColor : cardBorderHex,
                                color: affiliate.pixType === t ? currentTheme.primaryColor : labelColor
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black mb-1.5" style={{ color: labelColor }}>Endereço da Chave PIX</label>
                        <input 
                          type="text"
                          value={affiliate.pixKey}
                          onChange={(e) => setAffiliate({ ...affiliate, pixKey: e.target.value })}
                          placeholder="Digite seu PIX cadastrado"
                          className="w-full h-11 border focus:outline-none rounded-xl px-4 text-xs font-mono"
                          style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: cardBorderHex }}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black mb-1.5" style={{ color: labelColor }}>WhatsApp de Notificações</label>
                        <input 
                          type="text"
                          value={affiliate.whatsapp}
                          onChange={(e) => setAffiliate({ ...affiliate, whatsapp: e.target.value.replace(/\D/g, '') })}
                          placeholder="DDD + Número"
                          className="w-full h-11 border focus:outline-none rounded-xl px-4 text-xs font-mono"
                          style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: cardBorderHex }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!affiliate.pixKey.trim() || !affiliate.whatsapp) {
                            showToast("Preencha as chaves corretamente.", "warning");
                            return;
                          }
                          try {
                            const { updateDoc, doc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'affiliates', affiliate.id), {
                              pixKey: affiliate.pixKey.trim(),
                              pixType: affiliate.pixType,
                              whatsapp: affiliate.whatsapp.replace(/\D/g, '')
                            });
                            showToast("Dados de recebimento salvos com sucesso!", "success");
                          } catch (e) {
                            showToast("Erro ao gravar alterações.", "error");
                          }
                        }}
                        className="w-full h-12 font-black uppercase tracking-wider text-xs rounded-xl transition-all hover:opacity-90 cursor-pointer"
                        style={{
                          backgroundColor: currentTheme.primaryColor,
                          color: currentTheme.primaryTextColor || '#ffffff'
                        }}
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* FOOTER */}
      <footer className="border-t py-12 transition-colors" style={{ backgroundColor: `${currentTheme.cardColor}80` || '#000000', borderColor: cardBorderHex }}>
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-center md:text-left">
          <div style={{ color: labelColor }}>
            <span className="font-extrabold" style={{ color: bgText }}>DISCRETA BOUTIQUE © 2026</span> - Todos os direitos reservados.
            <p className="text-[10px] mt-1" style={{ color: secondaryText }}>Programa Oficial de Afiliadas - Sedução, Sigilo & Lucro</p>
          </div>
          <div className="flex gap-4" style={{ color: secondaryText }}>
            <a href="/" className="hover:opacity-80 transition-opacity" style={{ color: currentTheme.linkColor }}>Voltar para a Loja</a>
            <span>•</span>
            <a href="/catalogo" className="hover:opacity-80 transition-opacity" style={{ color: currentTheme.linkColor }}>Ver Catálogo</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Icon for tracking clicks
function DynamicClickIcon(props: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}

// Clock helper icon (fallback to simplified SVG if needed)
function Clock(props: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
