import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Users, Settings, LogOut, LayoutDashboard, Image as ImageIcon, Layers, ClipboardList, Shield, MapPin, Banknote, DollarSign, Truck, Clock, Tag, Brain, Moon, Sun, RefreshCcw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettings } from '../contexts/SettingsContext';
import { useFeedback } from '../contexts/FeedbackContext';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';

export function AdminLayout() {
  const { user, userData, isAdmin, isLoading, checkAuth, hasPermission } = useAuthStore();
  const settings = useSettings();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const location = useLocation();

  const menu = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, permission: 'dashboard' },
    { name: 'Insights IA', path: '/admin/ia-insights', icon: Brain, permission: 'dashboard' }, // Added here
    { name: 'PDV / Vender', path: '/admin/pdv', icon: ShoppingCart, permission: 'orders' },
    { name: 'Pedidos', path: '/admin/pedidos', icon: ShoppingCart, permission: 'orders' },
    { name: 'Caixa', path: '/admin/caixa', icon: Banknote, permission: 'caixa' },
    { name: 'Categorias', path: '/admin/categorias', icon: Layers, permission: 'categories' },
    { name: 'Produtos', path: '/admin/produtos', icon: Package, permission: 'produtos' },
    { name: 'Etiquetas', path: '/admin/etiquetas', icon: Tag, permission: 'produtos' },
    { name: 'Estoque', path: '/admin/mov_estoque', icon: ClipboardList, permission: 'stock' },
    { name: 'Compras', path: '/admin/compras', icon: Truck, permission: 'compras' },
    { name: 'Clientes', path: '/admin/clientes', icon: Users, permission: 'clientes' },
    { name: 'Financeiro', path: '/admin/financeiro', icon: DollarSign, permission: 'financeiro', submenu: [
        { name: 'Lançamentos', path: '/admin/financeiro/lancamentos', permission: 'financeiro' },
        { name: 'Contas a Receber', path: '/admin/financeiro/lancamentos?filtro=receber', permission: 'financeiro' },
        { name: 'Contas a Pagar', path: '/admin/financeiro/lancamentos?filtro=pagar', permission: 'financeiro' },
        { name: 'Relatórios', path: '/admin/financeiro/relatorios', permission: 'financeiro' },
        { name: 'Comissões', path: '/admin/financeiro/comissoes', permission: 'financeiro' },
        { name: 'Integração', path: '/admin/financeiro/integracao', permission: 'financeiro' },
        { name: 'Formas de Pagamento', path: '/admin/financeiro/formas-pagamento', permission: 'financeiro' }
    ]},
    { name: 'Áreas de Entrega', path: '/admin/areas-entrega', icon: MapPin, permission: 'areasEntrega' },
    { name: 'Horários da Loja', path: '/admin/horarios', icon: Clock, permission: 'settings' },
    { name: 'Configurações', path: '/admin/config', icon: Settings, permission: 'settings', submenu: [
        { name: 'Dados da Loja', path: '/admin/config', permission: 'settings' },
        { name: 'Recuperador Carrinho', path: '/admin/config/recuperador-carrinho', permission: 'settings' },
        { name: 'Logs Recuperação', path: '/admin/config/recovery-logs', permission: 'logs' }
    ]},
    { name: 'Contas / Equipe', path: '/admin/usuarios', icon: Shield, permission: 'users', submenu: [
        { name: 'Usuários', path: '/admin/usuarios', permission: 'users' },
        { name: 'Perfis de Acesso', path: '/admin/perfis', permission: 'roles' },
        { name: 'Logs / Auditoria', path: '/admin/logs', permission: 'logs' },
        { name: 'Webhooks WhatsApp', path: '/admin/webhooks-logs', permission: 'logs' },
        { name: 'Estoque Inteligente', path: '/admin/estoque-inteligente', permission: 'products' },
    ]},
    { name: 'Banners', path: '/admin/banners', icon: ImageIcon, permission: 'banners' },
  ];

  const [usersSubMenuOpen, setUsersSubMenuOpen] = useState(false);
  const [financeSubMenuOpen, setFinanceSubMenuOpen] = useState(false);
  const [configSubMenuOpen, setConfigSubMenuOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Unified state for all screen sizes
  
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('admin-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const handleThemeEvent = () => {
      const savedTheme = (localStorage.getItem('admin-theme') as 'dark' | 'light') || 'dark';
      setTheme(savedTheme);
    };
    window.addEventListener('admin-theme-changed', handleThemeEvent);
    return () => window.removeEventListener('admin-theme-changed', handleThemeEvent);
  }, []);

  useEffect(() => {
    localStorage.setItem('admin-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/admin/login');
        return;
      }

      const currentPath = location.pathname;
      
      const matchedItem = menu.find(item => {
        if (item.path === currentPath) return true;
        if (item.path !== '/admin' && currentPath.startsWith(item.path)) return true;
        if (item.submenu) {
          return item.submenu.some((sub: { path: string }) => currentPath.startsWith(sub.path));
        }
        return false;
      });

      if (matchedItem) {
        let permissionNeeded = matchedItem.permission;
        
        if (matchedItem.submenu) {
          const matchedSub = matchedItem.submenu.find((sub: { path: string }) => currentPath.startsWith(sub.path));
          if (matchedSub) permissionNeeded = matchedSub.permission;
        }

        if (!isAdmin && !hasPermission(permissionNeeded, 'visualizar')) {
          toast(`Acesso Negado: Você não tem permissão para acessar esta página (${matchedItem.name}). Motivo: Falta perfil de acesso.`, "error");
          // If no dashboard permission, try to find another one
          if (currentPath === '/admin' || currentPath === '/admin/') {
             const firstAllowed = menu.find(m => hasPermission(m.permission, 'visualizar'));
             if (firstAllowed) {
                navigate(firstAllowed.path);
                return;
             }
          }
          navigate('/admin');
        }
      }
    }
  }, [user, isAdmin, isLoading, navigate, hasPermission, location.pathname]);

  // ALWAYS close the menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Let's also close it on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm font-bold tracking-widest uppercase opacity-50">Autenticando...</p>
    </div>
  );
  if (!user) return null;
  
  // Basic check: if not admin, must have at least one permission to see admin layout
  const permissions = (userData as any)?.computedPermissions || {};
  const hasAnyPermission = isAdmin || Object.keys(permissions).some(k => hasPermission(k, 'visualizar'));
  
  if (!hasAnyPermission) return null;

  return (
    <div className={cn("min-h-screen flex flex-col w-full font-sans print:bg-white print:min-h-0 admin-container transition-colors duration-300", theme === 'dark' ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900")}>
      {/* Top Header */}
      <header className={cn("h-16 border-b flex justify-between items-center px-4 shadow-sm z-30 w-full fixed top-0 print:hidden transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
        <div className="flex items-center gap-4">
          <button 
            className={cn("p-2 -ml-2 transition-colors rounded-lg focus:outline-none", theme === 'dark' ? "text-slate-300 hover:text-red-600 hover:bg-slate-800" : "text-slate-800 hover:text-red-600 hover:bg-slate-100")} 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Alternar Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
          
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex w-10 h-10 bg-white dark:bg-slate-800 rounded-lg shadow-sm items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-red-600 font-black text-xs">DB</span>
                )}
             </div>
             <div>
               <h2 className={cn("font-bold tracking-tight leading-none text-sm sm:text-base", theme === 'dark' ? "text-slate-100" : "text-slate-900")}>{settings.storeName}</h2>
               <p className={cn("text-[10px] font-medium opacity-70", theme === 'dark' ? "text-slate-400" : "text-slate-500")}>Gestão Administrativa</p>
             </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 sm:gap-4 items-center">
          {/* User Info */}
          {user && (
             <div className="flex items-center gap-2 mr-2">
                <span className={cn("text-xs font-semibold hidden md:block", theme === 'dark' ? "text-slate-300" : "text-slate-600")}>
                    {userData?.name || user.email}
                </span>
                <div className="w-8 h-8 rounded-full bg-red-600/20 text-red-600 flex items-center justify-center font-bold text-xs uppercase border border-red-600/30">
                    {(userData?.name || user.email || 'A').charAt(0)}
                </div>
             </div>
          )}

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className={cn(
              "p-2 rounded-lg border transition-all duration-300 flex items-center justify-center",
              theme === 'dark' 
                ? "bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700" 
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
            )}
            title={theme === 'dark' ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link to="/" className={cn("text-xs sm:text-sm font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors", theme === 'dark' ? "text-slate-300 hover:text-red-600 bg-slate-800 border-slate-700" : "text-slate-600 hover:text-red-600 bg-white border-slate-200")}>
            <span className="hidden sm:inline">Ver Loja</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pt-16 w-full print:pt-0">
        
        {/* Overlay */}
        {isMenuOpen && (
            <div 
            className={cn("fixed inset-0 z-40 transition-opacity duration-300 print:hidden", theme === 'dark' ? "bg-slate-900/60 backdrop-blur-sm" : "bg-black/20 backdrop-blur-[2px]")} 
            onClick={() => setIsMenuOpen(false)} 
            />
        )}

        {/* Sidebar Drawer */}
        <aside className={cn(
            "fixed inset-y-0 left-0 flex flex-col z-50 transition-all duration-300 ease-in-out shadow-2xl overflow-hidden print:hidden border-r",
            isMenuOpen ? "w-[280px] translate-x-0" : "w-[280px] -translate-x-full",
            theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-600"
        )}>
            <div className={cn("h-16 flex items-center justify-between px-6 border-b shrink-0 transition-colors", theme === 'dark' ? "border-slate-800/50 bg-slate-950/50 text-white" : "border-slate-100 bg-slate-50 text-slate-900")}>
                <span className="text-sm font-black tracking-widest uppercase opacity-90">Menu Iniciar</span>
                <button 
                  className={cn("p-1.5 rounded-md transition-colors", theme === 'dark' ? "text-slate-400 hover:text-white bg-slate-800" : "text-slate-400 hover:text-slate-900 bg-slate-100")} 
                  onClick={() => setIsMenuOpen(false)}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            
            <nav className="flex-1 py-4 flex flex-col overflow-y-auto px-3 gap-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {menu.map((item) => {
                if (!hasPermission(item.permission, 'visualizar')) return null;

                const Icon = item.icon;
                
                if (item.submenu) {
                    const isUsersSub = item.name === 'Contas / Equipe';
                    const isFinanceSub = item.name === 'Financeiro';
                    const isConfigSub = item.name === 'Configurações';
                    
                    const isSubActive = isUsersSub 
                        ? (location.pathname.startsWith('/admin/usuarios') || location.pathname.startsWith('/admin/perfis') || location.pathname.startsWith('/admin/logs'))
                        : isFinanceSub 
                            ? location.pathname.startsWith('/admin/financeiro')
                            : isConfigSub
                                ? location.pathname.startsWith('/admin/config')
                                : false;
                            
                    const isOpen = isUsersSub ? usersSubMenuOpen : (isFinanceSub ? financeSubMenuOpen : (isConfigSub ? configSubMenuOpen : false));
                    
                    const toggleMenu = () => {
                        if (isUsersSub) setUsersSubMenuOpen(!usersSubMenuOpen);
                        if (isFinanceSub) setFinanceSubMenuOpen(!financeSubMenuOpen);
                        if (isConfigSub) setConfigSubMenuOpen(!configSubMenuOpen);
                    };

                    return (
                        <div key={item.name} className="flex flex-col mb-1 group/menu">
                            <button 
                                onClick={toggleMenu}
                                className={cn(
                                "flex justify-between items-center px-3 py-2.5 rounded-lg transition-all text-[13px] font-semibold tracking-wide whitespace-nowrap",
                                isSubActive 
                                  ? (theme === 'dark' ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-900") 
                                  : (theme === 'dark' ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-700 hover:text-slate-900")
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={18} className={isSubActive ? "text-red-500" : (theme === 'dark' ? "text-slate-400 group-hover/menu:text-red-400" : "text-slate-400 group-hover/menu:text-red-500")} />
                                    <span>{item.name}</span>
                                </div>
                                <span className={cn("text-xs transition-transform duration-200", isOpen && "rotate-180")}>▼</span>
                            </button>
                            {isOpen && (
                                <div className={cn("flex flex-col mt-1 ml-4 pl-3 border-l space-y-0.5", theme === 'dark' ? "border-slate-700/50" : "border-slate-200")}>
                                    {item.submenu.map(sub => {
                                        if (!hasPermission(sub.permission, 'visualizar')) return null;
                                        // Specific check for query params for contas a pagar/receber
                                        let subActive = location.pathname === sub.path.split('?')[0];
                                        if (sub.path.includes('?filtro=')) {
                                          const searchParams = new URLSearchParams(location.search);
                                          const filtro = searchParams.get('filtro');
                                          subActive = subActive && filtro === sub.path.split('=')[1];
                                        } else if (sub.path === '/admin/financeiro/lancamentos') {
                                           const searchParams = new URLSearchParams(location.search);
                                           subActive = subActive && !searchParams.has('filtro');
                                        }

                                        return (
                                            <Link
                                                key={sub.path}
                                                to={sub.path}
                                                className={cn(
                                                    "flex items-center px-3 py-2 rounded-md transition-all text-xs font-semibold tracking-wide whitespace-nowrap",
                                                    subActive 
                                                    ? (theme === 'dark' ? "bg-red-500/20 text-red-400 font-bold" : "bg-red-100 text-red-700 font-bold") 
                                                    : (theme === 'dark' ? "text-slate-400 hover:bg-slate-800 hover:text-slate-300" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                                                )}
                                            >
                                                {sub.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                }

                const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/admin' && item.path !== '/admin/financeiro');
                
                return (
                <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[13px] font-semibold tracking-wide whitespace-nowrap mb-1 group/menu",
                    isActive 
                        ? "bg-red-600 text-white shadow-md shadow-red-500/20" 
                        : (theme === 'dark' ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-700 hover:text-slate-900")
                    )}
                >
                    <Icon size={18} className={isActive ? "text-white" : (theme === 'dark' ? "text-slate-400 group-hover/menu:text-red-400" : "text-slate-400 group-hover/menu:text-red-500")} />
                    <span>{item.name}</span>
                </Link>
                )
            })}
            </nav>
            
            <div className={cn("p-4 border-t shrink-0 transition-colors", theme === 'dark' ? "border-slate-800/50 bg-slate-950/30" : "border-slate-100 bg-slate-50/50")}>
            <button 
                onClick={() => signOut(auth)}
                className={cn("flex items-center gap-3 px-3 py-2.5 text-[13px] font-semibold rounded-lg w-full transition-all tracking-wide", theme === 'dark' ? "hover:bg-red-500/10 text-slate-400 hover:text-red-500" : "hover:bg-red-50 text-slate-700 hover:text-red-600")}
            >
                <LogOut size={18} />
                Sair do Sistema
            </button>
            </div>
        </aside>

        {/* Dynamic Page Content */}
        <div className="flex-1 w-full relative">
          <main className="w-full min-h-full p-3 sm:p-6 lg:p-8 max-w-[100vw] print:p-0 print:m-0">
            <div className="w-full mx-auto pb-24 print:pb-0">
                <Outlet />
            </div>
          </main>
        </div>

      </div>
    </div>
  );
}
