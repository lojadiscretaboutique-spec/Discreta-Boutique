import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, User, ArrowLeft, Loader2, AlertCircle, EyeOff, 
  Camera, Upload, FileText, Check, Trash2, Shield, Phone, 
  Mail, MapPin, Calendar, Briefcase, Award, Smile, Sparkles, 
  ChevronRight, ChevronLeft, HelpCircle 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { candidateService } from '../../services/candidateService';
import { Candidate, CandidateStructuredData } from '../../types/candidate';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/storage';

export default function TrabalheConoscoPage() {
  const [currentStep, setCurrentStep] = useState<number>(-2); // -2: loading, -1: LGPD, 0..6: steps, 99: Success, 100: Deactivated
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Settings
  const [settings, setSettings] = useState<{
    isActive: boolean;
    recruiterName: string;
    finalMessage: string;
    lgpdText: string;
    resumeRequired?: boolean;
    selfieRequired?: boolean;
    resumeMaxSizeMb?: number;
    resumeAcceptedTypes?: string;
    declarationText?: string;
  } | null>(null);

  // Form Data State
  const [formData, setFormData] = useState<CandidateStructuredData>({
    nomeCompleto: '',
    idade: '',
    cidade: '',
    bairro: '',
    whatsapp: '',
    email: '',
    disponibilidadeHorarios: '',
    disponibilidadeSabados: '',
    disponibilidadeDatasEspeciais: '',
    disponibilidadePromocoes: '',
    disponibilidadeLiveShop: '',
    dataInicio: '',
    tipoInteresse: 'fixo',
    experienciaProfissional: '',
    experienciaAtendimento: '',
    experienciaVendas: '',
    experienciaLojaCaixaEstoquePdv: '',
    experienciaWhatsappComercial: '',
    ultimaExperiencia: '',
    cargoUltimaExperiencia: '',
    tempoPermanencia: '',
    motivoSaida: '',
    facilidadeAprender: '',
    organizacao: '',
    trabalhoEquipe: '',
    confortoProdutosIntimos: '',
    entendimentoDiscricao: '',
    clienteIndeciso: '',
    perguntasIntimas: '',
    facilidadeRedesSociais: '',
    pontoForte: '',
    pontoDesenvolver: '',
    expectativaSalarial: '',
    mensagemFinal: ''
  });

  // Selfie & Resume Files
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeName, setResumeName] = useState<string>('');

  // Camera stream state
  const [useCameraStream, setUseCameraStream] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
          setCurrentStep(-1); // LGPD Screen
        }
      } catch (err) {
        console.error('[SETTINGS_LOAD_ERROR]', err);
        // Fallback default configurations
        setSettings({
          isActive: true,
          recruiterName: 'Aurora',
          finalMessage: 'Muito obrigada pelas suas respostas! Seu processo de inscrição foi concluído com sucesso. Nossa equipe de recursos humanos e gerência revisará sua ficha e, se houver compatibilidade com nossas vagas, entraremos em contato direto.',
          lgpdText: 'Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/18), informamos que os dados cadastrados nesta conversa (como nome, contato, informações profissionais e percepções de mercado) serão tratados exclusivamente para análise de aptidão ao nosso time e contatos de recrutamento. Seus dados serão mantidos em sigilo absoluto em nossa infraestrutura de segurança e nunca serão compartilhados com terceiros. Você pode solicitar a remoção permanente de sua ficha a qualquer momento pelo nosso canal oficial de atendimento.',
          resumeRequired: false,
          selfieRequired: false,
          resumeMaxSizeMb: 5,
          resumeAcceptedTypes: '.pdf,.doc,.docx',
          declarationText: 'Confirmo que as informações declaradas são verdadeiras e autorizo o uso para o processo seletivo da Discreta Boutique.'
        });
        setCurrentStep(-1);
      }
    };
    fetchSettings();
  }, []);

  // Inline camera methods
  const startCamera = async () => {
    try {
      setErrorMsg('');
      setUseCameraStream(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('[CAMERA_ACCESS_ERROR]', err);
      setUseCameraStream(false);
      setErrorMsg('Não foi possível acessar a câmera do dispositivo automaticamente. Utilize o botão de Captura Rápida do Sistema abaixo.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUseCameraStream(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            setSelfieBlob(blob);
            setSelfiePreview(URL.createObjectURL(blob));
            stopCamera();
          }
        }, 'image/jpeg', 0.85);
      }
    }
  };

  // Fallback camera upload
  const handleSelfieFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelfieBlob(file);
      setSelfiePreview(URL.createObjectURL(file));
      setErrorMsg('');
    }
  };

  // Resume File Upload
  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const maxMb = settings?.resumeMaxSizeMb || 5;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setErrorMsg(`O arquivo do currículo deve ter no máximo ${maxMb}MB.`);
      return;
    }

    const allowedTypes = settings?.resumeAcceptedTypes ? settings.resumeAcceptedTypes.split(',').map(t => t.trim().toLowerCase()) : ['.pdf', '.doc', '.docx'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      setErrorMsg(`Formato inválido. Apenas os formatos ${allowedTypes.join(', ')} são aceitos.`);
      return;
    }

    setResumeFile(file);
    setResumeName(file.name);
  };

  const removeResume = () => {
    setResumeFile(null);
    setResumeName('');
  };

  // Form value handlers
  const handleInputChange = (field: keyof CandidateStructuredData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  // Validation routines per step
  const validateStep = (stepIndex: number): boolean => {
    const errors: Record<string, string> = {};

    if (stepIndex === 0) {
      // Dados pessoais
      if (!formData.nomeCompleto.trim()) errors.nomeCompleto = 'Nome completo é obrigatório';
      if (!formData.idade.trim()) errors.idade = 'Idade é obrigatória';
      if (!formData.cidade.trim()) errors.cidade = 'Cidade é obrigatória';
      if (!formData.bairro.trim()) errors.bairro = 'Bairro é obrigatório';
      
      const phoneDigits = formData.whatsapp.replace(/\D/g, '');
      if (!formData.whatsapp.trim()) {
        errors.whatsapp = 'WhatsApp é obrigatório';
      } else if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        errors.whatsapp = 'Insira um WhatsApp válido com DDD (10 ou 11 dígitos)';
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email.trim()) {
        errors.email = 'E-mail é obrigatório';
      } else if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Insira um e-mail válido';
      }
    }

    if (stepIndex === 1) {
      // Disponibilidade
      if (!formData.disponibilidadeHorarios.trim()) errors.disponibilidadeHorarios = 'Informe sua disponibilidade de horários';
      if (!formData.dataInicio.trim()) errors.dataInicio = 'Informe quando pode começar';
    }

    if (stepIndex === 5) {
      // Anexos
      // A selfie do candidato agora é sempre opcional, conforme solicitação do cliente
      if ((settings?.resumeRequired) && !resumeFile) {
        errors.resume = 'O envio do currículo é obrigatório';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    stopCamera();
    setCurrentStep(prev => Math.max(0, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Application
  const handleSubmitApplication = async () => {
    if (!declarationAccepted) {
      setErrorMsg('Você precisa marcar o aceite da declaração final antes de enviar.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    // Helper to convert Blob/File to Base64
    const blobToBase64 = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    };

    try {
      const applicationId = `application-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      let selfieUrl = '';
      let resumeUrl = '';

      // 1. Upload Selfie to Firebase Storage via Server Proxy
      if (selfieBlob) {
        try {
          const base64File = await blobToBase64(selfieBlob);
          const response = await fetch('/api/recruitment/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64File,
              fileName: 'selfie.jpg',
              path: `recruitment/selfies/${applicationId}`,
              contentType: 'image/jpeg'
            })
          });
          const result = await response.json();
          if (result.success) {
            selfieUrl = result.url;
          } else {
            throw new Error(result.error || 'Erro no upload da selfie');
          }
        } catch (uploadErr: any) {
          console.error('Selfie upload failed:', uploadErr);
          throw new Error(`Falha no upload da selfie: ${uploadErr.message}`);
        }
      }

      // 2. Upload Resume to Firebase Storage via Server Proxy
      if (resumeFile) {
        try {
          const base64File = await blobToBase64(resumeFile);
          const response = await fetch('/api/recruitment/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64File,
              fileName: resumeFile.name,
              path: `recruitment/resumes/${applicationId}`,
              contentType: resumeFile.type || 'application/pdf'
            })
          });
          const result = await response.json();
          if (result.success) {
            resumeUrl = result.url;
          } else {
            throw new Error(result.error || 'Erro no upload do currículo');
          }
        } catch (uploadErr: any) {
          console.error('Resume upload failed:', uploadErr);
          throw new Error(`Falha no upload do currículo: ${uploadErr.message}`);
        }
      }

      // 3. Compose Final Candidate object
      const finalCandidate: Candidate = {
        candidateName: formData.nomeCompleto,
        phone: formData.whatsapp,
        email: formData.email,
        city: formData.cidade,
        neighborhood: formData.bairro,
        age: formData.idade,
        status: 'NOVO',
        lgpdAccepted: true,
        lgpdAcceptedAt: new Date().toISOString(),
        declarationAccepted: true,
        declarationAcceptedAt: new Date().toISOString(),
        structuredData: {
          ...formData,
          // Garante preenchimento de campos para evitar o status 'INCOMPLETA' do candidateService
          experienciaProfissional: formData.experienciaProfissional || 'Não informada',
          experienciaAtendimento: formData.experienciaAtendimento || 'Não informada',
          experienciaVendas: formData.experienciaVendas || 'Não informada',
          experienciaLojaCaixaEstoquePdv: formData.experienciaLojaCaixaEstoquePdv || 'Não informada',
          experienciaWhatsappComercial: formData.experienciaWhatsappComercial || 'Não informada',
          ultimaExperiencia: formData.ultimaExperiencia || 'Não informada',
          cargoUltimaExperiencia: formData.cargoUltimaExperiencia || 'Não informada',
          tempoPermanencia: formData.tempoPermanencia || 'Não informado',
          motivoSaida: formData.motivoSaida || 'Não informado',
          facilidadeAprender: formData.facilidadeAprender || 'Não informada',
          organizacao: formData.organizacao || 'Não informada',
          trabalhoEquipe: formData.trabalhoEquipe || 'Não informado',
          confortoProdutosIntimos: formData.confortoProdutosIntimos || 'Não informado',
          entendimentoDiscricao: formData.entendimentoDiscricao || 'Não informado',
          clienteIndeciso: formData.clienteIndeciso || 'Não informado',
          perguntasIntimas: formData.perguntasIntimas || 'Não informado',
          facilidadeRedesSociais: formData.facilidadeRedesSociais || 'Não informada',
          pontoForte: formData.pontoForte || 'Não informado',
          pontoDesenvolver: formData.pontoDesenvolver || 'Não informado',
          expectativaSalarial: formData.expectativaSalarial || 'Não informada',
          mensagemFinal: formData.mensagemFinal || 'Enviada pelo formulário premium.'
        },
        chatMessages: [
          {
            id: 'system-init',
            sender: 'bot',
            text: 'Candidatura preenchida diretamente via Formulário Estruturado Premium.',
            timestamp: new Date().toLocaleTimeString()
          }
        ],
        ipAddress: 'Disponível no servidor',
        userAgent: navigator.userAgent,
        interviewId: applicationId,
        selfieUrl: selfieUrl || '',
        resumeUrl: resumeUrl || '',
        resumeFileName: resumeName || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 4. Save to Firestore
      await candidateService.createCandidate(finalCandidate as any);

      setCurrentStep(99); // Transition to success step
    } catch (err: any) {
      console.error('[SUBMIT_APPLICATION_ERROR]', err);
      setErrorMsg('Erro de rede ao salvar candidatura. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList = [
    { title: 'Dados Pessoais', icon: User },
    { title: 'Disponibilidade', icon: Calendar },
    { title: 'Experiência', icon: Briefcase },
    { title: 'Perfil', icon: Award },
    { title: 'Finalização', icon: Smile },
    { title: 'Mídias', icon: Camera },
    { title: 'Revisão', icon: Shield }
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 pb-20 pt-6 px-4 md:px-8 relative overflow-hidden flex flex-col items-center">
      {/* Background Neon Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-950/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-950/5 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* HEADER BAR */}
      <header className="w-full max-w-4xl flex items-center justify-between mb-8 z-10 shrink-0 border-b border-neutral-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-b from-red-900 to-stone-950 border border-red-900/40 flex items-center justify-center text-red-500 font-serif font-bold shadow-[0_0_15px_rgba(220,38,38,0.2)]">
            D
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold tracking-tight text-white">Discreta Boutique</h1>
            <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-semibold">Trabalhe Conosco</p>
          </div>
        </div>
        <Link 
          to="/"
          className="text-xs text-neutral-400 hover:text-white transition-colors border border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-900/40"
        >
          Voltar para Loja
        </Link>
      </header>

      {/* LOADING */}
      {currentStep === -2 && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center z-10">
          <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
          <p className="text-sm text-neutral-400 font-medium font-mono">Iniciando Portal de Candidaturas...</p>
        </div>
      )}

      {/* DEACTIVATED STATUS */}
      {currentStep === 100 && (
        <div className="flex-1 flex flex-col items-center justify-center py-10 z-10 max-w-md w-full text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-[0_0_30px_rgba(220,38,38,0.05)] relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-red-600" />
            <div className="w-16 h-16 rounded-full bg-red-950/30 border border-red-900/50 flex items-center justify-center text-red-500 mx-auto mb-4">
              <EyeOff size={28} />
            </div>
            <h2 className="font-serif text-2xl font-bold text-white tracking-tight mb-3">Vagas Pausadas</h2>
            <p className="text-sm text-neutral-400 leading-relaxed mb-6">
              Agradecemos seu interesse em fazer parte de nossa equipe. No momento, o recebimento de novas candidaturas está pausado para revisão interna dos perfis atuais.
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

      {/* LGPD ACCEPT SCREEN */}
      {currentStep === -1 && settings && (
        <div className="flex-1 w-full max-w-2xl z-10 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-[0_0_40px_rgba(220,38,38,0.1)] relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-800 to-amber-700" />
            <h2 className="font-serif text-2xl font-bold tracking-tight text-white mb-2">Portal de Oportunidades</h2>
            <p className="text-xs text-neutral-400 mb-6">Preencha sua ficha de inscrição em etapas seguras</p>

            <div className="space-y-4 text-neutral-300 text-sm leading-relaxed mb-6">
              <p>
                Seja bem-vinda ao nosso portal de recrutamento. Nosso processo foi desenvolvido de forma estruturada para compreendermos seu perfil profissional e alinharmos suas competências com nossas vagas disponíveis.
              </p>
              
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-850 text-neutral-400 text-xs space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                <p className="font-bold text-neutral-200">Aviso sobre Proteção de Dados (LGPD):</p>
                <p className="whitespace-pre-line leading-relaxed text-neutral-400">{settings.lgpdText}</p>
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
                Li e aceito que meus dados declarados sejam tratados exclusivamente para recrutamento e seleção pela equipe Discreta Boutique.
              </span>
            </label>

            <button
              onClick={() => {
                if (lgpdAccepted) setCurrentStep(0);
              }}
              disabled={!lgpdAccepted}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 border ${
                lgpdAccepted
                  ? 'bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white border-red-800 shadow-[0_4px_20px_rgba(220,38,38,0.25)]'
                  : 'bg-neutral-800/40 text-neutral-500 border-neutral-800/70 cursor-not-allowed'
              }`}
            >
              Iniciar Preenchimento da Ficha
            </button>
          </motion.div>
        </div>
      )}

      {/* FORM STEPS INTERFACE */}
      {currentStep >= 0 && currentStep <= 6 && settings && (
        <div className="w-full max-w-3xl z-10 flex flex-col gap-6">
          
          {/* STEPPER PROGRESS BAR */}
          <div className="bg-neutral-900/80 border border-neutral-900 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
              <span>Ficha Profissional • Etapa {currentStep + 1} de 7</span>
              <span className="text-red-400 font-bold">{Math.round(((currentStep + 1) / 7) * 100)}% concluído</span>
            </div>
            
            {/* Progress bar container */}
            <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
              <motion.div 
                className="bg-gradient-to-r from-red-800 to-amber-600 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / 7) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Stepper text indicators */}
            <div className="hidden sm:grid grid-cols-7 gap-1 mt-1 text-[9px] text-center font-bold tracking-wider uppercase text-neutral-500">
              {stepsList.map((step, idx) => {
                const IconComp = step.icon;
                const isActive = idx === currentStep;
                const isPassed = idx < currentStep;
                return (
                  <div 
                    key={idx} 
                    className={`flex flex-col items-center gap-1 transition-colors ${
                      isActive ? 'text-red-400' : isPassed ? 'text-neutral-300' : 'text-neutral-600'
                    }`}
                  >
                    <IconComp size={12} />
                    <span className="truncate w-full">{step.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTIVE STEP CARD */}
          <div className="bg-neutral-900/95 border border-neutral-850 rounded-2xl p-5 md:p-8 shadow-[0_4px_30px_rgba(0,0,0,0.4)] min-h-[400px] flex flex-col justify-between">
            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Step Titles */}
                  <div className="border-b border-neutral-850 pb-4">
                    <h2 className="text-xl font-serif font-bold text-white tracking-tight">
                      {stepsList[currentStep].title}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-1">
                      {currentStep === 0 && 'Preencha com seus dados pessoais de identificação e contato.'}
                      {currentStep === 1 && 'Indique seus horários, preferência de contratação e início.'}
                      {currentStep === 2 && 'Conte sobre seu histórico profissional recente e de atendimento.'}
                      {currentStep === 3 && 'Avaliaremos sua sintonia com os pilares da Discreta Boutique.'}
                      {currentStep === 4 && 'Destaque pontos pessoais e expectativa de remuneração.'}
                      {currentStep === 5 && 'Foto oficial de identificação em tempo real e currículo PDF.'}
                      {currentStep === 6 && 'Verifique se todos os dados estão corretos e declare o aceite final.'}
                    </p>
                  </div>

                  {/* STEP 0: DADOS PESSOAIS */}
                  {currentStep === 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Nome completo */}
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1">
                          Nome Completo <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.nomeCompleto}
                          onChange={(e) => handleInputChange('nomeCompleto', e.target.value)}
                          placeholder="Digite seu nome completo"
                          className={`w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                            validationErrors.nomeCompleto ? 'border-red-500/80 focus:ring-red-500' : 'border-neutral-800'
                          }`}
                        />
                        {validationErrors.nomeCompleto && (
                          <span className="text-[9px] text-red-400 font-semibold block">{validationErrors.nomeCompleto}</span>
                        )}
                      </div>

                      {/* Idade */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                          Idade <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.idade}
                          onChange={(e) => handleInputChange('idade', e.target.value)}
                          placeholder="Ex: 25 anos"
                          className={`w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                            validationErrors.idade ? 'border-red-500/80 focus:ring-red-500' : 'border-neutral-800'
                          }`}
                        />
                        {validationErrors.idade && (
                          <span className="text-[9px] text-red-400 font-semibold block">{validationErrors.idade}</span>
                        )}
                      </div>

                      {/* WhatsApp */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                          WhatsApp com DDD <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={formData.whatsapp}
                          onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                          placeholder="Apenas números. Ex: 11988887777"
                          className={`w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                            validationErrors.whatsapp ? 'border-red-500/80 focus:ring-red-500' : 'border-neutral-800'
                          }`}
                        />
                        {validationErrors.whatsapp && (
                          <span className="text-[9px] text-red-400 font-semibold block">{validationErrors.whatsapp}</span>
                        )}
                      </div>

                      {/* E-mail */}
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                          E-mail Pessoal <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="seu.email@exemplo.com"
                          className={`w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                            validationErrors.email ? 'border-red-500/80 focus:ring-red-500' : 'border-neutral-800'
                          }`}
                        />
                        {validationErrors.email && (
                          <span className="text-[9px] text-red-400 font-semibold block">{validationErrors.email}</span>
                        )}
                      </div>

                      {/* Cidade */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                          Cidade <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.cidade}
                          onChange={(e) => handleInputChange('cidade', e.target.value)}
                          placeholder="Digite sua cidade"
                          className={`w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                            validationErrors.cidade ? 'border-red-500/80 focus:ring-red-500' : 'border-neutral-800'
                          }`}
                        />
                        {validationErrors.cidade && (
                          <span className="text-[9px] text-red-400 font-semibold block">{validationErrors.cidade}</span>
                        )}
                      </div>

                      {/* Bairro */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                          Bairro <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.bairro}
                          onChange={(e) => handleInputChange('bairro', e.target.value)}
                          placeholder="Digite seu bairro"
                          className={`w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                            validationErrors.bairro ? 'border-red-500/80 focus:ring-red-500' : 'border-neutral-800'
                          }`}
                        />
                        {validationErrors.bairro && (
                          <span className="text-[9px] text-red-400 font-semibold block">{validationErrors.bairro}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* STEP 1: DISPONIBILIDADE */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      {/* Horários */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                          Disponibilidade Geral de Horários <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.disponibilidadeHorarios}
                          onChange={(e) => handleInputChange('disponibilidadeHorarios', e.target.value)}
                          placeholder="Ex: Integral das 9h às 19h, ou apenas meio período"
                          className={`w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                            validationErrors.disponibilidadeHorarios ? 'border-red-500/80 focus:ring-red-500' : 'border-neutral-800'
                          }`}
                        />
                        {validationErrors.disponibilidadeHorarios && (
                          <span className="text-[9px] text-red-400 font-semibold block">{validationErrors.disponibilidadeHorarios}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Sábados */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Disponibilidade aos Sábados?
                          </label>
                          <input
                            type="text"
                            value={formData.disponibilidadeSabados}
                            onChange={(e) => handleInputChange('disponibilidadeSabados', e.target.value)}
                            placeholder="Ex: Sim, sem restrições"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Datas especiais */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Disponibilidade para Datas Especiais?
                          </label>
                          <input
                            type="text"
                            value={formData.disponibilidadeDatasEspeciais}
                            onChange={(e) => handleInputChange('disponibilidadeDatasEspeciais', e.target.value)}
                            placeholder="Ex: Sim, natal, dias das mães, namorados"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Promoções */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Participação em Promoções / Campanhas?
                          </label>
                          <input
                            type="text"
                            value={formData.disponibilidadePromocoes}
                            onChange={(e) => handleInputChange('disponibilidadePromocoes', e.target.value)}
                            placeholder="Ex: Sim, tenho total flexibilidade"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Live shop */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Disponibilidade para Live Shop?
                          </label>
                          <input
                            type="text"
                            value={formData.disponibilidadeLiveShop}
                            onChange={(e) => handleInputChange('disponibilidadeLiveShop', e.target.value)}
                            placeholder="Ex: Sim, posso atuar no suporte ou em vídeo"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {/* Início */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Quando pode começar? <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.dataInicio}
                            onChange={(e) => handleInputChange('dataInicio', e.target.value)}
                            placeholder="Ex: Imediato, ou em 15 dias"
                            className={`w-full bg-neutral-950 border rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all ${
                              validationErrors.dataInicio ? 'border-red-500/80 focus:ring-red-500' : 'border-neutral-800'
                            }`}
                          />
                          {validationErrors.dataInicio && (
                            <span className="text-[9px] text-red-400 font-semibold block">{validationErrors.dataInicio}</span>
                          )}
                        </div>

                        {/* Tipo interesse */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Tipo de Interesse de Contratação
                          </label>
                          <select
                            value={formData.tipoInteresse}
                            onChange={(e) => handleInputChange('tipoInteresse', e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-red-600"
                          >
                            <option value="fixo">Vaga Fixa CLT</option>
                            <option value="temporário">Temporária / Final de Ano</option>
                            <option value="freelancer">Freelancer / Sob demanda</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: EXPERIÊNCIA PROFISSIONAL */}
                  {currentStep === 2 && (
                    <div className="space-y-4">
                      {/* Experiencia Geral */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                          Experiência Profissional Geral (Breve resumo)
                        </label>
                        <textarea
                          value={formData.experienciaProfissional}
                          onChange={(e) => handleInputChange('experienciaProfissional', e.target.value)}
                          placeholder="Descreva brevemente sua trajetória no mercado"
                          className="w-full h-16 bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none font-sans"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Atendimento */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Experiência com Atendimento ao Cliente?
                          </label>
                          <input
                            type="text"
                            value={formData.experienciaAtendimento}
                            onChange={(e) => handleInputChange('experienciaAtendimento', e.target.value)}
                            placeholder="Ex: Sim, há 2 anos em comércio físico"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Vendas */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Experiência com Vendas?
                          </label>
                          <input
                            type="text"
                            value={formData.experienciaVendas}
                            onChange={(e) => handleInputChange('experienciaVendas', e.target.value)}
                            placeholder="Ex: Sim, metas individuais e conversão"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Loja Caixa Estoque PDV */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Experiência com Caixa, Estoque ou Organização?
                          </label>
                          <input
                            type="text"
                            value={formData.experienciaLojaCaixaEstoquePdv}
                            onChange={(e) => handleInputChange('experienciaLojaCaixaEstoquePdv', e.target.value)}
                            placeholder="Ex: Sim, abertura de caixa e contagem de estoque"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* WhatsApp comercial */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Experiência com WhatsApp Comercial?
                          </label>
                          <input
                            type="text"
                            value={formData.experienciaWhatsappComercial}
                            onChange={(e) => handleInputChange('experienciaWhatsappComercial', e.target.value)}
                            placeholder="Ex: Sim, vendas e suporte por WhatsApp"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>
                      </div>

                      {/* Ultima experiencia detalhada */}
                      <div className="border-t border-neutral-850 pt-4 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <h3 className="text-xs font-bold text-neutral-300">Detalhes do Último Emprego</h3>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Última Empresa onde trabalhou
                          </label>
                          <input
                            type="text"
                            value={formData.ultimaExperiencia}
                            onChange={(e) => handleInputChange('ultimaExperiencia', e.target.value)}
                            placeholder="Ex: Boutique Elegance"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Cargo Exercido
                          </label>
                          <input
                            type="text"
                            value={formData.cargoUltimaExperiencia}
                            onChange={(e) => handleInputChange('cargoUltimaExperiencia', e.target.value)}
                            placeholder="Ex: Consultora de Vendas"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Tempo de Permanência
                          </label>
                          <input
                            type="text"
                            value={formData.tempoPermanencia}
                            onChange={(e) => handleInputChange('tempoPermanencia', e.target.value)}
                            placeholder="Ex: 1 ano e 3 meses"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Motivo de Saída
                          </label>
                          <input
                            type="text"
                            value={formData.motivoSaida}
                            onChange={(e) => handleInputChange('motivoSaida', e.target.value)}
                            placeholder="Ex: Em busca de novas oportunidades"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: PERFIL PROFISSIONAL */}
                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Facilidade aprender */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Facilidade para Aprender Novos Processos?
                          </label>
                          <input
                            type="text"
                            value={formData.facilidadeAprender}
                            onChange={(e) => handleInputChange('facilidadeAprender', e.target.value)}
                            placeholder="Ex: Muito alta, gosto de absorver métodos"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Organização */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Avaliação de sua Organização Individual
                          </label>
                          <input
                            type="text"
                            value={formData.organizacao}
                            onChange={(e) => handleInputChange('organizacao', e.target.value)}
                            placeholder="Ex: Extremamente organizada com cabides e gavetas"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Trabalho em equipe */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Comportamento em Equipe
                          </label>
                          <input
                            type="text"
                            value={formData.trabalhoEquipe}
                            onChange={(e) => handleInputChange('trabalhoEquipe', e.target.value)}
                            placeholder="Ex: Auxilio colegas e prezo por harmonia"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Redes sociais */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                            Facilidade com Instagram, Stories ou Vídeos?
                          </label>
                          <input
                            type="text"
                            value={formData.facilidadeRedesSociais}
                            onChange={(e) => handleInputChange('facilidadeRedesSociais', e.target.value)}
                            placeholder="Ex: Sim, gravo stories e opero redes"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>
                      </div>

                      {/* Conforto lingerie */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                          Conforto em atuar com lingerie, produtos íntimos e bem-estar?
                        </label>
                        <input
                          type="text"
                          value={formData.confortoProdutosIntimos}
                          onChange={(e) => handleInputChange('confortoProdutosIntimos', e.target.value)}
                          placeholder="Ex: Sim, me sinto totalmente confortável e vejo de forma natural"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>

                      {/* Discricao */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                          O que você entende por discrição no atendimento ao cliente?
                        </label>
                        <textarea
                          value={formData.entendimentoDiscricao}
                          onChange={(e) => handleInputChange('entendimentoDiscricao', e.target.value)}
                          placeholder="Descreva sua visão sobre sigilo, tom de voz e privacidade do cliente"
                          className="w-full h-16 bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-red-600 resize-none font-sans"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Cliente indeciso */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                            Como lidaria com cliente indeciso?
                          </label>
                          <input
                            type="text"
                            value={formData.clienteIndeciso}
                            onChange={(e) => handleInputChange('clienteIndeciso', e.target.value)}
                            placeholder="Ex: Ouvindo as necessidades e sugerindo opções ideais"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Perguntas intimas */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                            Como lidaria com perguntas íntimas feitas de clientes?
                          </label>
                          <input
                            type="text"
                            value={formData.perguntasIntimas}
                            onChange={(e) => handleInputChange('perguntasIntimas', e.target.value)}
                            placeholder="Ex: Com profissionalismo científico e empatia"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: FINALIZAÇÃO */}
                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Ponto Forte */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                            Seu Principal Ponto Forte
                          </label>
                          <input
                            type="text"
                            value={formData.pontoForte}
                            onChange={(e) => handleInputChange('pontoForte', e.target.value)}
                            placeholder="Ex: Comunicação e empatia imediata"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>

                        {/* Ponto Desenvolver */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                            Ponto que precisa desenvolver
                          </label>
                          <input
                            type="text"
                            value={formData.pontoDesenvolver}
                            onChange={(e) => handleInputChange('pontoDesenvolver', e.target.value)}
                            placeholder="Ex: Ansiedade de fechar metas muito rápido"
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                          />
                        </div>
                      </div>

                      {/* Expectativa salarial */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                          Expectativa Salarial aproximada
                        </label>
                        <input
                          type="text"
                          value={formData.expectativaSalarial}
                          onChange={(e) => handleInputChange('expectativaSalarial', e.target.value)}
                          placeholder="Ex: R$ 1.800,00 mais comissão comercial"
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                        />
                      </div>

                      {/* Mensagem final */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                          Deixe uma mensagem final para a Discreta Boutique
                        </label>
                        <textarea
                          value={formData.mensagemFinal}
                          onChange={(e) => handleInputChange('mensagemFinal', e.target.value)}
                          placeholder="Por que você gostaria de ser selecionada pela nossa empresa?"
                          className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-red-600 resize-y font-sans leading-relaxed"
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 5: ANEXOS (SELFIE & CURRÍCULO) */}
                  {currentStep === 5 && (
                    <div className="space-y-6">
                      
                      {/* CAMERA/SELFIE BOX */}
                      <div className="bg-neutral-950 rounded-xl p-4 md:p-6 border border-neutral-850 space-y-4">
                        <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-1.5">
                          <Camera size={16} className="text-neutral-500" />
                          Selfie de Identificação Oficial <span className="text-neutral-500 text-xs font-normal">(Opcional)</span>
                        </h3>
                        <p className="text-[10px] text-neutral-500 leading-relaxed">
                          Não permitimos uploads da galeria para segurança de identificação. Utilize a câmera ao vivo do seu dispositivo ou o modo câmera nativo integrado.
                        </p>

                        <div className="flex flex-col items-center gap-4">
                          {/* Live stream preview container */}
                          {useCameraStream && (
                            <div className="relative border border-neutral-800 rounded-xl overflow-hidden bg-black w-full max-w-sm aspect-video">
                              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={capturePhoto}
                                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-md"
                                >
                                  <Camera size={14} /> Capturar Foto
                                </button>
                                <button
                                  type="button"
                                  onClick={stopCamera}
                                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs rounded-lg transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Captures photo preview */}
                          {selfiePreview && !useCameraStream && (
                            <div className="relative border border-green-900/50 rounded-xl overflow-hidden bg-neutral-900 w-full max-w-xs p-2 text-center">
                              <span className="text-[9px] bg-green-950 text-green-400 border border-green-800/40 px-2 py-0.5 rounded font-bold uppercase tracking-wider block mb-2 mx-auto w-fit">
                                Selfie Capturada!
                              </span>
                              <img src={selfiePreview} alt="Selfie preview" className="w-full h-44 object-cover rounded-lg mb-2" />
                              <div className="flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelfieBlob(null);
                                    setSelfiePreview('');
                                    startCamera();
                                  }}
                                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs rounded-lg transition-colors"
                                >
                                  Refazer Selfie
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Initial action choices */}
                          {!useCameraStream && !selfiePreview && (
                            <div className="flex flex-wrap justify-center gap-3 w-full">
                              <button
                                type="button"
                                onClick={startCamera}
                                className="px-4 py-3 bg-neutral-900 border border-neutral-800 hover:border-red-600/30 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                              >
                                <Camera size={14} className="text-red-500 animate-pulse" />
                                Abrir Câmera ao Vivo
                              </button>

                              {/* Backup capture for phone browsers using native trigger */}
                              <label className="px-4 py-3 bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2">
                                <Camera size={14} className="text-neutral-500" />
                                Tirar Foto no Sistema (Celular)
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="user"
                                  className="hidden"
                                  onChange={handleSelfieFileInput}
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        {validationErrors.selfie && (
                          <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold justify-center">
                            <AlertCircle size={14} />
                            {validationErrors.selfie}
                          </div>
                        )}
                      </div>

                      {/* RESUME UPLOAD BOX */}
                      <div className="bg-neutral-950 rounded-xl p-4 md:p-6 border border-neutral-850 space-y-4">
                        <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-1.5">
                          <FileText size={16} className="text-red-500" />
                          Upload de Currículo Profissional {settings?.resumeRequired && <span className="text-red-500">*</span>}
                        </h3>
                        <p className="text-[10px] text-neutral-500 leading-relaxed">
                          Formatos aceitos: {settings?.resumeAcceptedTypes || '.pdf, .doc, .docx'}. Tamanho limite: {settings?.resumeMaxSizeMb || 5}MB.
                        </p>

                        {resumeFile ? (
                          <div className="p-3 bg-neutral-900 border border-red-900/20 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-red-950/40 flex items-center justify-center text-red-400">
                                <FileText size={16} />
                              </div>
                              <div>
                                <span className="text-xs text-neutral-200 font-medium block truncate max-w-[200px] md:max-w-[400px]">
                                  {resumeName}
                                </span>
                                <span className="text-[9px] text-neutral-500 block font-mono">
                                  {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={removeResume}
                              className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                              title="Remover arquivo"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <label className="border border-dashed border-neutral-800 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-neutral-950/40 hover:bg-neutral-900/30 cursor-pointer transition-colors group">
                            <Upload size={24} className="text-neutral-600 group-hover:text-red-500 transition-colors" />
                            <span className="text-xs font-semibold text-neutral-300">Selecionar arquivo do currículo</span>
                            <span className="text-[10px] text-neutral-500">Clique para buscar em seus arquivos locais</span>
                            <input
                              type="file"
                              accept={settings?.resumeAcceptedTypes || '.pdf,.doc,.docx'}
                              onChange={handleResumeUpload}
                              className="hidden"
                            />
                          </label>
                        )}

                        {validationErrors.resume && (
                          <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold justify-center">
                            <AlertCircle size={14} />
                            {validationErrors.resume}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* STEP 6: REVISÃO E DECLARAÇÃO */}
                  {currentStep === 6 && (
                    <div className="space-y-6">
                      
                      {/* RESPONSIVE SUMMARY REVIEW */}
                      <div className="space-y-4 max-h-[340px] overflow-y-auto scrollbar-thin border border-neutral-850 rounded-xl p-4 bg-neutral-950/40">
                        <div className="border-b border-neutral-800 pb-2">
                          <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <User size={12} /> 1. Dados Pessoais
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-neutral-300 mt-2">
                            <div><span className="text-neutral-500">Nome:</span> {formData.nomeCompleto}</div>
                            <div><span className="text-neutral-500">Idade:</span> {formData.idade}</div>
                            <div><span className="text-neutral-500">WhatsApp:</span> {formData.whatsapp}</div>
                            <div><span className="text-neutral-500">E-mail:</span> {formData.email}</div>
                            <div><span className="text-neutral-500">Local:</span> {formData.cidade} / {formData.bairro}</div>
                          </div>
                        </div>

                        <div className="border-b border-neutral-800 pb-2">
                          <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar size={12} /> 2. Disponibilidade
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-neutral-300 mt-2">
                            <div><span className="text-neutral-500">Horários:</span> {formData.disponibilidadeHorarios}</div>
                            <div><span className="text-neutral-500">Sábados:</span> {formData.disponibilidadeSabados || 'Não'}</div>
                            <div><span className="text-neutral-500">Especiais:</span> {formData.disponibilidadeDatasEspeciais || 'Não'}</div>
                            <div><span className="text-neutral-500">Lives:</span> {formData.disponibilidadeLiveShop || 'Não'}</div>
                            <div><span className="text-neutral-500">Tipo:</span> {formData.tipoInteresse}</div>
                            <div><span className="text-neutral-500">Início:</span> {formData.dataInicio}</div>
                          </div>
                        </div>

                        <div className="border-b border-neutral-800 pb-2">
                          <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Briefcase size={12} /> 3. Experiência
                          </h3>
                          <div className="space-y-1.5 text-xs text-neutral-300 mt-2">
                            <div><span className="text-neutral-500">Geral:</span> {formData.experienciaProfissional || 'Nenhuma'}</div>
                            <div><span className="text-neutral-500">Última Empresa:</span> {formData.ultimaExperiencia || 'Nenhuma'} ({formData.cargoUltimaExperiencia})</div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Camera size={12} /> 4. Mídias
                          </h3>
                          <div className="flex gap-4 text-xs text-neutral-300 mt-2">
                            <div><span className="text-neutral-500">Selfie:</span> {selfieBlob ? '✓ Foto anexada' : '✗ Não fornecida'}</div>
                            <div><span className="text-neutral-500">Currículo:</span> {resumeFile ? `✓ ${resumeName}` : '✗ Não fornecido'}</div>
                          </div>
                        </div>
                      </div>

                      {/* DECLARATION CHECKBOX */}
                      <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800/80 space-y-4">
                        <p className="text-[11px] leading-relaxed text-neutral-400 whitespace-pre-line font-serif italic text-center">
                          "{settings.declarationText || 'Confirmo que as informações declaradas são verdadeiras e autorizo o uso para o processo seletivo da Discreta Boutique.'}"
                        </p>

                        <label className="flex items-start gap-3 cursor-pointer select-none group pt-2 border-t border-neutral-900">
                          <input
                            type="checkbox"
                            checked={declarationAccepted}
                            onChange={(e) => {
                              setDeclarationAccepted(e.target.checked);
                              setErrorMsg('');
                            }}
                            className="mt-1 h-4 w-4 rounded border-neutral-800 bg-neutral-950 text-red-600 focus:ring-red-600 focus:ring-offset-neutral-900 cursor-pointer animate-pulse"
                          />
                          <span className="text-xs font-bold text-neutral-300 group-hover:text-white transition-colors">
                            Li a declaração acima e confirmo a integridade de todas as minhas respostas fornecidas.
                          </span>
                        </label>
                      </div>

                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ERROR BANNER */}
            {errorMsg && (
              <div className="mt-4 p-3.5 bg-red-950/60 border border-red-900/50 rounded-xl text-red-400 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle size={14} className="shrink-0" />
                <span className="font-semibold">{errorMsg}</span>
              </div>
            )}

            {/* ACTION CONTROLS */}
            <div className="flex items-center justify-between gap-4 border-t border-neutral-850 pt-6 mt-6 shrink-0">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={submitting}
                  className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-900 text-neutral-400 hover:text-white text-xs font-bold rounded-xl transition-colors border border-neutral-800 flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Deseja realmente sair? Seu progresso será perdido.')) {
                      setCurrentStep(-1);
                      setLgpdAccepted(false);
                    }
                  }}
                  className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-900 text-neutral-500 hover:text-neutral-300 text-xs font-semibold rounded-xl transition-colors border border-neutral-850"
                >
                  Sair do formulário
                </button>
              )}

              {currentStep < 6 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2.5 bg-red-850 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1"
                >
                  Próximo <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitApplication}
                  disabled={submitting || !declarationAccepted}
                  className={`px-6 py-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                    declarationAccepted && !submitting
                      ? 'bg-gradient-to-r from-red-900 to-red-850 hover:from-red-800 hover:to-red-750 text-white border-red-800 shadow-[0_4px_25px_rgba(220,38,38,0.3)] hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-neutral-800/40 text-neutral-500 border-neutral-850 cursor-not-allowed'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Enviando Candidatura...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} /> Enviar candidatura
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS COMPLETED PROFILE */}
      {currentStep === 99 && settings && (
        <div className="w-full max-w-xl z-10 py-10 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-[0_0_40px_rgba(220,38,38,0.15)] relative overflow-hidden text-center w-full"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-800 to-amber-700" />
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-950/40 border border-green-800/60 flex items-center justify-center text-green-500 mb-4 shadow-[0_0_15px_rgba(34,197,94,0.15)]">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="font-serif text-2xl font-bold text-white tracking-tight">Candidatura Enviada!</h2>
              <p className="text-xs text-neutral-400 mt-1">Seus dados e anexos foram gravados nos servidores seguros da Discreta Boutique.</p>
            </div>

            <div className="p-4 bg-neutral-950 border border-neutral-850 rounded-xl mb-6 text-left space-y-3">
              <h3 className="text-xs font-semibold text-neutral-300 tracking-wider uppercase border-b border-neutral-800 pb-1.5 flex items-center gap-2">
                <User size={12} className="text-red-500" /> Resumo do Registro
              </h3>
              <div className="grid grid-cols-1 gap-y-2 text-xs">
                <div><span className="text-neutral-500">Candidato(a):</span> <span className="text-neutral-300 font-medium">{formData.nomeCompleto}</span></div>
                <div><span className="text-neutral-500">Contato cadastrado:</span> <span className="text-neutral-300 font-medium">{formData.whatsapp} ({formData.email})</span></div>
                {selfieBlob && <div><span className="text-neutral-500">Foto selfie:</span> <span className="text-green-400 font-medium">✓ Anexada com sucesso</span></div>}
                {resumeFile && <div><span className="text-neutral-500">Currículo PDF:</span> <span className="text-green-400 font-medium">✓ {resumeName}</span></div>}
              </div>
            </div>

            <div className="text-sm text-neutral-300 leading-relaxed p-4 bg-neutral-950/40 rounded-xl border border-neutral-800/40 mb-8">
              <p className="whitespace-pre-line text-xs font-serif italic text-neutral-400 leading-relaxed text-center">
                "{settings.finalMessage}"
              </p>
            </div>

            <Link
              to="/"
              className="w-full inline-flex py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm rounded-xl transition-colors border border-neutral-700 justify-center items-center"
            >
              Voltar para a Página Inicial
            </Link>
          </motion.div>
        </div>
      )}
    </div>
  );
}
