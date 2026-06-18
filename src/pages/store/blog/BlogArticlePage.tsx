import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "../../../contexts/ThemeContext";
import { 
  Calendar, 
  Clock, 
  ArrowLeft, 
  User, 
  Share2, 
  Check, 
  MessageSquare, 
  Send, 
  AlertCircle,
  ShoppingBag,
  HelpCircle,
  Eye,
  Video,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { blogService, BlogPost, BlogComment, BlogContentBlock } from "../../../services/blogService";
import { productService, Product } from "../../../services/productService";

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

export function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { currentTheme } = useTheme();
  const bgText = currentTheme.backgroundTextColor || getContrastColor(currentTheme.backgroundColor);
  const isBgDark = bgText === '#ffffff';
  const subtitleColor = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.6)';
  const descColor = isBgDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(9, 9, 11, 0.85)';
  const cardColorBg = currentTheme.cardColor || (isBgDark ? 'rgba(24, 24, 27, 0.5)' : 'rgba(244, 244, 245, 0.5)');
  const borderColorHex = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.08)';

  const [post, setPost] = useState<BlogPost | null>(null);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [cluster, setCluster] = useState<any>(null);
  const [clusterPosts, setClusterPosts] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  
  // Interactive FAQ Toggle states
  const [openFaqIndex, setOpenFaqIndex] = useState<Record<number, boolean>>({});

  // Comment Form State
  const [commentName, setCommentName] = useState("");
  const [commentEmail, setCommentEmail] = useState("");
  const [commentContent, setCommentContent] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentSuccess, setCommentSuccess] = useState(false);
  const [commentError, setCommentError] = useState("");

  useEffect(() => {
    async function fetchStoreDetails() {
      try {
        const prodList = await productService.listProducts();
        // Filter active products
        setStoreProducts(prodList.filter(p => p.active !== false));
      } catch (err) {
        console.error("Erro ao listar catálogo para o blog:", err);
      }
    }
    fetchStoreDetails();
  }, []);

  useEffect(() => {
    async function fetchArticle() {
      if (!slug) return;
      setLoading(true);
      try {
        const article = await blogService.getPostBySlug(slug);
        if (article && article.id) {
          setPost(article);
          // Increment views in Firestore in background
          blogService.incrementPostViews(article.id);
          // Log access statistics
          blogService.logStat(article.id, article.title, 'view', 'direct');
          
          // Load comments
          const articleComments = await blogService.listComments(article.id);
          // Filter to show only approved comments on public site
          setComments(articleComments.filter(c => c.status === 'approved'));

          // Load cluster SEO if any
          if (article.clusterId) {
            const clusterData = await blogService.getCluster(article.clusterId);
            if (clusterData) {
              setCluster(clusterData);
              const postsList = await blogService.listPosts(true) || [];
              setAllPosts(postsList);
              const associatedIds = [...(clusterData.pillarPostId ? [clusterData.pillarPostId] : []), ...(clusterData.clusterPostIds || [])];
              const relatedClusterPosts = postsList.filter(p => p.id !== article.id && associatedIds.includes(p.id!));
              setClusterPosts(relatedClusterPosts);
            }
          } else {
            setCluster(null);
            setClusterPosts([]);
            setAllPosts([]);
          }
        }
      } catch (error) {
        console.error("Erro ao recuperar artigo:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchArticle();
  }, [slug]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    // Log share statistics
    if (post && post.id) {
      blogService.logStat(post.id, post.title, 'share', 'social');
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post?.id || !commentName.trim() || !commentEmail.trim() || !commentContent.trim()) {
      setCommentError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    setCommentSubmitting(true);
    setCommentError("");
    setCommentSuccess(false);

    try {
      await blogService.saveComment({
        postId: post.id,
        postTitle: post.title,
        authorName: commentName.trim(),
        authorEmail: commentEmail.trim(),
        content: commentContent.trim(),
        status: "pending" // Under moderation
      });
      setCommentSuccess(true);
      setCommentContent("");
    } catch (err: any) {
      console.error("Erro ao enviar comentário:", err);
      setCommentError("Erro ao enviar o comentário. Tente novamente mais tarde.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch {
      return "";
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Generate Google Rich Schema.org structures in JSON-LD (supports Article, Breadcrumb & FAQPage)
  const renderSchemas = () => {
    if (!post) return null;

    const domain = "https://discretaboutique.com.br";
    const postUrl = `${domain}/blog/${post.slug}`;

    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.summary || post.subtitle || "",
      "image": post.coverImage ? [post.coverImage] : [],
      "datePublished": post.publishedAt || post.createdAt || new Date().toISOString(),
      "dateModified": post.updatedAt || post.createdAt || new Date().toISOString(),
      "author": {
        "@type": "Organization",
        "name": "Discreta Boutique",
        "url": domain
      },
      "publisher": {
        "@type": "Organization",
        "name": "Discreta Boutique",
        "logo": {
          "@type": "ImageObject",
          "url": `${domain}/assets/logo.png`
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": postUrl
      }
    };

    const breadcrumbsSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": domain
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Blog",
          "item": `${domain}/blog`
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": post.title,
          "item": postUrl
        }
      ]
    };

    // Aggregate FAQ info
    const blocksFaq = post.contentBlocks?.filter(b => b.type === 'faq') || [];
    const seoFaq = post.seo?.faq || [];
    const faqList = [
      ...blocksFaq.map(b => ({ q: b.question || "", a: b.answer || "" })),
      ...seoFaq.map(f => ({ q: f.question, a: f.answer }))
    ].filter(f => f.q && f.a);

    let faqSchema = null;
    if (faqList.length > 0) {
      faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqList.map(item => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.a
          }
        }))
      };
    }

    return (
      <>
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbsSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </>
    );
  };

  const trackCtaClick = () => {
    if (post && post.id) {
      blogService.logStat(post.id, post.title, 'click');
    }
  };

  if (loading) {
    return (
      <div 
        className="flex-1 flex flex-col items-center justify-center min-h-screen"
        style={{ backgroundColor: currentTheme.backgroundColor }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-650 animate-spin mb-4" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 animate-pulse">Buscando artigo...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div 
        className="flex-1 py-32 px-4 text-center space-y-6"
        style={{
          backgroundColor: currentTheme.backgroundColor,
          color: bgText
        }}
      >
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Artigo Não Encontrado</h1>
        <p className="text-zinc-500 text-sm max-w-sm mx-auto">O post que você está procurando pode ter sido removido ou o endereço foi alterado.</p>
        <Link 
          to="/blog"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider underline hover:opacity-80 transition-opacity"
          style={{ color: currentTheme.primaryColor }}
        >
          <ArrowLeft size={14} /> Voltar para o Blog
        </Link>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 py-16 px-4 min-h-screen transition-all duration-300 font-sans"
      style={{
        backgroundColor: currentTheme.backgroundColor,
        color: bgText
      }}
    >
      {/* Inlining Search engine indexable rich microdata formats */}
      {renderSchemas()}

      <div className="max-w-4xl mx-auto space-y-10 text-left">
        {/* Back Link & Sharing triggers panel */}
        <div className="flex items-center justify-between">
          <Link 
            to="/blog"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ color: subtitleColor }}
          >
            <ArrowLeft size={14} /> Voltar para o Blog
          </Link>

          <button 
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border hover:bg-zinc-800/10 transition-colors"
            style={{ borderColor: borderColorHex }}
          >
            {copiedLink ? <Check size={12} className="text-emerald-500" /> : <Share2 size={12} />}
            {copiedLink ? "Link Copiado" : "Compartilhar"}
          </button>
        </div>

        {/* Featured Cover banner */}
        {post.coverImage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border"
            style={{ borderColor: borderColorHex }}
          >
            <img 
              src={post.coverImage} 
              alt={post.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}

        {/* Heading information metadata */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {formatDate(post.publishedAt || post.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {post.readingTime || 4} min de leitura
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Eye size={13} />
              {post.views || 0} visualizações
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none text-white">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="text-lg md:text-xl font-medium tracking-tight border-l-4 pl-4 border-red-650 leading-relaxed" style={{ color: subtitleColor }}>
              {post.subtitle}
            </p>
          )}
        </div>

        {/* Dynamic Blocks Rendering Engine */}
        {post.contentBlocks && post.contentBlocks.length > 0 ? (
          <div className="space-y-6 pt-4 border-b pb-12" style={{ borderColor: borderColorHex }}>
            {post.contentBlocks.map((block, bIdx) => {
              switch (block.type) {
                case 'paragraph':
                  // Wrap Markdown content renderer to allow formatting tags within block content safely!
                  return (
                    <div key={block.id || bIdx} className="text-zinc-300 leading-relaxed text-sm md:text-base whitespace-pre-wrap">
                      <ReactMarkdown
                        components={{
                          a: ({node, ...props}) => (
                            <a 
                              className="font-bold underline text-red-500 hover:text-red-400" 
                              referrerPolicy="no-referrer"
                              {...props} 
                            />
                          )
                        }}
                      >
                        {block.content || ""}
                      </ReactMarkdown>
                    </div>
                  );

                case 'heading':
                  if (block.level === 3) {
                    return (
                      <h3 key={block.id || bIdx} className="text-xl md:text-2xl font-black uppercase tracking-wider text-zinc-200 mt-8 mb-2">
                        {block.content}
                      </h3>
                    );
                  }
                  if (block.level === 4) {
                    return (
                      <h4 key={block.id || bIdx} className="text-base font-bold uppercase tracking-wider text-zinc-400 mt-6 mb-1">
                        {block.content}
                      </h4>
                    );
                  }
                  return (
                    <h2 key={block.id || bIdx} className="text-2xl md:text-3xl font-black uppercase italic tracking-tight text-white border-l-4 border-red-550 pl-3 mt-10 mb-4">
                      {block.content}
                    </h2>
                  );

                case 'image':
                  if (!block.url) return null;
                  return (
                    <figure key={block.id || bIdx} className="my-6 space-y-2">
                      <div className="rounded-2xl overflow-hidden border border-zinc-900 shadow-xl">
                        {/* Responsive resolution images with smart lazy load */}
                        <picture>
                          {block.versions?.mobile && <source media="(max-width: 768px)" srcSet={block.versions.mobile} />}
                          {block.versions?.desktop && <source media="(min-width: 769px)" srcSet={block.versions.desktop} />}
                          <img 
                            src={block.url} 
                            alt={block.alt || post.title} 
                            className="w-full object-cover max-h-[500px]" 
                            loading="lazy"
                          />
                        </picture>
                      </div>
                      {block.caption && (
                        <figcaption className="text-xs text-zinc-500 italic text-center font-sans">
                          {block.caption}
                        </figcaption>
                      )}
                    </figure>
                  );

                case 'quote':
                  return (
                    <blockquote key={block.id || bIdx} className="border-l-4 border-red-650 bg-zinc-90/20 p-5 rounded-r-2xl italic text-zinc-200 my-6 font-medium leading-relaxed">
                      <p>“{block.content || ""}”</p>
                      {block.alt && <cite className="block text-xs text-zinc-400 font-extrabold uppercase mt-2 font-mono">— {block.alt}</cite>}
                    </blockquote>
                  );

                case 'youtube':
                  if (!block.videoId) return null;
                  return (
                    <div key={block.id || bIdx} className="my-6 aspect-video rounded-2xl overflow-hidden border border-zinc-900 shadow-xl bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${block.videoId}`}
                        title="Youtube player"
                        className="w-full h-full border-0"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  );

                case 'table':
                  return (
                    <div key={block.id || bIdx} className="overflow-x-auto border border-zinc-900 rounded-2xl my-6 bg-zinc-950/20">
                      <table className="w-full text-left text-xs text-zinc-350">
                        <thead className="bg-zinc-900 text-[10px] font-black uppercase text-white border-b border-zinc-850">
                          <tr>
                            {(block.headers || []).map((header, idx) => (
                              <th key={idx} className="px-4 py-3 font-extrabold">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {(block.rows || []).map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-zinc-900/10">
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="px-4 py-2.5">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );

                case 'cta':
                  if (!block.url) return null;
                  return (
                    <div key={block.id || bIdx} className="my-6 text-center">
                      <a
                        href={block.url}
                        target={block.newTab ? "_blank" : "_self"}
                        rel="noopener noreferrer"
                        onClick={trackCtaClick}
                        className={`inline-flex items-center px-8 py-3.5 rounded-full text-xs font-black uppercase tracking-widest transition-transform hover:scale-[1.02] active:scale-95 ${
                          block.style === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]' :
                          block.style === 'secondary' ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' :
                          block.style === 'outline' ? 'bg-transparent hover:bg-zinc-900 text-white border border-zinc-700' :
                          'bg-red-650 hover:bg-red-550 text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)]'
                        }`}
                      >
                        {block.content || "Ver produto no WhatsApp"}
                      </a>
                    </div>
                  );

                case 'faq':
                  return (
                    <div 
                      key={block.id || bIdx} 
                      className="p-5 rounded-2xl border transition-all duration-300 my-4 bg-zinc-90/20"
                      style={{ borderColor: borderColorHex }}
                    >
                      <button 
                        onClick={() => toggleFaq(bIdx)}
                        className="w-full flex items-center justify-between text-left font-extrabold text-sm uppercase tracking-wide text-zinc-150 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <HelpCircle size={15} className="text-red-500" />
                          {block.question}
                        </span>
                        <ChevronDown 
                          size={15} 
                          className={`text-zinc-500 transition-transform duration-300 ${openFaqIndex[bIdx] ? "rotate-180" : ""}`} 
                        />
                      </button>
                      
                      <AnimatePresence>
                        {openFaqIndex[bIdx] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <p className="text-xs md:text-sm text-zinc-400 mt-3 whitespace-pre-wrap leading-relaxed">
                              {block.answer}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );

                case 'product_grid':
                  if (!block.productIds || block.productIds.length === 0) return null;
                  return (
                    <div key={block.id || bIdx} className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
                      {block.productIds.map((pId) => {
                        const product = storeProducts.find(p => p.id === pId);
                        if (!product) return null; // Safe fallback: don't break if removed
                        return (
                          <div 
                            key={pId} 
                            className="border border-zinc-900 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between group cursor-pointer duration-350 hover:scale-[1.02] hover:border-zinc-800"
                            style={{ backgroundColor: cardColorBg }}
                          >
                            {product.images?.[0]?.url && (
                              <div className="aspect-square w-full overflow-hidden bg-zinc-950">
                                <img 
                                  src={product.images[0].url} 
                                  alt={product.name} 
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                />
                              </div>
                            )}
                            <div className="p-3 space-y-2 text-center flex-1 flex flex-col justify-between">
                              <h5 className="text-[10px] font-black uppercase text-zinc-150 line-clamp-1">{product.name}</h5>
                              <p className="text-xs font-sans text-red-500 font-extrabold">R$ {product.price?.toFixed(2)}</p>
                              
                              <Link 
                                to={`/produto/${product.seo?.slug || pId}`}
                                onClick={trackCtaClick}
                                className="block w-full py-1.5 bg-zinc-900 border border-zinc-850 text-zinc-300 rounded-lg text-[8px] font-black uppercase hover:bg-zinc-850 hover:text-white transition-all tracking-wider"
                              >
                                Ver Detalhes
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );

                case 'bullet_list':
                  return (
                    <ul key={block.id || bIdx} className="list-disc pl-6 space-y-2 mb-6 text-zinc-300 text-sm md:text-base leading-relaxed">
                      {(block.items || []).map((item, idx) => (
                        <li key={idx}>
                          <ReactMarkdown components={{ a: ({node, ...props}) => <a className="text-red-500 hover:text-red-400 font-bold" {...props} /> }}>
                            {item}
                          </ReactMarkdown>
                        </li>
                      ))}
                    </ul>
                  );

                case 'numbered_list':
                  return (
                    <ol key={block.id || bIdx} className="list-decimal pl-6 space-y-2 mb-6 text-zinc-300 text-sm md:text-base leading-relaxed">
                      {(block.items || []).map((item, idx) => (
                        <li key={idx}>
                          <ReactMarkdown components={{ a: ({node, ...props}) => <a className="text-red-500 hover:text-red-400 font-bold" {...props} /> }}>
                            {item}
                          </ReactMarkdown>
                        </li>
                      ))}
                    </ol>
                  );

                case 'callout':
                  return (
                    <div 
                      key={block.id || bIdx} 
                      className={`p-5 rounded-r-2xl border-l-4 my-6 ${
                        block.style === 'warning' ? 'bg-amber-950/20 border-amber-500/40 text-amber-300' :
                        block.style === 'tip' ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' :
                        'bg-zinc-900 border-zinc-700 text-zinc-200'
                      }`}
                    >
                      <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{block.content}</p>
                    </div>
                  );

                case 'divider':
                  return <hr key={block.id || bIdx} className="border-t my-8 opacity-10" style={{ borderColor: bgText }} />;

                case 'conclusion':
                  return (
                    <div key={block.id || bIdx} className="p-6 rounded-2xl border border-dashed my-8 bg-zinc-90/25" style={{ borderColor: borderColorHex }}>
                      <h4 className="text-xs uppercase font-extrabold text-white tracking-widest mb-2 flex items-center gap-1.5">
                        <Check size={14} className="text-emerald-500" /> Considerações Finais
                      </h4>
                      <p className="text-zinc-300 text-sm md:text-base leading-relaxed whitespace-pre-wrap">{block.content}</p>
                    </div>
                  );

                default:
                  return null;
              }
            })}
          </div>
        ) : (
          /* Backward compatible legacy loader using ReactMarkdown (Phase 1) */
          <div 
            className="prose prose-invert prose-red max-w-none text-sm md:text-base leading-relaxed space-y-6 pt-4 border-b pb-12"
            style={{ borderColor: borderColorHex }}
          >
            <ReactMarkdown
              components={{
                h2: ({node, ...props}) => <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight mt-10 mb-4 text-zinc-100" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-xl font-bold uppercase tracking-wider mt-8 mb-2 text-zinc-200" {...props} />,
                p: ({node, ...props}) => <p className="mb-6 text-zinc-300 leading-relaxed font-normal" style={{ color: descColor }} {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-6 space-y-2 mb-6" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-6 space-y-2 mb-6" {...props} />,
                li: ({node, ...props}) => <li className="text-zinc-300" style={{ color: descColor }} {...props} />,
                a: ({node, ...props}) => (
                  <a 
                    className="font-bold underline hover:opacity-80 transition-opacity" 
                    style={{ color: currentTheme.primaryColor }} 
                    referrerPolicy="no-referrer"
                    {...props} 
                  />
                )
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Legacy static SEO FAQ section visually */}
        {(!post.contentBlocks || post.contentBlocks.length === 0) && post.seo?.faq && post.seo.faq.length > 0 && (
          <section className="space-y-6 pt-4">
            <h3 className="text-2xl font-black uppercase italic tracking-tight text-white">Dúvidas Frequentes</h3>
            <div className="space-y-4">
              {post.seo.faq.map((f, idx) => (
                <div 
                  key={idx} 
                  className="p-5 rounded-2xl border bg-zinc-90/20" 
                  style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
                >
                  <h4 className="font-extrabold text-sm uppercase tracking-wide mb-2 text-zinc-155">{f.question}</h4>
                  <p className="text-xs md:text-sm leading-relaxed" style={{ color: descColor }}>{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Legacy static Related recommended products list */}
        {(!post.contentBlocks || post.contentBlocks.length === 0) && post.relatedProducts && post.relatedProducts.length > 0 && (
          <section className="pt-6 space-y-6 border-b pb-8" style={{ borderColor: borderColorHex }}>
            <h3 className="text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
              <ShoppingBag size={20} style={{ color: currentTheme.primaryColor }} />
              Produtos Recomendados
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {post.relatedProducts.map((pName, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-xl border flex items-center justify-between hover:bg-zinc-850/20 transition-all cursor-pointer bg-zinc-90/20"
                  style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
                >
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-tight text-zinc-200">{pName}</h4>
                    <span className="text-[10px] uppercase font-black tracking-wider text-red-500">Conferir na loja</span>
                  </div>
                  <Link 
                    to="/catalogo" 
                    onClick={trackCtaClick}
                    className="p-2 bg-red-650/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all border border-red-505/10"
                  >
                    <ShoppingBag size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SEO Cluster Link Wheel Hub & Structured Metadata */}
        {cluster && (
          <section className="p-6 md:p-8 rounded-3xl border space-y-6 text-left" style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: borderColorHex }}>
              <div>
                <span className="text-[10px] font-black uppercase text-purple-500 tracking-widest block font-mono">Trilha de Leitura Recomendada</span>
                <h3 className="text-xl font-black uppercase italic tracking-tight text-white mt-1">
                  {cluster.title}
                </h3>
              </div>
              {cluster.mainKeyword && (
                <div className="bg-purple-950/40 border border-purple-800/30 text-purple-300 font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-full">
                  Foco: {cluster.mainKeyword}
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {cluster.description || `Este artigo faz parte do nosso guia especial para esclarecer dúvidas e potencializar sua experiência íntima com curadoria inteligente da Discreta Boutique em Icó.`}
            </p>

            {/* Trilha de artigos associados */}
            <div className="space-y-4">
              <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400 block">Artigos nesta Trilha:</span>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Pillar link first if it's NOT the active post */}
                {post.clusterType !== 'pillar' && cluster.pillarPostId && (
                  <Link
                    to={`/blog/${allPosts.find(p => p.id === cluster.pillarPostId)?.seo?.slug || ''}`}
                    className="p-4 bg-gradient-to-r from-purple-950/20 to-indigo-950/20 border border-purple-900/30 rounded-2xl hover:brightness-110 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-[9px] font-black uppercase text-emerald-450 tracking-wider flex items-center gap-1">
                        <Sparkles size={11} className="animate-pulse" /> Artigo Principal (Guia)
                      </span>
                      <p className="text-xs font-bold text-zinc-100 line-clamp-1 mt-1 group-hover:text-purple-300 transition-colors">
                        {allPosts.find(p => p.id === cluster.pillarPostId)?.title || 'Guia Completo Principal'}
                      </p>
                    </div>
                    <ChevronUp size={15} className="text-emerald-400 animate-bounce ml-2" />
                  </Link>
                )}

                {/* Satellite cluster links */}
                {clusterPosts.map((colPost) => (
                  <Link
                    key={colPost.id}
                    to={`/blog/${colPost.seo?.slug}`}
                    className="p-4 bg-zinc-950/50 border border-zinc-900 rounded-2xl hover:bg-zinc-900/40 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-[9px] font-bold text-zinc-500 uppercase">Artigo Complementar</span>
                      <p className="text-xs font-semibold text-zinc-350 line-clamp-1 mt-1 group-hover:text-white transition-colors">
                        {colPost.title}
                      </p>
                    </div>
                    <ExternalLink size={13} className="text-zinc-650 group-hover:text-purple-400 transition-all ml-2" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Strategic Product suggestions mapping directly from the query lookup */}
            {cluster.relatedProductIds && cluster.relatedProductIds.length > 0 && (
              <div className="pt-5 space-y-4" style={{ borderTop: `1px solid ${borderColorHex}` }}>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                  <ShoppingBag size={13} className="text-purple-500" /> Indicações da nossa Loja Física & Online:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {cluster.relatedProductIds.slice(0, 4).map((pId: string) => {
                    const productObj = storeProducts.find(p => p.id === pId);
                    if (!productObj) return null;
                    return (
                      <Link
                        key={pId}
                        to={`/produto/${productObj.seo?.slug || pId}`}
                        className="p-2.5 border border-zinc-900/60 rounded-2xl bg-zinc-950/30 hover:scale-[1.02] hover:border-zinc-805 hover:bg-zinc-950/80 transition-all text-center flex flex-col justify-between group"
                      >
                        {productObj.images?.[0]?.url && (
                          <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-zinc-950">
                            <img src={productObj.images[0].url} alt={productObj.name} className="w-full h-full object-cover group-hover:scale-105 duration-300" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        <h5 className="text-[10px] font-bold text-zinc-200 uppercase line-clamp-1">{productObj.name}</h5>
                        <p className="text-[10px] text-red-500 font-extrabold mt-1">R$ {productObj.price?.toFixed(2)}</p>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Embedded Rich Metadata BreadcrumbList JSON-LD Schema */}
            <script type="application/ld+json">
              {JSON.stringify({
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": `Guia de Conteúdos: ${cluster.title}`,
                "description": cluster.description,
                "url": `${window.location.origin}/blog/guia/${cluster.slug}`,
                "mainEntity": {
                  "@type": "ItemList",
                  "itemListElement": [
                    ...(cluster.pillarPostId ? [{
                      "@type": "ListItem",
                      "position": 1,
                      "url": `${window.location.origin}/blog/${allPosts.find(p => p.id === cluster.pillarPostId)?.seo?.slug || ''}`,
                      "name": allPosts.find(p => p.id === cluster.pillarPostId)?.title || "Artigo Pilar"
                    }] : []),
                    ...clusterPosts.map((p, idx) => ({
                      "@type": "ListItem",
                      "position": idx + (cluster.pillarPostId ? 2 : 1),
                      "url": `${window.location.origin}/blog/${p.seo?.slug}`,
                      "name": p.title
                    }))
                  ]
                }
              })}
            </script>
          </section>
        )}

        {/* Article Comments System */}
        <section className="space-y-8 pt-4">
          <h3 className="text-2xl font-black uppercase italic tracking-tight text-white flex items-center gap-2">
            <MessageSquare size={22} style={{ color: currentTheme.primaryColor }} />
            Comentários {comments.length > 0 && `(${comments.length})`}
          </h3>

          {/* Comment input form */}
          <div 
            className="p-6 md:p-8 rounded-3xl border space-y-6"
            style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
          >
            <h4 className="font-black text-sm uppercase tracking-wider">Deixe seu comentário</h4>
            <p className="text-xs text-zinc-500">Seu e-mail não será publicado. Todos os comentários passam por moderação prévia para sua segurança.</p>
            
            <form onSubmit={handleCommentSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Seu Nome *</label>
                  <input
                    type="text"
                    required
                    value={commentName}
                    onChange={(e) => setCommentName(e.target.value)}
                    placeholder="Ex: Clara Silva"
                    className="w-full px-4 py-2 border rounded-full text-xs font-semibold bg-transparent focus:outline-none focus:ring-1"
                    style={{ borderColor: borderColorHex, color: bgText, '--tw-ring-color': currentTheme.primaryColor } as any}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Seu E-mail *</label>
                  <input
                    type="email"
                    required
                    value={commentEmail}
                    onChange={(e) => setCommentEmail(e.target.value)}
                    placeholder="Ex: clara@email.com"
                    className="w-full px-4 py-2 border rounded-full text-xs font-semibold bg-transparent focus:outline-none focus:ring-1"
                    style={{ borderColor: borderColorHex, color: bgText, '--tw-ring-color': currentTheme.primaryColor } as any}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Comentário *</label>
                <textarea
                  required
                  rows={4}
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  placeholder="Escreva sua opinião, dúvida ou sugestão de forma totalmente segura..."
                  className="w-full px-4 py-3 border rounded-2xl text-xs font-semibold bg-transparent focus:outline-none focus:ring-1"
                  style={{ borderColor: borderColorHex, color: bgText, '--tw-ring-color': currentTheme.primaryColor } as any}
                />
              </div>

              <AnimatePresence mode="wait">
                {commentSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs rounded-xl flex items-center gap-2"
                  >
                    <Check size={14} />
                    Comentário enviado! Ele aparecerá aqui após ser moderado.
                  </motion.div>
                )}

                {commentError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2"
                  >
                    <AlertCircle size={14} />
                    {commentError}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={commentSubmitting}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: currentTheme.primaryColor,
                  color: getContrastColor(currentTheme.primaryColor)
                }}
              >
                {commentSubmitting ? "Enviando..." : "Enviar Comentário"}
                <Send size={12} />
              </button>
            </form>
          </div>

          {/* Comment list display */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-zinc-500 text-xs text-center border border-dashed rounded-3xl py-8" style={{ borderColor: borderColorHex }}>
                Seja a primeira pessoa a comentar este artigo!
              </p>
            ) : (
              comments.map((comm) => (
                <div 
                  key={comm.id}
                  className="p-5 rounded-2xl border flex gap-4"
                  style={{ borderColor: borderColorHex, backgroundColor: cardColorBg }}
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-red-500 font-extrabold uppercase text-[10px]">
                    {comm.authorName.charAt(0)}
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider">{comm.authorName}</h4>
                      <span className="text-[9px] text-zinc-500">{formatDate(comm.createdAt)}</span>
                    </div>
                    <p className="text-xs md:text-sm leading-relaxed" style={{ color: descColor }}>{comm.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
