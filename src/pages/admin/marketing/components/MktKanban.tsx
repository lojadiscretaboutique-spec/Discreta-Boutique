import React, { useState } from 'react';
import { 
  Kanban, 
  Plus, 
  Trash2, 
  Clock, 
  CheckSquare, 
  MessageSquare, 
  Paperclip, 
  Tag, 
  Users, 
  AlertCircle,
  Eye,
  X,
  History,
  Send,
  Sparkles
} from 'lucide-react';
import { MktTask, MktChecklistItem, MktComment } from '../marketingTypes';

interface MktKanbanProps {
  tasks: MktTask[];
  moveTask: (taskId: string, targetCol: MktTask['column']) => Promise<void>;
  saveTask: (task: MktTask) => Promise<void>;
  createTask: (task: Omit<MktTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteTask: (id: string) => Promise<void>;
  addCommentToTask: (taskId: string, text: string) => Promise<void>;
  updateChecklistItem: (taskId: string, itemId: string, completed: boolean) => Promise<void>;
  addChecklistItem: (taskId: string, text: string) => Promise<void>;
}

export function MktKanban({
  tasks,
  moveTask,
  saveTask,
  createTask,
  deleteTask,
  addCommentToTask,
  updateChecklistItem,
  addChecklistItem
}: MktKanbanProps) {
  // Columns definition
  const columns: Array<{ id: MktTask['column']; label: string; color: string; border: string }> = [
    { id: 'backlog', label: 'Backlog', color: 'bg-zinc-800 text-zinc-300', border: 'border-zinc-700/60' },
    { id: 'planejado', label: 'Planejado', color: 'bg-blue-950 text-blue-300 border-blue-900/30', border: 'border-blue-900/30' },
    { id: 'em-andamento', label: 'Em Andamento', color: 'bg-amber-950 text-amber-300 border-amber-900/30', border: 'border-amber-900/30' },
    { id: 'aguardando', label: 'Aguardando', color: 'bg-purple-950 text-purple-300 border-purple-900/30', border: 'border-purple-900/30' },
    { id: 'concluido', label: 'Concluído', color: 'bg-emerald-950 text-emerald-300 border-emerald-900/35', border: 'border-emerald-900/20' },
    { id: 'cancelado', label: 'Cancelado', color: 'bg-rose-950 text-rose-300 border-rose-900/20', border: 'border-rose-900/20' }
  ];

  // Filters state
  const [filterPriority, setFilterPriority] = useState<string>('todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<MktTask | null>(null);
  
  // New Task form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPhase, setNewPhase] = useState<MktTask['phase']>('geral');
  const [newCol, setNewCol] = useState<MktTask['column']>('backlog');
  const [newPriority, setNewPriority] = useState<MktTask['priority']>('media');
  const [newDueDate, setNewDueDate] = useState('2026-06-03');
  const [newTag, setNewTag] = useState('');

  // Comment submit state
  const [commentText, setCommentText] = useState('');
  // Subtask submit state
  const [subtaskText, setSubtaskText] = useState('');
  // Attachment submission
  const [attachUrl, setAttachUrl] = useState('');

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const matchesPriority = filterPriority === 'todas' || task.priority === filterPriority;
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPriority && matchesSearch;
  });

  const getPriorityColor = (p: MktTask['priority']) => {
    switch (p) {
      case 'critica': return 'bg-red-950 text-red-400 border-red-900/30 font-black';
      case 'alta': return 'bg-orange-950 text-orange-400 border-orange-900/35';
      case 'media': return 'bg-cyan-950 text-cyan-400 border-cyan-900/30';
      case 'baixa': return 'bg-zinc-800 text-zinc-400 border-zinc-700/50';
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const mockNew: Omit<MktTask, 'id' | 'createdAt' | 'updatedAt'> = {
      campaignId: 'namorados2026',
      name: newTitle,
      phase: newPhase,
      column: newCol,
      priority: newPriority,
      dueDate: newDueDate,
      checklist: [],
      comments: [],
      attachments: [],
      tags: newTag ? newTag.split(',').map(t => t.trim()) : ['Manual'],
      assignees: ['Marketing Manager'],
      history: [
        { id: Math.random().toString(), action: "Criada manualmente pelo gestor", userName: "Gestor Discreta", createdAt: new Date().toISOString() }
      ]
    };

    await createTask(mockNew);
    setNewTitle('');
    setNewTag('');
    setShowCreateForm(false);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTask) return;
    await addCommentToTask(selectedTask.id, commentText);
    
    // Refresh modal local state
    const currentTask = tasks.find(t => t.id === selectedTask.id);
    if (currentTask) {
      setSelectedTask({
        ...currentTask,
        comments: [...currentTask.comments, {
          id: Math.random().toString(),
          userName: 'Gestor Discreta',
          text: commentText,
          createdAt: new Date().toISOString()
        }]
      });
    }
    setCommentText('');
  };

  const handleAddSubtask = async () => {
    if (!subtaskText.trim() || !selectedTask) return;
    await addChecklistItem(selectedTask.id, subtaskText);
    
    const currentTask = tasks.find(t => t.id === selectedTask.id);
    if (currentTask) {
      setSelectedTask({
        ...currentTask,
        checklist: [...currentTask.checklist, {
          id: Math.random().toString(),
          text: subtaskText,
          completed: false
        }]
      });
    }
    setSubtaskText('');
  };

  const handleToggleSubtask = async (sub: MktChecklistItem) => {
    if (!selectedTask) return;
    await updateChecklistItem(selectedTask.id, sub.id, !sub.completed);
    
    // Update local modal view representation
    setSelectedTask(prev => {
      if (!prev) return null;
      return {
        ...prev,
        checklist: prev.checklist.map(item => item.id === sub.id ? { ...item, completed: !item.completed } : item)
      };
    });
  };

  const handleAttachLink = async () => {
    if (!attachUrl.trim() || !selectedTask) return;
    const updated = {
      ...selectedTask,
      attachments: [...selectedTask.attachments, attachUrl],
      history: [
        { id: Math.random().toString(), action: `Anexo adicionado: ${attachUrl.substring(0, 30)}...`, userName: "Gestor", createdAt: new Date().toISOString() },
        ...selectedTask.history
      ]
    };
    await saveTask(updated);
    setSelectedTask(updated);
    setAttachUrl('');
  };

  return (
    <div className="space-y-6 animate-fade-in text-white z-10 relative">
      {/* FILTER CONTROL BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase block">Busca Textual</label>
            <input 
              type="text" 
              placeholder="Filtrar tarefas..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 p-2 text-xs rounded-lg outline-none text-white focus:border-red-650 w-48 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase block">Prioridade</label>
            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 p-2 text-xs rounded-lg outline-none text-white focus:border-red-650 transition-colors"
            >
              <option value="todas">Todas Prioridades</option>
              <option value="critica font-bold">Critica 🔥</option>
              <option value="alta">Alta ⚡</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>

        <button 
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 font-bold text-xs rounded-xl transition-all shadow-[0_4px_12px_rgba(220,38,38,0.25)] flex items-center gap-1.5 cursor-pointer self-stretch md:self-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Criar Nova Tarefa
        </button>
      </div>

      {/* QUICK TASK CREATION FORM */}
      {showCreateForm && (
        <form onSubmit={handleCreateTask} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-down shadow-xl z-20">
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Título da Tarefa</label>
            <input 
              type="text" 
              required
              placeholder="Ex: Contratar influenciadora de biquíni..." 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none focus:border-red-500 text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Meta Ficha / Fase</label>
            <select 
              value={newPhase}
              onChange={(e) => setNewPhase(e.target.value as any)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white"
            >
              <option value="estrutura-comercial">Fase 1 - Estrutura Comercial</option>
              <option value="conteudo-instagram">Fase 2 - Conteúdo Instagram</option>
              <option value="influenciadores">Influenciadores CRM</option>
              <option value="sorteios">Sorteios / Desafios</option>
              <option value="whatsapp">WhatsApp Disparos</option>
              <option value="afiliados">Afiliados Campanha</option>
              <option value="geral">Geral</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Coluna Kanban Inicial</label>
            <select 
              value={newCol}
              onChange={(e) => setNewCol(e.target.value as any)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white"
            >
              <option value="backlog">Backlog</option>
              <option value="planejado">Planejado</option>
              <option value="em-andamento">Em Andamento</option>
              <option value="aguardando">Aguardando</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Prioridade</label>
            <select 
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as any)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white font-semibold"
            >
              <option value="critica" className="text-red-500 font-black">CRÍTICA 🚨</option>
              <option value="alta" className="text-orange-500">ALTA ⚡</option>
              <option value="media">MÉDIA</option>
              <option value="baixa">BAIXA</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Data Limite (Deadline)</label>
            <input 
              type="date" 
              value={newDueDate} 
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white font-mono"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Etiquetas / Tags (separar por vírgula)</label>
            <input 
              type="text" 
              placeholder="Criativos, Copy, Financeiro" 
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none focus:border-red-500 text-white"
            />
          </div>

          <div className="flex items-end gap-2 md:col-span-1 justify-end">
            <button 
              type="button" 
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 text-xs bg-red-650 hover:bg-red-700 bg-red-600 text-white font-bold rounded"
            >
              Adicionar
            </button>
          </div>
        </form>
      )}

      {/* HORIZONTAL KANBAN SCROLLFLOW GRID */}
      <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-thin w-full snap-x snap-mandatory">
        {columns.map(col => {
          const colTasks = filteredTasks.filter(t => t.column === col.id);
          return (
            <div 
              key={col.id} 
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) {
                  await moveTask(taskId, col.id);
                }
              }}
              className={`flex flex-col bg-zinc-900/40 p-4 rounded-2xl border ${col.border} min-w-[280px] md:min-w-[300px] max-h-[75vh] hover:bg-zinc-900/50 transition-colors snap-center`}
            >
              {/* COLUMN HEADER */}
              <div className="flex items-center justify-between mb-3 border-b border-zinc-800/80 pb-2">
                <span className="text-xs font-black tracking-wider text-zinc-300 capitalize flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-550/60 bg-red-600 inline-block shrink-0 shadow-[0_0_6px_rgba(220,38,38,0.5)]" />
                  {col.label}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono text-zinc-500 font-bold bg-zinc-950 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* ACTION PLAN CARDS COLLECTION */}
              <div className="flex-1 space-y-3.5 overflow-y-auto pr-0.5 scrollbar-thin">
                {colTasks.map(task => {
                  const checkTotal = task.checklist.length;
                  const checkDone = task.checklist.filter(c => c.completed).length;

                  return (
                    <div 
                      key={task.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", task.id);
                      }}
                      onClick={() => setSelectedTask(task)}
                      className="group bg-zinc-950/80 border border-zinc-805 hover:border-zinc-700/80 p-4 rounded-xl shadow-lg transition-all cursor-pointer relative hover:-translate-y-0.5 shrink-0 active:opacity-60 cursor-grab"
                    >
                      <div className="space-y-3">
                        {/* Tags and priority */}
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded border ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className="text-[9px] text-zinc-500 capitalize shrink-0 bg-zinc-900 px-1.5 py-0.5 rounded">
                            {task.phase.replace('-', ' ')}
                          </span>
                        </div>

                        {/* Task title */}
                        <h4 className="text-xs font-bold leading-relaxed text-zinc-200 group-hover:text-white transition-colors">
                          {task.name}
                        </h4>

                        {/* Badges footer info */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900 pt-3">
                          <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                            <Clock className="w-3 h-3 text-red-550 shrink-0" />
                            <span>{task.dueDate.split('-').slice(1).reverse().join('/')}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {checkTotal > 0 && (
                              <div className={`flex items-center gap-0.5 text-[10px] shrink-0 ${checkDone === checkTotal ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                <CheckSquare className="w-3 h-3 shrink-0" />
                                <span className="font-mono font-bold">{checkDone}/{checkTotal}</span>
                              </div>
                            )}

                            {task.comments.length > 0 && (
                              <div className="flex items-center gap-0.5 text-[10px] text-zinc-500 shrink-0">
                                <MessageSquare className="w-3 h-3 shrink-0" />
                                <span className="font-mono">{task.comments.length}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive simple Column Selector */}
                        <div className="mt-2.5 pt-2 border-t border-zinc-900/80 flex items-center justify-between">
                          <span className="text-[8px] text-zinc-600 block uppercase font-bold">Mover para:</span>
                          <select 
                            value={task.column}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => moveTask(task.id, e.target.value as any)}
                            className="bg-zinc-900 text-[9px] border-none text-zinc-400 p-1 rounded font-semibold cursor-pointer max-w-[100px]"
                          >
                            {columns.map(c => (
                              <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="text-center py-8 text-[11px] text-zinc-600 font-medium">
                    Sem tarefas nesta coluna
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CORE DETAIL TASK MODAL POPUP */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-up text-white flex flex-col max-h-[90vh]">
            {/* MODAL HEADER */}
            <div className="bg-zinc-950 p-6 flex items-start justify-between border-b border-zinc-800">
              <div className="space-y-1.5 flex-1 pr-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase border rounded ${getPriorityColor(selectedTask.priority)}`}>
                    {selectedTask.priority}
                  </span>
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-zinc-900 text-zinc-400 rounded border border-zinc-800">
                    {selectedTask.phase.replace('-', ' ')}
                  </span>
                </div>
                <h3 className="text-md md:text-lg font-black text-rose-50 font-sans leading-tight">
                  {selectedTask.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {/* Properties strip */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-zinc-950/40 p-4 border border-zinc-800 rounded-xl">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Data Limite</span>
                  <span className="text-xs font-mono font-bold text-zinc-200">
                    {selectedTask.dueDate.split('-').reverse().join('/')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Estado Atual</span>
                  <span className="text-xs font-semibold text-rose-450 text-rose-400 capitalize">
                    {selectedTask.column.replace('-', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Responsáveis</span>
                  <span className="text-xs text-zinc-350">{selectedTask.assignees.join(', ')}</span>
                </div>
              </div>

              {/* Sub-Checklist and adding checklist items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">Resoluções Checklist</h4>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {selectedTask.checklist.filter(c => c.completed).length}/{selectedTask.checklist.length} concluídos
                  </span>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedTask.checklist.map(item => (
                    <div 
                      key={item.id}
                      onClick={() => handleToggleSubtask(item)}
                      className="flex items-center gap-3 p-2 bg-zinc-950/50 hover:bg-zinc-950 border border-zinc-805 rounded-xl cursor-pointer"
                    >
                      <input 
                        type="checkbox" 
                        checked={item.completed} 
                        readOnly
                        className="rounded bg-zinc-800 border-zinc-700 text-red-650 focus:ring-red-500 h-4 w-4 shrink-0"
                      />
                      <span className={`text-[11px] font-medium leading-relaxed ${item.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}

                  {selectedTask.checklist.length === 0 && (
                    <p className="text-[11px] text-zinc-600 font-medium">Nenhum subitem de controle na lista.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Adicionar item de checklist..."
                    value={subtaskText}
                    onChange={(e) => setSubtaskText(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-800 text-xs p-2 rounded outline-none text-white focus:border-red-500"
                  />
                  <button 
                    onClick={handleAddSubtask}
                    className="px-3 py-1.5 bg-zinc-800 text-xs font-extrabold text-zinc-300 hover:text-white rounded hover:bg-zinc-750 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Model attachments list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> Mídias & Arquivos de Apoio
                </h4>

                <div className="space-y-2">
                  {selectedTask.attachments.map((at, index) => (
                    <a 
                      key={index} 
                      href={at} 
                      target="_blank" 
                      referrerPolicy="no-referrer"
                      rel="noreferrer"
                      className="text-xs text-rose-400 hover:underline block truncate bg-zinc-950/30 p-2 border border-zinc-805 rounded-lg font-mono"
                    >
                      📎 {at}
                    </a>
                  ))}

                  {selectedTask.attachments.length === 0 && (
                    <p className="text-[11px] text-zinc-600 font-medium">Nenhum arquivo ou link de referência anexado.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="URL da Imagem de Referência ou Roteiro..."
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-800 text-xs p-2 rounded outline-none text-white focus:border-red-500 font-mono"
                  />
                  <button 
                    onClick={handleAttachLink}
                    className="px-3 py-1.5 bg-zinc-800 text-xs font-extrabold text-zinc-300 hover:text-white rounded hover:bg-zinc-750 transition-colors"
                  >
                    Anexar
                  </button>
                </div>
              </div>

              {/* Real discussions commenting thread */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-305 text-rose-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Discussões do Time
                </h4>

                <div className="space-y-2.5 max-h-48 overflow-y-auto">
                  {selectedTask.comments.map(com => (
                    <div key={com.id} className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-red-400">{com.userName}</span>
                        <span className="font-mono text-zinc-500">{new Date(com.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-zinc-200 leading-relaxed font-sans">{com.text}</p>
                    </div>
                  ))}

                  {selectedTask.comments.length === 0 && (
                    <p className="text-[11px] text-zinc-650 text-zinc-600 font-medium">Seja o primeiro a deixar uma orientação ou nota de feedback!</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Escrever instrução privada de apoio..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-800 text-xs p-2.5 rounded-xl outline-none text-white focus:border-red-500"
                  />
                  <button 
                    onClick={handleAddComment}
                    className="px-4 bg-red-600 hover:bg-red-700 text-xs font-bold text-white rounded-xl flex items-center justify-center transition-colors shadow-sm"
                  >
                    Enviar
                  </button>
                </div>
              </div>

              {/* Auditory log history tracking */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Histórico de Alterações (Logs Auditáveis)
                </h4>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {selectedTask.history.map(item => (
                    <div key={item.id} className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>• {item.action}</span>
                      <span className="shrink-0">{item.userName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="bg-zinc-950 p-4 border-t border-zinc-800 flex justify-between">
              <button 
                onClick={async () => {
                  if (confirm('Tem certeza de que deseja excluir esta tarefa?')) {
                    await deleteTask(selectedTask.id);
                    setSelectedTask(null);
                  }
                }}
                className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-900/30 text-xs text-red-400 hover:text-white rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Tarefa
              </button>
              
              <button 
                onClick={() => setSelectedTask(null)}
                className="px-4 py-1.5 bg-zinc-800 text-xs text-zinc-300 hover:text-white rounded-lg font-bold hover:bg-zinc-750 transition-colors cursor-pointer"
              >
                Fechar Diário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
