import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

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
    const { user } = useAuthStore();
    const [mode, setMode] = useState<'login' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/area-cliente', { replace: true });
        }
    }, [user, navigate]);

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
            navigate('/area-cliente', { replace: true });
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err.code || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            navigate('/area-cliente', { replace: true });
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

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center p-6 bg-black text-white overflow-hidden font-sans">
            {/* Efeitos de Luz de Fundo Vermelho Neon */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-red-950/10 blur-[100px] rounded-full pointer-events-none" />

            {/* Link para voltar ao site */}
            <div className="absolute top-6 left-6 z-10 font-sans">
                <Link 
                    to="/" 
                    className="flex items-center gap-2 text-zinc-400 hover:text-white transition text-sm font-medium"
                >
                    <ArrowLeft className="h-4 w-4" /> Voltar para a Loja
                </Link>
            </div>

            <div className="w-full max-w-md z-[15] font-sans">
                {/* Logo Section */}
                <div className="mb-8 text-center">
                    <Link to="/" className="inline-block">
                        <img 
                            src="/logo.png" 
                            alt="Discreta Boutique logo" 
                            className="h-16 mx-auto hover:opacity-90 transition duration-300"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                // Fallback em caso de erro ao carregar a imagem
                                (e.target as HTMLElement).style.display = 'none';
                            }}
                        />
                        <div className="splash-logo text-white tracking-[0.2em] font-black italic text-2xl mt-3 text-center">
                            DISCRETA <span className="text-red-500">BOUTIQUE</span>
                        </div>
                    </Link>
                </div>

                {/* Card Conteiner */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-full rounded-3xl bg-zinc-950/80 border border-zinc-800/60 p-8 shadow-[0_0_30px_rgba(239,68,68,0.05)] backdrop-blur-md"
                >
                    <AnimatePresence mode="wait">
                        {mode === 'login' ? (
                            <motion.div
                                key="login-mode"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
                                    Acesse sua conta
                                </h1>
                                <p className="text-zinc-500 text-sm mb-6">
                                    Bem-vindo de volta! Insira suas credenciais abaixo.
                                </p>

                                {/* Alert de Erro */}
                                {error && (
                                    <div className="mb-4 flex items-start gap-3 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-sm">
                                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div>
                                        <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">E-mail</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                                            <input 
                                                required
                                                type="email" 
                                                placeholder="seuemail@exemplo.com" 
                                                value={email} 
                                                onChange={e => setEmail(e.target.value)} 
                                                className="w-full pl-11 pr-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-white placeholder-zinc-600 font-sans" 
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider">Senha</label>
                                            <button 
                                                type="button"
                                                onClick={() => setMode('forgot')} 
                                                className="text-xs text-red-500 hover:text-red-400 font-semibold transition"
                                            >
                                                Esqueceu a senha?
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                                            <input 
                                                required
                                                type={showPassword ? "text" : "password"} 
                                                placeholder="••••••••" 
                                                value={password} 
                                                onChange={e => setPassword(e.target.value)} 
                                                className="w-full pl-11 pr-11 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-white placeholder-zinc-600 font-sans" 
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300 transition"
                                            >
                                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-bold transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                                    >
                                        {loading ? (
                                            <div className="flex items-center gap-2">
                                                {/* Premium custom neon loader */}
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Entrando...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <LogIn className="h-5 w-5" />
                                                <span>Entrar na Conta</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                <div className="my-6 flex items-center gap-3 text-xs text-zinc-500 font-bold uppercase tracking-widest">
                                    <div className="h-[1px] flex-1 bg-zinc-800/80"></div>
                                    ou
                                    <div className="h-[1px] flex-1 bg-zinc-800/80"></div>
                                </div>

                                <button 
                                    onClick={handleGoogleLogin} 
                                    disabled={loading}
                                    className="w-full py-3.5 bg-zinc-900/50 border border-zinc-800 text-zinc-200 rounded-xl font-semibold hover:bg-zinc-800/50 transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer font-sans"
                                >
                                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" width="100%" height="100%">
                                        <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.514 5.514 0 0 1 8.441 13c0-3.045 2.47-5.514 5.55-5.514 1.35 0 2.583.489 3.541 1.287l3.197-3.203C18.8 3.82 16.536 2.971 13.99 2.971 8.436 2.971 3.93 7.464 3.93 13c0 5.536 4.506 10.029 10.06 10.029 5.793 0 9.684-4.043 9.684-9.843 0-.615-.054-1.2-.162-1.9H12.24Z"/>
                                    </svg>
                                    <span>Entrar com o Google</span>
                                </button>

                                <p className="mt-8 text-center text-sm text-zinc-500">
                                    Não tem um cadastro?{' '}
                                    <Link to="/cadastro" className="text-red-500 font-bold hover:text-red-400 hover:underline transition">
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
                                transition={{ duration: 0.2 }}
                            >
                                <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
                                    Recuperar Senha
                                </h1>
                                <p className="text-zinc-500 text-sm mb-6">
                                    Insira seu e-mail cadastrado e enviaremos as instruções para você redefinir sua senha.
                                </p>

                                {/* Mensagens de Feedback */}
                                {error && (
                                    <div className="mb-4 flex items-start gap-3 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-sm font-sans">
                                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}
                                {successMessage && (
                                    <div className="mb-4 flex items-start gap-3 p-3 bg-emerald-950/40 border border-emerald-950/50 rounded-xl text-emerald-400 text-sm font-sans">
                                        <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                        <span>{successMessage}</span>
                                    </div>
                                )}

                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div>
                                        <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">E-mail de Cadastro</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-zinc-500" />
                                            <input 
                                                required
                                                type="email" 
                                                placeholder="seuemail@exemplo.com" 
                                                value={email} 
                                                onChange={e => setEmail(e.target.value)} 
                                                className="w-full pl-11 pr-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-red-500/80 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 transition duration-300 text-white placeholder-zinc-600 font-sans" 
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl font-bold transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                                    >
                                        {loading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Enviando...</span>
                                            </div>
                                        ) : (
                                            <span>Enviar Link de Redefinição</span>
                                        )}
                                    </button>
                                </form>

                                <button 
                                    onClick={() => {
                                        setMode('login');
                                        setError(null);
                                        setSuccessMessage(null);
                                    }}
                                    className="w-full mt-4 py-3 bg-zinc-900/30 hover:bg-zinc-900/50 text-zinc-400 hover:text-white transition rounded-xl text-sm font-semibold flex items-center justify-center gap-2 font-sans"
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
