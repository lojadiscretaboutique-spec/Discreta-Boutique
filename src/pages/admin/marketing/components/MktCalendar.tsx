import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Tag, 
  Megaphone, 
  Sparkles, 
  Layers, 
  MessageSquare, 
  Gift, 
  Users, 
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  PlusCircle,
  Copy,
  Edit2,
  Trash2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  AlertCircle
} from 'lucide-react';
import { MktTask, MktInfluencer, MktGiveaway, MktWhatsAppShot, MktPromotion } from '../marketingTypes';

interface MktCalendarProps {
  tasks: MktTask[];
  influencers: MktInfluencer[];
  giveaways: MktGiveaway[];
  whatsAppShots: MktWhatsAppShot[];
  promotions: MktPromotion[];
  saveTask?: (task: MktTask) => Promise<void>;
  createTask?: (task: Omit<MktTask, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteTask?: (id: string) => Promise<void>;
}

interface CalendarEvent {
  id: string; // matches task_ID, inf_ID, giv_ID etc
  originalId: string; // raw database element ID
  type: 'post' | 'story' | 'sorteio' | 'whats' | 'influencer' | 'promo' | 'general';
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  details?: string;
  tagColor: string;
  meta?: any;
}

export function MktCalendar({
  tasks,
  influencers,
  giveaways,
  whatsAppShots,
  promotions,
  saveTask,
  createTask,
  deleteTask
}: MktCalendarProps) {
  const [activeView, setActiveView] = useState<'dia' | 'semana' | 'mes' | 'timeline'>('mes');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [currentMonth, setCurrentMonth] = useState<number>(5); // June is index 5
  const [currentYear] = useState<number>(2026);

  // States to add or edit a post/task directly on the calendar
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Schedule Form fields
  const [schedId, setSchedId] = useState('');
  const [schedName, setSchedName] = useState('');
  const [schedDate, setSchedDate] = useState('2026-06-01');
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedPhase, setSchedPhase] = useState<'estrutura-comercial' | 'conteudo-instagram' | 'geral' | 'influenciadores' | 'sorteios' | 'whatsapp' | 'afiliados'>('conteudo-instagram');
  const [schedPriority, setSchedPriority] = useState<'baixa' | 'media' | 'alta' | 'critica'>('media');
  const [schedTags, setSchedTags] = useState('Instagram, Post');
  const [schedColumn, setSchedColumn] = useState<'backlog' | 'planejado' | 'em-andamento' | 'aguardando' | 'concluido'>('planejado');
  const [schedNotes, setSchedNotes] = useState('');

  // Auto aggregated events pool
  const events: CalendarEvent[] = [];

  // 1. Compile Instagram/General Tasks
  tasks.forEach(t => {
    const isStory = t.name.toLowerCase().includes('story') || t.tags.some(tag => tag.toLowerCase().includes('story'));
    const isPost = t.name.toLowerCase().includes('post') || t.tags.some(tag => tag.toLowerCase().includes('post')) || t.name.toLowerCase().includes('reel');
    
    events.push({
      id: `task_${t.id}`,
      originalId: t.id,
      type: isStory ? 'story' : (isPost ? 'post' : 'general'),
      title: t.name,
      date: t.dueDate,
      time: t.dueTime || '09:00',
      details: t.checklist && t.checklist.length > 0 
        ? `${t.name}. Checklist: ${t.checklist.map(c => `[${c.completed ? 'x' : ' '}] ${c.text}`).join(' | ')}. ${t.priority.toUpperCase()} PRIORIDADE.`
        : `${t.name}. (${t.priority.toUpperCase()} PRIORIDADE).`,
      tagColor: isStory ? 'bg-orange-550 border-orange-500/30' : (isPost ? 'bg-rose-550 border-rose-500/30 text-rose-50' : 'bg-zinc-800 border-zinc-700'),
      meta: t
    });
  });

  // 2. Compile CRM Influencer Contacts
  influencers.forEach(inf => {
    events.push({
      id: `inf_${inf.id}`,
      originalId: inf.id,
      type: 'influencer',
      title: `CRM Post: ${inf.name} (${inf.instagram})`,
      date: inf.status === 'confirmado' ? '2026-06-05' : '2026-06-02',
      time: '14:00',
      details: `Influenciadora: ${inf.name}. Status: ${inf.status.toUpperCase()}. Nicho: ${inf.niche}. Cidade: ${inf.city}. Enviar lembretes e kits. Notas: ${inf.notes}`,
      tagColor: 'bg-blue-950 border-blue-900/35 text-sky-300',
      meta: inf
    });
  });

  // 3. Compile Sorteio events
  giveaways.forEach(g => {
    events.push({
      id: `giv_pub_${g.id}`,
      originalId: g.id,
      type: 'sorteio',
      title: `Lançar Sorteio: ${g.name}`,
      date: g.publishedAt,
      time: '12:00',
      details: `Publicar foto oficial do Sorteio no feed do Instagram. Regras e prêmios: ${g.description}. Métrica atual: ${g.participantsJoined} participações.`,
      tagColor: 'bg-purple-950 border-purple-900/35 text-purple-300',
      meta: g
    });
    events.push({
      id: `giv_end_${g.id}`,
      originalId: g.id,
      type: 'sorteio',
      title: `Encerramento Sorteio: ${g.name}`,
      date: g.endsAt.substring(0, 10),
      time: '23:59',
      details: `Fechar comentários do Sorteio oficial e extrair participantes para sorteio do prêmio.`,
      tagColor: 'bg-purple-950 border-purple-900/35 text-purple-300 font-extrabold',
      meta: g
    });
    events.push({
      id: `giv_res_${g.id}`,
      originalId: g.id,
      type: 'sorteio',
      title: `Resultado Sorteio: ${g.name}`,
      date: g.resultAt,
      time: '18:00',
      details: 'Realizar live de Sorteio do Dia dos Namorados e divulgar ganhador nos stories.',
      tagColor: 'bg-indigo-950 border-indigo-900/35 text-indigo-300',
      meta: g
    });
  });

  // 4. Compile WhatsApp Shots
  whatsAppShots.forEach(s => {
    events.push({
      id: `shot_${s.id}`,
      originalId: s.id,
      type: 'whats',
      title: `Zap Broadcast: ${s.title}`,
      date: s.date,
      time: '10:00',
      details: `Transmissão WhatsApp Disparada. Público Alvo: ${s.targetGroup}. Mensagem Enviada: "${s.text}"`,
      tagColor: 'bg-emerald-950 border-emerald-900 text-emerald-400',
      meta: s
    });
  });

  // 5. Compile Promo codes active timelines
  promotions.forEach(p => {
    events.push({
      id: `promo_${p.id}`,
      originalId: p.id,
      type: 'promo',
      title: `Início Cupom: ${p.code}`,
      date: p.startDate,
      time: '00:01',
      details: `Cupom: ${p.code}. Desconto: ${p.discountValue}%. ${p.description}.`,
      tagColor: 'bg-amber-950 border-amber-900 text-amber-400',
      meta: p
    });
    events.push({
      id: `promo_end_${p.id}`,
      originalId: p.id,
      type: 'promo',
      title: `Término Cupom: ${p.code}`,
      date: p.endDate,
      time: '23:59',
      details: `Inativação de códigos promocionais e remoção dos banners do site.`,
      tagColor: 'bg-rose-950 border-rose-900 text-rose-450 text-rose-400',
      meta: p
    });
  });

  // Days of June 2026 (Starts Monday, 1st to 30th)
  const juneDays: Array<{ dateStr: string; dayNum: number; isInMonth: boolean }> = [];
  for (let i = 1; i <= 30; i++) {
    const dayStr = i < 10 ? `0${i}` : `${i}`;
    juneDays.push({
      dateStr: `2026-06-${dayStr}`,
      dayNum: i,
      isInMonth: true
    });
  }

  // Group events by date
  const getEventsForDate = (date: string) => {
    return events.filter(e => e.date === date).sort((a,b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });
  };

  const getEventBadgeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'post': return 'bg-rose-600 border-rose-500/30 text-rose-50';
      case 'story': return 'bg-orange-500 border-orange-400/30 text-orange-50';
      case 'sorteio': return 'bg-purple-600 border-purple-500/30 text-purple-50';
      case 'whats': return 'bg-emerald-600 border-emerald-500/30 text-emerald-50';
      case 'influencer': return 'bg-blue-600 border-blue-500/30 text-blue-50';
      case 'promo': return 'bg-amber-600 border-amber-500/30 text-amber-50';
      default: return 'bg-zinc-700 border-zinc-650 text-zinc-100';
    }
  };

  // --- ACTIONS HANDLERS ---
  const handleOpenCreatePost = () => {
    setIsEditing(false);
    setSchedName('');
    setSchedDate('2026-06-01');
    setSchedTime('09:00');
    setSchedPhase('conteudo-instagram');
    setSchedPriority('media');
    setSchedTags('Instagram, Post');
    setSchedColumn('planejado');
    setSchedNotes('');
    setShowScheduleModal(true);
  };

  const handleOpenEditPost = (ev: CalendarEvent) => {
    if (ev.type !== 'post' && ev.type !== 'story' && ev.type !== 'general') {
      alert("Apenas publicações e tarefas do plano de ação podem ser editadas diretamente no calendário.");
      return;
    }
    const t = ev.meta as MktTask;
    setIsEditing(true);
    setSchedId(t.id);
    setSchedName(t.name);
    setSchedDate(t.dueDate);
    setSchedTime(t.dueTime || '09:00');
    setSchedPhase(t.phase);
    setSchedPriority(t.priority);
    setSchedTags(t.tags ? t.tags.join(', ') : 'Instagram, Post');
    setSchedColumn(t.column);
    setSchedNotes(t.checklist && t.checklist.length > 0 ? t.checklist.map(c => c.text).join('\n') : '');
    setSelectedEvent(null); // Close detail modal
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedName.trim()) return;

    const checklistItems = schedNotes 
      ? schedNotes.split('\n').filter(l => l.trim()).map(text => ({ id: Math.random().toString(), text, completed: false }))
      : [{ id: 'chk_1', text: "Criar Mockup e Banner", completed: false }, { id: 'chk_2', text: "Publicar no Instagram", completed: false }];

    if (isEditing && saveTask) {
      const originalTask = tasks.find(t => t.id === schedId);
      if (!originalTask) return;

      const updatedTask: MktTask = {
        ...originalTask,
        name: schedName,
        dueDate: schedDate,
        dueTime: schedTime,
        phase: schedPhase,
        priority: schedPriority,
        column: schedColumn,
        tags: schedTags.split(',').map(tag => tag.trim()).filter(Boolean),
        checklist: checklistItems,
        updatedAt: new Date().toISOString()
      };
      await saveTask(updatedTask);
      alert("Publicação atualizada no calendário!");
    } else if (createTask) {
      await createTask({
        campaignId: 'namorados2026',
        name: schedName,
        phase: schedPhase,
        column: schedColumn,
        priority: schedPriority,
        dueDate: schedDate,
        dueTime: schedTime,
        checklist: checklistItems,
        comments: [],
        attachments: [],
        tags: schedTags.split(',').map(tag => tag.trim()).filter(Boolean),
        assignees: ["Marketing Manager"],
        history: [{ id: 'hist_c', action: 'Tarefa agendada via calendário', userName: 'Gestor', createdAt: new Date().toISOString() }]
      });
      alert("Publicação agendada com sucesso!");
    }

    setShowScheduleModal(false);
  };

  const handleDuplicatePost = async (ev: CalendarEvent) => {
    if (ev.type !== 'post' && ev.type !== 'story' && ev.type !== 'general') return;
    const t = ev.meta as MktTask;
    if (!createTask) return;

    // Shift date by 1 day as duplicate suggestion
    const nextDate = new Date(t.dueDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const formattedNextDate = nextDate.toISOString().substring(0, 10);

    await createTask({
      campaignId: t.campaignId,
      name: `${t.name} (Cópia)`,
      phase: t.phase,
      column: 'planejado',
      priority: t.priority,
      dueDate: formattedNextDate,
      dueTime: t.dueTime || '09:00',
      checklist: t.checklist ? t.checklist.map(c => ({ id: Math.random().toString(), text: c.text, completed: false })) : [],
      comments: [],
      attachments: [],
      tags: [...t.tags, 'Duplicado'],
      assignees: [...t.assignees],
      history: [{ id: Math.random().toString(), action: 'Duplicado a partir do calendário', userName: 'Gestor', createdAt: new Date().toISOString() }]
    });

    alert(`Post duplicado e agendado para o dia seguinte: ${formattedNextDate.split('-').reverse().join('/')}!`);
    setSelectedEvent(null);
  };

  const handleDeletePost = async (ev: CalendarEvent) => {
    if (!deleteTask) return;
    if (confirm(`Tem certeza que deseja desmarcar e excluir a publicação "${ev.title}"?`)) {
      await deleteTask(ev.originalId);
      setSelectedEvent(null);
      alert("Publicação removida com sucesso.");
    }
  };

  // Drag and allocation re-scheduling simulator helper
  const handleQuickReschedule = async (ev: CalendarEvent, newDate: string) => {
    if (ev.type !== 'post' && ev.type !== 'story' && ev.type !== 'general') return;
    const t = ev.meta as MktTask;
    if (!saveTask) return;

    const updatedTask: MktTask = {
      ...t,
      dueDate: newDate,
      updatedAt: new Date().toISOString()
    };
    await saveTask(updatedTask);
    alert(`Publicação reagendada com sucesso para ${newDate.split('-').reverse().join('/')}!`);
    setSelectedEvent(null);
  };

  return (
    <div className="space-y-6 animate-fade-in text-white z-10 relative">
      
      {/* FILTER BUTTON BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/70 p-5 rounded-2xl border border-zinc-850 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-5 h-5 text-red-500 animate-pulse" />
          <div>
            <h2 className="text-sm font-black tracking-wider uppercase text-zinc-100">Cronograma de Atividades Integrado</h2>
            <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-widest font-mono">Controle de Postagens, Sorteios e WhatsApp</span>
          </div>
        </div>

        {/* Display modes tabs */}
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <button
            onClick={handleOpenCreatePost}
            className="px-3.5 py-1.5 bg-red-650 hover:bg-red-700 bg-red-600 text-xs font-black rounded-xl text-white flex items-center gap-1 cursor-pointer w-full sm:w-auto justify-center shadow-md shadow-red-950/20"
          >
            <PlusCircle className="w-4 h-4" /> Agendar Postagem
          </button>

          <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl shrink-0">
            {(['dia', 'semana', 'mes', 'timeline'] as const).map(view => (
              <button 
                key={view}
                onClick={() => setActiveView(view)}
                className={`px-3 py-1 text-[10.5px] font-black capitalize rounded-lg transition-all cursor-pointer ${activeView === view ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'}`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RENDER VIEW SCHEDULERS */}
      {activeView === 'mes' && (
        <div className="bg-zinc-950/45 p-6 rounded-2xl border border-zinc-85c border-zinc-805 backdrop-blur-md shadow-inner overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none font-mono">
              <div>Segunda</div>
              <div>Terça</div>
              <div>Quarta</div>
              <div>Quinta</div>
              <div>Sexta</div>
              <div>Sábado</div>
              <div>Domingo</div>
            </div>

            {/* Grid structure */}
            <div className="grid grid-cols-7 gap-3 min-h-[400px]">
              {juneDays.map(day => {
                const dayEvents = getEventsForDate(day.dateStr);
                return (
                  <div 
                    key={day.dateStr}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      const evData = e.dataTransfer.getData("text/plain");
                      if (evData) {
                        try {
                          const ev = JSON.parse(evData) as CalendarEvent;
                          await handleQuickReschedule(ev, day.dateStr);
                        } catch (err) {}
                      }
                    }}
                    className="bg-zinc-900/40 border border-zinc-805 p-2 rounded-xl min-h-[110px] flex flex-col justify-between group hover:border-zinc-700 hover:bg-zinc-900/60 transition-all cursor-pointer"
                  >
                    <span className="text-[10px] font-black text-zinc-550 group-hover:text-white font-mono self-end">
                      {day.dayNum}
                    </span>

                    {/* Date lists */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] mt-1 scrollbar-none pr-0.5">
                      {dayEvents.map(ev => (
                        <div 
                          key={ev.id}
                          draggable={ev.type === 'post' || ev.type === 'story' || ev.type === 'general'}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", JSON.stringify(ev));
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }}
                          className={`text-[8.5px] p-1 px-1.5 rounded-lg truncate border font-extrabold flex items-center justify-between gap-1 shadow-sm transition-opacity active:opacity-55 active:scale-95 cursor-grab hover:brightness-110 ${getEventBadgeColor(ev.type)}`}
                          title={`${ev.time} - ${ev.title}`}
                        >
                          <div className="flex items-center gap-1 truncate w-full">
                            <span className="w-1 h-1 rounded-full bg-white opacity-60 shrink-0" />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeView === 'dia' && (
        <div className="bg-zinc-950/45 p-6 rounded-2xl border border-zinc-850 backdrop-blur-md max-w-xl mx-auto space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-xs font-black text-zinc-200 uppercase tracking-widest font-mono">Ações do Dia da Operação</h3>
              <p className="text-[10px] text-zinc-500 font-bold font-mono">01 de Junho de 2026</p>
            </div>
            <span className="text-[10px] bg-red-950/50 border border-red-900/30 text-rose-400 font-black px-2.5 py-1 rounded-full">Dia 1</span>
          </div>

          <div className="space-y-3.5">
            {getEventsForDate('2026-06-01').map(ev => (
              <div 
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className="flex items-start gap-4 p-4 bg-zinc-900/50 border border-zinc-805 rounded-2xl hover:border-zinc-700 cursor-pointer group transition-all"
              >
                <div className={`mt-0.5 p-2 rounded-xl text-white ${getEventBadgeColor(ev.type).split(' ')[0]}`}>
                  {ev.type === 'whats' ? <MessageSquare className="w-4.5 h-4.5" /> : (ev.type === 'sorteio' ? <Gift className="w-4.5 h-4.5" /> : <Megaphone className="w-4.5 h-4.5" />)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold uppercase text-zinc-400">{ev.time}</span>
                    <span className="text-zinc-700 font-mono text-[9px]">•</span>
                    <span className="text-[9px] font-black uppercase text-rose-450 text-rose-400 leading-none capitalize">{ev.type}</span>
                  </div>
                  <h4 className="text-xs font-black text-zinc-200 group-hover:text-white transition-colors">{ev.title}</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-sans max-w-md line-clamp-2">{ev.details}</p>
                </div>
              </div>
            ))}

            {getEventsForDate('2026-06-01').length === 0 && (
              <p className="text-center py-12 text-zinc-650 text-xs font-medium italic">Nenhuma postagem agendada para este dia.</p>
            )}
          </div>
        </div>
      )}

      {activeView === 'semana' && (
        <div className="bg-zinc-950/45 p-6 rounded-2xl border border-zinc-805 backdrop-blur-md shadow-2xl overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 min-w-[800px]">
            {juneDays.slice(0, 7).map((day, idx) => {
              const dayEvents = getEventsForDate(day.dateStr);
              const weekdays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
              return (
                <div key={day.dateStr} className="bg-zinc-900/30 border border-zinc-805 rounded-xl p-4 space-y-3 min-h-[180px]">
                  <div className="border-b border-zinc-800/80 pb-1.5 flex justify-between items-baseline">
                    <span className="text-[10px] font-black text-red-500 uppercase font-mono">D. {day.dayNum}</span>
                    <span className="text-[9px] font-bold text-zinc-500">{weekdays[idx]}</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dayEvents.map(ev => (
                      <div 
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`p-2.5 rounded-lg border text-[9px] font-extrabold cursor-pointer hover:opacity-95 transition-all flex flex-col gap-1 ${getEventBadgeColor(ev.type)}`}
                        title={ev.title}
                      >
                        <span className="font-mono text-[8px] opacity-60">⏰ {ev.time}</span>
                        <span className="leading-tight truncate">{ev.title}</span>
                      </div>
                    ))}

                    {dayEvents.length === 0 && (
                      <div className="text-center py-8 text-[9px] text-zinc-600 font-bold font-mono">SEM AÇÕES</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeView === 'timeline' && (
        <div className="bg-zinc-950/45 p-6 rounded-2xl border border-zinc-805 backdrop-blur-md max-w-xl mx-auto shadow-2xl">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-6 font-mono leading-none">Voo de Pássaro das Campanhas Ativas</h3>
          
          <div className="space-y-5 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-zinc-800">
            {events.slice(0, 15).map((ev, index) => (
              <div 
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className="flex items-start gap-4 pl-8 relative group cursor-pointer"
              >
                {/* Node pin point */}
                <div className={`absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full border border-zinc-950 z-10 transition-transform group-hover:scale-125 ${getEventBadgeColor(ev.type).split(' ')[0]}`} />
                
                <div className="bg-zinc-900/40 border border-zinc-805 hover:border-zinc-700/85 p-4 rounded-xl flex-1 space-y-1 transition-all">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-mono text-zinc-550 font-bold">{ev.date.split('-').reverse().join('/')} às {ev.time}</span>
                    <span className="font-black uppercase text-rose-500">{ev.type}</span>
                  </div>
                  <h4 className="text-xs font-black text-zinc-200 group-hover:text-white transition-colorsLeading">{ev.title}</h4>
                  <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">{ev.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EVENT DETAIL FLOATING SELECT DIALOG OVERLAY */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up text-white">
            <div className="bg-zinc-950 p-6 flex items-start justify-between border-b border-zinc-800">
              <div className="space-y-1.5">
                <span className={`px-2 py-0.5 text-[8.5px] font-extrabold uppercase border border-white/10 rounded-full ${getEventBadgeColor(selectedEvent.type)}`}>
                  {selectedEvent.type.toUpperCase()}
                </span>
                <h3 className="text-sm font-black text-rose-50 font-sans leading-tight">
                  Visualizar Atividade do Cronograma
                </h3>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <span className="text-[9px] uppercase font-bold text-zinc-550 font-mono block">Ação Agendada</span>
                <h4 className="text-xs font-black text-zinc-100">{selectedEvent.title}</h4>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-zinc-950/40 p-4 border border-zinc-805 rounded-xl font-mono text-xs">
                <div>
                  <span className="text-[9px] uppercase font-black text-zinc-500 block">Data de Execução</span>
                  <span className="text-zinc-200 font-bold">{selectedEvent.date.split('-').reverse().join('/')}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-zinc-500 block">Horário Sugerido</span>
                  <span className="text-zinc-200 font-bold">{selectedEvent.time}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[9px] uppercase font-bold text-zinc-555 font-mono block">Instrução / Notas Completas</span>
                <p className="text-xs text-zinc-350 leading-relaxed bg-zinc-950 p-4 border border-zinc-850 rounded-xl max-h-40 overflow-y-auto font-sans font-medium">
                  {selectedEvent.details}
                </p>
              </div>

              {/* AUTOMATION EXPLAINER */}
              <div className="p-3 bg-rose-950/20 border border-rose-900/20 rounded-xl flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[10px] text-zinc-400 leading-tight">
                  <span className="font-extrabold text-zinc-300">Publicação Automática Ativa</span>: No dia e horário definidos, a publicação será disparada via nossa API Oficial do Instagram Graph.
                </span>
              </div>

              {/* INTERACTIVE ACTIONS DUPLICATE/EDIT-RESCHEDULE/DELETE */}
              {(selectedEvent.type === 'post' || selectedEvent.type === 'story' || selectedEvent.type === 'general') && (
                <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => handleDuplicatePost(selectedEvent)}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-950/50 hover:bg-zinc-850 border border-zinc-805 rounded-xl cursor-pointer hover:border-zinc-700 transition"
                  >
                    <Copy className="w-4.5 h-4.5 text-zinc-400" />
                    <span className="text-[9px] font-bold text-zinc-350 mt-1">Duplicar Post</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditPost(selectedEvent)}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-950/50 hover:bg-zinc-850 border border-zinc-805 rounded-xl cursor-pointer hover:border-zinc-700 transition"
                  >
                    <Edit2 className="w-4.5 h-4.5 text-rose-450 text-rose-450" />
                    <span className="text-[9px] font-bold text-zinc-350 mt-1">Editar Post</span>
                  </button>

                  <button
                    onClick={() => handleDeletePost(selectedEvent)}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-950/20 hover:bg-red-950/30 border border-red-950 hover:border-red-900 rounded-xl cursor-pointer transition"
                  >
                    <Trash2 className="w-4.5 h-4.5 text-red-400" />
                    <span className="text-[9px] font-bold text-red-300 mt-1">Desmarcar</span>
                  </button>
                </div>
              )}
            </div>

            <div className="bg-zinc-950 p-4 border-t border-zinc-800 flex justify-end">
              <button 
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white rounded-lg cursor-pointer transition"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE SCHEDULER / EDIT DIALOG FORM */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-fade-in text-white">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <form onSubmit={handleSaveSchedule}>
              <div className="bg-zinc-950 p-5 flex items-start justify-between border-b border-zinc-800">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4.5 h-4.5 text-rose-500" />
                    <h3 className="text-sm font-black text-rose-50 font-sans tracking-tight leading-none">
                      {isEditing ? "Editar Agendamento Marketing" : "Agendar Novo Conteúdo"}
                    </h3>
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Monday + ClickUp Style Interface</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto select-none">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Nome / Gancho da Postagem</label>
                  <input
                    type="text"
                    required
                    value={schedName}
                    onChange={(e) => setSchedName(e.target.value)}
                    placeholder="Ex: Story [09:00] - Oferta espartilho rubra especial"
                    className="w-full bg-zinc-950 p-2.5 text-xs outline-none border border-zinc-800 rounded-xl focus:border-red-500 text-white font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Date picker */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Data do Envio</label>
                    <input
                      type="date"
                      required
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                      className="w-full bg-zinc-950 p-2 text-xs outline-none border border-zinc-805 rounded-xl text-white font-mono"
                    />
                  </div>

                  {/* Time input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Horário Planejado</label>
                    <input
                      type="time"
                      required
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      className="w-full bg-zinc-950 p-2 text-xs outline-none border border-zinc-805 rounded-xl text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Phase select */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Fase Operação</label>
                    <select
                      value={schedPhase}
                      onChange={(e) => setSchedPhase(e.target.value as any)}
                      className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded-xl outline-none text-zinc-300 font-bold"
                    >
                      <option value="estrutura-comercial">Comercial</option>
                      <option value="conteudo-instagram">Instagram</option>
                      <option value="influenciadores">Influenciadores</option>
                      <option value="sorteios">Sorteios</option>
                      <option value="whatsapp">Disparos WhatsApp</option>
                      <option value="afiliados">Afiliados</option>
                      <option value="geral">Instância Geral</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Grau de Urgência</label>
                    <select
                      value={schedPriority}
                      onChange={(e) => setSchedPriority(e.target.value as any)}
                      className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded-xl outline-none text-zinc-300 font-bold"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="critica">🚨 Crítica</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Status columns */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Status Kanban Inicial</label>
                    <select
                      value={schedColumn}
                      onChange={(e) => setSchedColumn(e.target.value as any)}
                      className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded-xl outline-none text-zinc-300 font-bold"
                    >
                      <option value="planejado">Planejado</option>
                      <option value="em-andamento">Em Andamento</option>
                      <option value="aguardando">Aguardando Aprovação</option>
                      <option value="concluido">✔️ Publicado / Concluído</option>
                    </select>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Tags de Apoio (Vírgulas)</label>
                    <input
                      type="text"
                      value={schedTags}
                      onChange={(e) => setSchedTags(e.target.value)}
                      placeholder="Instagram, Reels, Oferta"
                      className="w-full bg-zinc-950 p-2 text-xs outline-none border border-zinc-805 rounded-xl text-white"
                    />
                  </div>
                </div>

                {/* Subtasks checklist placeholder in text lines */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono">Passos Operacionais Checklist (1 por linha)</label>
                  <textarea
                    rows={2.5}
                    value={schedNotes}
                    onChange={(e) => setSchedNotes(e.target.value)}
                    placeholder="Ex:&#10;Criar imagem estúdio por IA&#10;Gerar copy sensual via IA&#10;Validar link do cupom no site"
                    className="w-full bg-zinc-950 p-2.5 text-xs outline-none border border-zinc-800 rounded-xl max-h-24 overflow-y-auto leading-relaxed text-zinc-300 placeholder-zinc-700 font-medium font-sans"
                  />
                </div>

              </div>

              <div className="bg-zinc-950 p-4 border-t border-zinc-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-650 hover:bg-red-700 bg-red-600 text-xs font-black rounded-lg text-white font-bold"
                >
                  {isEditing ? "Gravar Mudanças" : "Agendar Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
