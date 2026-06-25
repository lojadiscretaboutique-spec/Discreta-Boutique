import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { StoreLayout } from './layouts/StoreLayout';
import { WifiHotspotPage } from './pages/store/WifiHotspotPage';
import { motion } from 'motion/react';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { PromotionProvider } from './contexts/PromotionContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TypographyProvider } from './contexts/TypographyContext';
import { cacheService } from './services/cacheService';
import { useAuthStore } from './store/authStore';
import HomePage from './pages/store/HomePage';
import { CatalogPage } from './pages/store/CatalogPage';
import { ProductPage } from './pages/store/ProductPage';
import { CartPage } from './pages/store/CartPage';
import { LoginPage } from './pages/store/LoginPage';
import { CadastroPage } from './pages/store/CadastroPage';
import { AtivacaoContaPage } from './pages/store/AtivacaoContaPage';
import { SuccessPage } from './pages/store/SuccessPage';
import { CheckoutPixPage } from './pages/store/CheckoutPixPage';
import { CustomerAreaPage } from './pages/store/CustomerAreaPage';
import { AreaClienteLayout } from './layouts/AreaClienteLayout';
import { LiveShopPage } from './pages/store/LiveShopPage';

const AdminLayout = lazy(() => import('./layouts/AdminLayout').then(m => ({ default: m.AdminLayout })));

// Store Pages
const CustomerAccountDataPage = lazy(() => import('./pages/store/area-cliente/CustomerAccountDataPage').then(m => ({ default: m.CustomerAccountDataPage })));
const CustomerOrdersPage = lazy(() => import('./pages/store/area-cliente/CustomerOrdersPage').then(m => ({ default: m.CustomerOrdersPage })));
const CustomerAddressesPage = lazy(() => import('./pages/store/area-cliente/CustomerAddressesPage').then(m => ({ default: m.CustomerAddressesPage })));
const CustomerFavoritesPage = lazy(() => import('./pages/store/area-cliente/CustomerFavoritesPage').then(m => ({ default: m.CustomerFavoritesPage })));
const CustomerLoyaltyPage = lazy(() => import('./pages/store/area-cliente/CustomerLoyaltyPage').then(m => ({ default: m.CustomerLoyaltyPage })));
const CustomerReviewsPage = lazy(() => import('./pages/store/area-cliente/CustomerReviewsPage').then(m => ({ default: m.CustomerReviewsPage })));
const CustomerNotificationsPage = lazy(() => import('./pages/store/area-cliente/CustomerNotificationsPage').then(m => ({ default: m.CustomerNotificationsPage })));
const CustomerSupportPage = lazy(() => import('./pages/store/area-cliente/CustomerSupportPage').then(m => ({ default: m.CustomerSupportPage })));
const CustomerChangePasswordPage = lazy(() => import('./pages/store/area-cliente/CustomerChangePasswordPage').then(m => ({ default: m.CustomerChangePasswordPage })));

const PrivacyPolicyPage = lazy(() => import('./pages/store/PrivacyPolicyPage'));
const AboutUsPage = lazy(() => import('./pages/store/AboutUsPage'));
const ExchangePolicyPage = lazy(() => import('./pages/store/ExchangePolicyPage'));
const LGPDPage = lazy(() => import('./pages/store/LGPDPage'));
const DiscreetDeliveryPage = lazy(() => import('./pages/store/DiscreetDeliveryPage'));
const ContactPage = lazy(() => import('./pages/store/ContactPage'));
const AffiliateLandingPage = lazy(() => import('./modules/afiliados/pages/AffiliateLandingPage').then(m => ({ default: m.AffiliateLandingPage })));
const AdminAffiliates = lazy(() => import('./modules/afiliados/pages/AdminAffiliates').then(m => ({ default: m.AdminAffiliates })));

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
const AdminCustomerNotifications = lazy(() => import('./pages/admin/AdminCustomerNotifications').then(m => ({ default: m.AdminCustomerNotifications })));
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
const AdminPrinterConfig = lazy(() => import('./pages/admin/AdminPrinterConfig').then(m => ({ default: m.AdminPrinterConfig })));
const AdminLiveShop = lazy(() => import('./pages/admin/marketing/AdminLiveShop').then(m => ({ default: m.AdminLiveShop })));
const AdminStoryShopManager = lazy(() => import('./pages/admin/marketing/AdminStoryShopManager').then(m => ({ default: m.AdminStoryShopManager })));
const AdminWifiUsers = lazy(() => import('./pages/admin/marketing/AdminWifiUsers'));

// Public Blog Pages
const BlogPage = lazy(() => import('./pages/store/blog/BlogPage').then(m => ({ default: m.BlogPage })));
const BlogCategoryPage = lazy(() => import('./pages/store/blog/BlogCategoryPage').then(m => ({ default: m.BlogCategoryPage })));
const BlogArticlePage = lazy(() => import('./pages/store/blog/BlogArticlePage').then(m => ({ default: m.BlogArticlePage })));
const BlogClusterPage = lazy(() => import('./pages/store/blog/BlogClusterPage').then(m => ({ default: m.BlogClusterPage })));
const WebStoriesCatalog = lazy(() => import('./pages/store/blog/WebStoriesCatalog').then(m => ({ default: m.WebStoriesCatalog })));
const WebStoryViewer = lazy(() => import('./pages/store/blog/WebStoryViewer').then(m => ({ default: m.WebStoryViewer })));
const NewsletterPage = lazy(() => import('./pages/store/blog/NewsletterPage').then(m => ({ default: m.NewsletterPage })));

// Admin Blog Pages
const AdminBlogHub = lazy(() => import('./pages/admin/blog/AdminBlogHub').then(m => ({ default: m.AdminBlogHub })));
const AdminBlogNewsletter = lazy(() => import('./pages/admin/blog/AdminBlogNewsletter').then(m => ({ default: m.AdminBlogNewsletter })));
const AdminBlogAuthority = lazy(() => import('./pages/admin/blog/AdminBlogAuthority').then(m => ({ default: m.AdminBlogAuthority })));
const AdminBlogWebStories = lazy(() => import('./pages/admin/blog/AdminBlogWebStories').then(m => ({ default: m.AdminBlogWebStories })));
const AdminBlogWebStoriesStats = lazy(() => import('./pages/admin/blog/AdminBlogWebStoriesStats').then(m => ({ default: m.AdminBlogWebStoriesStats })));
const AdminBlogEditor = lazy(() => import('./pages/admin/blog/AdminBlogEditor').then(m => ({ default: m.AdminBlogEditor })));
const AdminBlogAI = lazy(() => import('./pages/admin/blog/AdminBlogAI').then(m => ({ default: m.AdminBlogAI })));
const AdminBlogCategories = lazy(() => import('./pages/admin/blog/AdminBlogCategories').then(m => ({ default: m.AdminBlogCategories })));
const AdminBlogIntelligence = lazy(() => import('./pages/admin/blog/AdminBlogIntelligence').then(m => ({ default: m.AdminBlogIntelligence })));
const AdminBlogSettings = lazy(() => import('./pages/admin/blog/AdminBlogSettings').then(m => ({ default: m.AdminBlogSettings })));
const AdminBlogSEO = lazy(() => import('./pages/admin/blog/AdminBlogSEO').then(m => ({ default: m.AdminBlogSEO })));
const AdminBlogComments = lazy(() => import('./pages/admin/blog/AdminBlogComments').then(m => ({ default: m.AdminBlogComments })));
const AdminBlogStats = lazy(() => import('./pages/admin/blog/AdminBlogStats').then(m => ({ default: m.AdminBlogStats })));
const AdminBlogClusters = lazy(() => import('./pages/admin/blog/AdminBlogClusters').then(m => ({ default: m.AdminBlogClusters })));

// Loading Component (Splash Screen)
function PageLoader() {
  const settings = useSettings();
  console.log('Renderizando componente: PageLoader');
  
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
  const checkAuth = useAuthStore(s => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    cacheService.validateCache();
  }, []);

  useEffect(() => {
    // Only track storefront visitors (exclude analytics inside admin panel)
    if (location.pathname.startsWith('/admin')) return;

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
            <Route path="/categoria/:slug" element={<CatalogPage />} />
            
            {/* Protected Customer Routes */}
            <Route element={<AreaClienteLayout />}>
              <Route path="/area-cliente" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/dados" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/pedidos" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/enderecos" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/favoritos" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/fidelidade" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/avaliacoes" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/notificacoes" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/suporte" element={<CustomerAreaPage />} />
              <Route path="/area-cliente/alterar-senha" element={<CustomerAreaPage />} />
            </Route>

            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<CadastroPage />} />
            <Route path="/ativar-conta" element={<AtivacaoContaPage />} />
            <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
            <Route path="/quem-somos" element={<AboutUsPage />} />
            <Route path="/politica-de-troca" element={<ExchangePolicyPage />} />
            <Route path="/trocas-e-devolucoes" element={<ExchangePolicyPage />} />
            <Route path="/entrega-discreta" element={<DiscreetDeliveryPage />} />
            <Route path="/contato" element={<ContactPage />} />
            <Route path="/lgpd" element={<LGPDPage />} />
            <Route path="/carrinho" element={<CartPage />} />
            <Route path="/produto/:slug" element={<ProductPage />} />
            <Route path="/sucesso" element={<SuccessPage />} />
            <Route path="/checkout-pix" element={<CheckoutPixPage />} />
            <Route path="/afiliados" element={<AffiliateLandingPage />} />
            <Route path="/live" element={<LiveShopPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/categoria/:slug" element={<BlogCategoryPage />} />
            <Route path="/blog/:slug" element={<BlogArticlePage />} />
            <Route path="/blog/guia/:clusterSlug" element={<BlogClusterPage />} />
            <Route path="/stories" element={<WebStoriesCatalog />} />
            <Route path="/story/:slug" element={<WebStoryViewer />} />
            <Route path="/newsletter" element={<NewsletterPage />} />
          </Route>

          {/* Standalone public Wi-Fi Hotspot portal page */}
          <Route path="/wifi" element={<WifiHotspotPage />} />

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
            <Route path="marketing/story-shop" element={<AdminStoryShopManager />} />
            <Route path="live-shop" element={<AdminLiveShop />} />
            <Route path="marketing/banners" element={<AdminBanners />} />
            <Route path="marketing/popups" element={<AdminPopups />} />
            <Route path="marketing/cupons" element={<AdminCoupons />} />
            <Route path="marketing/promocoes" element={<AdminPromotions />} />
            <Route path="marketing/postagem" element={<AdminPostagem />} />
            <Route path="marketing/wifi-users" element={<AdminWifiUsers />} />
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
            <Route path="config/impressao" element={<AdminPrinterConfig />} />
            <Route path="config/notificacoes" element={<AdminCustomerNotifications />} />

            {/* Admin Blog Routes */}
            <Route path="blog" element={<AdminBlogHub />} />
            <Route path="blog/autoridade" element={<AdminBlogAuthority />} />
            <Route path="blog/inteligencia" element={<AdminBlogIntelligence />} />
            <Route path="blog/novo" element={<AdminBlogEditor />} />
            <Route path="blog/editar/:id" element={<AdminBlogEditor />} />
            <Route path="blog/ia" element={<AdminBlogAI />} />
            <Route path="blog/categorias" element={<AdminBlogCategories />} />
            <Route path="blog/configuracoes" element={<AdminBlogSettings />} />
            <Route path="blog/seo" element={<AdminBlogSEO />} />
            <Route path="blog/comentarios" element={<AdminBlogComments />} />
            <Route path="blog/estatisticas" element={<AdminBlogStats />} />
            <Route path="blog/clusters" element={<AdminBlogClusters />} />
            <Route path="blog/clusters/novo" element={<AdminBlogClusters />} />
            <Route path="blog/clusters/editar/:id" element={<AdminBlogClusters />} />
            <Route path="blog/web-stories" element={<AdminBlogWebStories />} />
            <Route path="blog/web-stories/estatisticas" element={<AdminBlogWebStoriesStats />} />
            <Route path="blog/newsletter" element={<AdminBlogNewsletter />} />
            <Route path="blog/rascunhos" element={<AdminBlogHub initialTab="rascunhos" />} />
            <Route path="blog/lixeira" element={<AdminBlogHub initialTab="lixeira" />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  useEffect(() => {
    // -------------------------------------------------------------------------
    // BOOTSTRAP PROGRESS TRACKER & DEVELOPMENT STATUS INDICATORS
    // -------------------------------------------------------------------------
    if (import.meta.env.DEV) {
      console.log("[Discreta Boot] 🚀 Starting application bootstrap sequence...");
      console.log("[Discreta Boot] 📦 Mount progress: 10% - React Shell Rendered.");
      console.log("[Discreta Boot] 🛠️ Mount progress: 40% - Core contexts settings initialization started.");
      console.log("[Discreta Boot] 🎨 Mount progress: 70% - Dynamic theme properties compiling.");
      console.log("[Discreta Boot] 📝 Mount progress: 90% - Typography context checking loaded fonts.");
      console.log("[Discreta Boot] ✅ Mount progress: 100% - Ready for final paint.");
    }

    const staticSplash = document.getElementById('initial-splash');
    
    // Safety fallback release if splash didn't unmount yet (React lifecycle safety timeout)
    const safetyRelease = setTimeout(() => {
      const splashExists = document.getElementById('initial-splash');
      if (splashExists) {
        if (import.meta.env.DEV) {
          console.warn("[Discreta Boot] ⚡ React-level safety timeout reached. Hiding static splash.");
        }
        splashExists.style.opacity = '0';
        setTimeout(() => {
          splashExists.remove();
          document.body.style.overflow = 'auto';
        }, 500);
      }
    }, 4500);

    // Initial rapid unmount for typical flawless rendering paths
    if (staticSplash) {
      if (import.meta.env.DEV) {
        console.log("[Discreta Boot] ✨ Static splash detected. Transitioning opacity...");
      }
      staticSplash.style.opacity = '0';
      const cleanupTimer = setTimeout(() => {
        staticSplash.remove();
        document.body.style.overflow = 'auto';
        if (import.meta.env.DEV) {
          console.log("[Discreta Boot] Validated: Static splash successfully unmounted. Content interactive.");
        }
      }, 500);
      return () => {
        clearTimeout(cleanupTimer);
        clearTimeout(safetyRelease);
      };
    } else {
      clearTimeout(safetyRelease);
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
