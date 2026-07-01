import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, CheckCircle2, User, ArrowLeft, Loader2, MessageSquare, AlertCircle, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { candidateService } from '../../services/candidateService';
import { ChatMessage, Candidate, CandidateStructuredData } from '../../types/candidate';

export default function TrabalheConoscoPage() {
  // -2: Loading settings, -1: LGPD, 0: Chatting, 1: Extracting structured data, 99: Success screen, 100: Deactivated
  const [currentStep, setCurrentStep] = useState<-2 | -1 | 0 | 1 | 99 | 100>(-2);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [interviewId] = useState<string>(() => {
    const saved = localStorage.getItem('aurora_interview_id');
    if (saved) return saved;
    const newId = `interview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('aurora_interview_id', newId);
    return newId;
  });
  
  // Settings fetched from backend
  const [settings, setSettings] = useState<{
    isActive: boolean;
    recruiterName: string;
    initialMessage: string;
    finalMessage: string;
    lgpdText: string;
  } | null>(null);

  // Conversation and input state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Final structured candidate data compiled from AI extraction
  const [structuredResult, setStructuredResult] = useState<CandidateStructuredData | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages or typing status changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load public recruitment settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/ia/recruitment-settings');
        if (!response.ok) {
          throw new Error('Erro ao carregar configurações de recrutamento');
        }
        const data = await response.json();
        setSettings(data);
        if (!data.isActive) {
          setCurrentStep(100);
        } else {
          setCurrentStep(-1);
        }
      } catch (err) {
        console.error('[SETTINGS_LOAD_ERROR]', err);
        // Fallback fallback to local settings if server fails to provide
        setSettings({
          isActive: true,
          recruiterName: 'Aurora',
          initialMessage: 'Olá! Sou a Aurora, recrutadora virtual da Discreta Boutique. É um prazer ter você aqui querendo fazer parte do nosso time. Vamos iniciar nossa conversa?',
          finalMessage: 'Muito obrigada pelas suas respostas! Seu processo de inscrição foi concluído com sucesso. Nossa equipe de recursos humanos e gerência revisará sua ficha e, se houver compatibilidade com nossas vagas, entraremos em contato direto.',
          lgpdText: 'Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/18), informamos que os dados cadastrados nesta conversa (como nome, contato, informações profissionais e percepções de mercado) serão tratados exclusivamente para análise de aptidão ao nosso time e contatos de recrutamento. Seus dados serão mantidos em sigilo absoluto em nossa infraestrutura de segurança e nunca serão compartilhados com terceiros. Você pode solicitar a remoção permanente de sua ficha a qualquer momento pelo nosso canal oficial de atendimento.'
        });
        setCurrentStep(-1);
      }
    };
    fetchSettings();
  }, []);

  // Handle LGPD Consent
  const handleLgpdAccept = () => {
    if (!lgpdAccepted || !settings) return;
    setCurrentStep(0);
    setIsTyping(true);
    
    // Set the initial greeting from Aurora
    setTimeout(() => {
      setMessages([
        {
          id: 'msg-init',
          sender: 'bot',
          text: settings.initialMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
      setIsTyping(false);
    }, 800);
  };

  // Submit Candidate's chat response
  const handleSendAnswer = async () => {
    if (isTyping || !inputValue.trim() || !settings) return;
    setErrorMsg('');

    const userText = inputValue.trim();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      // Call AI recruitment chat backend route
      const response = await fetch('/api/ia/recruitment-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, interviewId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao processar mensagem com a recrutadora virtual.');
      }

      const data = await response.json();
      let aiText = data.responseText || '';

      setIsTyping(false);

      // Check if conversation has completed
      const isConcluded = aiText.includes('[ENTREVISTA_CONCLUIDA]');
      
      // Clean up the secret tag from display text
      if (isConcluded) {
        aiText = aiText.replace('[ENTREVISTA_CONCLUIDA]', '').trim();
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const nextMessages = [...updatedMessages, botMsg];
      setMessages(nextMessages);

      if (isConcluded) {
        // AI marked interview as finished, proceed to extract structured profile
        handleFinishInterview(nextMessages);
      }
    } catch (err: any) {
      console.error('[CHAT_ERROR]', err);
      setErrorMsg(err.message || 'Houve uma falha na conexão. Por favor, tente enviar novamente.');
      setIsTyping(false);
    }
  };

  // Extract structured data from chat log and save the candidate
  const handleFinishInterview = async (finalMessages: ChatMessage[]) => {
    setCurrentStep(1); // Proceed to step 1 (Extraction state overlay)
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Step A: call GPT extraction backend route
      const response = await fetch('/api/ia/recruitment-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: finalMessages, interviewId }),
      });

      if (!response.ok) {
        throw new Error('Não foi possível estruturar sua ficha de candidato.');
      }

      const structuredData: CandidateStructuredData = await response.json();
      setStructuredResult(structuredData);

      // Step B: Save candidate to Firestore via candidateService
      const finalCandidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'> & { interviewId?: string } = {
        candidateName: structuredData.nomeCompleto || 'Candidato Sem Nome',
        phone: structuredData.whatsapp || '',
        email: structuredData.email || '',
        city: structuredData.cidade || '',
        neighborhood: structuredData.bairro || '',
        status: 'NOVO',
        lgpdAccepted: true,
        lgpdAcceptedAt: new Date().toISOString(),
        structuredData: structuredData,
        chatMessages: finalMessages,
        ipAddress: 'Disponível no servidor', // safe representation
        userAgent: navigator.userAgent,
        interviewId: interviewId || undefined
      };

      await candidateService.createCandidate(finalCandidate);
      localStorage.removeItem('aurora_interview_id');
      
      setCurrentStep(99); // Transition to success step
    } catch (err: any) {
      console.error('[EXTRACTION_AND_SAVE_ERROR]', err);
      setErrorMsg('Desculpe, ocorreu um erro ao registrar sua ficha. Nossos servidores podem estar congestionados. Por favor, clique no botão abaixo para tentar processar novamente.');
      // Allow user to manually retry the extraction/submission
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendAnswer();
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 bottom-16 md:bottom-0 z-40 bg-neutral-950 flex flex-col h-[calc(100dvh-64px)] md:h-[100dvh] overflow-hidden text-neutral-200">
      {/* Background Decorative Neon Accents */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-red-950/10 rounded-full blur-[110px] pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-neutral-900/40 rounded-full blur-[130px] pointer-events-none z-0" />

      {/* STEP -2: Loading settings */}
      {currentStep === -2 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
          <p className="text-sm text-neutral-400 font-medium">Iniciando portal de oportunidades Discreta Boutique...</p>
        </div>
      )}

      {/* STEP 100: DEACTIVATED FROM PUBLIC ACCESS */}
      {currentStep === 100 && (
        <div className="flex-1 flex items-center justify-center p-4 z-10 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-[0_0_30px_rgba(220,38,38,0.05)] relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-red-600" />
            <div className="w-16 h-16 rounded-full bg-red-950/30 border border-red-900/50 flex items-center justify-center text-red-500 mx-auto mb-4">
              <EyeOff size={28} />
            </div>
            <h1 className="font-serif text-2xl font-bold text-white tracking-tight mb-3">Vagas Temporariamente Pausadas</h1>
            <p className="text-sm text-neutral-400 leading-relaxed mb-6">
              Agradecemos seu interesse em fazer parte da equipe Discreta Boutique. No momento, nosso canal público de candidaturas está temporariamente pausado para revisão interna dos perfis recebidos.
            </p>
            <p className="text-xs text-neutral-500 mb-8">
              Fique atenta às nossas redes sociais oficiais para futuros anúncios de contratação e reabertura de entrevistas.
            </p>
            <Link
              to="/"
              className="inline-flex w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm rounded-xl transition-all border border-neutral-700 items-center justify-center"
            >
              Voltar para a Loja
            </Link>
          </motion.div>
        </div>
      )}

      {/* STEP -1: LGPD Consent Notice */}
      {currentStep === -1 && settings && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 z-10 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-[0_0_40px_rgba(220,38,38,0.1)] relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-800 to-amber-700" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-red-950/40 border border-red-900/60 flex items-center justify-center text-red-500">
                <MessageSquare size={20} />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight text-white">Trabalhe Conosco</h1>
                <p className="text-xs text-neutral-400">Canal de Oportunidades • Discreta Boutique</p>
              </div>
            </div>

            <div className="space-y-4 text-neutral-300 text-sm leading-relaxed mb-6">
              <p>
                Seja bem-vinda ao nosso processo seletivo! Para conhecermos melhor você e suas habilidades, utilizamos uma entrevista interativa com nossa recrutadora virtual.
              </p>
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 text-neutral-400 text-xs space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin">
                <p className="font-semibold text-neutral-300">Aviso sobre Proteção de Dados (LGPD):</p>
                <p className="whitespace-pre-line leading-relaxed">{settings.lgpdText}</p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none group mb-8">
              <input
                type="checkbox"
                checked={lgpdAccepted}
                onChange={(e) => setLgpdAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-neutral-800 bg-neutral-950 text-red-600 focus:ring-red-600 focus:ring-offset-neutral-900 cursor-pointer"
              />
              <span className="text-xs text-neutral-400 group-hover:text-neutral-200 transition-colors">
                Li e aceito que meus dados sejam usados exclusivamente para participação no processo seletivo da Discreta Boutique.
              </span>
            </label>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleLgpdAccept}
                disabled={!lgpdAccepted}
                className={`w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 border ${
                  lgpdAccepted
                    ? 'bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white border-red-800 shadow-[0_4px_20px_rgba(220,38,38,0.2)]'
                    : 'bg-neutral-800/40 text-neutral-500 border-neutral-800/70 cursor-not-allowed'
                }`}
              >
                Iniciar Entrevista com {settings.recruiterName}
              </button>
              
              <Link
                to="/"
                className="w-full py-3 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 text-center font-semibold text-xs rounded-xl transition-colors border border-neutral-850 flex items-center justify-center"
              >
                Voltar para a Loja
              </Link>
            </div>
          </motion.div>
        </div>
      )}

      {/* STEP 0: ACTIVE CHAT INTERFACE */}
      {currentStep === 0 && settings && (
        <div className="flex-1 flex flex-col overflow-hidden z-10 w-full">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-b from-red-900 to-stone-900 border border-red-900/60 flex items-center justify-center text-red-400 text-sm font-bold font-serif shadow-[0_0_12px_rgba(220,38,38,0.25)]">
                  {settings.recruiterName[0] || 'A'}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-neutral-950 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-white tracking-wide">{settings.recruiterName}</h2>
                  <span className="text-[9px] bg-red-950/60 text-red-400 border border-red-900/40 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest scale-90">Aurora IA</span>
                </div>
                <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse"></span>
                  Recrutadora Virtual • Online
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (confirm('Deseja realmente sair? Todo o progresso da sua entrevista será perdido.')) {
                    localStorage.removeItem('aurora_interview_id');
                    setCurrentStep(-1);
                    setMessages([]);
                    setLgpdAccepted(false);
                  }
                }}
                className="text-neutral-400 hover:text-white p-2.5 rounded-full hover:bg-neutral-900 transition-colors flex items-center justify-center"
                title="Voltar ao início"
              >
                <ArrowLeft size={18} />
              </button>
            </div>
          </div>

          {/* Message Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            <div className="max-w-3xl mx-auto w-full space-y-5">
              {/* Privacy Notice */}
              <div className="flex justify-center my-2">
                <span className="bg-neutral-900/80 border border-neutral-850 text-neutral-400 text-[10px] px-3 py-1.5 rounded-lg text-center leading-relaxed max-w-sm shadow-sm">
                  🔒 Seus dados e respostas estão protegidos em conformidade com a LGPD e armazenados em sigilo absoluto na Discreta Boutique.
                </span>
              </div>

              <AnimatePresence initial={false}>
                {messages.map((msg) => {
                  const isBot = msg.sender === 'bot';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-lg ${
                        isBot 
                          ? 'bg-neutral-900 border border-neutral-850 text-neutral-100 rounded-tl-none shadow-[0_2px_8px_rgba(0,0,0,0.2)]' 
                          : 'bg-red-950/20 border border-red-900/40 text-red-100 rounded-tr-none shadow-[0_4px_16px_rgba(220,38,38,0.1)]'
                      }`}>
                        <p className="whitespace-pre-line leading-relaxed font-sans">{msg.text}</p>
                        <span className="block text-[9px] text-neutral-500 mt-1.5 text-right font-mono tracking-wider">
                          {msg.timestamp}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Typing Indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div className="bg-neutral-900 border border-neutral-850 rounded-2xl rounded-tl-none px-4 py-3.5 flex items-center gap-1.5 shadow-md">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Error Message banner */}
          {errorMsg && (
            <div className="px-4 py-2 bg-red-950/80 border-t border-red-900/50 text-red-400 text-xs flex items-center gap-2 shrink-0 z-10">
              <AlertCircle size={14} className="shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Input Footer Area */}
          <div 
            className="p-3 sm:p-4 border-t border-neutral-900 bg-neutral-950/90 backdrop-blur-md flex gap-2 items-center shrink-0 w-full z-10"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <div className="max-w-3xl mx-auto w-full flex gap-2 items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                onKeyDown={handleKeyPress}
                disabled={isTyping}
                placeholder={isTyping ? "Aguardando Aurora..." : `Escreva sua mensagem aqui...`}
                className="flex-1 bg-neutral-900 border border-neutral-850 rounded-full px-5 py-3 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-red-800/80 focus:border-red-800/80 transition-all disabled:opacity-40"
              />
              <button
                onClick={handleSendAnswer}
                disabled={isTyping || !inputValue.trim()}
                className={`w-11 h-11 rounded-full transition-all flex items-center justify-center shrink-0 ${
                  inputValue.trim() && !isTyping
                    ? 'bg-red-800 hover:bg-red-700 text-white shadow-[0_0_12px_rgba(220,38,38,0.4)] hover:scale-105 active:scale-95'
                    : 'bg-neutral-900 text-neutral-600 border border-neutral-850 cursor-not-allowed'
                }`}
                title="Enviar mensagem"
              >
                <Send size={16} className={inputValue.trim() && !isTyping ? "translate-x-0.5" : ""} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: AI EXTRACTION AND SAVING PROFILE */}
      {currentStep === 1 && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full shadow-[0_0_30px_rgba(220,38,38,0.05)] relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-800 to-amber-700 animate-pulse" />
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-6" />
            <h1 className="font-serif text-xl font-bold text-white mb-2">Estruturando suas Respostas...</h1>
            <p className="text-sm text-neutral-400 max-w-sm mx-auto leading-relaxed mb-6">
              Nossa Inteligência Artificial está sintetizando sua entrevista e compilando sua ficha profissional da Discreta Boutique. Por favor, não feche esta página.
            </p>

            {errorMsg && (
              <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl text-left text-xs text-red-300 space-y-4">
                <p>{errorMsg}</p>
                <button
                  onClick={() => handleFinishInterview(messages)}
                  className="w-full py-2.5 bg-red-900 hover:bg-red-800 text-white font-semibold rounded-lg transition-colors border border-red-800 flex items-center justify-center gap-1"
                >
                  <Loader2 className="w-3 h-3 animate-spin" /> Tentar Novamente
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* STEP 99: SUCCESS COMPLETED PROFILE */}
      {currentStep === 99 && settings && (
        <div className="flex-1 flex items-center justify-center p-4 z-10 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 max-w-2xl w-full shadow-[0_0_40px_rgba(220,38,38,0.15)] relative overflow-hidden text-center"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-800 to-amber-700" />
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-950/40 border border-green-800/60 flex items-center justify-center text-green-500 mb-4 shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="font-serif text-2xl font-bold text-white tracking-tight">Candidatura Enviada!</h1>
              <p className="text-xs text-neutral-400 mt-1">Sua ficha de recrutamento foi registrada com sucesso</p>
            </div>

            {structuredResult && (
              <div className="p-4 bg-neutral-950 border border-neutral-850 rounded-xl mb-6 text-left space-y-3">
                <h2 className="text-xs font-semibold text-neutral-300 tracking-wider uppercase border-b border-neutral-800 pb-1.5 flex items-center gap-2">
                  <User size={12} className="text-red-500" />
                  Resumo dos Dados Coletados:
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Nome Completo:</span>
                    <span className="text-neutral-300 font-medium truncate block">{structuredResult.nomeCompleto}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">WhatsApp:</span>
                    <span className="text-neutral-300 font-medium block">{structuredResult.whatsapp}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">E-mail:</span>
                    <span className="text-neutral-300 font-medium truncate block">{structuredResult.email}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Cidade / Bairro:</span>
                    <span className="text-neutral-300 font-medium truncate block">
                      {structuredResult.cidade} {structuredResult.bairro ? `(${structuredResult.bairro})` : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="text-sm text-neutral-300 leading-relaxed space-y-4 mb-8 text-left p-4 bg-neutral-950/30 rounded-xl border border-neutral-800/40">
              <p className="whitespace-pre-line text-xs font-serif italic text-neutral-400 leading-relaxed text-center">
                "{settings.finalMessage}"
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                to="/"
                className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm rounded-xl transition-colors border border-neutral-700 flex items-center justify-center"
              >
                Voltar para a Página Inicial
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
