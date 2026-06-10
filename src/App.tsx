import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { StoreLayout } from './layouts/StoreLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { motion } from 'motion/react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { PromotionProvider } from './contexts/PromotionContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TypographyProvider } from './contexts/TypographyContext';
import { cacheService } from './services/cacheService';

// Store Pages
const HomePage = lazy(() => import('./pages/store/HomePage').then(m => ({ default: m.HomePage })));
const CatalogPage = lazy(() => import('./pages/store/CatalogPage').then(m => ({ default: m.CatalogPage })));
const ProductPage = lazy(() => import('./pages/store/ProductPage').then(m => ({ default: m.ProductPage })));
const CartPage = lazy(() => import('./pages/store/CartPage').then(m => ({ default: m.CartPage })));
const SuccessPage = lazy(() => import('./pages/store/SuccessPage').then(m => ({ default: m.SuccessPage })));
const CustomerAreaPage = lazy(() => import('./pages/store/CustomerAreaPage').then(m => ({ default: m.CustomerAreaPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/store/PrivacyPolicyPage'));
const AboutUsPage = lazy(() => import('./pages/store/AboutUsPage'));
const ExchangePolicyPage = lazy(() => import('./pages/store/ExchangePolicyPage'));
const LGPDPage = lazy(() => import('./pages/store/LGPDPage'));
const AffiliateLandingPage = lazy(() => import('./modules/afiliados/pages/AffiliateLandingPage').then(m => ({ default: m.AffiliateLandingPage })));
const AdminAffiliates = lazy(() => import('./modules/afiliados/pages/AdminAffiliates').then(m => ({ default: m.AdminAffiliates })));

// Motoboy Pages
const MotoboyLogin = lazy(() => import('./pages/motoboy/MotoboyLogin').then(m => ({ default: m.MotoboyLogin })));
const MotoboyDashboard = lazy(() => import('./pages/motoboy/MotoboyDashboard').then(m => ({ default: m.MotoboyDashboard })));

// Admin Pages
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then(m => ({ default: m.AdminOrders })));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts').then(m => ({ default: m.AdminProducts })));
const AdminCombos = lazy(() => import('./pages/admin/AdminCombos').then(m => ({ default: m.AdminCombos })));
const AdminLabels = lazy(() => import('./pages/admin/AdminLabels').then(m => ({ default: m.AdminLabels })));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories').then(m => ({ default: m.AdminCategories })));
const AdminBanners = lazy(() => import('./pages/admin/AdminBanners').then(m => ({ default: m.AdminBanners })));
const AdminPopups = lazy(() => import('./pages/admin/marketing/AdminPopups').then(m => ({ default: m.AdminPopups })));
const AdminCoupons = lazy(() => import('./pages/admin/marketing/AdminCoupons').then(m => ({ default: m.AdminCoupons })));
const AdminPromotions = lazy(() => import('./pages/admin/marketing/AdminPromotions').then(m => ({ default: m.AdminPromotions })));
const AdminPostagem = lazy(() => import('./pages/admin/marketing/AdminPostagem').then(m => ({ default: m.AdminPostagem })));
const AdminVisualHome = lazy(() => import('./pages/admin/marketing/AdminVisualHome').then(m => ({ default: m.AdminVisualHome })));
const MovEstoque = lazy(() => import('./pages/admin/MovEstoque').then(m => ({ default: m.MovEstoque })));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers').then(m => ({ default: m.AdminCustomers })));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminRoles = lazy(() => import('./pages/admin/AdminRoles').then(m => ({ default: m.AdminRoles })));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs').then(m => ({ default: m.AdminLogs })));
const AdminConfig = lazy(() => import('./pages/admin/AdminConfig').then(m => ({ default: m.AdminConfig })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminAIInsights = lazy(() => import('./pages/admin/AdminAIInsights'));
const AdminDeliveryAreas = lazy(() => import('./pages/admin/AdminDeliveryAreas').then(m => ({ default: m.AdminDeliveryAreas })));
const AdminCaixa = lazy(() => import('./pages/admin/AdminCaixa').then(m => ({ default: m.AdminCaixa })));
const AdminPDV = lazy(() => import('./pages/admin/AdminPDV').then(m => ({ default: m.AdminPDV })));
const AdminPurchases = lazy(() => import('./pages/admin/AdminPurchases').then(m => ({ default: m.AdminPurchases })));
const AdminFinancialList = lazy(() => import('./pages/admin/financial/AdminFinancialList').then(m => ({ default: m.AdminFinancial })));
const AdminFinancialReports = lazy(() => import('./pages/admin/financial/AdminFinancialReports').then(m => ({ default: m.AdminFinancialReports })));
const AdminCommissions = lazy(() => import('./pages/admin/financial/AdminCommissions').then(m => ({ default: m.AdminCommissions })));
const AdminIntegracao = lazy(() => import('./pages/admin/financial/AdminIntegracao').then(m => ({ default: m.AdminIntegracao })));
const AdminPaymentMethods = lazy(() => import('./pages/admin/financial/AdminPaymentMethods').then(m => ({ default: m.AdminPaymentMethods })));
const AdminOperatingHours = lazy(() => import('./pages/admin/AdminOperatingHours').then(m => ({ default: m.AdminOperatingHours })));
const AdminWebhooks = lazy(() => import('./pages/admin/AdminWebhooks').then(m => ({ default: m.AdminWebhooks })));
const AdminSmartStock = lazy(() => import('./pages/admin/AdminSmartStock'));
const AdminMarketingHub = lazy(() => import('./pages/admin/marketing/AdminMarketingHub'));
const AdminVisitors = lazy(() => import('./pages/admin/analytics/AdminVisitors').then(m => ({ default: m.AdminVisitors })));
const AdminThemeManager = lazy(() => import('./pages/admin/AdminThemeManager').then(m => ({ default: m.AdminThemeManager })));
const AdminTypography = lazy(() => import('./pages/admin/AdminTypography').then(m => ({ default: m.AdminTypography })));
const AdminLiveShop = lazy(() => import('./pages/admin/marketing/AdminLiveShop').then(m => ({ default: m.AdminLiveShop })));
const LiveShopPage = lazy(() => import('./pages/store/LiveShopPage').then(m => ({ default: m.LiveShopPage })));

// Loading Component (Splash Screen)
function PageLoader() {
  const settings = useSettings();
  
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black gap-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-red-900/20 to-transparent animate-pulse"></div>
      
      <div className="relative flex flex-col items-center">
        {settings.logoUrl ? (
          <motion.img 
            src={settings.logoUrl}
            alt={settings.storeName}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-32 h-32 object-contain mb-4"
          />
        ) : (
          <motion.h1 
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="text-6xl md:text-8xl font-black italic tracking-[-0.1em] text-white uppercase"
          >
            {settings.storeName.split(' ')[0]}
          </motion.h1>
        )}
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          className="h-1 bg-red-600 mt-2 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)]"
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>

      <p className="text-[10px] font-black tracking-[8px] uppercase text-zinc-700 animate-pulse mt-4">
        Sedução & Sigilo
      </p>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    cacheService.validateCache();
  }, []);

  useEffect(() => {
    // Dynamic Manifest switching for Motoboy vs Default Store
    const link: HTMLLinkElement | null = document.querySelector('link[rel="manifest"]');
    if (link) {
      if (location.pathname.startsWith('/motoboy')) {
        link.href = '/motoboy-manifest.json';
        document.title = 'Discreta Entregas';
      } else {
        link.href = '/manifest.json';
        document.title = 'Discreta Boutique | Sensualidade e Elegância';
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    // Only track storefront visitors (exclude analytics inside admin panel)
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/motoboy')) return;

    const timer = setTimeout(() => {
      const pageTitle = document.title || 'Discreta Boutique';
      import('./services/analyticsService').then(({ analyticsService }) => {
        analyticsService.trackPageView(pageTitle, location.pathname + location.search);
      });
    }, 1500); // 1.5s delay to allow dynamic lazy bundles and titles to resolve accurately

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return (
    <>
      <ScrollToTop />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Store Routes */}
          <Route element={<StoreLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/catalogo" element={<CatalogPage />} />
            <Route path="/area-cliente" element={<CustomerAreaPage />} />
            <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
            <Route path="/quem-somos" element={<AboutUsPage />} />
            <Route path="/politica-de-troca" element={<ExchangePolicyPage />} />
            <Route path="/lgpd" element={<LGPDPage />} />
            <Route path="/carrinho" element={<CartPage />} />
            <Route path="/produto/:slug" element={<ProductPage />} />
            <Route path="/sucesso" element={<SuccessPage />} />
            <Route path="/afiliados" element={<AffiliateLandingPage />} />
            <Route path="/live" element={<LiveShopPage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="ia-insights" element={<AdminAIInsights />} />
            <Route path="pedidos" element={<AdminOrders />} />
            <Route path="categorias" element={<AdminCategories />} />
            <Route path="produtos" element={<AdminProducts />} />
            <Route path="combos" element={<AdminCombos />} />
            <Route path="etiquetas" element={<AdminLabels />} />
            <Route path="mov_estoque" element={<MovEstoque />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="perfis" element={<AdminRoles />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="marketing/visual-home" element={<AdminVisualHome />} />
            <Route path="marketing/live-shop" element={<AdminLiveShop />} />
            <Route path="live-shop" element={<AdminLiveShop />} />
            <Route path="marketing/banners" element={<AdminBanners />} />
            <Route path="marketing/popups" element={<AdminPopups />} />
            <Route path="marketing/cupons" element={<AdminCoupons />} />
            <Route path="marketing/promocoes" element={<AdminPromotions />} />
            <Route path="marketing/postagem" element={<AdminPostagem />} />
            <Route path="clientes" element={<AdminCustomers />} />
            <Route path="caixa" element={<AdminCaixa />} />
            <Route path="pdv" element={<AdminPDV />} />
            <Route path="compras" element={<AdminPurchases />} />
            <Route path="financeiro">
              <Route path="lancamentos" element={<AdminFinancialList />} />
              <Route path="entradas" element={<AdminFinancialList />} />
              <Route path="saidas" element={<AdminFinancialList />} />
              <Route path="relatorios" element={<AdminFinancialReports />} />
              <Route path="comissoes" element={<AdminCommissions />} />
              <Route path="integracao" element={<AdminIntegracao />} />
              <Route path="formas-pagamento" element={<AdminPaymentMethods />} />
            </Route>
            <Route path="areas-entrega" element={<AdminDeliveryAreas />} />
            <Route path="horarios" element={<AdminOperatingHours />} />
            <Route path="marketing/webhooks" element={<AdminWebhooks />} />
            <Route path="marketing/webhooks-logs" element={<AdminWebhooks />} />
            <Route path="marketing/afiliados" element={<AdminAffiliates />} />
            <Route path="estoque-inteligente" element={<AdminSmartStock />} />
            <Route path="marketing" element={<AdminMarketingHub />} />
            <Route path="marketing/:subpage" element={<AdminMarketingHub />} />
            <Route path="marketing/recuperador-carrinho" element={<AdminWebhooks />} />
            <Route path="marketing/recovery-logs" element={<AdminWebhooks />} />
            <Route path="analytics/visitors" element={<AdminVisitors />} />
            <Route path="config" element={<AdminConfig />} />
            <Route path="config/theme-manager" element={<AdminThemeManager />} />
            <Route path="config/typography" element={<AdminTypography />} />
          </Route>

          {/* Motoboy Routes */}
          <Route path="/motoboy/login" element={<MotoboyLogin />} />
          <Route path="/motoboy" element={<MotoboyDashboard />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  useEffect(() => {
    // Reveal app and hide static splash
    const staticSplash = document.getElementById('initial-splash');
    if (staticSplash) {
      staticSplash.style.opacity = '0';
      setTimeout(() => {
        staticSplash.remove();
        document.body.style.overflow = 'auto'; // Re-enable scroll if it was blocked
      }, 500);
    }
  }, []);

  return (
    <SettingsProvider>
      <TypographyProvider>
        <ThemeProvider>
          <PromotionProvider>
            <AppContent />
          </PromotionProvider>
        </ThemeProvider>
      </TypographyProvider>
    </SettingsProvider>
  );
}
