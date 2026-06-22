import { Link, useLocation } from 'react-router-dom';
import { Home, Package, ShoppingBag, User } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useTheme } from '../../contexts/ThemeContext';

export const BottomNav = () => {
  const location = useLocation();
  const cartItems = useCartStore(state => state.items);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const { currentTheme } = useTheme();

  const navItems = [
    { label: 'Início', path: '/', icon: Home },
    { label: 'Pedidos', path: '/area-cliente/pedidos', icon: Package },
    { label: 'Carrinho', path: '/carrinho', icon: ShoppingBag, badge: cartCount },
    { label: 'Perfil', path: '/area-cliente', icon: User },
  ];

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 w-full h-16 border-t flex items-center justify-around z-50 px-2"
      style={{ 
        backgroundColor: currentTheme.cardColor, 
        borderColor: 'rgba(0,0,0,0.1)',
        color: currentTheme.cardTextColor 
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        
        return (
          <Link 
            key={item.label} 
            to={item.path} 
            className="flex flex-col items-center justify-center flex-1 h-full gap-1 relative"
          >
            <div className="relative">
              <Icon 
                size={24} 
                style={{ color: isActive ? currentTheme.primaryColor : 'inherit' }}
                className={isActive ? 'stroke-[2.5px]' : 'stroke-[2px] opacity-70'}
              />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span 
              className="text-[10px] font-bold uppercase tracking-tighter"
              style={{ color: isActive ? currentTheme.primaryColor : 'inherit', opacity: isActive ? 1 : 0.7 }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
