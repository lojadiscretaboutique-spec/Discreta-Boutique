import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useTheme } from "../../../contexts/ThemeContext";
import { Search, Calendar, Clock, ArrowRight, User, BookOpen, Tag } from "lucide-react";
import { blogService, BlogPost, BlogCategory } from "../../../services/blogService";

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

export function BlogPage() {
  const { currentTheme } = useTheme();
  const bgText = currentTheme.backgroundTextColor || getContrastColor(currentTheme.backgroundColor);
  const isBgDark = bgText === '#ffffff';
  const subtitleColor = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.6)';
  const descColor = isBgDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(9, 9, 11, 0.85)';
  const cardColorBg = currentTheme.cardColor || (isBgDark ? 'rgba(24, 24, 27, 0.5)' : 'rgba(244, 244, 245, 0.5)');
  const borderColorHex = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.08)';

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      try {
        const loadedPosts = await blogService.listPosts();
        const loadedCats = await blogService.listCategories();
        setPosts(loadedPosts);
        setCategories(loadedCats);
      } catch (error) {
        console.error("Erro ao carregar os dados do blog:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    // Log static general blog landing page view
    blogService.logStat(undefined, undefined, 'view', 'direct');
  }, []);

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (post.subtitle?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
                          (post.summary?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || post.categoryId === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const featuredPost = filteredPosts.find(p => p.featured) || (filteredPosts.length > 0 ? filteredPosts[0] : null);
  const regularPosts = featuredPost ? filteredPosts.filter(p => p.id !== featuredPost.id) : filteredPosts;

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

  return (
    <div 
      className="flex-1 py-20 px-4 min-h-screen transition-all duration-300"
      style={{
        backgroundColor: currentTheme.backgroundColor,
        color: bgText
      }}
    >
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-red-600/10 text-red-500 mb-2 border border-red-500/20"
          >
            <BookOpen size={12} />
            Universo Discreta
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-black uppercase tracking-tighter italic"
          >
            Nosso <span style={{ color: currentTheme.primaryColor }}>Blog</span>
          </motion.h1>
          <p 
            className="font-medium text-xs md:text-sm uppercase tracking-[0.25em]"
            style={{ color: subtitleColor }}
          >
            Sua dose semanal de intimidade, autoestima, sedução e bem-estar em Icó - CE.
          </p>
        </header>

        {/* Search & Category Filter Section */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center max-w-4xl mx-auto">
          {/* Search Input */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: subtitleColor }} />
            <input
              type="text"
              placeholder="Buscar artigos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-full text-xs font-semibold bg-transparent focus:outline-none focus:ring-1"
              style={{ 
                borderColor: borderColorHex, 
                color: bgText,
                '--tw-ring-color': currentTheme.primaryColor 
              } as any}
            />
          </div>

          {/* Category Badges */}
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border`}
              style={{
                borderColor: selectedCategory === "all" ? currentTheme.primaryColor : borderColorHex,
                backgroundColor: selectedCategory === "all" ? currentTheme.primaryColor : "transparent",
                color: selectedCategory === "all" ? getContrastColor(currentTheme.primaryColor) : bgText
              }}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id || "all")}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border`}
                style={{
                  borderColor: selectedCategory === cat.id ? currentTheme.primaryColor : borderColorHex,
                  backgroundColor: selectedCategory === cat.id ? currentTheme.primaryColor : "transparent",
                  color: selectedCategory === cat.id ? getContrastColor(currentTheme.primaryColor) : bgText
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Loading or Empty */}
        {loading ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-red-600 animate-spin mx-auto" />
            <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 animate-pulse">Carregando artigos...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-3xl" style={{ borderColor: borderColorHex }}>
            <p className="text-zinc-500 text-sm">Nenhum artigo encontrado. Tente ajustar seus termos de busca.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {/* Featured Post Highlight Card */}
            {featuredPost && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="grid md:grid-cols-2 gap-8 rounded-3xl overflow-hidden border"
                style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
              >
                <div className="relative aspect-video md:aspect-auto min-h-[300px]">
                  {featuredPost.coverImage ? (
                    <img 
                      src={featuredPost.coverImage} 
                      alt={featuredPost.title} 
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center">
                      <BookOpen size={48} className="text-red-950" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-600 text-white shadow-lg">
                    Destaque
                  </div>
                </div>

                <div className="p-8 md:p-12 flex flex-col justify-center space-y-6">
                  <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      {formatDate(featuredPost.publishedAt || featuredPost.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} />
                      {featuredPost.readingTime || 5} min
                    </span>
                  </div>

                  <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none">
                    {featuredPost.title}
                  </h2>

                  <p className="text-sm md:text-base leading-relaxed" style={{ color: descColor }}>
                    {featuredPost.summary || featuredPost.subtitle}
                  </p>

                  <div className="pt-4">
                    <Link
                      to={`/blog/${featuredPost.slug}`}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300"
                      style={{
                        backgroundColor: currentTheme.primaryColor,
                        color: getContrastColor(currentTheme.primaryColor)
                      }}
                    >
                      Ler Artigo Completo
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {/* General Posts Grid */}
            {regularPosts.length > 0 && (
              <div className="grid md:grid-cols-3 gap-8">
                {regularPosts.map((post, idx) => (
                  <motion.article 
                    key={post.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
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
                      {post.categoryId && (
                        <span className="absolute top-3 left-3 px-2 py-1 rounded bg-black/70 backdrop-blur-sm text-[8px] font-bold uppercase tracking-widest text-white border border-white/10">
                          {categories.find(c => c.id === post.categoryId)?.name || "Geral"}
                        </span>
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

                      <h3 className="text-xl font-bold uppercase tracking-tight italic line-clamp-2 leading-tight">
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
                          className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest group-hover:underline"
                          style={{ color: currentTheme.primaryColor }}
                        >
                          Ler mais
                          <ArrowRight size={10} className="transition-transform group-hover:translate-x-1" />
                        </Link>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer info/about the boutique blog (Local SEO) */}
        <section 
          className="p-8 md:p-12 rounded-3xl border text-center space-y-4 max-w-4xl mx-auto"
          style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
        >
          <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter italic">
            Discreta Boutique Icó-CE
          </h3>
          <p className="text-xs md:text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: descColor }}>
            Somos uma marca que nasceu com o propósito de libertar corpos, mentes e sentimentos. Mais do que lingeries exclusivas, oferecemos um canal seguro para sua autoestima. Todas as nossas compras acompanham embalagem externa sem nenhuma identificação, garantindo total privacidade em Icó-CE e região do Centro-Sul cearense. Aproveite a leitura e conecte-se com o seu prazer!
          </p>
        </section>
      </div>
    </div>
  );
}
