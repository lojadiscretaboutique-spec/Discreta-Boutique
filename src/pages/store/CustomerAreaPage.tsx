import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { Button } from '../../components/ui/button';
import { ChevronRight, LogOut, Package, MapPin, Heart, Wallet, Star, ShieldCheck, Mail, Headphones, Lock, User } from 'lucide-react';
import { themeService } from '../../services/themeService';
import { ThemeConfig } from '../../types/theme';

export const CustomerAreaPage = () => {
    const navigate = useNavigate();
    const [theme, setTheme] = useState<ThemeConfig | null>(null);

    useEffect(() => {
        themeService.getActiveTheme().then(setTheme);
    }, []);

    const handleLogout = async () => {
        await signOut(getAuth());
        navigate('/login');
    };                
    
    // Minimal mock data for structure as requested in the "perfil like" image
    const menuItems = [
        { label: 'Meus Pedidos', path: '/area-cliente/pedidos', icon: Package },
        { label: 'Meus Endereços', path: '/area-cliente/enderecos', icon: MapPin },
        { label: 'Favoritos', path: '/area-cliente/favoritos', icon: Heart },
        { label: 'Fidelidade', path: '/area-cliente/fidelidade', icon: Star },
        { label: 'Minhas Avaliações', path: '/area-cliente/avaliacoes', icon: Star },
        { label: 'Notificações', path: '/area-cliente/notificacoes', icon: Mail },
        { label: 'Suporte', path: '/area-cliente/suporte', icon: Headphones },
        { label: 'Alterar Senha', path: '/area-cliente/alterar-senha', icon: Lock },
    ];
    
    return (
        <div className="bg-slate-50 min-h-screen" style={{ backgroundColor: theme?.backgroundColor }}>
            <div className="max-w-2xl mx-auto min-h-screen shadow-sm" style={{ backgroundColor: theme?.cardColor }}>
                
                <header className="px-6 pt-12 pb-6 border-b border-slate-100 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl border" style={{ backgroundColor: theme?.secondaryColor, borderColor: theme?.primaryColor, color: theme?.primaryTextColor }}>
                        <User className="w-10 h-10" />
                    </div>
                    <div onClick={() => navigate('/area-cliente/dados')} className="cursor-pointer flex-1">
                        <h1 className="text-2xl font-bold" style={{ color: theme?.cardTextColor }}>Felipe Denis</h1>
                        <p className="text-base font-medium" style={{ color: theme?.primaryColor }}>Ver dados da conta</p>
                    </div>
                </header>
                
                <nav className="px-2 py-4">
                    <ul className="space-y-1">
                        {menuItems.map(item => {
                            const Icon = item.icon;
                            return (
                                <li key={item.label} onClick={() => navigate(item.path)} className="flex justify-between items-center p-4 rounded-xl cursor-pointer transition-colors group" style={{ color: theme?.cardTextColor }}>
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg transition-colors" style={{ backgroundColor: theme?.secondaryColor, color: theme?.primaryColor }}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <span className="font-semibold">{item.label}</span>
                                    </div>
                                    <ChevronRight className="w-5 h-5 transition-colors" style={{ color: theme?.primaryColor }} />
                                </li>
                            );
                        })}
                        
                        <li className="pt-4 px-4">
                            <Button onClick={handleLogout} className="w-full justify-start gap-3 px-0 text-base" size="lg" style={{ backgroundColor: theme?.buttonColor, color: theme?.buttonTextColor }}>
                                <LogOut className="w-5 h-5" />
                                Sair da conta
                            </Button>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    );
};

