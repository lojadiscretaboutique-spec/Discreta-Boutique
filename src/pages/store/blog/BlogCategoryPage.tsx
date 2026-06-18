import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "../../../contexts/ThemeContext";
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  BookOpen, 
  ChevronRight, 
  Tag, 
  Heart,
  Flame,
  Gift,
  Sparkles,
  Calendar as CalendarIcon,
  Compass,
  Award,
  MapPin,
  Folder
} from "lucide-react";
import { blogService, BlogPost, BlogCategory } from "../../../services/blogService";

// Helper to resolve contrast background
function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

const PRESET_ICONS: Record<string, any> = {
  Heart: Heart,
  Flame: Flame,
  Feather: Tag, // fallback representation
  Gift: Gift,
  Sparkles: Sparkles,
  Calendar: CalendarIcon,
  Compass: Compass,
  Award: Award,
  MapPin: MapPin,
  Folder: Folder
};

export function BlogCategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { currentTheme } = useTheme();
  
  const bgText = currentTheme.backgroundTextColor || getContrastColor(currentTheme.backgroundColor);
  const isBgDark = bgText === '#ffffff';
  const subtitleColor = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.6)';
  const descColor = isBgDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(9, 9, 11, 0.85)';
  const cardColorBg = currentTheme.cardColor || (isBgDark ? 'rgba(24, 24, 27, 0.5)' : 'rgba(244, 244, 245, 0.5)');
  const borderColorHex = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.08)';

  const [category, setCategory] = useState<BlogCategory | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategoryData() {
      if (!slug) return;
      setLoading(true);
      try {
        const allCats = await blogService.listCategories();
        setCategories(allCats);

        const currentCat = allCats.find(c => c.slug === slug);
        if (currentCat) {
          setCategory(currentCat);
          
          // Log category landing page view statistics
          blogService.logStat(currentCat.id, currentCat.name, 'view', 'direct');

          // Query posts belonging to this category
          const allPosts = await blogService.listPosts();
          const filtered = allPosts.filter(p => p.categoryId === currentCat.id);
          setPosts(filtered);
        } else {
          setCategory(null);
        }
      } catch (err) {
        console.error("Erro ao carregar dados da categoria do blog:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCategoryData();
  }, [slug]);

  // Inject beautiful dynamic SEO tags
  useEffect(() => {
    if (!category) return;

    const title = category.seoTitle || `${category.name} | Blog Discreta Boutique`;
    document.title = title;

    const setMetaTag = (attrName: string, attrVal: string, content: string) => {
      let element = document.querySelector(`meta[${attrName}="${attrVal}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrVal);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    // Standard Metas
    setMetaTag('name', 'description', category.seoDescription || category.shortDescription || category.description || "");
    setMetaTag('name', 'keywords', category.keywords || "");

    // Open Graph Facebook/WhatsApp 
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', category.seoDescription || category.shortDescription || "");
    setMetaTag('property', 'og:image', category.coverImage || "https://discretaboutique.com.br/default-share.jpg");
    setMetaTag('property', 'og:url', window.location.href);
    setMetaTag('property', 'og:type', 'website');

    // Twitter Cards
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', category.seoDescription || category.shortDescription || "");
    setMetaTag('name', 'twitter:image', category.coverImage || "https://discretaboutique.com.br/default-share.jpg");

    // Canonical Link
    setLinkTag('canonical', window.location.href);

    // Schema.org structured JSON-LD scripts (BreadcrumbList & CollectionPage)
    let schemaScript = document.getElementById('category-seo-schema') as HTMLScriptElement;
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.id = 'category-seo-schema';
      schemaScript.type = 'application/ld+json';
      document.head.appendChild(schemaScript);
    }

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": window.location.origin
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Blog",
          "item": `${window.location.origin}/blog`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": category.name,
          "item": window.location.href
        }
      ]
    };

    const collectionSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": category.name,
      "description": category.seoDescription || category.shortDescription || category.description || "",
      "url": window.location.href,
      "about": {
        "@type": "Thing",
        "name": category.name,
        "description": category.shortDescription || ""
      }
    };

    schemaScript.text = JSON.stringify([breadcrumbSchema, collectionSchema]);

    return () => {
      // Clean up script on page unmount
      schemaScript?.remove();
    };
  }, [category]);

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div 
        className="text-center py-32 flex flex-col items-center justify-center min-h-screen"
        style={{ backgroundColor: currentTheme.backgroundColor, color: bgText }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-red-650 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 mt-4 animate-pulse">
          Buscando silo de artigos...
        </p>
      </div>
    );
  }

  if (!category) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center text-center p-6 space-y-6"
        style={{ backgroundColor: currentTheme.backgroundColor, color: bgText }}
      >
        <BookOpen size={48} className="text-zinc-700 animate-bounce" />
        <h1 className="text-2xl font-black uppercase tracking-tight">Silo Temático Não Encontrado</h1>
        <p className="text-sm max-w-sm text-zinc-500">
          A categoria que você tentou acessar não existe ou foi removida temporariamente do blog.
        </p>
        <Link 
          to="/blog"
          className="px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-650 text-white hover:bg-red-500 transition-all shadow-md"
        >
          Voltar ao Blog Geral
        </Link>
      </div>
    );
  }

  // Resolve defined icon
  const IconComp = PRESET_ICONS[category.icon || "Folder"] || Folder;
  const themeAccentColor = category.color || currentTheme.primaryColor;

  return (
    <div 
      className="flex-1 py-12 px-4 md:px-8 min-h-screen transition-all duration-300 font-sans"
      style={{
        backgroundColor: currentTheme.backgroundColor,
        color: bgText
      }}
    >
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Breadcrumb Navigation Trail */}
        <nav className="flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest" style={{ color: subtitleColor }}>
          <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
          <ChevronRight size={12} className="shrink-0" />
          <span className="text-zinc-500">Categorias</span>
          <ChevronRight size={12} className="shrink-0" />
          <span className="text-white font-black">{category.name}</span>
        </nav>

        {/* Hero Header Card with Background Layer */}
        <div 
          className="relative rounded-3xl overflow-hidden border p-8 md:p-16 flex flex-col justify-end min-h-[300px] md:min-h-[380px] shadow-2xl transition-all duration-300"
          style={{ borderColor: borderColorHex }}
        >
          {/* Cover image backdrop with premium overlay */}
          {category.coverImage ? (
            <>
              <img 
                src={category.coverImage} 
                alt={category.name} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/70 to-zinc-950/20" />
            </>
          ) : (
            <div 
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: `radial-gradient(circle, ${themeAccentColor} 1.5px, transparent 1.5px)`,
                backgroundSize: '24px 24px'
              }}
            />
          )}

          <div className="relative z-10 space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-950/80 backdrop-blur border border-white/5 shadow-lg">
              <span 
                className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
                style={{ backgroundColor: themeAccentColor }}
              />
              Silo Temático Autorizado
            </div>

            <h1 className="text-4xl md:text-6xl font-black uppercase italic text-white tracking-tighter leading-none flex items-center gap-3 flex-wrap">
              <span className="p-2 border rounded-xl flex items-center justify-center shrink-0" style={{ borderColor: `${themeAccentColor}40`, backgroundColor: `${themeAccentColor}15`, color: themeAccentColor }}>
                <IconComp size={32} />
              </span>
              {category.name}
            </h1>

            {category.shortDescription && (
              <p className="text-sm md:text-lg text-zinc-300 font-medium leading-relaxed max-w-2xl">
                {category.shortDescription}
              </p>
            )}
          </div>
        </div>

        {/* Grid split: Left Category Rich Content & Post listings, Right Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Main area (8 cols) */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Extended SEO Rich Category Text Section */}
            {category.description && (
              <div 
                className="p-6 md:p-8 rounded-2xl border"
                style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
              >
                <div className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase tracking-widest text-[#ec4899]">
                  <Sparkles size={12} className="animate-spin" />
                  Sobre esta categoria
                </div>
                {/* Visual rich text rendering */}
                <div className="prose prose-invert prose-xs max-w-none text-zinc-300 leading-relaxed space-y-3">
                  <ReactMarkdown>{category.description}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Posts Heading */}
            <div className="border-b pb-4 flex items-center justify-between" style={{ borderColor: borderColorHex }}>
              <h2 className="text-lg md:text-xl font-bold uppercase tracking-tight italic flex items-center gap-2">
                <BookOpen size={16} style={{ color: themeAccentColor }} />
                Artigos Recentes em {category.name}
              </h2>
              <span className="text-xs text-zinc-500 font-mono font-bold uppercase">
                {posts.length} {posts.length === 1 ? 'artigo' : 'artigos'}
              </span>
            </div>

            {/* Posts Grid Container */}
            {posts.length === 0 ? (
              <div className="text-center py-20 border border-dashed rounded-3xl p-6" style={{ borderColor: borderColorHex }}>
                <Folder size={32} className="mx-auto text-zinc-800 mb-3" />
                <p className="text-zinc-500 text-xs uppercase font-extrabold tracking-wider">Brevemente Novos Artigos</p>
                <p className="text-[11px] text-zinc-650 max-w-xs mx-auto mt-2">
                  Estamos produzindo pautas incríveis sobre este tema. Volte logo ou assine nossa newsletter para novidades!
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {posts.map((post) => (
                  <motion.article 
                    key={post.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex flex-col rounded-2xl overflow-hidden border group transition-all duration-300 hover:scale-[1.02]"
                    style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
                  >
                    <div className="relative aspect-video overflow-hidden">
                      {post.coverImage ? (
                        <img 
                          src={post.coverImage} 
                          alt={post.title} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-red-950/10 flex items-center justify-center">
                          <BookOpen size={30} className="text-red-950/35" />
                        </div>
                      )}
                    </div>

                    <div className="p-6 flex flex-col flex-1 space-y-4">
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {formatDate(post.publishedAt || post.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {post.readingTime || 4} min
                        </span>
                      </div>

                      <h3 className="text-lg font-bold uppercase tracking-tight italic line-clamp-2 leading-tight">
                        <Link to={`/blog/${post.slug}`} className="hover:opacity-80 transition-opacity">
                          {post.title}
                        </Link>
                      </h3>

                      <p className="text-xs leading-relaxed line-clamp-3" style={{ color: descColor }}>
                        {post.summary || post.subtitle}
                      </p>

                      <div className="pt-4 mt-auto">
                        <Link
                          to={`/blog/${post.slug}`}
                          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest hover:underline"
                          style={{ color: themeAccentColor }}
                        >
                          Ler mais
                        </Link>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Quick Back Button */}
            <Link 
              to="/blog"
              className="flex items-center justify-center gap-2 p-3 border border-zinc-800 bg-zinc-950 rounded-2xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-900 transition-all text-zinc-300 hover:text-white"
            >
              <ArrowLeft size={14} />
              Voltar ao Feed Central
            </Link>

            {/* Other categories */}
            <div 
              className="p-6 rounded-2xl border space-y-4"
              style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
            >
              <h4 className="text-xs font-black uppercase tracking-widest text-zinc-200 border-b pb-2" style={{ borderColor: borderColorHex }}>
                Outras Categorias
              </h4>
              <div className="flex flex-col gap-2">
                {categories
                  .filter(c => c.id !== category.id && c.status !== "oculta")
                  .map(cat => {
                    const CatIcon = PRESET_ICONS[cat.icon || "Folder"] || Folder;
                    const catColor = cat.color || "#64748b";
                    
                    return (
                      <Link 
                        key={cat.id}
                        to={`/blog/categoria/${cat.slug}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-zinc-800 hover:bg-zinc-950/45 transition-all text-zinc-400 hover:text-white"
                      >
                        <div 
                          className="p-1.5 rounded-lg flex items-center justify-center shrink-0"
                          style={{ 
                            borderColor: `${catColor}20`, 
                            backgroundColor: `${catColor}10`,
                            color: catColor
                          }}
                        >
                          <CatIcon size={12} />
                        </div>
                        <span className="text-xs font-extrabold">{cat.name}</span>
                      </Link>
                    );
                  })
                }
              </div>
            </div>

            {/* Newsletter or local brand reinforcement banner */}
            <div 
              className="p-6 rounded-2xl border text-center space-y-4 bg-gradient-to-br from-zinc-950/70 to-zinc-900/60"
              style={{ borderColor: borderColorHex }}
            >
              <Sparkles size={24} className="mx-auto text-pink-500 animate-pulse" />
              <h4 className="text-sm font-black uppercase tracking-wider text-white">
                Fique Sabendo Primeiro!
              </h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Inscreva seu e-mail gratuito em nosso boletim íntimo para receber dicas secretas e novidades sazonais em Icó!
              </p>
              <Link 
                to="/newsletter"
                className="inline-block w-full py-2 bg-pink-700 hover:bg-pink-600 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all"
              >
                Inscrever-se Grátis
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
