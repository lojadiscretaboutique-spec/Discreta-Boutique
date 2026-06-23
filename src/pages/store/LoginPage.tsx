import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../contexts/ThemeContext';

// Tradução de erros do Firebase Auth para o português amigável
const getFriendlyErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'O formato do e-mail inserido é inválido. Verifique se digitou corretamente.';
        case 'auth/user-disabled':
            return 'Esta conta foi desativada temporariamente. Entre em contato com o suporte.';
        case 'auth/user-not-found':
            return 'Nenhuma conta cadastrada com este e-mail. Crie uma nova conta!';
        case 'auth/wrong-password':
            return 'Senha incorreta. Se esqueceu sua senha, clique em "Esqueci minha senha".';
        case 'auth/invalid-credential':
            return 'E-mail ou senha incorretos. Por favor, tente novamente.';
        case 'auth/network-request-failed':
            return 'Falha na conexão de rede. Verifique seu sinal de internet e tente novamente.';
        case 'auth/too-many-requests':
            return 'Muitas tentativas de login com erro. Por favor, tente novamente mais tarde.';
        case 'auth/email-already-in-use':
            return 'Este e-mail já está em uso por outro usuário.';
        default:
            return 'Ocorreu um erro no acesso. Caso persista, entre em contato com nosso suporte.';
    }
};

export const LoginPage = () => {
    const { user, userData } = useAuthStore();
    const [mode, setMode] = useState<'login' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/area-cliente';

    // Auto-redireciona se o usuário estiver autenticado E tiver um cadastro no sistema
    useEffect(() => {
        if (user && userData) {
            navigate(redirectTo, { replace: true });
        } else if (user && !userData && !loading) {
            // Conta autenticada via Firebase Auth mas sem documento de cadastro em Firestore
            auth.signOut().then(() => {
                setError("O e-mail do Google utilizado não possui cadastro em nossa loja. Por favor, crie uma conta primeiro.");
            });
        }
    }, [user, userData, loading, navigate, redirectTo]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError("Por favor, preencha todos os campos.");
            return;
        }
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate(redirectTo, { replace: true });
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err.code || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError("Por favor, insira seu endereço de e-mail para recuperar a senha.");
            return;
        }
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await sendPasswordResetEmail(auth, email);
            setSuccessMessage("E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada.");
            setError(null);
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err.code || err.message));
        } finally {
            setLoading(false);
        }
    };

    const { currentTheme } = useTheme();

    return (
        <div className="relative min-h-screen lg:h-screen w-full flex flex-col items-center justify-center p-3 sm:p-6 bg-black text-white overflow-hidden font-sans">
            {/* Efeitos de Luz de Fundo Vermelho Neon */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-red-900/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[250px] h-[250px] bg-red-950/10 blur-[80px] rounded-full pointer-events-none" />

            {/* Link para voltar ao site */}
            <div className="absolute top-3 left-3 md:top-6 md:left-6 z-10 font-sans">
                <Link 
                    to="/" 
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition text-xs sm:text-sm font-medium"
                >
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a Loja
                </Link>
            </div>

            <div className="w-full max-w-sm sm:max-w-md z-[15] font-sans flex flex-col justify-center items-center py-4">
                {/* Logo Section */}
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
                                        className="mx-auto hover:opacity-90 transition duration-300 object-contain"
                                        style={{ width: '130px', minWidth: '100px', maxWidth: '150px', height: 'auto' }}
                                        referrerPolicy="no-referrer"
                                    />
                                );
                            }
                            return (
                                <div className="splash-logo text-white tracking-[0.15em] font-black italic text-base sm:text-lg text-center leading-tight">
                                    DISCRETA <span className="text-red-500">BOUTIQUE</span>
                                </div>
                            );
                        })()}
                    </Link>
                </div>

                {/* Card Conteiner - responsive height and scroll behavior if extremely short vertical space */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-full rounded-2xl bg-zinc-950/80 border border-zinc-805 bg-black/90 p-4 sm:p-6 shadow-[0_0_20px_rgba(239,68,68,0.03)] backdrop-blur-md max-h-[75vh] md:max-h-none overflow-y-auto no-scrollbar"
                >
                    <AnimatePresence mode="wait">
                        {mode === 'login' ? (
                            <motion.div
                                key="login-mode"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.15 }}
                            >
                                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white mb-0.5">
                                    Acesse sua conta
                                </h1>
                                <p className="text-zinc-500 text-xs mb-4">
                                    Bem-vindo de volta! Insira suas credenciais abaixo.
                                </p>

                                {/* Alert de Erro */}
                                {error && (
                                    <div className="mb-3.5 flex items-start gap-2.5 p-2.5 bg-red-950/40 border border-red-900/45 rounded-lg text-red-400 text-xs">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <form onSubmit={handleLogin} className="space-y-3">
                                    <div>
                                        <label className="block text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">E-mail</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                                            <input 
                                                required
                                                type="email" 
                                                placeholder="seuemail@exemplo.com" 
                                                value={email} 
                                                onChange={e => setEmail(e.target.value)} 
                                                className="w-full pl-9 pr-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-red-500/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans" 
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-zinc-400 text-[10px] font-semibold uppercase tracking-wider">Senha</label>
                                            <button 
                                                type="button"
                                                onClick={() => setMode('forgot')} 
                                                className="text-[10px] text-red-500 hover:text-red-400 font-semibold transition"
                                            >
                                                Esqueceu a senha?
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                                            <input 
                                                required
                                                type={showPassword ? "text" : "password"} 
                                                placeholder="••••••••" 
                                                value={password} 
                                                onChange={e => setPassword(e.target.value)} 
                                                className="w-full pl-9 pr-9 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-red-500/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans" 
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                                    >
                                        {loading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Entrando...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <LogIn className="h-4 w-4" />
                                                <span>Entrar na Conta</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                <p className="mt-4 text-center text-xs text-zinc-500">
                                    Não tem um cadastro?{' '}
                                    <Link to={`/cadastro${redirectTo !== '/area-cliente' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="text-red-500 font-bold hover:text-red-400 hover:underline transition">
                                        Criar conta
                                    </Link>
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="forgot-mode"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.15 }}
                            >
                                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white mb-0.5">
                                    Recuperar Senha
                                </h1>
                                <p className="text-zinc-500 text-xs mb-4">
                                    Insira seu e-mail cadastrado para redefinir sua senha.
                                </p>

                                {/* Mensagens de Feedback */}
                                {error && (
                                    <div className="mb-3.5 flex items-start gap-2.5 p-2.5 bg-red-950/40 border border-red-900/45 rounded-lg text-red-400 text-xs font-sans">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}
                                {successMessage && (
                                    <div className="mb-3.5 flex items-start gap-2.5 p-2.5 bg-emerald-950/40 border border-emerald-950/45 rounded-lg text-emerald-400 text-xs font-sans">
                                        <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>{successMessage}</span>
                                    </div>
                                )}

                                <form onSubmit={handleResetPassword} className="space-y-3">
                                    <div>
                                        <label className="block text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">E-mail de Cadastro</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                                            <input 
                                                required
                                                type="email" 
                                                placeholder="seuemail@exemplo.com" 
                                                value={email} 
                                                onChange={e => setEmail(e.target.value)} 
                                                className="w-full pl-9 pr-3 py-2 bg-zinc-900/60 border border-zinc-800 focus:border-red-500/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-xs sm:text-sm text-white placeholder-zinc-650 font-sans" 
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                                    >
                                        {loading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Enviando...</span>
                                            </div>
                                        ) : (
                                            <span>Enviar instruções</span>
                                        )}
                                    </button>
                                </form>

                                <button 
                                    onClick={() => {
                                        setMode('login');
                                        setError(null);
                                        setSuccessMessage(null);
                                    }}
                                    className="w-full mt-3 py-2 bg-zinc-900/30 hover:bg-zinc-900/55 text-zinc-400 hover:text-white transition rounded-lg text-xs font-semibold flex items-center justify-center gap-2 font-sans cursor-pointer"
                                >
                                    Voltar para o Login
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
};
