import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';

export const AtivacaoContaPage = () => {
    const { user, isLoading: authLoading } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login', { replace: true });
            return;
        }

        if (authLoading || !user) return;

        const checkAndRedirect = async () => {
            try {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    if (data.accountStatus === 'pending_otp' || !data.emailVerified) {
                        await updateDoc(userRef, {
                            emailVerified: true,
                            accountStatus: 'active',
                            updatedAt: serverTimestamp()
                        }).catch(() => {});
                    }
                }
            } catch (err) {
                console.error("Erro ao verificar status na página de ativação:", err);
            } finally {
                navigate('/area-cliente', { replace: true });
            }
        };

        checkAndRedirect();
    }, [user, authLoading, navigate]);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="p-8 bg-zinc-950 border border-zinc-900 rounded-3xl text-center space-y-4">
                <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-zinc-400 font-medium text-sm">Acessando sua conta...</p>
            </div>
        </div>
    );
};
