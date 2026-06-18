import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, Folder, CheckCircle, AlertTriangle } from "lucide-react";
import { blogService, BlogCategory } from "../../../services/blogService";

export function AdminBlogCategories() {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New Category Form
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const cats = await blogService.listCategories();
      setCategories(cats);
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao carregar lista de categorias.");
    } finally {
      setLoading(false);
    }
  }

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  }

  const handleNameChange = (val: string) => {
    setNewCatName(val);
    const generatedSlug = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    setNewCatSlug(generatedSlug);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatSlug.trim()) {
      showFeedback('error', "Nome e Slug são obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      await blogService.saveCategory({
        name: newCatName.trim(),
        slug: newCatSlug.trim(),
        description: newCatDesc.trim()
      });
      showFeedback('success', `Categoria "${newCatName}" criada com sucesso!`);
      setNewCatName("");
      setNewCatSlug("");
      setNewCatDesc("");
      loadCategories();
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao salvar categoria no Firestore.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (catId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover a categoria "${name}"? Os posts associados a ela voltarão para a categoria "Geral".`)) {
      return;
    }
    try {
      await blogService.deleteCategory(catId);
      showFeedback('success', "Categoria removida com sucesso.");
      loadCategories();
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao remover categoria.");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 bg-zinc-950 min-h-screen flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-650 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 mt-4">Buscando categorias...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-zinc-850 pb-6">
        <Link
          to="/admin/blog"
          className="p-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-black uppercase italic text-white tracking-tight">Gerenciar Categorias</h1>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Agrupe seus artigos do blog em silos temáticos ricos.</p>
        </div>
      </div>

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

      <div className="grid md:grid-cols-3 gap-8">
        {/* Create form panel */}
        <div className="p-6 border border-zinc-850 bg-zinc-900/30 rounded-2xl space-y-4 h-fit">
          <h3 className="text-sm font-black uppercase tracking-wider text-white border-b border-zinc-850 pb-3 flex items-center gap-2">
            <Plus size={15} className="text-red-500" />
            Nova Categoria
          </h3>
          
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nome da Categoria *</label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Autoestima & Sedução"
                className="w-full px-3.5 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Slug *</label>
              <input
                type="text"
                required
                value={newCatSlug}
                onChange={(e) => setNewCatSlug(e.target.value)}
                placeholder="autoestima-seducao"
                className="w-full px-3.5 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Descrição curta (Opcional)</label>
              <textarea
                rows={3}
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Discorra sobre o foco dos artigos desse silo..."
                className="w-full px-3.5 py-2 border border-zinc-800 bg-zinc-950 text-xs rounded-xl focus:outline-none focus:border-red-500 text-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-red-650 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
            >
              Criar Categoria
            </button>
          </form>
        </div>

        {/* Categories List table */}
        <div className="md:col-span-2 border border-zinc-850 rounded-2xl overflow-hidden bg-zinc-900/50">
          <div className="p-5 border-b border-zinc-850 bg-zinc-900/80">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Categorias Ativas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-850 text-[9px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-900/40">
                  <th className="py-3 px-5">Nome</th>
                  <th className="py-3 px-5">Slug</th>
                  <th className="py-3 px-5">Descrição</th>
                  <th className="py-3 px-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60 text-xs">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-zinc-500 text-[11px] uppercase tracking-wide">
                      Nenhuma categoria registrada no banco de dados.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-zinc-850/10">
                      <td className="py-3 px-5 font-bold text-zinc-100 flex items-center gap-2">
                        <Folder size={14} className="text-zinc-500" />
                        {cat.name}
                      </td>
                      <td className="py-3 px-5 text-zinc-400 font-mono">/{cat.slug}</td>
                      <td className="py-3 px-5 text-zinc-400 truncate max-w-[180px]">{cat.description || "---"}</td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => handleDeleteCategory(cat.id!, cat.name)}
                          className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors"
                          title="Excluir Categoria"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
