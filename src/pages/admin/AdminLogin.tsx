import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { useFeedback } from '../../contexts/FeedbackContext';

export function AdminLogin() {
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
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Verify if user is admin in users collection
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        if (!userDoc.exists() || userData?.status !== 'ativo') {
          await auth.signOut();
          setError('Acesso negado. Sua conta não está ativa ou não possui privilégios.');
          checkAuth();
        } else {
          // Verify if has any admin permission
          const perms = userData.computedPermissions || {};
          const hasAnyPerm = Object.values(perms).some((mod: any) => 
            Object.values(mod).some(val => val === true)
          );

          if (!hasAnyPerm && userData.role !== 'admin') {
            await auth.signOut();
            setError('Acesso negado. Você não possui permissões administrativas atribuídas.');
            checkAuth();
          } else {
            checkAuth();
            navigate('/admin');
          }
        }
      } catch {
        // If Firestore blocks the read due to rules
        await auth.signOut();
        setError('Erro de permissão ao validar privilégios. Verifique seu cadastro no painel Firebase.');
        checkAuth();
      }
      
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError('Falha na autenticação: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-800 px-4">
      <div className="max-w-md w-full bg-slate-900 rounded-xl shadow-xl border overflow-hidden">
        <div className="bg-black py-6 text-center text-red-600 font-bold text-2xl tracking-tight">
          DISCRETA<span className="font-light">ADMIN</span>
        </div>
        <form onSubmit={handleLogin} className="p-8 flex flex-col space-y-4">
          {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input 
              type="email" 
              required 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="admin@discreta.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <Input 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
            />
            <div className="flex justify-end mt-1">
                <button 
                  type="button" 
                  onClick={handleResetPassword}
                  className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition-colors uppercase tracking-wider"
                >
                    Esqueci minha senha
                </button>
            </div>
          </div>
          
          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? 'Entrando...' : 'Acessar Painel'}
          </Button>

          <Button type="button" variant="outline" onClick={() => navigate('/')} className="w-full">
            Voltar para a Loja
          </Button>
        </form>
      </div>
    </div>
  );
}
