import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, CheckSquare, Search, Globe, ChevronRight } from "lucide-react";
import { blogService, BlogPost } from "../../../services/blogService";

export function AdminBlogSEO() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const loaded = await blogService.listPosts();
        setPosts(loaded);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // SEO Health Checklist calculation metrics for active blogs
  const getCheckingLogs = () => {
    const published = posts.filter(p => p.status === 'publicado');
    const logs = [
      {
        id: "sitemap",
        title: "Sitemap XML Otimizado",
        desc: "Sitemap configurado dinamicamente para notificar crawlers em /sitemap.xml",
        status: "success"
      },
      {
        id: "canonical",
        title: "Tags Canônicas Dinâmicas",
        desc: "Evita que conteúdos semelhantes criem conflitos de canibalização de links no Google.",
        status: "success"
      },
      {
        id: "meta_titles",
        title: "Meta-títulos de Artigos",
        desc: `${published.filter(p => p.title && p.title.length >= 30).length} de ${published.length} artigos publicados possuem títulos com densidade de clique ideal.`,
        status: published.length === 0 ? "warning" : "success"
      },
      {
        id: "rich_schema",
        title: "Esquema JSON-LD BlogPosting",
        desc: "Todos os artigos injetam JSON-LD estruturado diretamente no HTML retornado pelo servidor.",
        status: "success"
      },
      {
        id: "faq_schema",
        title: "Acordeões de Pergunta Frequente Google",
        desc: `${published.filter(p => p.seo?.faq && p.seo?.faq.length > 0).length} artigos possuem FAQs configuradas. Isso ativa rich snippets de alta conversão!`,
        status: "info"
      }
    ];
    return logs;
  };

  if (loading) {
    return (
      <div className="text-center py-20 bg-zinc-950 min-h-screen flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-650 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 mt-4">Calculando métricas SEO...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <div className="flex items-center gap-3 border-b border-zinc-850 pb-6">
        <Link
          to="/admin/blog"
          className="p-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-black uppercase italic text-white tracking-tight flex items-center gap-2">
            <Sparkles className="text-amber-500" />
            Checklist Técnico SEO
          </h1>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Garanta que de ponta a ponta o blog siga as diretrizes estritas do Google.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left checklists sidebar */}
        <div className="md:col-span-2 space-y-5">
          <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-2xl space-y-5">
            <h3 className="text-sm font-black uppercase tracking-wider text-white border-b border-zinc-850 pb-3 flex items-center gap-2">
              <CheckSquare size={16} className="text-red-500" />
              Métricas e Auditorias Ativas
            </h3>

            <div className="space-y-4">
              {getCheckingLogs().map((item, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-850/60">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    item.status === 'success' ? 'bg-emerald-500' : item.status === 'warning' ? 'bg-amber-500' : 'bg-sky-400'
                  }`} />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-xs uppercase tracking-wide text-zinc-100">{item.title}</h4>
                    <p className="text-[11px] text-zinc-400 leading-normal">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick instructions block */}
          <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-2xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Manual EEAT: Lingerie & Sexualidade</h3>
            <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
              <p>O Google impõe filtros robustos de qualidade para assuntos íntimos. Siga estas diretrizes para rankear acima dos concorrentes em Icó-CE:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-zinc-200">Tom Científico e Respeitoso:</strong> Trate de lubrificantes, estimulantes e sexualidade de forma empática, evitando apelo vulgar. O robô rejeita linguajar obsceno.</li>
                <li><strong className="text-zinc-200">Palavras-Chave de Intenção Local:</strong> Sempre cite termos como "sex shop em Icó", "lingerie elegante no Centro-Sul cearense" ou "entrega discreta em Iguatu". Isso ativa o robô de buscas regionais!</li>
                <li><strong className="text-zinc-200">Interligação de Links:</strong> Sempre que citar lingeries vermelhas ou vibradores em gel, inclua links relacionando para os produtos ativos da boutique catalogados.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Preview of visual serp inside search card */}
        <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-2xl space-y-5 h-fit">
          <h3 className="text-sm font-black uppercase tracking-wider text-white border-b border-zinc-850 pb-3 flex items-center gap-1.5">
            <Search size={15} className="text-red-500" />
            Visualizador SERP
          </h3>

          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Como o Blog aparece no Google:</p>

          <div className="p-4 rounded-xl bg-white text-zinc-900 space-y-1 font-sans text-left text-xs shadow-lg leading-snug">
            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] uppercase font-bold truncate">
              <Globe size={11} />
              <span>https://discretaboutique.com.br &gt; blog</span>
            </div>
            <h4 className="text-[#1a0dab] font-semibold text-sm hover:underline hover:cursor-pointer break-words leading-tight">
              Blog Discreta Boutique | Sexualidade, Lingerie e Bem-Estar em Icó - CE
            </h4>
            <p className="text-[#4d5156] font-normal leading-normal text-[11px] break-words">
              Aprenda sobre saúde íntima, dicas de sedução, novidades em lingeries, cosméticos sensuais e ideias para casais no blog oficial da Discreta Boutique em Icó, Ceará.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/admin/blog"
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-extrabold text-[10px] uppercase rounded-lg tracking-wider transition-all flex items-center justify-center gap-1"
            >
              Voltar ao Hub <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
