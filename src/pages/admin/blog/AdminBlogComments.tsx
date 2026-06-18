import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, Check, X, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { blogService, BlogComment } from "../../../services/blogService";

export function AdminBlogComments() {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadComments();
  }, []);

  async function loadComments() {
    setLoading(true);
    try {
      const loaded = await blogService.listAllComments();
      setComments(loaded);
    } catch (err) {
      console.error(err);
      showFeedback('error', "Não foi possível resgatar os comentários registrados.");
    } finally {
      setLoading(false);
    }
  }

  function showFeedback(type: 'success' | 'error', message: string) {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  }

  const handleStatusChange = async (commentId: string, status: 'approved' | 'rejected') => {
    try {
      await blogService.updateCommentStatus(commentId, status);
      showFeedback('success', `Comentário foi marcado como ${status === 'approved' ? 'Aprovado' : 'Rejeitado'} com sucesso.`);
      loadComments();
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao alterar status do comentário.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Tem certeza que deseja excluir permanentemente este comentário?")) return;
    try {
      await blogService.deleteComment(commentId);
      showFeedback('success', "Comentário excluído para sempre.");
      loadComments();
    } catch (err) {
      console.error(err);
      showFeedback('error', "Erro ao tentar remover o comentário.");
    }
  };

  const filteredComments = comments.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 bg-zinc-950 min-h-screen flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-red-655 animate-spin" />
        <p className="text-xs uppercase font-extrabold tracking-widest text-zinc-500 mt-4">Carregando fila de moderação de comentários...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/blog"
            className="p-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-black uppercase italic text-white tracking-tight flex items-center gap-2">
              <MessageSquare size={22} className="text-red-500" />
              Moderação de Comentários
            </h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Modere e garanta um debate civilizado e elegante no blog.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-fit shrink-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              filter === 'all' ? 'bg-zinc-855 bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              filter === 'pending' ? 'bg-amber-600/20 text-amber-500 border border-amber-500/10' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pendentes ({comments.filter(c => c.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              filter === 'approved' ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/10' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Aprovados ({comments.filter(c => c.status === 'approved').length})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
              filter === 'rejected' ? 'bg-red-600/20 text-red-500 border border-red-500/10' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Rejeitados ({comments.filter(c => c.status === 'rejected').length})
          </button>
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

      {/* Grid Comments */}
      <div className="space-y-4">
        {filteredComments.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-850 rounded-2xl bg-zinc-900/10 p-10 space-y-4">
            <MessageSquare size={36} className="text-zinc-700 mx-auto" />
            <p className="text-zinc-500 text-xs">Nenhum comentário na fila para este filtro.</p>
          </div>
        ) : (
          filteredComments.map((c) => (
            <div 
              key={c.id} 
              className="p-6 border border-zinc-850 rounded-2xl bg-zinc-900/30 flex flex-col md:flex-row gap-6 md:items-start transition-all hover:border-zinc-800"
            >
              {/* Profile letter avatar */}
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-extrabold uppercase text-xs text-red-500 shrink-0 border border-zinc-700">
                {c.authorName.charAt(0)}
              </div>

              {/* Text detail */}
              <div className="space-y-3 flex-1">
                <div>
                  <h4 className="font-extrabold text-sm uppercase text-zinc-100 flex flex-wrap items-center gap-2">
                    {c.authorName} 
                    <span className="text-[10px] uppercase font-normal text-zinc-500">({c.authorEmail})</span>
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded ${
                      c.status === 'pending' ? 'bg-amber-600/10 text-amber-500' : c.status === 'approved' ? 'bg-emerald-600/10 text-emerald-500' : 'bg-red-650/15 text-red-500'
                    }`}>
                      {c.status === 'pending' ? 'Pendente' : c.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                    </span>
                  </h4>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-wider">
                    Post Relacionado: <span className="text-zinc-300 italic">{c.postTitle || 'Desconhecido'}</span> &bull; {formatDate(c.createdAt)}
                  </p>
                </div>

                <p className="text-xs md:text-sm text-zinc-350 leading-relaxed font-semibold">"{c.content}"</p>
              </div>

              {/* Action Buttons panel */}
              <div className="flex xl:flex-col gap-2 shrink-0 self-end md:self-start">
                {c.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(c.id!, 'approved')}
                      className="p-2 bg-emerald-650/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-lg transition-all flex items-center justify-center border border-emerald-500/10"
                      title="Aprovar Comentário"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => handleStatusChange(c.id!, 'rejected')}
                      className="p-2 bg-red-650/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all flex items-center justify-center border border-red-500/10"
                      title="Rejeitar Comentário"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}

                {c.status === 'approved' && (
                  <button
                    onClick={() => handleStatusChange(c.id!, 'rejected')}
                    className="p-2 bg-zinc-805 bg-zinc-800 hover:bg-red-650 hover:text-white text-zinc-400 rounded-lg transition-all flex items-center justify-center"
                    title="Mover para Rejeitados"
                  >
                    <X size={14} />
                  </button>
                )}

                {c.status === 'rejected' && (
                  <button
                    onClick={() => handleStatusChange(c.id!, 'approved')}
                    className="p-2 bg-zinc-805 bg-zinc-800 hover:bg-emerald-650 hover:text-white text-zinc-400 rounded-lg transition-all flex items-center justify-center"
                    title="Mover para Aprovados"
                  >
                    <Check size={14} />
                  </button>
                )}

                <button
                  onClick={() => handleDeleteComment(c.id!)}
                  className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-lg transition-all flex items-center justify-center"
                  title="Excluir Definitivamente"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
