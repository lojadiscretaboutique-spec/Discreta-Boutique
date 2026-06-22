import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const AreaClienteLayout = () => {
    const { user, isLoading } = useAuthStore();
    
    if (isLoading) {
        console.log('Renderizando componente: AreaClienteLayout (loading)');
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-red-900/10 to-transparent animate-pulse pointer-events-none"></div>
                <div className="relative flex flex-col items-center">
                    <div className="h-10 w-10 border-2 border-red-650 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.4)]" />
                    <span className="text-[9px] font-black tracking-[5px] uppercase text-zinc-600 mt-6 animate-pulse">
                        Carregando Perfil...
                    </span>
                </div>
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    
    return (
        <div className="min-h-screen bg-transparent pb-20">
            <Outlet />
        </div>
    );
};
