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
import { auth } from '../../../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { affiliateService, Affiliate, Commission, AffiliateSettings } from '../services/affiliateService';

// Format currency in Reais
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);
};

export function AffiliateLandingPage() {
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
      // Clean and appendref link
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
    <div className="min-h-screen bg-[#070202] text-zinc-100 font-sans selection:bg-red-600 selection:text-white">
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
      <nav className="border-b border-zinc-900/80 bg-black/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl md:text-2xl font-black italic tracking-tighter text-white">
              DISCRETA <span className="text-red-500">BOUTIQUE</span>
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800 text-zinc-400 font-bold">
              Afiliados
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a href="#como-funciona" className="hidden md:block text-xs uppercase tracking-wider font-bold text-zinc-400 hover:text-white transition-colors">
              Como Funciona
            </a>
            <a href="#simulador" className="hidden md:block text-xs uppercase tracking-wider font-bold text-zinc-400 hover:text-white transition-colors">
              Simulador
            </a>
            <a href="#faq" className="hidden md:block text-xs uppercase tracking-wider font-bold text-zinc-400 hover:text-white transition-colors">
              Dúvidas
            </a>
            {currentUser ? (
              <button 
                onClick={() => {
                  const element = document.getElementById('affiliate-panel');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-full transition-colors flex items-center gap-2"
              >
                <Compass size={14} className="animate-spin" style={{ animationDuration: '6s' }} /> Meu Painel
              </button>
            ) : (
              <a 
                href="#painel" 
                className="bg-red-600/10 border border-red-500/20 hover:bg-red-600 text-white font-black text-xs uppercase tracking-widest px-5 py-2.5 rounded-full transition-all"
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
          <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-from)_0%,_transparent_60%)] from-red-950/20 to-transparent">
            <div className="absolute inset-0 bg-black/40 z-0"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-900/10 rounded-full filter blur-[120px]"></div>

            <div className="max-w-5xl mx-auto px-4 md:px-6 relative z-10 text-center">
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="flex flex-col items-center"
              >
                <div className="bg-red-950/50 border border-red-500/30 text-red-500 text-[10px] font-black uppercase tracking-[0.25em] px-4 py-1.5 rounded-full mb-6">
                  🔥 OPORTUNIDADE EXCLUSIVA
                </div>

                <h1 className="text-4xl md:text-7xl font-black tracking-tight uppercase leading-[0.95] text-white">
                  FATURE ATÉ <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-600 drop-shadow-[0_0_25px_rgba(239,68,68,0.2)]">{settings?.defaultCommissionRate || 10}%</span> DE COMISSÃO
                </h1>
                <p className="text-3xl md:text-4xl font-extrabold italic text-zinc-400 mt-2">
                  Divulgando os Lingeries e Produtos Eróticos Mais Desejados!
                </p>

                <p className="max-w-2xl text-sm md:text-base text-zinc-400 mt-6 leading-relaxed">
                  A <strong>Discreta Boutique</strong> é referência em sofisticação e discrição absoluta. Cadastre-se como parceira de vendas e use suas redes sociais ou WhatsApp para indicar nossos produtos com entrega em embalagens 100% secretas. Você vende sem estoque e saca no PIX!
                </p>

                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center w-full max-w-sm">
                  <a 
                    href="#painel" 
                    onClick={() => setActiveTab('register')}
                    className="h-16 bg-red-600 hover:bg-red-500 text-white rounded-2xl flex items-center justify-center font-black uppercase tracking-wider text-sm transition-all shadow-[0_0_30px_rgba(220,38,38,0.3)] active:scale-95"
                  >
                    Começar a Faturar Hoje
                  </a>
                  <a 
                    href="#como-funciona" 
                    className="h-16 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-zinc-100 rounded-2xl flex items-center justify-center font-bold uppercase tracking-wider text-xs transition-colors"
                  >
                    Entender Como Funciona
                  </a>
                </div>

                <div className="mt-14 grid grid-cols-3 gap-6 md:gap-12 text-center w-full max-w-2xl border-t border-zinc-900/60 pt-10">
                  <div>
                    <div className="text-3xl md:text-4xl font-black text-red-500">100%</div>
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Gratuito e Sem Taxas</div>
                  </div>
                  <div>
                    <div className="text-3xl md:text-4xl font-black text-white">Até 15%</div>
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">De Comissão Real</div>
                  </div>
                  <div>
                    <div className="text-3xl md:text-4xl font-black text-white">PIX</div>
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mt-1">Saque Rápido</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* SIMULATOR */}
          <section id="simulador" className="py-20 border-t border-zinc-950 bg-black/40">
            <div className="max-w-4xl mx-auto px-4 md:px-6">
              <div className="text-center mb-12">
                <span className="text-red-500 font-black text-[10px] tracking-widest uppercase">🤑 SIMULADOR DE GANHOS EXCLUSIVO</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase text-white mt-1">Quanto posso ganhar sendo afiliada?</h2>
                <p className="text-xs text-zinc-500 mt-2">Ajuste os controles abaixo e veja uma projeção realista baseada nas suas indicações.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-zinc-950/80 rounded-3xl border border-zinc-900 p-6 md:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-950/5 via-transparent to-transparent"></div>
                
                {/* Sliders */}
                <div className="space-y-6 relative z-10">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-zinc-400">Cliques no Link (Mensal):</span>
                      <span className="text-red-500">{simClicks.toLocaleString()} Cliques</span>
                    </div>
                    <input 
                      type="range" 
                      min="100" 
                      max="20000" 
                      step="100"
                      value={simClicks}
                      onChange={(e) => setSimClicks(parseInt(e.target.value))}
                      className="w-full accent-red-600 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-semibold">
                      <span>100</span>
                      <span>10.000</span>
                      <span>20.000</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-zinc-400">Taxa de Conversão em Venda:</span>
                      <span className="text-red-500">{simConversion}% de sucesso</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="10" 
                      step="0.5"
                      value={simConversion}
                      onChange={(e) => setSimConversion(parseFloat(e.target.value))}
                      className="w-full accent-red-600 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-semibold">
                      <span>0.5% (Iniciante)</span>
                      <span>5.0% (Alto giro)</span>
                      <span>10% (Profissional)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-zinc-400">Valor Médio da Compra (Ticket):</span>
                      <span className="text-red-500">{formatCurrency(simTicket)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="400" 
                      step="10"
                      value={simTicket}
                      onChange={(e) => setSimTicket(parseInt(e.target.value))}
                      className="w-full accent-red-600 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-semibold">
                      <span>R$ 50</span>
                      <span>R$ 200</span>
                      <span>R$ 400</span>
                    </div>
                  </div>
                </div>

                {/* Results Screen */}
                <div className="bg-black/40 border border-zinc-900 rounded-2xl p-6 text-center flex flex-col justify-center relative z-10 min-h-[220px]">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Seus Ganhos Mensais Estimados</div>
                  <div className="text-4xl md:text-5xl font-black text-green-500 drop-shadow-[0_0_20px_rgba(34,197,94,0.15)] animate-pulse">
                    {formatCurrency(simEarnings)}
                  </div>
                  <div className="h-px bg-zinc-900 my-4"></div>
                  
                  <div className="space-y-1.5 text-left">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Vendas Estimadas:</span>
                      <span className="font-bold text-white">{simSales} vendas por mês</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Volume de Venda:</span>
                      <span className="font-bold text-white">{formatCurrency(simTotalVolume)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Sua Comissão Média ({currentRate}%):</span>
                      <span className="font-bold text-red-500">{formatCurrency(simEarnings)}</span>
                    </div>
                  </div>

                  <p className="text-[8px] text-zinc-600 leading-relaxed mt-4">
                    *Esta é uma estimativa simulada baseada em referências históricas e nas métricas do painel Discreta Boutique. Os resultados reais podem variar dependendo da sua dedicação e métodos de compartilhamento.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* STEP BY STEP (COMO FUNCIONA) */}
          <section id="como-funciona" className="py-20 border-t border-zinc-950 relative">
            <div className="max-w-5xl mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <span className="text-red-500 font-black text-[10px] tracking-widest uppercase">🛠️ SIMPLES E EFICAZ</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase text-white mt-1">Como Funciona em 3 Passos?</h2>
                <p className="text-xs text-zinc-500 mt-2">Veja como é barbada começar a receber comissões pelas suas recomendações.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative z-10">
                <div className="bg-zinc-950/50 p-8 rounded-3xl border border-zinc-900 flex flex-col items-center">
                  <div className="w-14 h-14 bg-red-600/10 rounded-full flex items-center justify-center border border-red-500/30 text-red-500 mb-6 font-black text-xl">
                    1
                  </div>
                  <h3 className="text-lg font-black uppercase text-white mb-3">Abra sua Conta de Graça</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Escolha um nome de afiliada exclusivo (ex: <strong>mariasilva</strong>) ao criar seu cadastro. Isso gerará seu link pessoal e intransferível de divulgação instantaneamente.
                  </p>
                </div>

                <div className="bg-zinc-950/50 p-8 rounded-3xl border border-zinc-900 flex flex-col items-center">
                  <div className="w-14 h-14 bg-red-600/10 rounded-full flex items-center justify-center border border-red-500/30 text-red-500 mb-6 font-black text-xl">
                    2
                  </div>
                  <h3 className="text-lg font-black uppercase text-white mb-3">Recomende Nossos Coleções</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Copie seu link de indicação do painel. Poste-o na biografia do Instagram, envie no privado, crie stories sensuais mostrando nossas fotos ou envie nos grupos de ofertas do WhatsApp!
                  </p>
                </div>

                <div className="bg-zinc-950/50 p-8 rounded-3xl border border-zinc-900 flex flex-col items-center">
                  <div className="w-14 h-14 bg-red-600/10 rounded-full flex items-center justify-center border border-red-500/30 text-red-500 mb-6 font-black text-xl">
                    3
                  </div>
                  <h3 className="text-lg font-black uppercase text-white mb-3">Receba Comissões via PIX</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Sempre que alguém visitar a Discreta Boutique pelo seu link e efetuar uma compra, sua comissão será exibida no painel. Assim que o pedido for entregue, solicite o saque imediato.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ADVANTAGES */}
          <section className="py-20 border-t border-zinc-950 bg-black/60">
            <div className="max-w-5xl mx-auto px-4 md:px-6">
              <div className="text-center mb-16">
                <span className="text-red-500 font-black text-[10px] tracking-widest uppercase">💎 VANTAGENS EXCLUSIVAS</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase text-white mt-1">Por que escolher o programa de afiliadas Discreta?</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <div key={index} className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 hover:border-red-500/30 transition-colors">
                    <item.icon className="text-red-500 w-10 h-10 mb-4" />
                    <h3 className="text-base font-black uppercase text-white mb-2">{item.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* AUTHENTICATION PORTAL (LOGIN / REGISTER) */}
          <section id="painel" className="py-20 border-t border-zinc-950 bg-radial-gradient(circle_at_bottom,_rgba(220,38,38,0.1)_0%,_transparent_50%)">
            <div className="max-w-md mx-auto px-4">
              <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 to-red-800"></div>

                <div className="flex bg-zinc-900/60 p-1 rounded-2xl mb-8">
                  <button 
                    onClick={() => setActiveTab('register')}
                    className={`flex-1 py-3 text-center rounded-xl text-xs uppercase tracking-wider font-extrabold transition-all ${
                      activeTab === 'register' ? 'bg-red-600 text-white font-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Quero Me Cadastrar
                  </button>
                  <button 
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 py-3 text-center rounded-xl text-xs uppercase tracking-wider font-extrabold transition-all ${
                      activeTab === 'login' ? 'bg-red-600 text-white font-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Entrar no Painel
                  </button>
                </div>

                {activeTab === 'register' ? (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-black uppercase text-white">Criar Cadastro</h3>
                      <p className="text-[10px] text-zinc-500 mt-1 pb-4">Preencha corretamente seus dados para gerar suas credenciais.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">Código Exclusivo de Afiliada (Slug)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs font-mono font-bold">ref=</span>
                        <input 
                          type="text"
                          required
                          value={regSlug}
                          onChange={(e) => setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                          placeholder="mariasilva"
                          className="w-full h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 pl-12 text-sm text-white font-semibold transition-colors font-mono"
                        />
                        {slugStatus === 'checking' && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                        )}
                        {slugStatus === 'available' && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-green-500 uppercase">✓ Disponível</span>
                        )}
                        {slugStatus === 'taken' && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-red-500 uppercase">✗ Indisponível</span>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-500 mt-1 block leading-tight">Será usado no final do seu link: discretaboutique.com.br/?ref={regSlug || '...'}</span>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">Nome Completo</label>
                      <input 
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Ex: Maria Silva Ramos"
                        className="w-full h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 text-sm text-white font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">WhatsApp com DDD</label>
                      <input 
                        type="tel"
                        required
                        value={regWhatsapp}
                        onChange={(e) => setRegWhatsapp(e.target.value.replace(/\D/g, ''))}
                        placeholder="Ex: 51999999999"
                        className="w-full h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 text-sm text-zinc-100 font-mono font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">Endereço de E-mail</label>
                      <input 
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="Ex: seuemail@gmail.com"
                        className="w-full h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 text-sm text-white font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5 font-bold">Chave PIX (Para Receber Comissões)</label>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {['cpf', 'email', 'telefone', 'outro'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setRegPixType(t)}
                            className={`py-2 text-center text-[10px] uppercase font-black rounded-lg border transition-colors ${
                              regPixType === t ? 'bg-red-950/40 border-red-500 text-red-500' : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
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
                        className="w-full h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 text-sm text-zinc-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">Crie sua Senha</label>
                      <input 
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 text-sm text-white"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={authLoading}
                      className="w-full h-14 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white font-black uppercase tracking-wider text-xs rounded-xl transition-colors mt-6 shadow-[0_0_20px_rgba(220,38,38,0.2)]"
                    >
                      {authLoading ? 'Registrando Informações...' : 'Finalizar Cadastro de Afiliada'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-black uppercase text-white">Entrar no Sistema</h3>
                      <p className="text-[10px] text-zinc-500 mt-1 pb-4">Acesse seu extrato, relatórios de cliques e links exclusivos.</p>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">E-mail Cadastrado</label>
                      <input 
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="nome@email.com"
                        className="w-full h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 text-sm text-white font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400 mb-1.5">Senha de Acesso</label>
                      <input 
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Digite sua senha cadastrada"
                        className="w-full h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 text-sm text-white"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={authLoading}
                      className="w-full h-14 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white font-black uppercase tracking-wider text-xs rounded-xl transition-colors mt-6 shadow-[0_0_20px_rgba(220,38,38,0.2)]"
                    >
                      {authLoading ? 'Conectando...' : 'Acessar Meu Painel'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>

          {/* FAQ SECTION */}
          <section id="faq" className="py-20 border-t border-zinc-950 bg-black/40">
            <div className="max-w-3xl mx-auto px-4">
              <div className="text-center mb-12">
                <span className="text-red-500 font-black text-[10px] tracking-widest uppercase">💬 SUPORTE & DÚVIDAS</span>
                <h2 className="text-2xl md:text-4xl font-black uppercase text-white mt-1">Perguntas Frequentes</h2>
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
                  <div key={idx} className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden transition-all">
                    <button 
                      onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                      className="w-full px-6 py-5 text-left flex justify-between items-center bg-transparent cursor-pointer font-bold"
                    >
                      <span className="text-sm text-zinc-200">{faq.q}</span>
                      <ChevronDown size={16} className={`text-zinc-500 transition-transform ${faqOpen === idx ? 'rotate-180 text-red-500' : ''}`} />
                    </button>
                    {faqOpen === idx && (
                      <div className="px-6 pb-5 text-xs text-zinc-400 leading-relaxed border-t border-zinc-900/60 pt-3">
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
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xs uppercase tracking-widest font-bold text-zinc-500">Buscando seu relatório...</p>
            </div>
          ) : !affiliate ? (
            <div className="py-16 text-center max-w-md mx-auto">
              <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-black uppercase text-white mb-2">Cadastro Não Localizado</h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Detectamos seu login, mas você ainda não está cadastrado formalmente como integrante do time de afiliados da Discreta Boutique.
              </p>
              
              {/* Fallback to bind user to affiliate */}
              <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl text-left space-y-4">
                <h3 className="text-sm font-black uppercase text-white">Criar Perfil de Afiliada</h3>
                <div>
                  <label className="block text-[10px] uppercase font-black text-zinc-500 mb-1">Slug da sua Indicação</label>
                  <input 
                    type="text" 
                    value={regSlug}
                    onChange={(e) => setRegSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="mariasilva"
                    className="w-full bg-zinc-900 text-sm h-11 border border-zinc-800 rounded-xl px-4 text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-zinc-500 mb-1">WhatsApp de Contato</label>
                  <input 
                    type="tel" 
                    value={regWhatsapp}
                    onChange={(e) => setRegWhatsapp(e.target.value.replace(/\D/g, ''))}
                    placeholder="DDD + Número"
                    className="w-full bg-zinc-900 text-sm h-11 border border-zinc-800 rounded-xl px-4 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-zinc-500 mb-1">Chave PIX e Tipo</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select 
                      value={regPixType} 
                      onChange={(e) => setRegPixType(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-xs text-zinc-300"
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
                      className="bg-zinc-900 text-sm border border-zinc-800 rounded-xl px-3 text-white font-mono"
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
                  className="w-full h-12 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-wider rounded-xl transition-all"
                >
                  Registrar Agora
                </button>
              </div>

              <button onClick={handleLogout} className="mt-6 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 mx-auto">
                <LogOut size={12} /> Sair da Conta
              </button>
            </div>
          ) : (
            <div>
              {/* Welcom banner */}
              <div className="bg-gradient-to-r from-red-950/40 via-zinc-950 to-zinc-950 border border-zinc-900 rounded-[2rem] p-6 mb-8 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full filter blur-2xl"></div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">💰 PARCEIRA OFICIAL</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold border ${
                      affiliate.status === 'approved' ? 'bg-green-950/40 border-green-500/50 text-green-400' :
                      affiliate.status === 'rejected' ? 'bg-red-950/40 border-red-500/30 text-red-400' :
                      'bg-yellow-950/40 border-yellow-500/30 text-yellow-400'
                    }`}>
                      {affiliate.status === 'approved' ? 'Link Ativado' : affiliate.status === 'rejected' ? 'Recusado' : 'Em Análise'}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-3xl font-black uppercase text-white">Olá, {affiliate.name}!</h2>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    Sua porcentagem atual por indicação de sucesso: <strong className="text-red-500 font-black">{affiliate.commissionRate || settings?.defaultCommissionRate || 10}%</strong>
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
                    className="h-11 px-4 bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all text-xs font-bold uppercase flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut size={14} /> Sair
                  </button>
                </div>
              </div>

              {/* Dashboard Sub-tabs */}
              <div className="flex border-b border-zinc-900 mb-8 overflow-x-auto gap-2">
                {[
                  { id: 'stats', label: 'Desempenho & Saques' },
                  { id: 'links', label: 'Meus Links de Divulgação' },
                  { id: 'profile', label: 'Dados de Pagamento (PIX)' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDashTab(t.id as any)}
                    className={`py-4 px-4 font-black text-xs uppercase tracking-wider relative shrink-0 cursor-pointer ${
                      dashTab === t.id ? 'text-red-500 border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: STATISTICS */}
              {dashTab === 'stats' && (
                <div className="space-y-8">
                  {/* Cards Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1.5 flex justify-between items-center">
                        <span>Cliques no Link</span>
                        <Share2 size={12} className="text-zinc-600" />
                      </div>
                      <div className="text-2xl md:text-3xl font-black text-white">{stats.clicks}</div>
                      <p className="text-[9px] text-zinc-500 mt-1">Visitantes únicos rastreados</p>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1.5 flex justify-between items-center">
                        <span>Saldo Pendente</span>
                        <Clock size={12} className="text-yellow-600" />
                      </div>
                      <div className="text-2xl md:text-3xl font-black text-yellow-500">{formatCurrency(stats.pending)}</div>
                      <p className="text-[9px] text-zinc-500 mt-1">Pedidos aguardando entrega</p>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1.5 flex justify-between items-center">
                        <span>Saldo Disponível</span>
                        <Coins size={12} className="text-green-600" />
                      </div>
                      <div className="text-2xl md:text-3xl font-black text-green-500">{formatCurrency(stats.approved)}</div>
                      <p className="text-[9px] text-zinc-500 mt-1">Consolidado pronto para PIX</p>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
                      <div className="text-[10px] font-bold uppercase text-zinc-500 mb-1.5 flex justify-between items-center">
                        <span>Total Pago</span>
                        <Award size={12} className="text-red-600" />
                      </div>
                      <div className="text-2xl md:text-3xl font-black text-white">{formatCurrency(stats.paid)}</div>
                      <p className="text-[9px] text-zinc-500 mt-1">Comissões recebidas na conta</p>
                    </div>
                  </div>

                  {/* Min Payout & Request Saque banner */}
                  <div className="bg-zinc-950 border border-zinc-900 p-5 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="text-xs font-black uppercase text-zinc-300">Como Recebo meu Saldo Disponível?</h4>
                      <p className="text-[10px] text-zinc-500 max-w-xl mt-1 leading-relaxed">
                        O limite mínimo padrão para saques é de <strong>{formatCurrency(settings?.minimumPayoutAmount || 50)}</strong>. Quando seu "Saldo Disponível" atingir este montante, nossa equipe financeira realizará a transferência automática de pagamento para a sua chave PIX cadastrada (<strong>{affiliate.pixType.toUpperCase()}: {affiliate.pixKey}</strong>). Se precisar de ajuda, entre em contato diretamente com o suporte.
                      </p>
                    </div>

                    <a 
                      href={`https://wa.me/5551999999999?text=Ol%C3%A1!+Meu+nome+%C3%A9+${encodeURIComponent(affiliate.name)}+e+gostaria+de+solicitar+o+resgate+de+minhas+comiss%C3%B5es+de+afiliada+da+Discreta+Boutique.+Meu+ID:+${affiliate.id}+-+Saldo+Dispon%C3%ADvel:+${encodeURIComponent(formatCurrency(stats.approved))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`h-11 px-5 rounded-xl uppercase font-black text-xs flex items-center justify-center tracking-wider transition-colors shrink-0 ${
                        stats.approved >= (settings?.minimumPayoutAmount || 50)
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
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
                    <h3 className="text-sm font-black uppercase text-white mb-4">Relatório Detalhado de Vendas e Comissões</h3>
                    
                    {commissions.length === 0 ? (
                      <div className="bg-zinc-950/40 border border-zinc-900 p-12 rounded-3xl text-center">
                        <AlertCircle className="text-zinc-700 mx-auto mb-3" size={32} />
                        <h4 className="text-xs font-bold uppercase text-zinc-500">Nenhuma Venda Identificada</h4>
                        <p className="text-[10px] text-zinc-600 mt-1 max-w-xs mx-auto">Seus cliques estão sendo contados, mas ainda não localizamos pedidos aprovados vinculados ao seu código.</p>
                      </div>
                    ) : (
                      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[700px]">
                            <thead>
                              <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 font-bold uppercase tracking-wider bg-black/40">
                                <th className="p-4">Pedido ID</th>
                                <th className="p-4">Data</th>
                                <th className="p-4">Cliente / Tipo</th>
                                <th className="p-4 text-right">Valor Venda</th>
                                <th className="p-4 text-center">Sua Taxa</th>
                                <th className="p-4 text-right">Sua Comissão</th>
                                <th className="p-4 text-right">Status do Recebimento</th>
                              </tr>
                            </thead>
                            <tbody>
                              {commissions.map((comm, idx) => (
                                <tr key={idx} className="border-b border-zinc-900 hover:bg-zinc-900/20">
                                  <td className="p-4 font-black font-mono text-white text-xs">
                                    #{comm.orderShortId}
                                  </td>
                                  <td className="p-4 text-zinc-500 font-mono text-[11px]">
                                    {comm.orderDate.toLocaleDateString('pt-BR')} {comm.orderDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="p-4">
                                    <div className="font-extrabold text-zinc-300">{comm.customerName}</div>
                                    <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-black">{comm.orderStatus}</div>
                                  </td>
                                  <td className="p-4 text-right font-mono text-zinc-400 font-medium">
                                    {formatCurrency(comm.orderTotal)}
                                  </td>
                                  <td className="p-4 text-center font-bold text-red-500">
                                    {comm.commissionRate}%
                                  </td>
                                  <td className="p-4 text-right font-black font-semibold text-green-400">
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
                    <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl space-y-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-widest block">🏠 LINK OFICIAL DA LOJA</span>
                        <h4 className="text-base font-black uppercase text-white mt-1">Página Inicial</h4>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                          Indicado para postar na biografia do seu Instagram, TikTok ou enviar como recomendação geral de catálogo. Se o cliente acessar e comprar qualquer coisa, a comissão é sua.
                        </p>
                      </div>

                      <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden h-12 items-center">
                        <span className="flex-1 text-xs truncate select-all px-4 font-semibold text-zinc-300 font-mono">
                          {primaryRefUrl}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(primaryRefUrl)}
                          className="h-full px-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Copy size={16} className="text-white" />
                        </button>
                      </div>
                    </div>

                    {/* Catalog Link card */}
                    <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-3xl space-y-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-red-500 tracking-widest block">🛍️ CATALOGO COMPLETO</span>
                        <h4 className="text-base font-black uppercase text-white mt-1">Página do Catálogo</h4>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                          Leva o cliente diretamente para a grade de filtros, buscas rápidas de lingeries, fantasias sensuais e categorias eróticas organizadas.
                        </p>
                      </div>

                      <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden h-12 items-center">
                        <span className="flex-1 text-xs truncate select-all px-4 font-semibold text-zinc-300 font-mono">
                          {catalogRefUrl}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(catalogRefUrl)}
                          className="h-full px-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Copy size={16} className="text-white" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Product Link Generator */}
                  <div className="bg-zinc-950 border border-zinc-900 p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 to-red-800"></div>

                    <div className="max-w-xl">
                      <span className="text-[10px] font-black uppercase text-red-500 tracking-widest block">🛠️ DIRECIONAMENTO DE PROrodutos</span>
                      <h3 className="text-lg md:text-xl font-black uppercase text-white mt-1">Gerador Inteligente de Links Personalizados</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-2">
                        Quer indicar um lingerie ou produto de sexshop específico da nossa loja? É simples! Copie a URL do produto que viu na nossa loja tradicional (ex: <code>discretaboutique.com.br/produto/calcinha-renda</code>), cole no campo abaixo e gere o seu código correspondente.
                      </p>

                      <form onSubmit={handleGenerateLink} className="space-y-4 mt-6">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input 
                            type="text"
                            value={customOriginalUrl}
                            onChange={(e) => setCustomOriginalUrl(e.target.value)}
                            placeholder="Cole aqui o link do produto (ex: discretaboutique.com.br/produto/...)"
                            className="flex-1 h-12 bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 text-xs text-white"
                          />
                          <button 
                            type="submit"
                            className="h-12 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider px-6 rounded-xl transition-colors shrink-0"
                          >
                            Gerar Link
                          </button>
                        </div>
                      </form>

                      {generatedCustomUrl && (
                        <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-zinc-900 space-y-2">
                          <span className="text-[9px] font-black uppercase tracking-wider block text-green-500">✓ Link Gerado com Sucesso</span>
                          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden h-11 items-center">
                            <span className="flex-1 text-[11px] truncate select-all px-4 font-mono font-medium text-zinc-300">
                              {generatedCustomUrl}
                            </span>
                            <button 
                              onClick={() => copyToClipboard(generatedCustomUrl)}
                              className="h-full px-4 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <Copy size={14} className="text-white" />
                            </button>
                          </div>
                          <p className="text-[9px] text-zinc-500 leading-tight">Envie este link direto para o cliente. Quando ele comprar este ou qualquer outro produto na sessão gerada, sua comissão será registrada.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PROFILE CONTROLS */}
              {dashTab === 'profile' && (
                <div className="max-w-xl">
                  <div className="bg-zinc-950 border border-zinc-900 p-6 md:p-8 rounded-[2.5rem] space-y-6">
                    <div>
                      <h3 className="text-lg font-black uppercase text-white">Dados Financeiros (Para Saques no PIX)</h3>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        Mantenha sua chave PIX atualizada corretamente. Todos os pagamentos automáticos do fechamento mensal de afiliadas serão depositados nesta conta.
                      </p>
                    </div>

                    <div className="h-px bg-zinc-900"></div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] uppercase font-black text-zinc-500 mb-1.5">Nome Completo do Titular</label>
                        <input 
                          type="text" 
                          disabled
                          value={affiliate.name}
                          className="w-full h-11 bg-zinc-900/40 text-xs border border-zinc-800 rounded-xl px-4 text-zinc-400 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-zinc-500 mb-1.5">Tipo de Chave PIX</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {['cpf', 'email', 'telefone', 'outro'].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setAffiliate({ ...affiliate, pixType: t });
                              }}
                              className={`py-2 text-[10px] uppercase font-black rounded-lg border transition-all ${
                                affiliate.pixType === t ? 'bg-red-950/40 border-red-500 text-red-500 font-heavy' : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-zinc-500 mb-1.5">Endereço da Chave PIX</label>
                        <input 
                          type="text"
                          value={affiliate.pixKey}
                          onChange={(e) => setAffiliate({ ...affiliate, pixKey: e.target.value })}
                          placeholder="Digite seu PIX cadastrado"
                          className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-xs text-zinc-100 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-black text-zinc-500 mb-1.5">WhatsApp de Notificações</label>
                        <input 
                          type="text"
                          value={affiliate.whatsapp}
                          onChange={(e) => setAffiliate({ ...affiliate, whatsapp: e.target.value.replace(/\D/g, '') })}
                          placeholder="DDD + Número"
                          className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-xs text-zinc-100 font-mono"
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
                        className="w-full h-12 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-wider text-xs rounded-xl transition-colors mt-6"
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
      <footer className="border-t border-zinc-950 py-12 bg-black">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-zinc-600 text-xs text-center md:text-left">
          <div>
            <span className="font-extrabold text-zinc-400">DISCRETA BOUTIQUE © 2026</span> - Todos os direitos reservados.
            <p className="text-[10px] text-zinc-600 mt-1">Programa Oficial de Afiliadas - Sedução, Sigilo & Lucro</p>
          </div>
          <div className="flex gap-4">
            <a href="/" className="hover:text-zinc-400 transition-colors">Voltar para a Loja</a>
            <span>•</span>
            <a href="/catalogo" className="hover:text-zinc-400 transition-colors">Ver Catálogo</a>
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
