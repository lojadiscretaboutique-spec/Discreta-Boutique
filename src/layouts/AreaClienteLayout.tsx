import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const AreaClienteLayout = () => {
    const { user, isLoading } = useAuthStore();
    
    if (isLoading) {
        console.log('Renderizando componente: AreaClienteLayout (loading)');
        return (
            <div className="min-h-screen flex flex-col items-center justify-center relative" style={{ backgroundColor: 'var(--background-color, #0a0a0a)' }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-red-900/10 to-transparent animate-pulse pointer-events-none"></div>
                <div className="relative flex flex-col items-center">
                    <div className="h-10 w-10 border-2 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.4)]" style={{ borderColor: 'var(--primary-color, #dc2626)', borderTopColor: 'transparent' }} />
                    <span className="text-[9px] font-black tracking-[5px] uppercase mt-6 animate-pulse" style={{ color: 'var(--text-secondary-color, #a0a0a0)' }}>
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
