import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const AreaClienteLayout = () => {
    const { user } = useAuthStore();
    if (!user) return <Navigate to="/login" replace />;
    return (
        <div className="min-h-screen bg-transparent pb-20">
            <Outlet />
        </div>
    );
};
