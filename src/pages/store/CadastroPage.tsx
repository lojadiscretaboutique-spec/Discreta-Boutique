import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Lock, Phone, Calendar, CreditCard, MapPin, 
  ArrowRight, ArrowLeft, Check, AlertCircle, Eye, EyeOff, ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../contexts/ThemeContext';

// Tradução de erros comuns do Firebase Auth
const getFriendlyErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'Este endereço de e-mail já está cadastrado. Tente fazer login ou use outro e-mail.';
        case 'auth/invalid-email':
            return 'O formato do e-mail inserido é inválido. Verifique se digitou corretamente.';
        case 'auth/operation-not-allowed':
            return 'O cadastro com e-mail e senha não está habilitado no momento. Entre em contato com o suporte.';
        case 'auth/weak-password':
            return 'A senha é muito fraca. Escolha uma senha mais forte com pelo menos 6 caracteres.';
        case 'auth/network-request-failed':
            return 'Falha na conexão com a internet. Verifique sua rede e tente novamente.';
        default:
            return 'Não foi possível concluir o seu cadastro. Se o erro persistir, entre em contato com nosso suporte.';
    }
};

// Funções de formatação de máscaras
const formatCPF = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return clean
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatWhatsApp = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 10) {
        return clean
            .slice(0, 10)
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return clean
        .slice(0, 11)
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
};

const formatCEP = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return clean
        .slice(0, 8)
        .replace(/(\d{5})(\d)/, '$1-$2');
};

// Validador de CPF brasileiro
const validateCPF = (cpf: string): boolean => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(clean)) return false; // Verifica dígitos idênticos
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(clean.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(clean.substring(10, 11))) return false;
    
    return true;
};

export const CadastroPage = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const { currentTheme } = useTheme();

    // Estado geral de controle de passos (wizard)
    // Passo 1: Dados Pessoais
    // Passo 2: Endereço
    // Passo 3: Dados de Acesso
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loadingCep, setLoadingCep] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);

    // Campos adicionais
    const [fullName, setFullName] = useState('');
    const [cpf, setCpf] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [whatsapp, setWhatsapp] = useState('');

    // Endereço
    const [cep, setCep] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [reference, setReference] = useState('');

    // Acesso
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/area-cliente';

    // Bloqueia acesso caso já esteja logado
    useEffect(() => {
        if (user) {
            navigate(redirectTo, { replace: true });
        }
    }, [user, navigate, redirectTo]);

    const normalizeCity = (cityStr: string) => {
        return cityStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };

    const normalizeState = (stateStr: string) => {
        return stateStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setError("Seu navegador não suporta geolocalização.");
            return;
        }

        setLoadingLocation(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                try {
                    const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || "";
                    if (!apiKey) {
                        setError("Google Maps API Key não configurada. Configure GOOGLE_MAPS_PLATFORM_KEY.");
                        setLoadingLocation(false);
                        return;
                    }

                    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
                    const data = await response.json();

                    if (data.status === "OK" && data.results && data.results.length > 0) {
                        const result = data.results[0];
                        const components = result.address_components;

                        let foundCep = '';
                        let foundStreet = '';
                        let foundNumber = '';
                        let foundNeighborhood = '';
                        let foundCity = '';
                        let foundState = '';

                        for (const comp of components) {
                            if (comp.types.includes('postal_code')) {
                                foundCep = comp.long_name;
                            }
                            if (comp.types.includes('route')) {
                                foundStreet = comp.long_name;
                            }
                            if (comp.types.includes('street_number')) {
                                foundNumber = comp.long_name;
                            }
                            if (comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality')) {
                                foundNeighborhood = comp.long_name;
                            }
                            if (comp.types.includes('administrative_area_level_2')) {
                                foundCity = comp.long_name;
                            }
                            if (comp.types.includes('administrative_area_level_1')) {
                                foundState = comp.short_name;
                            }
                        }

                        if (foundCep) setCep(formatCEP(foundCep));
                        if (foundStreet) setStreet(foundStreet);
                        if (foundNumber) setNumber(foundNumber);
                        if (foundNeighborhood) setNeighborhood(foundNeighborhood);
                        if (foundCity) setCity(normalizeCity(foundCity));
                        if (foundState) setState(normalizeState(foundState));
                    } else {
                        setError("Não conseguimos encontrar seu endereço automaticamente.");
                    }
                } catch (err) {
                    console.error("Erro no geocoding do Google:", err);
                    setError("Não conseguimos encontrar seu endereço automaticamente.");
                } finally {
                    setLoadingLocation(false);
                }
            },
            (err) => {
                console.error("Erro ao obter geolocalização:", err);
                if (err.code === err.PERMISSION_DENIED) {
                    setError("Permissão de localização negada. Ative a localização no seu navegador.");
                } else {
                    setError("Erro ao obter localização atual.");
                }
                setLoadingLocation(false);
            }
        );
    };

    // Buscar CEP por ViaCEP
    const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatCEP(e.target.value);
        setCep(formatted);

        const cleanCep = formatted.replace(/\D/g, '');
        if (cleanCep.length === 8) {
            setLoadingCep(true);
            setError(null);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                const data = await response.json();
                if (data.erro) {
                    setError('CEP não localizado. Por favor, verifique e preencha manualmente.');
                } else {
                    setStreet(data.logradouro || '');
                    setNeighborhood(data.bairro || '');
                    setCity(data.localidade || '');
                    setState(data.uf || '');
                }
            } catch (err) {
                console.error('Erro ao buscar CEP:', err);
                setError('Erro ao buscar CEP automaticamente. Continue digitando manualmente.');
            } finally {
                setLoadingCep(false);
            }
        }
    };

    // Valida o passo 1
    const validateStep1 = (): boolean => {
        setError(null);
        if (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) {
            setError('Por favor, informe seu nome completo (nome e sobrenome).');
            return false;
        }
        if (!validateCPF(cpf)) {
            setError('Por favor, informe um CPF válido.');
            return false;
        }
        if (!birthDate) {
            setError('Por favor, selecione sua data de nascimento.');
            return false;
        }
        const cleanPhone = whatsapp.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
            setError('Por favor, insira um número de WhatsApp brasileiro válido.');
            return false;
        }
        return true;
    };

    // Valida o passo 2
    const validateStep2 = (): boolean => {
        setError(null);
        if (cep.replace(/\D/g, '').length !== 8) {
            setError('Insera o CEP corretamente.');
            return false;
        }
        if (!street.trim()) {
            setError('Informe o endereço/rua.');
            return false;
        }
        if (!number.trim()) {
            setError('Por favor, insira o número do endereço.');
            return false;
        }
        if (!neighborhood.trim()) {
            setError('Informe o bairro.');
            return false;
        }
        if (!city.trim()) {
            setError('Informe a cidade.');
            return false;
        }
        if (!state.trim()) {
            setError('Selecione ou digite a sigla do estado.');
            return false;
        }
        return true;
    };

    // Validations at full submission
    const handleCadastroSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !email.includes('@')) {
            setError('Por favor, insira um endereço de e-mail válido.');
            return;
        }
        if (password.length < 6) {
            setError('A senha deve possuir no mínimo 6 caracteres.');
            return;
        }
        if (password !== confirmPassword) {
            setError('As senhas não coincidem. Verifique e tente novamente.');
            return;
        }
        if (!acceptedTerms) {
            setError('Você precisa ler e aceitar os Termos de Uso e Política de Privacidade.');
            return;
        }

        setLoading(true);
        try {
            // Criar no Firebase Auth
            const userCredentials = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const uid = userCredentials.user.uid;

            // Criar endereço inicial default
            const firstAddress = {
                id: 'legacy-default',
                cep: cep.replace(/\D/g, ''),
                street: street.trim(),
                number: number.trim(),
                complement: complement.trim(),
                neighborhood: neighborhood.trim(),
                city: city.trim(),
                state: state.toUpperCase().trim(),
                reference: reference.trim(),
                isDefault: true,
                type: 'casa',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Criar cadastro detalhado no Firestore com accountStatus: 'pending_otp'
            await setDoc(doc(db, 'users', uid), {
                uid,
                role: 'customer',
                type: 'customer',
                fullName: fullName.trim(),
                cpf: cpf.replace(/\D/g, ''),
                email: email.trim().toLowerCase(),
                whatsapp: whatsapp.replace(/\D/g, ''),
                birthDate,
                address: {
                    cep: cep.replace(/\D/g, ''),
                    street: street.trim(),
                    number: number.trim(),
                    complement: complement.trim(),
                    neighborhood: neighborhood.trim(),
                    city: city.trim(),
                    state: state.toUpperCase().trim(),
                    reference: reference.trim()
                },
                addresses: [firstAddress],
                acceptedTerms: true,
                emailVerified: false,
                accountStatus: 'pending_otp',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Disparar Webhook de Boas-Vindas em background (seguro e não-bloqueante)
            fetch('/api/customer-events/welcome', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uid,
                    fullName: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    whatsapp: whatsapp.replace(/\D/g, ''),
                    cpf: cpf.replace(/\D/g, ''),
                    createdAt: new Date().toISOString()
                })
            }).catch(fetchErr => {
                console.error("Erro interno ao chamar webhook de boas-vindas:", fetchErr);
            });

            // Disparar geração e envio do código OTP
            await fetch('/api/customer-otp/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uid,
                    fullName: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    whatsapp: whatsapp.replace(/\D/g, '')
                })
            });

            // Mostrar mensagem de sucesso e aguardar clique antes de redirecionar
            setSuccessMessage("Cadastro criado com sucesso! Enviamos um código de ativação por e-mail/WhatsApp para ativar sua conta.");
        } catch (err: any) {
            console.error('Erro ao efetuar cadastro:', err);
            setError(getFriendlyErrorMessage(err.code || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen lg:h-screen w-full flex flex-col items-center justify-center p-3 sm:p-6 bg-black text-white overflow-hidden font-sans">
            {/* Efeitos de Luz e Neon Vermelho de Fundo */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-red-900/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[250px] h-[250px] bg-red-950/10 blur-[80px] rounded-full pointer-events-none" />

            {/* Back to Home Link */}
            <div className="absolute top-3 left-3 md:top-6 md:left-6 z-10 font-sans">
                <Link 
                    to="/" 
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition text-xs sm:text-sm font-medium"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Loja
                </Link>
            </div>

            <div className="w-full max-w-lg sm:max-w-xl z-20 font-sans py-4 flex flex-col items-center">
                {/* Logo Area */}
                <div className="mb-4 text-center">
                    <Link to="/" className="inline-block max-w-[180px] sm:max-w-[240px]">
                        {(() => {
                            const lh = currentTheme?.branding?.logoHorizontal;
                            const url = typeof lh === 'string' ? lh : lh?.url;
                            if (url) {
                                return (
                                    <img 
                                        src={url} 
                                        alt={currentTheme?.branding?.appName || "Discreta Boutique"} 
                                        className="mx-auto hover:opacity-95 transition duration-300 object-contain"
                                        style={{ width: '130px', minWidth: '100px', maxWidth: '150px', height: 'auto' }}
                                        referrerPolicy="no-referrer"
                                    />
                                );
                            }
                            return (
                                <div className="text-white tracking-[0.15em] font-black italic text-base sm:text-lg text-center leading-tight">
                                    DISCRETA <span className="text-red-500 animate-pulse">BOUTIQUE</span>
                                </div>
                            );
                        })()}
                    </Link>
                </div>

                {/* Card Container */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-full rounded-2xl bg-zinc-950/85 border border-zinc-900 bg-black/90 p-4 sm:p-6 shadow-[0_0_20px_rgba(239,68,68,0.03)] backdrop-blur-md max-h-[75vh] overflow-y-auto no-scrollbar"
                >
                    {successMessage ? (
                        <div className="text-center font-sans py-4 flex flex-col items-center gap-6">
                            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                <Check className="h-8 w-8" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white">Cadastro Realizado!</h2>
                                <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
                                    {successMessage}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/ativar-conta', { replace: true })}
                                className="w-full max-w-xs mt-4 py-3 px-6 bg-red-650 hover:bg-red-750 text-white font-bold rounded-2xl shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                            >
                                Ativar Minha Conta <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Linha indicativa de passos */}
                    <div className="mb-8 select-none">
                        <div className="flex justify-between items-center relative">
                            {/* Linhas de conexão */}
                            <div className="absolute h-[2px] bg-zinc-800 left-3 right-3 top-1/2 -translate-y-1/2 z-0" />
                            <div 
                                className="absolute h-[2px] bg-red-600 top-1/2 -translate-y-1/2 z-0 transition-all duration-300"
                                style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
                            />

                            {[1, 2, 3].map((num) => (
                                <div key={num} className="z-10 flex flex-col items-center">
                                    <div 
                                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition duration-300 ${
                                            step >= num 
                                                ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' 
                                                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                        }`}
                                    >
                                        {step > num ? <Check className="h-4 w-4" /> : num}
                                    </div>
                                    <span className={`text-[10px] uppercase tracking-wider font-bold mt-2 ${
                                        step >= num ? 'text-zinc-300' : 'text-zinc-600'
                                    }`}>
                                        {num === 1 ? 'Pessoal' : num === 2 ? 'Despacho/Entrega' : 'Acesso'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Exibição de Alerta de Erro */}
                    {error && (
                        <div className="mb-6 flex items-start gap-3 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-sm animate-fade-in font-sans">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step-1"
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 15 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3"
                            >
                                <div className="mb-3">
                                    <h2 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                        <User className="h-5 w-5 text-red-500" /> Seus Dados Pessoais
                                    </h2>
                                    <p className="text-zinc-500 text-[10px] md:text-xs">Precisamos das suas informações essenciais para faturamento e validação sigilosa.</p>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Nome Completo</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Maria Eduarda Silva"
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                            className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">CPF</label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3.5 top-2.5 md:top-3 h-4 w-4 md:h-5 md:w-5 text-zinc-500" />
                                                <input 
                                                    type="text" 
                                                    placeholder="000.000.000-00"
                                                    value={cpf}
                                                    onChange={e => setCpf(formatCPF(e.target.value))}
                                                    className="w-full pl-11 pr-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Data de Nascimento</label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3.5 top-2.5 md:top-3 h-4 w-4 md:h-5 md:w-5 text-zinc-500" />
                                                <input 
                                                    type="date"
                                                    value={birthDate}
                                                    onChange={e => setBirthDate(e.target.value)}
                                                    className="w-full pl-11 pr-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">WhatsApp</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3.5 top-2.5 md:top-3 h-4 w-4 md:h-5 md:w-5 text-zinc-500" />
                                            <input 
                                                type="text" 
                                                placeholder="(00) 00000-0000"
                                                value={whatsapp}
                                                onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
                                                className="w-full pl-11 pr-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                            />
                                        </div>
                                        <span className="text-[9px] text-zinc-600 mt-1 block">Será usado estritamente para envio de atualizações sigilosas e privadas do pedido.</span>
                                    </div>
                                </div>

                                <button 
                                    type="button" 
                                    onClick={() => {
                                        if (validateStep1()) setStep(2);
                                    }}
                                    className="w-full mt-4 py-2 md:py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer font-sans text-xs sm:text-sm"
                                >
                                    <span>Continuar</span> <ArrowRight className="h-4 w-4" />
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step-2"
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 15 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3"
                            >
                                <div className="mb-3">
                                    <h2 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                        <MapPin className="h-5 w-5 text-red-500" /> Endereço de Envio Sigiloso
                                    </h2>
                                    <p className="text-zinc-500 text-[10px] md:text-xs">Entregas 100% discretas. Nenhuma menção sex-shop ou produto aparecerá na etiqueta externa.</p>
                                </div>

                                <div className="mb-1.5">
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        disabled={loadingLocation}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 active:scale-[0.98] border border-zinc-800 hover:border-red-500/40 rounded-xl transition-all duration-300 text-[10px] md:text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50 cursor-pointer"
                                    >
                                        {loadingLocation ? (
                                            <>
                                                <div className="h-3.5 w-3.5 border-2 border-red-500 border-t-white rounded-full animate-spin" />
                                                <span>Buscando sua localização...</span>
                                            </>
                                        ) : (
                                            <>
                                                <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                                <span>Definir endereço pela localização</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">CEP</label>
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    placeholder="00000-00"
                                                    value={cep}
                                                    onChange={handleCepChange}
                                                    className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                                />
                                                {loadingCep && (
                                                    <div className="absolute right-3.5 top-2.5 md:top-3 h-4 w-4 border-2 border-red-500 border-t-zinc-600 rounded-full animate-spin" />
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Bairro</label>
                                            <input 
                                                type="text" 
                                                placeholder="Nome do Bairro"
                                                value={neighborhood}
                                                onChange={e => setNeighborhood(e.target.value)}
                                                className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Rua / Logradouro</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Avenida Copacabana"
                                            value={street}
                                            onChange={e => setStreet(e.target.value)}
                                            className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Número</label>
                                            <input 
                                                type="text" 
                                                placeholder="Ex: 52"
                                                value={number}
                                                onChange={e => setNumber(e.target.value)}
                                                className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Complemento (Opcional)</label>
                                            <input 
                                                type="text" 
                                                placeholder="Ex: Apto 302, Bloco B"
                                                value={complement}
                                                onChange={e => setComplement(e.target.value)}
                                                className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Cidade</label>
                                            <input 
                                                type="text" 
                                                placeholder="Ex: Rio de Janeiro"
                                                value={city}
                                                onChange={e => setCity(e.target.value)}
                                                className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Estado (UF)</label>
                                            <input 
                                                maxLength={2}
                                                type="text" 
                                                placeholder="Ex: RJ"
                                                value={state}
                                                onChange={e => setState(e.target.value)}
                                                className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans uppercase"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Ponto de Referência (Opcional)</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Ao lado do mercado, portão azul."
                                            value={reference}
                                            onChange={e => setReference(e.target.value)}
                                            className="w-full px-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-5">
                                    <button 
                                        type="button" 
                                        onClick={() => setStep(1)}
                                        className="py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer font-sans"
                                    >
                                        <ArrowLeft className="h-4 w-4" /> Voltar
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            if (validateStep2()) setStep(3);
                                        }}
                                        className="py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer font-sans"
                                    >
                                        Continuar <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step-3"
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 15 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-3"
                            >
                                <div className="mb-3">
                                    <h2 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-red-500" /> Acesso & Segurança
                                    </h2>
                                    <p className="text-zinc-500 text-[10px] md:text-xs">Configure seus dados de acesso restrito com segurança criptografada.</p>
                                </div>

                                <form onSubmit={handleCadastroSubmit} className="space-y-3">
                                    <div>
                                        <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">E-mail</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-2.5 md:top-3 h-4 w-4 md:h-5 md:w-5 text-zinc-500" />
                                            <input 
                                                required
                                                type="email" 
                                                placeholder="Ex: mariadosilva@exemplo.com"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                                className="w-full pl-11 pr-4 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Senha</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-2.5 md:top-3 h-4 w-4 md:h-5 md:w-5 text-zinc-500" />
                                                <input 
                                                    required
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Mínimo de 6 dígitos"
                                                    value={password}
                                                    onChange={e => setPassword(e.target.value)}
                                                    className="w-full pl-11 pr-11 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3.5 top-2.5 md:top-3 text-zinc-500 hover:text-zinc-300 transition animate-fade-in"
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4 md:h-5 md:w-5" /> : <Eye className="h-4 w-4 md:h-5 md:w-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-zinc-400 text-[10px] md:text-xs font-semibold uppercase tracking-wider mb-1.5">Confirmar Senha</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-2.5 md:top-3 h-4 w-4 md:h-5 md:w-5 text-zinc-500" />
                                                <input 
                                                    required
                                                    type={showConfirmPassword ? "text" : "password"}
                                                    placeholder="Repita sua senha"
                                                    value={confirmPassword}
                                                    onChange={e => setConfirmPassword(e.target.value)}
                                                    className="w-full pl-11 pr-11 py-2 md:py-2.5 bg-zinc-900/50 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3.5 top-2.5 md:top-3 text-zinc-500 hover:text-zinc-300 transition animate-fade-in"
                                                >
                                                    {showConfirmPassword ? <EyeOff className="h-4 w-4 md:h-5 md:w-5" /> : <Eye className="h-4 w-4 md:h-5 md:w-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Termos de Uso */}
                                    <div className="pt-1 select-none">
                                        <label className="flex items-start gap-3 cursor-pointer select-none">
                                            <input 
                                                type="checkbox"
                                                checked={acceptedTerms}
                                                onChange={e => setAcceptedTerms(e.target.checked)}
                                                className="mt-0.5 h-3.5 w-3.5 bg-zinc-900 border-zinc-800 text-red-600 focus:ring-red-500/40 rounded border cursor-pointer"
                                            />
                                            <span className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                                                Li e concordo com os{' '}
                                                <Link to="/lgpd" className="text-red-500 hover:underline font-bold transition">
                                                    Termos de Uso
                                                </Link>{' '}
                                                e{' '}
                                                <Link to="/politica-de-privacidade" className="text-red-500 hover:underline font-bold transition">
                                                    Políticas de Privacidade
                                                </Link>{' '}
                                                da Discreta Boutique.
                                            </span>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-3">
                                        <button 
                                            type="button" 
                                            onClick={() => setStep(2)}
                                            className="py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer font-sans"
                                        >
                                            <ArrowLeft className="h-4 w-4" /> Voltar
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={loading}
                                            className="py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                                        >
                                            {loading ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>Cadastrando...</span>
                                                </div>
                                            ) : (
                                                <span>Finalizar Cadastro</span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>
                        </>
                    )}
                </motion.div>

                {/* Footer Section */}
                <p className="mt-8 text-center text-sm text-zinc-500">
                    Já possui um cadastro ativo?{' '}
                    <Link to={`/login${redirectTo !== '/area-cliente' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="text-red-500 font-bold hover:text-red-400 hover:underline transition">
                        Entrar na minha conta
                    </Link>
                </p>
            </div>
        </div>
    );
};
