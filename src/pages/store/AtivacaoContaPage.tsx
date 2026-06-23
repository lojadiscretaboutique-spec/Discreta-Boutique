import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { motion } from 'motion/react';
import { CheckCircle, AlertCircle, RefreshCw, LogOut, ShieldCheck } from 'lucide-react';

export const AtivacaoContaPage = () => {
    const { user, isLoading: authLoading, checkAuth } = useAuthStore();
    const navigate = useNavigate();

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Settings
    const [resendCooldown, setResendCooldown] = useState(60);
    const [otpValidity, setOtpValidity] = useState(10);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);

    // Load settings from Firestore
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settingsRef = doc(db, 'settings', 'customerNotifications');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    const data = settingsSnap.data();
                    if (data.otpResendSeconds) {
                        setResendCooldown(Number(data.otpResendSeconds));
                    }
                    if (data.otpValidityMinutes) {
                        setOtpValidity(Number(data.otpValidityMinutes));
                    }
                }
            } catch (err) {
                console.error("Erro ao carregar configurações de OTP:", err);
            }
        };
        loadSettings();
    }, []);

    // Redireciona se não estiver logado, ou se estiver logado e ativo/antigo (sem accountStatus)
    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login', { replace: true });
            return;
        }

        if (authLoading || !user) return;

        const checkStatus = async () => {
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    const status = data.accountStatus;
                    // Se accountStatus for 'active' ou estiver vazio/indefinido (cliente antigo), redireciona por padrão
                    if (status === 'active' || !status) {
                        navigate('/area-cliente', { replace: true });
                    }
                } else {
                    // Se o documento nem existir, deixa redirecionar para a área do cliente para evitar bloqueios
                    navigate('/area-cliente', { replace: true });
                }
            } catch (err) {
                console.error("Erro ao carregar dados do usuário na ativação:", err);
            }
        };

        checkStatus();
    }, [user, authLoading, navigate]);

    // Timer de Cooldown de Reenvio usando setTimeout
    useEffect(() => {
        if (cooldownRemaining <= 0) return;
        const timer = setTimeout(() => {
            setCooldownRemaining(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [cooldownRemaining]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (code.trim().length !== 6) {
            setError("O código de ativação deve conter exatamente 6 dígitos.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch('/api/customer-otp/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uid: user.uid,
                    code: code.trim()
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || "Erro ao verificar código. Confirme o código e tente novamente.");
            } else {
                setSuccess("Sua conta foi ativada com sucesso!");
                // Sincronizar store global com dados novos ativos
                await checkAuth();
                // Redireciona para área do cliente após 2 segundos
                setTimeout(() => {
                    navigate('/area-cliente', { replace: true });
                }, 2000);
            }
        } catch (err: any) {
            setError("Erro de rede. Verifique sua conexão e tente novamente.");
            console.error("Erro ao verificar OTP:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!user || cooldownRemaining > 0) return;

        setResending(true);
        setError(null);
        setSuccess(null);

        try {
            // Sincronizar informações do usuário com o banco primeiro
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                setError("Usuário não encontrado.");
                setResending(false);
                return;
            }

            const userData = userSnap.data();

            const res = await fetch('/api/customer-otp/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uid: user.uid,
                    fullName: userData.fullName || '',
                    email: userData.email || user.email || '',
                    whatsapp: userData.whatsapp || ''
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || "Erro ao reenviar o código.");
            } else {
                setSuccess("Enviamos um novo código de ativação para seu e-mail e WhatsApp!");
                setCooldownRemaining(resendCooldown);
            }
        } catch (err: any) {
            setError("Erro ao reenviar o código. Tente novamente.");
            console.error("Erro ao reenviar OTP:", err);
        } finally {
            setResending(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login', { replace: true });
        } catch (err) {
            console.error("Erro ao deslogar:", err);
        }
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-red-900/10 to-transparent animate-pulse pointer-events-none"></div>
                <div className="relative flex flex-col items-center">
                    <div className="h-10 w-10 border-2 border-red-650 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.4)]" />
                    <span className="text-[9px] font-black tracking-[5px] uppercase text-zinc-600 mt-6 animate-pulse">
                        Carregando...
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-black text-white overflow-hidden font-sans">
            {/* Efeitos de Luz e Neon Vermelho de Fundo */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-900/15 blur-[140px] rounded-full pointer-events-none animate-pulse" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-red-955/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md z-10">
                {/* Logo / Header */}
                <div className="flex flex-col items-center mb-8 text-center">
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex p-3 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 mb-3 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                    >
                        <ShieldCheck className="h-8 w-8" />
                    </motion.div>
                    <h1 className="text-3xl font-black tracking-tight uppercase text-white">
                        Ativação de Conta
                    </h1>
                    <p className="text-zinc-500 text-xs mt-1 uppercase tracking-[3px] font-black">
                        Discreta Boutique
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full rounded-3xl bg-zinc-950/80 border border-zinc-900/60 p-8 shadow-[0_0_35px_rgba(239,68,68,0.06)] backdrop-blur-md"
                >
                    <p className="text-zinc-400 text-sm text-center leading-relaxed mb-6">
                        Por motivos de segurança e privacidade, enviamos um código numérico de 6 dígitos para o seu e-mail cadastrado (<span className="text-zinc-300 font-medium">{user?.email}</span>) e/ou WhatsApp.
                    </p>

                    <div className="mb-6 p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-center">
                        <p className="text-white font-bold text-sm">
                            Ative sua conta para acessar todos os recursos.
                        </p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-6">
                        {/* INPUT CODE */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black tracking-wider uppercase text-zinc-400 text-center">
                                Digite o Código de 6 Dígitos
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-red-600 focus:outline-none text-white font-mono text-3xl font-black tracking-[12px] text-center py-4 px-3 rounded-2xl shadow-inner transition-all hover:bg-zinc-900"
                                />
                            </div>
                            <span className="block text-[11px] text-zinc-500 text-center">
                                O código é válido por {otpValidity} minutos.
                            </span>
                        </div>

                        {/* Erros e Alertas */}
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-2xl bg-red-950/40 border border-red-500/20 text-red-400 text-xs flex items-start gap-3"
                            >
                                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                                <span className="leading-relaxed">{error}</span>
                            </motion.div>
                        )}

                        {success && (
                            <motion.div 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-3"
                            >
                                <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />
                                <span className="leading-relaxed">{success}</span>
                            </motion.div>
                        )}

                        {/* Botão Principal */}
                        <button
                            type="submit"
                            disabled={loading || code.trim().length !== 6}
                            className="w-full py-4 bg-red-650 hover:bg-red-750 disabled:bg-zinc-800 disabled:text-zinc-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.30)] text-white font-sans font-black uppercase text-sm tracking-wider rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                "Ativar Minha Conta"
                            )}
                        </button>
                    </form>

                    {/* Botões de Ação Auxiliares */}
                    <div className="mt-8 pt-6 border-t border-zinc-900/60 flex flex-col items-center gap-4">
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resending || cooldownRemaining > 0}
                            className="text-xs font-bold text-zinc-400 hover:text-white transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed flex items-center gap-2 group"
                        >
                            <RefreshCw className={`h-3 w-3 ${resending ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                            {cooldownRemaining > 0 
                                ? `Reenviar código (${cooldownRemaining}s)` 
                                : "Não recebeu o código? Enviar novamente"
                            }
                        </button>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-2"
                        >
                            <LogOut className="h-3 w-3" />
                            Sair da Conta
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
