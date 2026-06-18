import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  BookOpen, 
  Clock, 
  Type, 
  Tags, 
  HelpCircle,
  Wand2,
  Heading,
  Video,
  Table as TableIcon,
  Link as LinkIcon,
  Quote,
  Minus,
  Info,
  ChevronUp,
  ChevronDown,
  Upload,
  Calendar,
  AlertCircle,
  FileText
} from "lucide-react";
import { blogService, BlogPost, BlogCategory, BlogContentBlock, BlogCluster } from "../../../services/blogService";
import { productService, Product } from "../../../services/productService";
import { uploadBlogImage } from "../../../utils/imageOptimizer";

export function AdminBlogEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Categories & Products
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  // Main Form fields
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [readingTime, setReadingTime] = useState(5);
  const [featured, setFeatured] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [publishedAt, setPublishedAt] = useState("");
  const [status, setStatus] = useState<'rascunho' | 'publicado' | 'agendado' | 'arquivado'>('rascunho');
  const [palavraChave, setPalavraChave] = useState("");
  
  // SEO Cluster parameters
  const [clusters, setClusters] = useState<BlogCluster[]>([]);
  const [clusterId, setClusterId] = useState("");
  const [clusterType, setClusterType] = useState<'pillar' | 'cluster'>('cluster');

  // Content Blocks
  const [contentBlocks, setContentBlocks] = useState<BlogContentBlock[]>([]);

  // States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewTab, setPreviewTab] = useState<'desktop' | 'mobile' | 'google' | 'social' | 'twitter'>('desktop');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Product Search state for block additions
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [activeProductBlockId, setActiveProductBlockId] = useState<string | null>(null);

  // Gemini AI controls
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiTema, setAiTema] = useState("");
  const [aiPublico, setAiPublico] = useState("");
  const [aiTomVoz, setAiTomVoz] = useState("Empoderado e Sensual");
  const [aiPalavras, setAiPalavras] = useState(500);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Auto-save logic
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedState = useRef<string>("");

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [cats, prods, loadedClusters] = await Promise.all([
          blogService.listCategories(),
          productService.listProducts(),
          blogService.listClusters()
        ]);
        setCategories(cats);
        setAllProducts(prods.filter(p => p.active !== false));
        setClusters(loadedClusters || []);
        if (cats.length > 0) setCategoryId(cats[0].id || "");

        if (id) {
          const post = await blogService.getPostById(id);
          if (post) {
            setTitle(post.title);
            setSubtitle(post.subtitle || "");
            setSlug(post.slug);
            setSummary(post.summary || "");
            setCoverImage(post.coverImage || "");
            setCoverImageAlt(post.seo?.ogImage || ""); // Map cover alt safely
            setCategoryId(post.categoryId || "");
            setTags(post.tags || []);
            setReadingTime(post.readingTime || 5);
            setFeatured(post.featured || false);
            setStatus(post.status || 'rascunho');
            setPalavraChave(post.seo?.keywords || "");
            setClusterId(post.clusterId || "");
            setClusterType(post.clusterType || 'cluster');
            
            if (post.status === 'agendado' && post.publishedAt) {
              setIsScheduled(true);
              const formattedDate = new Date(post.publishedAt).toISOString().slice(0, 16);
              setPublishedAt(formattedDate);
            } else if (post.publishedAt) {
              const formattedDate = new Date(post.publishedAt).toISOString().slice(0, 16);
              setPublishedAt(formattedDate);
            }

            // Load content blocks safely if present, or parse classic Markdown to block structure
            if (post.contentBlocks && post.contentBlocks.length > 0) {
              setContentBlocks(post.contentBlocks);
            } else if (post.content) {
              setContentBlocks(parseMarkdownToBlocks(post.content));
            } else {
              setContentBlocks([]);
            }
          }
        } else {
          // Initialize with a default paragraph block for clean UX
          setContentBlocks([
            { id: generateId(), type: 'paragraph', content: "" }
          ]);
        }
      } catch (err) {
        console.error("Erro ao iniciar editor:", err);
        showFeedback('error', "Erro ao iniciar o editor de artigos.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [id]);

  // Track field changes to mark form as dirty for autosave
  useEffect(() => {
    const currentStateString = JSON.stringify({
      title, subtitle, slug, summary, coverImage, coverImageAlt, categoryId, tags, status, publishedAt, contentBlocks, palavraChave, featured
    });
    if (lastSavedState.current && lastSavedState.current !== currentStateString) {
      setIsDirty(true);
    }
    if (!lastSavedState.current && title) {
      lastSavedState.current = currentStateString;
    }
  }, [title, subtitle, slug, summary, coverImage, coverImageAlt, categoryId, tags, status, publishedAt, contentBlocks, palavraChave, featured]);

  // Periodic Auto-save check (every 30 seconds)
  useEffect(() => {
    if (!isDirty || !title.trim() || !slug.trim()) return;

    const interval = setInterval(() => {
      handleAutoSave();
    }, 30000);

    return () => clearInterval(interval);
  }, [isDirty, title, slug, contentBlocks, summary, coverImage, coverImageAlt, categoryId, tags, status, publishedAt, palavraChave, featured]);

  // Auto-save on page exit
  useEffect(() => {
    const beforeUnloadListener = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        return (e.returnValue = 'Você tem alterações não salvas. Deseja mesmo sair?');
      }
    };
    window.addEventListener('beforeunload', beforeUnloadListener);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadListener);
    };
  }, [isDirty]);

  // Auto-generate safe unique IDs
  const generateId = () => {
    return 'block_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  };

  // Safe markdown to blocks converter (Phase 1 legacy compatibility)
  const parseMarkdownToBlocks = (md: string): BlogContentBlock[] => {
    if (!md.trim()) return [];
    const sections = md.split(/\n\n+/);
    const parsedBlocks: BlogContentBlock[] = [];

    sections.forEach((sect) => {
      const line = sect.trim();
      if (!line) return;

      // H2, H3, H4
      if (line.startsWith('#')) {
        const match = line.match(/^(#{2,4})\s+(.*)$/);
        if (match) {
          const level = match[1].length as 2 | 3 | 4;
          parsedBlocks.push({
            id: generateId(),
            type: 'heading',
            level,
            content: match[2]
          });
          return;
        }
      }

      // Quote
      if (line.startsWith('>')) {
        parsedBlocks.push({
          id: generateId(),
          type: 'quote',
          content: line.replace(/^>\s*/, '')
        });
        return;
      }

      // Bullet List
      if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        const items = line.split('\n').map(l => l.replace(/^[-*•]\s*/, ''));
        parsedBlocks.push({
          id: generateId(),
          type: 'bullet_list',
          items
        });
        return;
      }

      // Numbered List
      if (/^\d+\.\s+/.test(line)) {
        const items = line.split('\n').map(l => l.replace(/^\d+\.\s*/, ''));
        parsedBlocks.push({
          id: generateId(),
          type: 'numbered_list',
          items
        });
        return;
      }

      // YouTube Markdown
      if (line.includes('youtube.com') || line.includes('youtu.be')) {
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = line.match(ytRegex);
        if (match) {
          parsedBlocks.push({
            id: generateId(),
            type: 'youtube',
            videoId: match[1],
            url: line
          });
          return;
        }
      }

      // Markdown Image
      if (line.startsWith('![')) {
        const match = line.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) {
          parsedBlocks.push({
            id: generateId(),
            type: 'image',
            alt: match[1],
            url: match[2]
          });
          return;
        }
      }

      // Fallback Paragraph
      parsedBlocks.push({
        id: generateId(),
        type: 'paragraph',
        content: line
      });
    });

    return parsedBlocks;
  };

  // Compile Blocks to Standard Markdown (for Phase 1 backward compatibility)
  const compileBlocksToMarkdown = (blocks: BlogContentBlock[]): string => {
    return blocks.map(b => {
      switch (b.type) {
        case 'paragraph':
          return b.content || '';
        case 'heading':
          const hashes = '#'.repeat(b.level || 2);
          return `${hashes} ${b.content}`;
        case 'image':
          return `![${b.alt || ''}](${b.url || ''})\n*${b.caption || ''}*`;
        case 'quote':
          return `> ${b.content || ''}`;
        case 'divider':
          return '---';
        case 'bullet_list':
          return (b.items || []).map(i => `- ${i}`).join('\n');
        case 'numbered_list':
          return (b.items || []).map((i, idx) => `${idx + 1}. ${i}`).join('\n');
        case 'cta':
          return `[${b.content || 'CTA'}](${b.url || '#'})`;
        case 'faq':
          return `**Dúvida: ${b.question}**\n*Resposta: ${b.answer}*`;
        case 'youtube':
          return `Vídeo do YouTube: ${b.url || ''}`;
        case 'table':
          const head = '| ' + (b.headers || []).join(' | ') + ' |';
          const sep = '| ' + (b.headers || []).map(() => '---').join(' | ') + ' |';
          const body = (b.rows || []).map(row => '| ' + row.join(' | ') + ' |').join('\n');
          return `${head}\n${sep}\n${body}`;
        case 'callout':
          return `> **[${b.style?.toUpperCase() || 'OBSERVAÇÃO'}]** ${b.content}`;
        case 'conclusion':
          return `### Conclusão\n\n${b.content}`;
        default:
          return b.content || '';
      }
    }).join('\n\n');
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!id) {
      const generatedSlug = val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      setSlug(generatedSlug);
    }
  };

  // Blocks management
  const addBlock = (type: BlogContentBlock['type']) => {
    const newBlock: BlogContentBlock = {
      id: generateId(),
      type
    };

    if (type === 'heading') {
      newBlock.level = 2;
      newBlock.content = "";
    } else if (type === 'table') {
      newBlock.headers = ["Coluna 1", "Coluna 2"];
      newBlock.rows = [["Valor A1", "Valor A2"], ["Valor B1", "Valor B2"]];
    } else if (type === 'cta') {
      newBlock.content = "Clique aqui para saber mais";
      newBlock.url = "/catalogo";
      newBlock.style = "primary";
      newBlock.newTab = false;
    } else if (type === 'faq') {
      newBlock.question = "";
      newBlock.answer = "";
    } else if (type === 'product_grid') {
      newBlock.productIds = [];
    } else if (type === 'bullet_list' || type === 'numbered_list') {
      newBlock.items = [""];
    } else if (type === 'callout') {
      newBlock.style = "info";
      newBlock.content = "";
    } else if (type === 'image') {
      newBlock.url = "";
      newBlock.alt = "";
      newBlock.caption = "";
    } else {
      newBlock.content = "";
    }

    setContentBlocks([...contentBlocks, newBlock]);
    setIsDirty(true);
  };

  const updateBlock = (idx: number, updatedFields: Partial<BlogContentBlock>) => {
    const updated = [...contentBlocks];
    updated[idx] = { ...updated[idx], ...updatedFields };
    setContentBlocks(updated);
    setIsDirty(true);
  };

  const removeBlock = (idx: number) => {
    setContentBlocks(contentBlocks.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const moveBlock = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === contentBlocks.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...contentBlocks];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setContentBlocks(updated);
    setIsDirty(true);
  };

  // Block Image Upload handler (with Desktop, Mobile, Thumbnail versioning)
  const handleBlockImageUpload = async (idx: number, file: File) => {
    if (!file) return;
    
    // Update block state to show uploading placeholder
    updateBlock(idx, { content: "Enviando imagem...", url: "loading" });

    try {
      const altText = contentBlocks[idx].alt || title || "Imagem do Blog";
      const uploadedInfo = await uploadBlogImage(file, altText, contentBlocks[idx].caption || "");
      
      // Update with final Firebase optimized sizes and metadata
      updateBlock(idx, {
        url: uploadedInfo.url,
        path: uploadedInfo.path,
        width: uploadedInfo.width,
        height: uploadedInfo.height,
        sizeKb: uploadedInfo.sizeKb,
        alt: uploadedInfo.alt,
        caption: uploadedInfo.caption,
        content: "" // clear placeholder
      });
      showFeedback('success', "Imagem otimizada (WebP/3 tamanhos) criada com sucesso!");
    } catch (err) {
      console.error(err);
      updateBlock(idx, { url: "", content: "" });
      showFeedback('error', "Erro ao otimizar ou carregar a imagem selecionada.");
    }
  };

  const handleAutosaveImageUpload = async (file: File) => {
    try {
      showFeedback('success', "Otimizando imagem de capa...");
      const uploadedInfo = await uploadBlogImage(file, title || "Capa do Artigo", title || "Capa");
      setCoverImage(uploadedInfo.url);
      setCoverImageAlt(uploadedInfo.alt);
      setIsDirty(true);
    } catch (err) {
      console.error(err);
      showFeedback('error', "Não foi possível carregar a capa.");
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput("");
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (idx: number) => {
    setTags(tags.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  // Helper to extract YouTube video ID from URL
  const extractYoutubeId = (url: string): string => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : "";
  };

  // Auto-save logic implementation
  const handleAutoSave = async () => {
    if (!title.trim() || !slug.trim()) return;
    setSaveStatus('saving');
    try {
      const plainMarkdown = compileBlocksToMarkdown(contentBlocks);
      const postData: Partial<BlogPost> = {
        title,
        subtitle,
        slug,
        summary,
        coverImage,
        categoryId,
        tags,
        readingTime,
        featured,
        status: status === 'agendado' && !publishedAt ? 'rascunho' : status,
        publishedAt: status === 'agendado' && publishedAt ? new Date(publishedAt).toISOString() : (publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString()),
        content: plainMarkdown,
        contentBlocks,
        clusterId: clusterId || null,
        clusterType: clusterId ? clusterType : null,
        seo: {
          title: title,
          description: summary,
          canonical: `https://discretaboutique.com.br/blog/${slug}`,
          keywords: palavraChave,
          faq: contentBlocks.filter(b => b.type === 'faq').map(b => ({ question: b.question || "", answer: b.answer || "" })),
          ogImage: coverImageAlt || coverImage,
          twitterImage: coverImage
        }
      };

      await blogService.savePost(id, postData as BlogPost);
      setSaveStatus('saved');
      setIsDirty(false);
      lastSavedState.current = JSON.stringify({
        title, subtitle, slug, summary, coverImage, coverImageAlt, categoryId, tags, status, publishedAt, contentBlocks, palavraChave, featured
      });
    } catch (err) {
      console.error("Autosave error:", err);
      setSaveStatus('error');
    }
  };

  const handleManualSave = async (targetStatus?: BlogPost['status']) => {
    const finalStatus = targetStatus || status;
    
    if (!title.trim() || !slug.trim()) {
      showFeedback('error', "Título e Slug de URL são obrigatórios.");
      return;
    }

    if (finalStatus === 'agendado' && !publishedAt) {
      showFeedback('error', "Para agendar, selecione a data e horário de publicação.");
      return;
    }

    setSaving(true);
    setSaveStatus('saving');
    try {
      const plainMarkdown = compileBlocksToMarkdown(contentBlocks);
      const postData: Partial<BlogPost> = {
        title,
        subtitle,
        slug,
        summary,
        coverImage,
        categoryId,
        tags,
        readingTime,
        featured,
        status: finalStatus,
        publishedAt: finalStatus === 'agendado' && publishedAt ? new Date(publishedAt).toISOString() : (publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString()),
        content: plainMarkdown,
        contentBlocks,
        clusterId: clusterId || null,
        clusterType: clusterId ? clusterType : null,
        seo: {
          title: title,
          description: summary,
          canonical: `https://discretaboutique.com.br/blog/${slug}`,
          keywords: palavraChave,
          faq: contentBlocks.filter(b => b.type === 'faq').map(b => ({ question: b.question || "", answer: b.answer || "" })),
          ogImage: coverImageAlt || coverImage,
          twitterImage: coverImage
        }
      };

      const savedId = await blogService.savePost(id, postData as BlogPost);

      // Keep cluster references in synchronized harmony
      if (clusterId) {
        const clusterToUpdate = await blogService.getCluster(clusterId);
        if (clusterToUpdate) {
          if (clusterType === 'pillar') {
            await blogService.updateCluster(clusterId, { pillarPostId: savedId });
          } else {
            const currentSubPosts = clusterToUpdate.clusterPostIds || [];
            if (!currentSubPosts.includes(savedId)) {
              await blogService.updateCluster(clusterId, { clusterPostIds: [...currentSubPosts, savedId] });
            }
          }
        }
      }

      setSaveStatus('saved');
      setIsDirty(false);
      showFeedback('success', id ? "Artigo atualizado perfeitamente!" : "Novo artigo criado com sucesso!");
      
      if (!id) {
        setTimeout(() => navigate(`/admin/blog/editar/${savedId}`), 1000);
      }
    } catch (err) {
      console.error("Manual save error:", err);
      setSaveStatus('error');
      showFeedback('error', "Erro de gravação no Firestore.");
    } finally {
      setSaving(false);
    }
  };

  // Gemini AI automatic generator trigger
  const handleGeminiGenerateBlocks = async () => {
    if (!aiTema.trim()) {
      alert("Por favor, informe o tema para criar o artigo.");
      return;
    }

    setAiGenerating(true);
    try {
      const activeCat = categories.find(c => c.id === categoryId)?.name || "Geral";
      const response = await fetch("/api/blog/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tema: aiTema,
          categoria: activeCat,
          publico: aiPublico || "Mulheres e casais modernos interessados em sexualidade",
          tomVoz: aiTomVoz,
          palavras: aiPalavras,
          palavrasChave: tags
        })
      });

      if (!response.ok) {
        throw new Error("Erro na rede com a IA.");
      }

      const data = await response.json();
      if (data) {
        if (data.titulo) {
          setTitle(data.titulo);
          setSlug(data.titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-"));
        }
        if (data.subtitulo) setSubtitle(data.subtitulo);
        if (data.sumario) setSummary(data.sumario);
        if (data.tempoLeitura) setReadingTime(Number(data.tempoLeitura));

        // Format Gemini Markdown contents straight to modern visual content blocks!
        if (data.conteudo) {
          setContentBlocks(parseMarkdownToBlocks(data.conteudo));
        }

        // Add optional FAQ blocks if supplied by AI
        if (data.faq && Array.isArray(data.faq)) {
          const faqBlocks: BlogContentBlock[] = data.faq.map((f: any) => ({
            id: generateId(),
            type: 'faq',
            question: f.pergunta || f.question || '',
            answer: f.resposta || f.answer || ''
          }));
          setContentBlocks(prev => [...prev, ...faqBlocks]);
        }

        showFeedback('success', "Artigo profissional gerado e dividido em blocos com sucesso!");
        setAiExpanded(false);
        setIsDirty(true);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao invocar o assistente. Verifique a chave @google/genai ou chaves secretas.");
    } finally {
      setAiGenerating(false);
    }
  };

  // SEO validations calculator
  const calculateWordCount = () => {
    let totalWords = 0;
    contentBlocks.forEach(b => {
      if (b.content) {
        totalWords += b.content.trim().split(/\s+/).filter(Boolean).length;
      }
      if (b.items) {
        b.items.forEach(item => {
          totalWords += item.trim().split(/\s+/).filter(Boolean).length;
        });
      }
    });
    return totalWords;
  };

  const wordCount = calculateWordCount();
  const keywordInTitle = palavraChave ? title.toLowerCase().includes(palavraChave.toLowerCase()) : false;
  const descriptionFilled = summary.trim().length > 0;
  const friendlySlug = /^[a-z0-9-]+$/.test(slug);
  const coverImageHasAlt = coverImage ? coverImageAlt.trim().length > 0 : false;
  const hasH2 = contentBlocks.some(b => b.type === 'heading' && b.level === 2);
  const hasInternalLink = compileBlocksToMarkdown(contentBlocks).match(/(\/catalogo|\/produto|\/contato|\/sobre|discretaboutique\.com)/i) !== null;
  const hasProducts = contentBlocks.some(b => b.type === 'product_grid' && b.productIds && b.productIds.length > 0);
  const hasFaqOptional = contentBlocks.some(b => b.type === 'faq');
  const minimumWordsMet = wordCount >= 600;

  // Render score
  const getSeoScore = () => {
    let count = 0;
    if (keywordInTitle) count++;
    if (descriptionFilled) count++;
    if (friendlySlug) count++;
    if (coverImageHasAlt) count++;
    if (hasH2) count++;
    if (hasInternalLink) count++;
    if (hasProducts) count++;
    if (minimumWordsMet) count++;
    return Math.round((count / 8) * 100);
  };

  const seoScore = getSeoScore();

  if (loading) {
    return (
      <div className="text-center py-20 bg-zinc-950 min-h-screen flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-600 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 mt-4 leading-none">Abrindo editor profissional...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen font-sans">
      {/* Top Header Controls bar */}
      <div className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 p-4 sticky top-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/blog"
              className="p-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black uppercase text-white leading-tight">
                  {id ? "Editar Artigo" : "Novo Artigo"}
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                  status === 'publicado' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/25' :
                  status === 'agendado' ? 'bg-blue-950 text-blue-400 border border-blue-500/25' :
                  'bg-zinc-900 text-zinc-400 border border-zinc-850'
                }`}>
                  {status}
                </span>

                {/* Auto-save visual indicator */}
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  {saveStatus === 'saving' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                  {saveStatus === 'saved' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {saveStatus === 'saving' ? "Salvando..." : saveStatus === 'saved' ? "Salvo" : "Rascunho"}
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest leading-none mt-1">
                Discreta Boutique — editor de blocos estrutrados
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Link
              to="/admin/blog/ia"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_10px_rgba(168,85,247,0.2)]"
            >
              <Sparkles size={13} className="text-purple-200 animate-pulse" /> Gerar com IA
            </Link>
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="flex items-center gap-1 px-4 py-2 border border-zinc-800 hover:bg-zinc-900 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              <Eye size={13} /> {isPreviewMode ? "Voltar ao Editor" : "Pré-visualizar Artigo"}
            </button>
            <div className="h-6 w-px bg-zinc-900" />
            <select
              value={status}
              onChange={(e) => {
                const s = e.target.value as any;
                setStatus(s);
                setIsDirty(true);
              }}
              className="px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs font-bold uppercase rounded-xl text-white focus:outline-none focus:border-red-500"
            >
              <option value="rascunho">Rascunho</option>
              <option value="publicado">Publicado</option>
              <option value="agendado">Agendado</option>
              <option value="arquivado">Arquivado</option>
            </select>

            <button
              onClick={() => handleManualSave()}
              disabled={saving}
              className="flex items-center gap-1 px-4 py-2 bg-red-650 hover:bg-red-550 active:scale-95 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all"
            >
              <Save size={13} /> "Salvar Artigo"
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Alerts / feedback */}
        {feedback && (
          <div className={`p-4 rounded-xl flex items-center gap-3 border ${
            feedback.type === 'success' 
              ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-400' 
              : 'bg-red-950/20 border-red-500/25 text-red-400'
          }`}>
            {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span className="text-xs font-semibold">{feedback.message}</span>
          </div>
        )}

        {/* AI Generator Drawer */}
        <div className="border border-red-900/40 rounded-2xl overflow-hidden bg-red-950/5">
          <button
            onClick={() => setAiExpanded(!aiExpanded)}
            className="w-full flex items-center justify-between p-4 bg-red-950/10 text-left cursor-pointer border-b border-red-900/10"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-red-500" />
              <div>
                <h4 className="font-extrabold text-xs uppercase text-white tracking-wide">Gerador de Artigos Otimizados (IA Gemini)</h4>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mt-0.5">Produza artigos profissionais fatiados em blocos estruturados automaticamente</p>
              </div>
            </div>
            <span className="text-xs font-bold uppercase text-red-500 hover:underline">
              {aiExpanded ? "Recolher" : "Expandir Assistente"}
            </span>
          </button>

          {aiExpanded && (
            <div className="p-6 space-y-5 bg-zinc-900/20">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Título ou Tema Planejado *</label>
                  <input
                    type="text"
                    value={aiTema}
                    onChange={(e) => setAiTema(e.target.value)}
                    placeholder="Ex: Como escolher a primeira lingerie vermelha romântica"
                    className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tom de Voz</label>
                  <select
                    value={aiTomVoz}
                    onChange={(e) => setAiTomVoz(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl text-white focus:outline-none"
                  >
                    <option value="Empoderado e Sensual">Empoderado e Sensual (Discreta)</option>
                    <option value="Informativo e Clínico para Saúde Íntima">Saúde Íntima / Clínico Curativo</option>
                    <option value="Sutil e Romântico">Sutil e Romântico</option>
                    <option value="Prático e Direto para Dicas">Dicas Rápidas</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Público-Alvo Específico</label>
                  <input
                    type="text"
                    value={aiPublico}
                    onChange={(e) => setAiPublico(e.target.value)}
                    placeholder="Ex: Mulheres recém-casadas buscando apimentar"
                    className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nº de palavras sugerido</label>
                  <input
                    type="number"
                    value={aiPalavras}
                    onChange={(e) => setAiPalavras(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl text-white focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleGeminiGenerateBlocks}
                disabled={aiGenerating}
                className="w-full py-2.5 bg-red-650 hover:bg-red-500 font-extrabold text-xs uppercase tracking-widest text-white rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-55"
              >
                <Wand2 size={13} />
                {aiGenerating ? "Redigindo e segmentando artigo com Gemini..." : "Gerar Artigo em Bloco Profissional"}
              </button>
            </div>
          )}
        </div>

        {/* Visual layouts */}
        {!isPreviewMode ? (
          <div className="grid lg:grid-cols-4 gap-8 items-start">
            
            {/* LEFT / CENTER: PRIMARY CONTENT CANVAS EDITORS */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Cover and header definitions info block */}
              <div className="p-6 border border-zinc-900 bg-zinc-900/30 rounded-2xl space-y-4">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2 border-b border-zinc-900 pb-3">
                  <FileText size={15} className="text-red-500" />
                  Informações de Capa e URL
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Título Principal do Artigo *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Tema ou Dicas do post..."
                      className="w-full px-4 py-2.5 border border-zinc-800 bg-zinc-950 text-xs text-white rounded-xl focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Slug URL amigável *</label>
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => { setSlug(e.target.value); setIsDirty(true); }}
                        placeholder="ex-post-url-amigavel"
                        className="w-full px-4 py-2.5 border border-zinc-800 bg-zinc-950 text-xs text-white rounded-xl focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Subtítulo secundário</label>
                      <input
                        type="text"
                        value={subtitle}
                        onChange={(e) => { setSubtitle(e.target.value); setIsDirty(true); }}
                        placeholder="Abaixo do título nas listagens..."
                        className="w-full px-4 py-2.5 border border-zinc-800 bg-zinc-950 text-xs text-white rounded-xl focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Sumário (Meta Description — essencial para o Google) *</label>
                    <textarea
                      rows={2}
                      value={summary}
                      onChange={(e) => { setSummary(e.target.value); setIsDirty(true); }}
                      placeholder="Escreva um sumário de 120-160 caracteres contendo sua palavra-chave principal..."
                      className="w-full px-4 py-2.5 border border-zinc-800 bg-zinc-950 text-xs text-white rounded-xl focus:outline-none"
                    />
                  </div>

                  {/* CAPA & ALT */}
                  <div className="grid md:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Imagem de Capa (URL)</label>
                      <input
                        type="text"
                        value={coverImage}
                        onChange={(e) => { setCoverImage(e.target.value); setIsDirty(true); }}
                        placeholder="Insira URL ou faça upload ao lado..."
                        className="w-full px-4 py-2.5 border border-zinc-800 bg-zinc-950 text-xs text-white rounded-xl focus:outline-none"
                      />
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1 mt-2">Tag ALT da Capa (Texto alternativo SEO)</label>
                      <input
                        type="text"
                        value={coverImageAlt}
                        onChange={(e) => { setCoverImageAlt(e.target.value); setIsDirty(true); }}
                        placeholder="Ex: Conjunto de lingerie vermelha de renda da Discreta Boutique"
                        className="w-full px-4 py-2.5 border border-zinc-800 bg-zinc-950 text-xs text-white rounded-xl focus:outline-none"
                      />
                    </div>

                    <div className="border border-zinc-900 bg-zinc-950/40 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                      {coverImage ? (
                        <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-zinc-850">
                          <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button
                            onClick={() => { setCoverImage(""); setCoverImageAlt(""); }}
                            className="absolute top-2 right-2 p-1.5 bg-black/80 rounded-lg hover:text-red-500"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="py-4 space-y-2">
                          <ImageIcon size={32} className="text-zinc-650 mx-auto" />
                          <p className="text-[10px] text-zinc-500 uppercase font-black">Fazer upload de foto de capa</p>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 rounded-lg font-bold text-[10px] uppercase cursor-pointer">
                            <Upload size={12} /> Selecionar capa
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAutosaveImageUpload(file);
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* DYNAMIC CONTENT BLOCKS WRAPPER */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black uppercase text-white tracking-tight flex items-center gap-2">
                    <Type size={18} className="text-red-500" />
                    Blocos de Conteúdo do Artigo
                  </h3>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                    Fatias indexadas: {contentBlocks.length}
                  </span>
                </div>

                {contentBlocks.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-zinc-900 rounded-2xl">
                    <p className="text-zinc-500 text-xs uppercase font-extrabold tracking-widest">Nenhum bloco de texto ou imagem cadastrado no momento.</p>
                    <p className="text-zinc-600 text-[10px] mt-1">Insira parágrafos, cabeçalhos ou imagens abaixo para começar.</p>
                  </div>
                ) : (
                  contentBlocks.map((block, idx) => (
                    <div 
                      key={block.id} 
                      className="group border border-zinc-900 hover:border-zinc-800 bg-zinc-900/10 hover:bg-zinc-900/15 rounded-xl transition-all overflow-hidden relative"
                    >
                      {/* Block upper control bar */}
                      <div className="bg-zinc-950/40 px-4 py-2 border-b border-zinc-900/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-zinc-400">
                            Bloco {idx + 1} — {block.type}
                          </span>
                        </div>

                        {/* Reordering buttons & deletion */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveBlock(idx, 'up')}
                            disabled={idx === 0}
                            title="Mover para cima"
                            className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => moveBlock(idx, 'down')}
                            disabled={idx === contentBlocks.length - 1}
                            title="Mover para baixo"
                            className="p-1 text-zinc-500 hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <div className="w-px h-3 bg-zinc-800 mx-1" />
                          <button
                            onClick={() => removeBlock(idx)}
                            title="Remover Bloco"
                            className="p-1 text-zinc-500 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Block inputs based on type */}
                      <div className="p-4 space-y-3">
                        {block.type === 'paragraph' && (
                          <div className="space-y-1">
                            <textarea
                              rows={4}
                              value={block.content || ""}
                              onChange={(e) => updateBlock(idx, { content: e.target.value })}
                              placeholder="Digite o texto do parágrafo. Suporta negritos via markdown como **exemplo**."
                              className="w-full p-3 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs text-zinc-200 focus:outline-none font-sans leading-relaxed"
                            />
                          </div>
                        )}

                        {block.type === 'heading' && (
                          <div className="flex gap-4 items-center">
                            <select
                              value={block.level || 2}
                              onChange={(e) => updateBlock(idx, { level: Number(e.target.value) as any })}
                              className="px-2.5 py-1.5 border border-zinc-850 bg-zinc-950 text-xs font-bold rounded-lg"
                            >
                              <option value={2}>H2 (Título principal)</option>
                              <option value={3}>H3 (Subtópico)</option>
                              <option value={4}>H4 (Menor)</option>
                            </select>
                            <input
                              type="text"
                              value={block.content || ""}
                              onChange={(e) => updateBlock(idx, { content: e.target.value })}
                              placeholder="Título do Cabeçalho..."
                              className="flex-1 px-3 py-1.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs font-bold text-white focus:outline-none"
                            />
                          </div>
                        )}

                        {block.type === 'image' && (
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div>
                                <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">URL da Imagem</label>
                                <input
                                  type="text"
                                  value={block.url || ""}
                                  onChange={(e) => updateBlock(idx, { url: e.target.value })}
                                  placeholder="https://link-da-imagem.jpg"
                                  className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Alt da imagem (Mais visibilidade no Google Fotos) *</label>
                                <input
                                  type="text"
                                  value={block.alt || ""}
                                  onChange={(e) => updateBlock(idx, { alt: e.target.value })}
                                  placeholder="Descreva a foto para deficientes visuais e buscadores..."
                                  className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Legenda (Abaixo da foto no artigo)</label>
                                <input
                                  type="text"
                                  value={block.caption || ""}
                                  onChange={(e) => updateBlock(idx, { caption: e.target.value })}
                                  placeholder="Digite uma descrição para o leitor..."
                                  className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="border border-dashed border-zinc-850 bg-zinc-950/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                              {block.url === "loading" ? (
                                <div className="space-y-2">
                                  <div className="w-5 h-5 border-2 border-zinc-700 border-t-red-650 rounded-full animate-spin mx-auto" />
                                  <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Processando e enviando versões...</p>
                                </div>
                              ) : block.url ? (
                                <div className="space-y-1 w-full">
                                  <div className="relative aspect-video rounded overflow-hidden border border-zinc-900 mx-auto max-h-36">
                                    <img src={block.url} alt="Uploaded" className="w-full h-full object-cover" />
                                    <button
                                      onClick={() => updateBlock(idx, { url: "", path: undefined })}
                                      className="absolute top-1 right-1 p-1 bg-black/70 rounded hover:text-red-500"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                  <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">
                                    Dimensões: {block.width}x{block.height} | Peso: {block.sizeKb}kb
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <ImageIcon size={24} className="text-zinc-700 mx-auto" />
                                  <p className="text-[9px] text-zinc-500 uppercase font-bold">Upload Local Otimizado</p>
                                  <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-extrabold text-[9px] uppercase rounded-lg cursor-pointer transition-all">
                                    <Upload size={10} /> Otimizar & Enviar
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleBlockImageUpload(idx, file);
                                      }}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {block.type === 'quote' && (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              value={block.content || ""}
                              onChange={(e) => updateBlock(idx, { content: e.target.value })}
                              placeholder="“As lingeries certas despertam sensações guardadas dentro do seu amor próprio...”"
                              className="w-full p-2.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs italic text-zinc-300 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={block.alt || ""}
                              onChange={(e) => updateBlock(idx, { alt: e.target.value })}
                              placeholder="Autor da citação (Opcional)"
                              className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none"
                            />
                          </div>
                        )}

                        {block.type === 'youtube' && (
                          <div className="grid md:grid-cols-2 gap-4 items-center">
                            <div className="space-y-2">
                              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Cole o link do YouTube</label>
                              <input
                                type="text"
                                value={block.url || ""}
                                onChange={(e) => {
                                  const urlVal = e.target.value;
                                  const ytId = extractYoutubeId(urlVal);
                                  updateBlock(idx, { url: urlVal, videoId: ytId });
                                }}
                                placeholder="https://www.youtube.com/watch?v=id_do_video"
                                className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none text-white font-mono"
                              />
                            </div>
                            <div className="aspect-video border border-zinc-900 bg-zinc-950/40 rounded-xl flex items-center justify-center relative overflow-hidden max-h-36">
                              {block.videoId ? (
                                <img
                                  src={`https://img.youtube.com/vi/${block.videoId}/0.jpg`}
                                  alt="Preview vídeo"
                                  className="w-full h-full object-cover opacity-60"
                                />
                              ) : (
                                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Aguardando ID do vídeo...</p>
                              )}
                              {block.videoId && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Video size={18} className="text-red-500 drop-shadow-lg" />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {block.type === 'cta' && (
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div>
                                <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Texto do botão</label>
                                <input
                                  type="text"
                                  value={block.content || ""}
                                  onChange={(e) => updateBlock(idx, { content: e.target.value })}
                                  placeholder="Ver Catálogo Completo"
                                  className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Link de destino (URL)</label>
                                <input
                                  type="text"
                                  value={block.url || ""}
                                  onChange={(e) => updateBlock(idx, { url: e.target.value })}
                                  placeholder="Ex: /catalogo ou link do WhatsApp"
                                  className="w-full px-3 py-1.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Visual do Botão</label>
                                <select
                                  value={block.style || "primary"}
                                  onChange={(e) => updateBlock(idx, { style: e.target.value as any })}
                                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-850 text-xs font-bold rounded-lg"
                                >
                                  <option value="primary">Botão Discreta (Destaque Vermelho)</option>
                                  <option value="secondary">Cinza Escuro / Elegante</option>
                                  <option value="whatsapp">Verde WhatsApp (Conversão)</option>
                                  <option value="outline">Apenas Contorno (Minimalista)</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-2 py-1.5">
                                <input
                                  type="checkbox"
                                  id={`newTab_${block.id}`}
                                  checked={block.newTab || false}
                                  onChange={(e) => updateBlock(idx, { newTab: e.target.checked })}
                                  className="w-4 h-4 bg-zinc-950 rounded border-zinc-800 checked:bg-red-500 cursor-pointer"
                                />
                                <label htmlFor={`newTab_${block.id}`} className="text-[10px] font-black uppercase tracking-wider text-zinc-400 cursor-pointer">
                                  Abrir link em nova guia / aba
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        {block.type === 'faq' && (
                          <div className="space-y-2.5">
                            <div>
                              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Pergunta frequente (Rich FAQ)</label>
                              <input
                                type="text"
                                value={block.question || ""}
                                onChange={(e) => updateBlock(idx, { question: e.target.value })}
                                placeholder="Ex: Qual tamanho ideal para presentear?"
                                className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs text-white font-bold focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Resposta explicativa curta</label>
                              <textarea
                                rows={2}
                                value={block.answer || ""}
                                onChange={(e) => updateBlock(idx, { answer: e.target.value })}
                                placeholder="Digite a resposta curta..."
                                className="w-full px-3 py-2 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs text-zinc-300 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {block.type === 'bullet_list' && (
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Tópicos com Marcadores</label>
                            <div className="space-y-1.5">
                              {(block.items || []).map((item, itemIdx) => (
                                <div key={itemIdx} className="flex gap-2 items-center">
                                  <span className="text-red-500">•</span>
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                      const updatedItems = [...(block.items || [])];
                                      updatedItems[itemIdx] = e.target.value;
                                      updateBlock(idx, { items: updatedItems });
                                    }}
                                    placeholder="Digite um tópico..."
                                    className="flex-1 px-3 py-1 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none text-zinc-200 animate-fade-in"
                                  />
                                  <button
                                    onClick={() => {
                                      const updatedItems = (block.items || []).filter((_, i) => i !== itemIdx);
                                      updateBlock(idx, { items: updatedItems });
                                    }}
                                    className="p-1 hover:text-red-500"
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  const updatedItems = [...(block.items || []), ""];
                                  updateBlock(idx, { items: updatedItems });
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-[9px] font-bold uppercase rounded text-zinc-400 mt-1"
                              >
                                <Plus size={10} /> Inserir Item
                              </button>
                            </div>
                          </div>
                        )}

                        {block.type === 'numbered_list' && (
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Lista Numerada</label>
                            <div className="space-y-1.5">
                              {(block.items || []).map((item, itemIdx) => (
                                <div key={itemIdx} className="flex gap-2 items-center">
                                  <span className="text-[10px] text-red-500 font-bold">{itemIdx + 1}.</span>
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                      const updatedItems = [...(block.items || [])];
                                      updatedItems[itemIdx] = e.target.value;
                                      updateBlock(idx, { items: updatedItems });
                                    }}
                                    placeholder="Digite um item ordenado..."
                                    className="flex-1 px-3 py-1 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs focus:outline-none text-zinc-200"
                                  />
                                  <button
                                    onClick={() => {
                                      const updatedItems = (block.items || []).filter((_, i) => i !== itemIdx);
                                      updateBlock(idx, { items: updatedItems });
                                    }}
                                    className="p-1 hover:text-red-500"
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  const updatedItems = [...(block.items || []), ""];
                                  updateBlock(idx, { items: updatedItems });
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-850 hover:bg-zinc-805 text-[9px] font-bold uppercase rounded text-zinc-400 mt-1"
                              >
                                <Plus size={10} /> Inserir Item
                              </button>
                            </div>
                          </div>
                        )}

                        {block.type === 'callout' && (
                          <div className="grid md:grid-cols-3 gap-4">
                            <div>
                              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Visual do Card</label>
                              <select
                                value={block.style || "info"}
                                onChange={(e) => updateBlock(idx, { style: e.target.value as any })}
                                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-850 text-xs font-bold rounded-lg"
                              >
                                <option value="info">Elegante (Cinza/Discreto)</option>
                                <option value="warning">Atenção / Dica Sensual (Laranja)</option>
                                <option value="tip">Dica de Conservação (Verde)</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Conteúdo do Card Destaque</label>
                              <textarea
                                rows={2}
                                value={block.content || ""}
                                onChange={(e) => updateBlock(idx, { content: e.target.value })}
                                placeholder="Insira o texto em destaque..."
                                className="w-full p-2 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs text-zinc-250 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {block.type === 'table' && (
                          <div className="space-y-3">
                            <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Edição de Tabela Simples</label>
                            
                            {/* Headers Row */}
                            <div className="flex gap-2 items-center flex-wrap pt-1">
                              <span className="text-[9px] font-bold text-zinc-500 uppercase pr-2">Cabeçalhos:</span>
                              {(block.headers || []).map((header, headIdx) => (
                                <div key={headIdx} className="flex gap-1 items-center bg-zinc-90 w-auto rounded border border-zinc-800 pr-1">
                                  <input
                                    type="text"
                                    value={header}
                                    onChange={(e) => {
                                      const updatedHeaders = [...(block.headers || [])];
                                      updatedHeaders[headIdx] = e.target.value;
                                      updateBlock(idx, { headers: updatedHeaders });
                                    }}
                                    className="px-2 py-0.5 bg-transparent text-[10px] font-black uppercase text-white outline-none w-20"
                                  />
                                  <button
                                    onClick={() => {
                                      const updatedHeaders = (block.headers || []).filter((_, i) => i !== headIdx);
                                      const updatedRows = (block.rows || []).map(row => row.filter((_, i) => i !== headIdx));
                                      updateBlock(idx, { headers: updatedHeaders, rows: updatedRows });
                                    }}
                                    className="text-[10px] text-zinc-500 hover:text-red-500 font-bold"
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  const updatedHeaders = [...(block.headers || []), "Nova Coluna"];
                                  const updatedRows = (block.rows || []).map(row => [...row, ""]);
                                  updateBlock(idx, { headers: updatedHeaders, rows: updatedRows });
                                }}
                                className="px-2 py-0.5 bg-zinc-900 text-[9px] font-bold uppercase rounded text-zinc-400"
                              >
                                + Coluna
                              </button>
                            </div>

                            {/* Cell Rows */}
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {(block.rows || []).map((row, rowIdx) => (
                                <div key={rowIdx} className="flex gap-2 items-center">
                                  <span className="text-[9px] font-bold text-zinc-600 w-4">#{rowIdx + 1}</span>
                                  {row.map((cell, cellIdx) => (
                                    <input
                                      key={cellIdx}
                                      type="text"
                                      value={cell}
                                      onChange={(e) => {
                                        const updatedRows = (block.rows || []).map((r, rIdx) => {
                                          if (rIdx !== rowIdx) return r;
                                          const updatedCells = [...r];
                                          updatedCells[cellIdx] = e.target.value;
                                          return updatedCells;
                                        });
                                        updateBlock(idx, { rows: updatedRows });
                                      }}
                                      className="flex-1 px-2.5 py-1 bg-zinc-950/60 border border-zinc-850/50 rounded text-xs text-zinc-300 outline-none"
                                    />
                                  ))}
                                  <button
                                    onClick={() => {
                                      const updatedRows = (block.rows || []).filter((_, i) => i !== rowIdx);
                                      updateBlock(idx, { rows: updatedRows });
                                    }}
                                    className="p-1 hover:text-red-500 text-xs text-zinc-500"
                                    title="Remover Linha"
                                  >
                                    &times;
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => {
                                const newRow = (block.headers || []).map(() => "");
                                const updatedRows = [...(block.rows || []), newRow];
                                updateBlock(idx, { rows: updatedRows });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-[9px] font-bold uppercase rounded text-zinc-400 mt-1"
                            >
                              <Plus size={10} /> + Linha de Valores
                            </button>
                          </div>
                        )}

                        {block.type === 'product_grid' && (
                          <div className="space-y-3">
                            <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Grid de Produtos Recomendados</label>
                            
                            {/* Selected Products Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                              {(block.productIds || []).length === 0 ? (
                                <div className="col-span-all py-3 px-4 border border-zinc-900 bg-zinc-950/20 text-center rounded-lg text-[10px] text-zinc-500 uppercase font-black">
                                  Nenhum produto indexado neste bloco
                                </div>
                              ) : (
                                (block.productIds || []).map((pId) => {
                                  const realProduct = allProducts.find(p => p.id === pId);
                                  return (
                                    <div key={pId} className="p-2 border border-zinc-850 bg-zinc-950 flex flex-col justify-between rounded-lg relative group">
                                      <button
                                        onClick={() => {
                                          const updatedIds = (block.productIds || []).filter(id => id !== pId);
                                          updateBlock(idx, { productIds: updatedIds });
                                        }}
                                        className="absolute -top-1 right-0 text-zinc-500 hover:text-red-500 text-[11px] font-black p-1"
                                        title="Excluir da seleção"
                                      >
                                        &times;
                                      </button>
                                      {realProduct ? (
                                        <div className="space-y-1">
                                          {realProduct.images?.[0]?.url && (
                                            <img
                                              src={realProduct.images[0].url}
                                              alt={realProduct.name}
                                              className="w-full h-11 object-cover rounded-md"
                                              referrerPolicy="no-referrer"
                                            />
                                          )}
                                          <p className="text-[9px] font-extrabold text-zinc-300 truncate leading-tight uppercase">{realProduct.name}</p>
                                          <p className="text-[9px] font-black text-red-500">R$ {realProduct.price?.toFixed(2)}</p>
                                        </div>
                                      ) : (
                                        <p className="text-[9px] text-zinc-650 italic">Produto indisponível</p>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>

                            {/* Search and Attach */}
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="🔍 Buscar produto no estoque da de Icó..."
                                value={activeProductBlockId === block.id ? productSearchTerm : ""}
                                onFocus={() => {
                                  setActiveProductBlockId(block.id);
                                  setProductSearchTerm("");
                                }}
                                onChange={(e) => setProductSearchTerm(e.target.value)}
                                className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-900 rounded-lg text-xs outline-none"
                              />

                              {activeProductBlockId === block.id && productSearchTerm && (
                                <div className="absolute left-0 right-0 max-h-36 overflow-y-auto border border-zinc-850 bg-zinc-950 rounded-lg shadow-2xl z-50 mt-1 pb-1">
                                  {allProducts
                                    .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) && !(block.productIds || []).includes(p.id || ""))
                                    .map(p => (
                                      <button
                                        key={p.id}
                                        onClick={() => {
                                          const updatedIds = [...(block.productIds || []), p.id || ""];
                                          updateBlock(idx, { productIds: updatedIds });
                                          setProductSearchTerm("");
                                          setActiveProductBlockId(null);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-zinc-900 text-xs text-zinc-300 font-bold uppercase transition-colors"
                                      >
                                        {p.name} — R$ {p.price?.toFixed(2)}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {block.type === 'divider' && (
                          <div className="h-6 flex items-center justify-center relative">
                            <hr className="w-1/3 border-zinc-850" />
                            <Minus size={10} className="text-zinc-500 mx-2" />
                            <hr className="w-1/3 border-zinc-850" />
                          </div>
                        )}

                        {block.type === 'conclusion' && (
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Texto de Encerramento / Conclusão</label>
                            <textarea
                              rows={3}
                              value={block.content || ""}
                              onChange={(e) => updateBlock(idx, { content: e.target.value })}
                              placeholder="Digite a conclusão e considerações finais..."
                              className="w-full p-2.5 bg-zinc-950/60 border border-zinc-850/50 rounded-lg text-xs leading-relaxed text-white focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* QUICK BLOCK ADDITIONS DIALOG BUTTONS */}
              <div className="p-5 border border-zinc-900 bg-zinc-900/10 rounded-2xl">
                <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest text-center mb-3">
                  + Inserir novo bloco no artigo
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => addBlock('paragraph')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <Type size={12} className="text-red-500" /> Parágrafo
                  </button>
                  <button
                    onClick={() => addBlock('heading')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <Heading size={12} className="text-red-500" /> Título (H2/H3)
                  </button>
                  <button
                    onClick={() => addBlock('image')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <ImageIcon size={12} className="text-red-500" /> Imagem Otimizada
                  </button>
                  <button
                    onClick={() => addBlock('quote')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <Quote size={12} className="text-red-500" /> Citação / Frase
                  </button>
                  <button
                    onClick={() => addBlock('youtube')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <Video size={12} className="text-red-500" /> Vídeo YouTube
                  </button>
                  <button
                    onClick={() => addBlock('cta')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <LinkIcon size={12} className="text-red-500" /> Botão / CTA
                  </button>
                  <button
                    onClick={() => addBlock('faq')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <HelpCircle size={12} className="text-red-500" /> FAQ Google
                  </button>
                  <button
                    onClick={() => addBlock('product_grid')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <Tags size={12} className="text-red-500" /> Grade de Produtos
                  </button>
                  <button
                    onClick={() => addBlock('bullet_list')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <Minus size={12} className="text-red-500" /> Lista de Tópicos
                  </button>
                  <button
                    onClick={() => addBlock('table')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <TableIcon size={12} className="text-red-500" /> Tabela Simples
                  </button>
                  <button
                    onClick={() => addBlock('callout')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <Info size={12} className="text-red-500" /> Aviso Destaque
                  </button>
                  <button
                    onClick={() => addBlock('conclusion')}
                    className="flex items-center gap-1.5 p-2 bg-zinc-950 hover:bg-zinc-90 w-full text-zinc-300 hover:text-white rounded-lg font-bold text-[10px] uppercase border border-zinc-850 duration-200"
                  >
                    <CheckCircle size={12} className="text-red-500" /> Conclusão
                  </button>
                </div>
              </div>

            </div>

            {/* RIGHT SIDEBAR: SEO SUITE VALDATOR */}
            <div className="space-y-6">
              
              {/* Categorization and Schedule */}
              <div className="p-5 border border-zinc-900 bg-zinc-900/30 rounded-2xl space-y-4">
                <h4 className="text-xs uppercase font-extrabold text-zinc-300 flex items-center gap-1">
                  <Calendar size={13} className="text-red-500" /> Agendamento & Status
                </h4>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">Categoria do Universo</label>
                  <select
                    value={categoryId}
                    onChange={(e) => { setCategoryId(e.target.value); setIsDirty(true); }}
                    className="w-full mt-1 px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs text-white rounded-xl focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* SEO Cluster Selection */}
                <div>
                  <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block">SEO Cluster (Opcional)</label>
                  <select
                    value={clusterId}
                    onChange={(e) => { setClusterId(e.target.value); setIsDirty(true); }}
                    className="w-full mt-1 px-3 py-2 border border-zinc-800 bg-zinc-950 text-xs text-white rounded-xl focus:outline-none"
                  >
                    <option value="">Nenhum Cluster</option>
                    {clusters.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  {clusterId && (
                    <div className="mt-2 flex gap-2">
                      <label className="flex items-center gap-1 text-[9px] text-zinc-400">
                        <input type="radio" checked={clusterType === 'cluster'} onChange={() => { setClusterType('cluster'); setIsDirty(true); }} className="w-3" />
                        Secundário
                      </label>
                      <label className="flex items-center gap-1 text-[9px] text-zinc-400">
                        <input type="radio" checked={clusterType === 'pillar'} onChange={() => { setClusterType('pillar'); setIsDirty(true); }} className="w-3" />
                        Pilar
                      </label>
                    </div>
                  )}
                </div>

                {/* Scheduled DateTime picker */}
                <div className="space-y-1 bg-zinc-950/40 p-3 rounded-lg border border-zinc-850/50">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable_scheduled"
                      checked={status === 'agendado'}
                      onChange={(e) => {
                        const newStatus = e.target.checked ? 'agendado' : 'rascunho';
                        setStatus(newStatus);
                        setIsDirty(true);
                      }}
                      className="w-4 h-4 bg-zinc-950 rounded border-zinc-800 checked:bg-red-500 cursor-pointer"
                    />
                    <label htmlFor="enable_scheduled" className="text-[10px] font-extrabold uppercase text-zinc-400 cursor-pointer">
                      Agendar Lançamento
                    </label>
                  </div>

                  {status === 'agendado' && (
                    <div className="pt-2">
                      <label className="text-[8px] font-black uppercase text-zinc-500">Data e Horário de Liberação</label>
                      <input
                        type="datetime-local"
                        value={publishedAt}
                        onChange={(e) => { setPublishedAt(e.target.value); setIsDirty(true); }}
                        className="w-full mt-1 px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-lg text-xs font-mono text-white focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Reading time minutes slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] font-extrabold uppercase tracking-wider text-zinc-500">
                    <span>Média Leitura (Minutos)</span>
                    <span className="text-red-500">{readingTime} MIN</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={readingTime}
                    onChange={(e) => { setReadingTime(Number(e.target.value)); setIsDirty(true); }}
                    className="w-full bg-zinc-800 rounded-lg appearance-none h-1 cursor-pointer accent-red-650"
                  />
                </div>

                {/* Featured toggle */}
                <div className="flex items-center gap-2 pt-1 border-t border-zinc-900">
                  <input
                    type="checkbox"
                    id="is_blog_featured"
                    checked={featured}
                    onChange={(e) => { setFeatured(e.target.checked); setIsDirty(true); }}
                    className="w-4 h-4 bg-zinc-950 rounded border-zinc-800 checked:bg-red-500 cursor-pointer"
                  />
                  <label htmlFor="is_blog_featured" className="text-[10px] font-extrabold uppercase text-zinc-400 cursor-pointer">
                    Destacar este artigo
                  </label>
                </div>
              </div>

              {/* Tags panel */}
              <div className="p-5 border border-zinc-900 bg-zinc-900/30 rounded-2xl space-y-3">
                <h4 className="text-xs uppercase font-extrabold text-zinc-300">
                  Tags Otimizadoras
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder=" lingerie-renda"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    className="flex-1 px-3 py-1.5 border border-zinc-800 bg-zinc-950 text-xs rounded-xl text-white outline-none"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-black uppercase rounded-xl text-white"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {tags.length === 0 ? (
                    <span className="text-[9px] text-zinc-650 uppercase font-black">Nenhuma tag cadastrada</span>
                  ) : (
                    tags.map((t, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-zinc-850 rounded text-[9px] text-zinc-400 uppercase font-black">
                        {t}
                        <button onClick={() => handleRemoveTag(idx)} className="text-zinc-650 hover:text-red-500">&times;</button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* SEO ASSISTED SIDE PANEL MODULE */}
              <div className="p-5 border border-zinc-900 bg-zinc-900/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <h4 className="text-xs uppercase font-black text-white tracking-widest flex items-center gap-1.5">
                    <Sparkles size={14} className="text-red-500 animate-pulse" />
                    Assistente de SEO
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    seoScore >= 80 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                    seoScore >= 50 ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                    'bg-red-950/20 text-red-500 border border-red-500/20'
                  }`}>
                    {seoScore}%
                  </span>
                </div>

                {/* Keyword search field */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 block mb-1">Palavra-chave Foco</label>
                  <input
                    type="text"
                    value={palavraChave}
                    onChange={(e) => { setPalavraChave(e.target.value); setIsDirty(true); }}
                    placeholder="Ex: lingerie vermelha"
                    className="w-full px-3 py-2 border border-zinc-850 bg-zinc-950 text-xs rounded-xl text-white focus:outline-none"
                  />
                  <p className="text-[8px] text-zinc-650 leading-tight">Palavra principal pela qual você quer ranquear no Google de Icó-CE e Centro-Sul.</p>
                </div>

                {/* Realtime checks checklist */}
                <div className="space-y-2 pt-2 border-t border-zinc-900">
                  <h5 className="text-[9px] font-extrabold uppercase text-zinc-400 tracking-wider">Checklist dos Buscadores:</h5>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-zinc-500">Título SEO ideal ({title.length}c)</span>
                      <span className={`text-[8px] font-bold ${title.length >= 40 && title.length <= 60 ? 'text-emerald-500' : 'text-zinc-600'}`}>
                        {title.length >= 40 && title.length <= 60 ? 'Perfeito (40-60c)' : 'Inválido'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold text-zinc-500">Meta Description ({summary.length}c)</span>
                      <span className={`text-[8px] font-bold ${summary.length >= 110 && summary.length <= 160 ? 'text-emerald-500' : 'text-zinc-650'}`}>
                        {summary.length >= 110 && summary.length <= 160 ? 'Perfeito (120-160c)' : 'Fora do padrão'}
                      </span>
                    </div>

                    <div className="h-px bg-zinc-900/60 my-2" />

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${keywordInTitle ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-600'}`}>
                        {keywordInTitle ? "✓" : "✗"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400">Título contém palavra-chave</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${descriptionFilled ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-600'}`}>
                        {descriptionFilled ? "✓" : "✗"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400">Description preenchida</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${friendlySlug ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-600'}`}>
                        {friendlySlug ? "✓" : "✗"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400">Slug URL amigável</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${coverImageHasAlt ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-600'}`}>
                        {coverImageHasAlt ? "✓" : "✗"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400">Imagem de capa com alt</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${hasH2 ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-600'}`}>
                        {hasH2 ? "✓" : "✗"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400">Pelo menos um cabeçalho H2</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${hasInternalLink ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-600'}`}>
                        {hasInternalLink ? "✓" : "✗"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400">Contém link interno</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${hasProducts ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-600'}`}>
                        {hasProducts ? "✓" : "✗"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400">Grade de produtos inclusa</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${minimumWordsMet ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-600'}`}>
                        {minimumWordsMet ? "✓" : "✗"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400">
                        Mínimo 600 palavras ({wordCount}p)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black ${hasFaqOptional ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-900 text-zinc-500'}`}>
                        {hasFaqOptional ? "✓" : "★"}
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 flex items-center gap-1">
                        FAQ Schema opcional {hasFaqOptional && <span className="text-[8px] text-emerald-400 uppercase font-black">(Ativada)</span>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* PREVIEW MODE SCREEN WITH INTERACTIVE MULTI-TAB CHOICE */
          <div className="border border-zinc-900 bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl space-y-4">
            
            {/* Tab navigation headers */}
            <div className="bg-zinc-900/60 p-4 border-b border-zinc-900 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewTab('desktop')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    previewTab === 'desktop' ? 'bg-red-650 text-white' : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400'
                  }`}
                >
                  Computador (Desktop)
                </button>
                <button
                  onClick={() => setPreviewTab('mobile')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    previewTab === 'mobile' ? 'bg-red-650 text-white' : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400'
                  }`}
                >
                  Celular (Mobile)
                </button>
                <button
                  onClick={() => setPreviewTab('google')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    previewTab === 'google' ? 'bg-red-650 text-white' : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400'
                  }`}
                >
                  Resultado do Google (SERP)
                </button>
                <button
                  onClick={() => setPreviewTab('social')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    previewTab === 'social' ? 'bg-red-650 text-white' : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400'
                  }`}
                >
                  Redes Sociais (Facebook/WhatsApp)
                </button>
                <button
                  onClick={() => setPreviewTab('twitter')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    previewTab === 'twitter' ? 'bg-red-650 text-white' : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400'
                  }`}
                >
                  Twitter / X Card
                </button>
              </div>

              <button
                onClick={() => setIsPreviewMode(false)}
                className="text-xs uppercase font-extrabold text-zinc-500 hover:text-white underline cursor-pointer"
              >
                Voltar ao Redator
              </button>
            </div>

            {/* Rendering Tab Views */}
            <div className="p-4 md:p-8">
              
              {/* DESKTOP MODE PREVIEW */}
              {previewTab === 'desktop' && (
                <div className="max-w-3xl mx-auto space-y-6 bg-zinc-950 text-zinc-300 py-6 pr-6 pl-2">
                  <span className="text-red-500 uppercase font-black text-xs tracking-widest">
                    {categories.find(c => c.id === categoryId)?.name || "Geral"}
                  </span>
                  <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tight text-white leading-none">
                    {title || "Sem título informado"}
                  </h1>
                  {subtitle && <p className="text-base text-zinc-400 font-medium italic mt-2">{subtitle}</p>}

                  {coverImage && (
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-zinc-900 my-4 shadow-xl">
                      <img src={coverImage} alt={title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  {/* Render contentBlocks visually */}
                  <div className="space-y-6 pt-4 text-zinc-300 font-sans leading-relaxed text-sm md:text-base">
                    {contentBlocks.map((b) => (
                      <div key={b.id} className="animate-fade-in text-left">
                        {b.type === 'paragraph' && <p className="text-zinc-300 leading-relaxed font-normal whitespace-pre-wrap">{b.content}</p>}
                        {b.type === 'heading' && b.level === 2 && <h2 className="text-2xl md:text-3xl font-black uppercase italic tracking-tight mt-10 mb-4 text-zinc-100 border-l-4 border-red-500 pl-3">{b.content}</h2>}
                        {b.type === 'heading' && b.level === 3 && <h3 className="text-xl font-bold uppercase tracking-wider mt-8 mb-2 text-zinc-200">{b.content}</h3>}
                        {b.type === 'heading' && b.level === 4 && <h4 className="text-base font-bold uppercase tracking-wider text-zinc-350">{b.content}</h4>}
                        
                        {b.type === 'image' && b.url && (
                          <div className="my-6 space-y-1.5">
                            <div className="rounded-xl overflow-hidden border border-zinc-900 shadow-lg">
                              <img src={b.url} alt={b.alt || title} className="w-full object-cover max-h-[500px]" />
                            </div>
                            {b.caption && <p className="text-xs text-zinc-500 italic text-center font-sans">{b.caption}</p>}
                          </div>
                        )}

                        {b.type === 'quote' && (
                          <blockquote className="border-l-4 border-red-650 bg-zinc-900/40 p-4 rounded-r-xl italic text-zinc-100 my-5 font-medium leading-relaxed">
                            {b.content}
                            {b.alt && <cite className="block text-xs text-zinc-400 tracking-wider font-extrabold uppercase mt-2 font-mono">— {b.alt}</cite>}
                          </blockquote>
                        )}

                        {b.type === 'youtube' && b.videoId && (
                          <div className="my-6 aspect-video rounded-xl overflow-hidden border border-zinc-900 shadow-xl bg-black">
                            <iframe
                              src={`https://www.youtube.com/embed/${b.videoId}`}
                              title="Youtube Video player"
                              className="w-full h-full border-0"
                              allowFullScreen
                              loading="lazy"
                            />
                          </div>
                        )}

                        {b.type === 'cta' && b.url && (
                          <div className="my-6 text-center">
                            <a
                              href={b.url}
                              target={b.newTab ? "_blank" : "_self"}
                              rel="noopener noreferrer"
                              className={`inline-flex items-center px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-transform hover:scale-[1.02] active:scale-95 ${
                                b.style === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]' :
                                b.style === 'secondary' ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' :
                                b.style === 'outline' ? 'bg-transparent hover:bg-zinc-900 text-white border border-zinc-700' :
                                'bg-red-650 hover:bg-red-550 text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)]'
                              }`}
                            >
                              {b.content || "Clique Aqui"}
                            </a>
                          </div>
                        )}

                        {b.type === 'faq' && (
                          <div className="my-4 p-5 rounded-2xl border border-zinc-900 bg-zinc-950/40">
                            <h4 className="font-extrabold text-sm uppercase tracking-wide text-zinc-100 flex items-center gap-1.5">
                              <HelpCircle size={14} className="text-red-500" />
                              {b.question}
                            </h4>
                            <p className="text-xs md:text-sm text-zinc-400 mt-2 whitespace-pre-wrap leading-relaxed">{b.answer}</p>
                          </div>
                        )}

                        {b.type === 'bullet_list' && (
                          <ul className="list-disc pl-6 space-y-1.5 my-4 text-zinc-300 text-sm md:text-base">
                            {(b.items || []).map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        )}

                        {b.type === 'numbered_list' && (
                          <ol className="list-decimal pl-6 space-y-1.5 my-4 text-zinc-300 text-sm md:text-base">
                            {(b.items || []).map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ol>
                        )}

                        {b.type === 'callout' && (
                          <div className={`p-5 rounded-r-2xl border-l-4 my-5 ${
                            b.style === 'warning' ? 'bg-amber-950/20 border-amber-500/40 text-amber-300' :
                            b.style === 'tip' ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' :
                            'bg-zinc-900 border-zinc-700 text-zinc-300'
                          }`}>
                            <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{b.content}</p>
                          </div>
                        )}

                        {b.type === 'table' && (
                          <div className="overflow-x-auto border border-zinc-900 rounded-xl my-6 bg-zinc-950/30">
                            <table className="w-full text-left text-xs text-zinc-300">
                              <thead className="bg-zinc-900 text-[10px] font-black uppercase text-white border-b border-zinc-850">
                                <tr>
                                  {(b.headers || []).map((h, i) => (
                                    <th key={i} className="px-4 py-3 font-extrabold">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-900">
                                {(b.rows || []).map((row, i) => (
                                  <tr key={i} className="hover:bg-zinc-900/10">
                                    {row.map((cell, j) => (
                                      <td key={j} className="px-4 py-2 text-zinc-350">{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {b.type === 'product_grid' && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
                            {(b.productIds || []).map((pId) => {
                              const pData = allProducts.find(p => p.id === pId);
                              if (!pData) return null;
                              return (
                                <div key={pId} className="border border-zinc-900 rounded-xl overflow-hidden bg-zinc-90/40 hover:scale-[1.02] duration-200">
                                  {pData.images?.[0]?.url && (
                                    <img src={pData.images[0].url} alt={pData.name} className="w-full h-24 object-cover" />
                                  )}
                                  <div className="p-2.5 space-y-1 text-center">
                                    <h5 className="text-[9px] font-black uppercase tracking-tight text-white leading-none whitespace-nowrap overflow-hidden text-ellipsis">{pData.name}</h5>
                                    <p className="text-[9px] font-sans text-red-500 font-extrabold leading-none">R$ {pData.price?.toFixed(2)}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {b.type === 'conclusion' && (
                          <div className="p-6 bg-zinc-900/30 rounded-2xl border border-zinc-900 my-6">
                            <h4 className="text-xs uppercase font-extrabold text-white tracking-widest mb-1">Considerações Finais</h4>
                            <p className="text-zinc-300 text-sm md:text-base font-normal leading-relaxed whitespace-pre-wrap">{b.content}</p>
                          </div>
                        )}

                        {b.type === 'divider' && <hr className="border-zinc-850 my-6" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MOBILE SMARTPHONE PORTABLE CASE */}
              {previewTab === 'mobile' && (
                <div className="max-w-[390px] border border-zinc-800 bg-zinc-950 rounded-[44px] min-h-[640px] px-4 py-8 shadow-2xl mx-auto overflow-y-auto aspect-[9/18] relative ring-8 ring-zinc-900/80 bg-zinc-950 text-left">
                  <div className="space-y-4 pt-4">
                    <span className="text-[9px] text-red-500 font-black uppercase tracking-widest">
                      {categories.find(c => c.id === categoryId)?.name || 'Geral'}
                    </span>
                    <h1 className="text-2xl font-black uppercase italic text-white tracking-tight">
                      {title || "Sem título informado"}
                    </h1>

                    {coverImage && (
                      <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-900">
                        <img src={coverImage} alt={title} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="space-y-4 text-zinc-300 text-xs leading-relaxed font-sans">
                      {contentBlocks.map((b) => (
                        <div key={b.id} className="text-xs">
                          {b.type === 'paragraph' && <p className="text-zinc-300 font-sans leading-relaxed whitespace-pre-wrap">{b.content}</p>}
                          {b.type === 'heading' && b.level === 2 && <h2 className="text-base font-black uppercase italic tracking-tight text-white mt-6 mb-2 border-l-2 border-red-500 pl-2">{b.content}</h2>}
                          {b.type === 'heading' && b.level === 3 && <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200 mt-4 pb-0.5">{b.content}</h3>}
                          {b.type === 'image' && b.url && (
                            <div className="my-4 space-y-1 text-center">
                              <img src={b.url} alt={b.alt} className="w-full object-cover rounded-lg border border-zinc-900" />
                              {b.caption && <p className="text-[8px] text-zinc-500 italic mt-1 font-sans">{b.caption}</p>}
                            </div>
                          )}
                          {b.type === 'quote' && (
                            <blockquote className="border-l-2 border-red-500 bg-zinc-90/20 p-2.5 rounded-r italic text-zinc-100 my-4 text-xs font-medium">
                              {b.content}
                            </blockquote>
                          )}
                          {b.type === 'youtube' && b.videoId && (
                            <div className="my-4 aspect-video rounded-lg overflow-hidden border border-zinc-900">
                              <iframe src={`https://www.youtube.com/embed/${b.videoId}`} className="w-full h-full border-0" allowFullScreen />
                            </div>
                          )}
                          {b.type === 'cta' && b.url && (
                            <div className="my-4 text-center">
                              <a href={b.url} className="inline-flex px-6 py-2 bg-red-650 text-white rounded-full font-black text-[9px] uppercase tracking-wider">
                                {b.content || "Ver produto"}
                              </a>
                            </div>
                          )}
                          {b.type === 'faq' && (
                            <div className="my-2.5 p-3 rounded-xl border border-zinc-900 bg-zinc-90/20">
                              <h4 className="font-extrabold text-[10px] uppercase text-white">{b.question}</h4>
                              <p className="text-[10px] text-zinc-400 mt-1 whitespace-pre-wrap">{b.answer}</p>
                            </div>
                          )}
                          {b.type === 'callout' && (
                            <div className={`p-4 rounded-lg my-3 ${b.style === 'warning' ? 'bg-amber-950/20 text-amber-300' : 'bg-zinc-900 text-zinc-200'}`}>
                              <p className="text-[10px]">{b.content}</p>
                            </div>
                          )}
                          {b.type === 'product_grid' && (
                            <div className="grid grid-cols-2 gap-2 my-4">
                              {(b.productIds || []).map((pId) => {
                                const pData = allProducts.find(p => p.id === pId);
                                if (!pData) return null;
                                return (
                                  <div key={pId} className="border border-zinc-900 rounded-lg overflow-hidden bg-zinc-90/20">
                                    {pData.images?.[0]?.url && (
                                      <img src={pData.images[0].url} alt={pData.name} className="w-full h-16 object-cover" />
                                    )}
                                    <div className="p-1.5 text-center space-y-0.5">
                                      <h5 className="text-[8px] font-black uppercase text-zinc-200 truncate leading-none">{pData.name}</h5>
                                      <p className="text-[8px] text-red-500 font-black">R$ {pData.price?.toFixed(2)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {b.type === 'table' && (
                            <div className="overflow-x-auto my-4 w-full border border-zinc-900 rounded-lg">
                              <table className="w-full text-left text-[8px] text-zinc-300">
                                <thead className="bg-zinc-900 text-zinc-100">
                                  <tr>
                                    {(b.headers || []).map((h, i) => <th key={i} className="px-2 py-1.5">{h}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(b.rows || []).map((row, i) => (
                                    <tr key={i} className="border-t border-zinc-900">
                                      {row.map((cell, j) => <td key={j} className="px-2 py-1">{cell}</td>)}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {b.type === 'divider' && <hr className="border-zinc-900 my-4" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* GOOGLE VIEW PREVIEW */}
              {previewTab === 'google' && (
                <div className="max-w-2xl bg-white text-zinc-900 p-6 rounded-2xl border border-zinc-200 text-left">
                  <span className="text-xs text-zinc-500 font-sans tracking-tight">https://discretaboutique.com.br &gt; blog &gt; {slug}</span>
                  <h3 className="text-xl text-blue-800 font-normal hover:underline cursor-pointer leading-tight mt-1 font-sans">
                    {title || "Sem Título preenchido"} | Discreta Boutique
                  </h3>
                  <p className="text-sm text-zinc-700 leading-normal mt-1 font-sans">
                    {summary || "Preencha a meta description acima nas configurações de sumário do assistente para pré-visualizar o snippet de busca orgânica do Google em Icó."}
                  </p>
                </div>
              )}

              {/* SOCIAL WHATSAPP FACEBOOK PREVIEW */}
              {previewTab === 'social' && (
                <div className="max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden text-left mx-auto">
                  {coverImage && (
                    <div className="aspect-video w-full bg-zinc-950">
                      <img src={coverImage} alt={title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 space-y-1 font-sans">
                    <span className="text-[10px] text-zinc-500 uppercase font-black">DISCRETABOUTIQUE.COM.BR</span>
                    <h4 className="text-sm font-extrabold text-white uppercase">{title || "Título do Post"}</h4>
                    <p className="text-xs text-zinc-400 line-clamp-2">{summary || "Meta-descrição em destaque..."}</p>
                  </div>
                </div>
              )}

              {/* TWITTER X CARD PREVIEW */}
              {previewTab === 'twitter' && (
                <div className="max-w-md border border-zinc-800 bg-zinc-950 rounded-2xl overflow-hidden text-left mx-auto font-sans leading-normal">
                  {coverImage && (
                    <div className="aspect-video w-full">
                      <img src={coverImage} alt={title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3 border-t border-zinc-900 space-y-0.5">
                    <span className="text-[10px] text-zinc-600">discretaboutique.com.br</span>
                    <h4 className="text-xs font-bold text-white leading-tight">{title || "Título do Artigo"}</h4>
                    <p className="text-[11px] text-zinc-400 line-clamp-2">{summary || "Resumo informativo..."}</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
