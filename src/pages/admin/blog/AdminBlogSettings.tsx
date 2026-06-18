import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, ShieldAlert, CheckCircle, Settings, User } from "lucide-react";
import { blogService, BlogSettings } from "../../../services/blogService";

export function AdminBlogSettings() {
  const [settings, setSettings] = useState<BlogSettings>({
    blogName: "Blog Discreta Boutique",
    blogDescription: "Aprenda tudo sobre amor próprio, intimidade, lingerie de qualidade, sensualismo saudável e novidades quentes do mercado com total sigilo e privacidade.",
    postsPerPage: 9,
    defaultCoverImage: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&q=80&w=1200",
    authorName: "Equipe Discreta Boutique",
    authorBio: "Redação composta por consultoras especialistas em autoestima corporal, intimidade, prazer e empoderamento saudável e livre de tabus em Icó-CE."
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const loaded = await blogService.getSettings();
        if (loaded) {
          setSettings(loaded);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await blogService.saveSettings(settings);
      showFeedback('success', "Configurações gerais do blog salvas com sucesso!");
    } catch (err) {
      console.error(err);
      showFeedback('error', "Não foi possível persistir as configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 bg-zinc-950 min-h-screen flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-650 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 mt-4">Buscando configurações...</p>
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
          <h1 className="text-2xl font-black uppercase italic text-white tracking-tight">Configurações Gerais do Blog</h1>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Ajuste o tom, número de páginas e autores principais para SEO orgânico.</p>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-400' 
            : 'bg-red-950/20 border-red-500/25 text-red-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
          <span className="text-xs font-semibold">{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-8">
        {/* Blog layout params */}
        <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-2xl space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-white border-b border-zinc-850 pb-3 flex items-center gap-1.5">
            <Settings size={15} className="text-red-500" />
            Parâmetros de Identidade
          </h3>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nome Oficial do Blog</label>
            <input
              type="text"
              value={settings.blogName}
              onChange={(e) => setSettings({ ...settings, blogName: e.target.value })}
              className="w-full px-4 py-2 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Meta Description Padrão</label>
            <textarea
              rows={4}
              value={settings.blogDescription}
              onChange={(e) => setSettings({ ...settings, blogDescription: e.target.value })}
              className="w-full px-4 py-2 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Artigos por Página no Catálogo</label>
            <input
              type="number"
              value={settings.postsPerPage}
              onChange={(e) => setSettings({ ...settings, postsPerPage: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Imagem de Capa Padrão (URL fallback)</label>
            <input
              type="text"
              value={settings.defaultCoverImage}
              onChange={(e) => setSettings({ ...settings, defaultCoverImage: e.target.value })}
              className="w-full px-4 py-2 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 rounded-xl focus:outline-none"
            />
          </div>
        </div>

        {/* Author / BIO fields */}
        <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-white border-b border-zinc-850 pb-3 flex items-center gap-1.5">
              <User size={15} className="text-red-500" />
              Perfil do Redator / Autor Oficial
            </h3>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nome do Autor Principal</label>
              <input
                type="text"
                value={settings.authorName}
                onChange={(e) => setSettings({ ...settings, authorName: e.target.value })}
                className="w-full px-4 py-2 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 rounded-xl focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Biografia de Autor (Ajuda no algoritmo E-E-A-T do Google)</label>
              <textarea
                rows={5}
                value={settings.authorBio}
                onChange={(e) => setSettings({ ...settings, authorBio: e.target.value })}
                className="w-full px-4 py-2 border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-red-650 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Save size={13} className="inline mr-1" />
              {saving ? "Salvando parâmetros..." : "Salvar Configurações"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
