import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { motion } from 'motion/react';
import { Mail, Lock, LogIn } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export const LoginPage = () => {
    const { user } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/area-cliente');
        }
    }, [user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/area-cliente');
        } catch (err: any) {
            setError(err.message || "Erro ao fazer login.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            navigate('/area-cliente');
        } catch (err: any) {
            setError(err.message || "Erro ao logar com Google.");
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError("Por favor, insira seu e-mail para recuperar a senha.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Email de redefinição de senha enviado!");
        } catch (err: any) {
            setError(err.message || "Erro ao solicitar redefinição de senha.");
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center min-h-screen p-6 bg-zinc-50"
        >
            <div className="w-full max-w-md p-8 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                <h1 className="text-3xl font-black italic tracking-[-0.05em] text-zinc-900 mb-2">Entrar</h1>
                <p className="text-zinc-500 mb-8">Bem-vindo(a) de volta à Discreta Boutique.</p>
                
                {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 h-5 w-5 text-zinc-400" />
                        <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 h-5 w-5 text-zinc-400" />
                        <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600" />
                    </div>
                    <button type="submit" className="w-full py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition flex items-center justify-center gap-2" disabled={loading}>
                        {loading ? 'Entrando...' : <><LogIn className="h-4 w-4" /> Entrar</>}
                    </button>
                </form>

                <div className="mt-4 text-right">
                    <button onClick={handleForgotPassword} className="text-sm text-zinc-500 hover:text-red-700 font-medium">Esqueceu a senha?</button>
                </div>

                <div className="my-6 flex items-center gap-4 text-sm text-zinc-400">
                    <div className="h-px flex-1 bg-zinc-200"></div>
                    ou continue com
                    <div className="h-px flex-1 bg-zinc-200"></div>
                </div>

                <button onClick={handleGoogleLogin} className="w-full py-3 bg-white border border-zinc-300 text-zinc-700 rounded-lg font-semibold hover:bg-zinc-50 transition flex items-center justify-center gap-2" disabled={loading}>
                    Continuar com Google
                </button>

                <p className="mt-8 text-center text-sm text-zinc-600">
                    Não tem uma conta? <Link to="/cadastro" className="text-red-600 font-bold hover:underline">Criar conta</Link>
                </p>
            </div>
        </motion.div>
    );
};
