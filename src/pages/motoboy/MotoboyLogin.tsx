import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Shield, Smartphone, Key, AlertCircle } from 'lucide-react';

export function MotoboyLogin() {
  const settings = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const checkAuth = useAuthStore(s => s.checkAuth);
  const { toast } = useFeedback();

  const handleResetPassword = async () => {
    if (!email) return setError('Informe seu e-mail para receber o link de recuperação.');
    try {
        await sendPasswordResetEmail(auth, email);
        toast("E-mail de recuperação enviado! Verifique sua caixa de entrada.", "success");
    } catch (err: any) {
        setError('Erro ao enviar e-mail: ' + err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
          await auth.signOut();
          setError('Acesso negado. Perfil de usuário não encontrado.');
          checkAuth();
          return;
        }

        const userData = userDoc.data();
        
        if (userData?.status !== 'ativo') {
          await auth.signOut();
          setError('Acesso negado. Sua conta não está ativa no sistema.');
          checkAuth();
          return;
        }

        // Verify ROLE_MOTOBOY
        const roles = userData.roles || (userData.role ? [userData.role] : []);
        const hasMotoboyRole = roles.includes('ROLE_MOTOBOY') || roles.includes('motoboy') || userData.role === 'ROLE_MOTOBOY' || userData.role === 'motoboy' || roles.includes('admin') || userData.role === 'admin';

        if (!hasMotoboyRole) {
          await auth.signOut();
          setError('Acesso negado. Este painel é de uso exclusivo de entregadores autorizados (ROLE_MOTOBOY).');
          checkAuth();
          return;
        }

        checkAuth();
        toast("Login bem-sucedido! Bem-vindo.", "success");
        navigate('/motoboy');
      } catch (err: any) {
        console.error("Firestore verification error:", err);
        await auth.signOut();
        setError('Erro ao verificar permissões de acesso. Tente novamente.');
        checkAuth();
      }
      
    } catch (err: unknown) {
      console.warn('Erro contornado no login:', err);
      let errorMessage = 'Falha na autenticação. Verifique suas credenciais.';
      if (err instanceof Error) {
        if (err.message.includes('auth/invalid-email')) {
          errorMessage = 'O formato do e-mail é inválido.';
        } else if (err.message.includes('auth/user-not-found') || err.message.includes('auth/wrong-password') || err.message.includes('auth/invalid-credential')) {
          errorMessage = 'E-mail ou senha incorretos.';
        } else if (err.message.includes('auth/too-many-requests')) {
          errorMessage = 'Muitas tentativas falhas. Tente novamente mais tarde.';
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="motoboy-login-page" className="min-h-screen w-full flex flex-col items-center justify-center bg-black px-4 text-white">
      {/* Background radial highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(220,38,38,0.15)_0%,_transparent_75%)] pointer-events-none" />
      
      <div className="max-w-md w-full bg-zinc-950 rounded-[2.5rem] shadow-[0_0_50px_rgba(220,38,38,0.1)] border border-zinc-900 overflow-hidden relative z-10">
        <div className="bg-gradient-to-b from-zinc-900 to-black py-10 text-center flex flex-col items-center gap-2 border-b border-zinc-900 px-6">
          <div className="w-16 h-16 bg-red-650 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6 mb-2 border border-red-500">
            <Smartphone size={32} className="text-white" />
          </div>
          
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-red-500">
            Discreta Entregas
          </h2>
          <span className="text-zinc-500 font-bold text-[9px] tracking-[0.25em] uppercase">
            Módulo Exclusivo para Motoboys
          </span>
        </div>

        <form onSubmit={handleLogin} className="p-8 flex flex-col space-y-5">
          {error && (
            <div className="p-4 bg-red-950/50 border border-red-800 rounded-2xl text-red-400 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">Email do Entregador</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">@</span>
              <Input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="entregador@discreta.com"
                className="pl-10 h-14 bg-zinc-900 border-zinc-800 text-sm font-semibold rounded-2xl focus:border-red-500 transition-all text-white placeholder:text-zinc-700"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">Senha Secreta</label>
              <button 
                type="button" 
                onClick={handleResetPassword}
                className="text-[10px] font-black text-zinc-500 hover:text-red-500 transition-colors uppercase tracking-wider"
              >
                Esqueci
              </button>
            </div>
            
            <div className="relative">
              <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <Input 
                type="password" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                className="pl-10 h-14 bg-zinc-900 border-zinc-800 text-sm font-semibold rounded-2xl focus:border-red-500 transition-all text-white placeholder:text-zinc-700"
              />
            </div>
          </div>
          
          <div className="pt-4 space-y-3">
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-14 bg-red-650 hover:bg-red-700 text-white font-black rounded-2xl text-sm uppercase tracking-widest border-b-4 border-red-800 active:border-b-0 active:translate-y-0.5 transition-all shadow-[0_4px_20px_rgba(220,38,38,0.25)]"
            >
              {loading ? 'Autenticando...' : 'Entrar no Sistema'}
            </Button>

            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => navigate('/')} 
              className="w-full h-12 text-zinc-500 hover:text-zinc-300 font-bold text-xs uppercase tracking-wider"
            >
              Voltar para a Loja
            </Button>
          </div>
        </form>
      </div>
      
      <p className="mt-8 text-[10px] font-black tracking-widest text-zinc-700 uppercase flex items-center gap-1.5">
        <Shield size={10} /> Dis discreta boutique • Sigilo absoluto
      </p>
    </div>
  );
}
