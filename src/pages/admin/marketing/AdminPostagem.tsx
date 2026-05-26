import { useState, useEffect } from 'react';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { db } from '../../../lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  getDoc 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  FileText, 
  Megaphone,
  Sparkles
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface PostIdea {
  id: string;
  date: string; // YYYY-MM-DD
  titulo: string;
  descricao: string;
  hashtags: string;
  createdAt?: any;
}

interface PromptConfig {
  promptTemplate: string;
}

const DEFAULT_PROMPT_TEMPLATE = `Atue como um redator profissional especialista em mídias sociais para sexshops premium. 
Crie uma legenda de alta conversão, sedutora, sofisticada e envolvente para o Instagram da Discreta Boutique.

Use as seguintes informações do post:
🔹 TÍTULO: [TITULO]
🔹 CONCEITO/DESCRIÇÃO: [DESCRICAO]
🔹 HASHTAGS: [HASHTAGS]

Instruções para a legenda:
1. Comece com uma frase gancho chamativa e instigante.
2. Use tom elegante, sensual, discreto e premium (evite termos vulgares).
3. Desenvolva o conceito e incentive o desejo.
4. Inclua uma chamada para ação (CTA) sutil mandando clicar no link da bio para comprar pelo WhatsApp ou site com sigilo total.
5. Incorpore as hashtags fornecidas e adicione mais algumas de sexo seguro/intimidade se julgar necessário.`;

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function AdminPostagem() {
  const { toast } = useFeedback();
  const theme = localStorage.getItem('admin-theme') || 'dark';

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [postIdeias, setPostIdeias] = useState<PostIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  
  // Prompt Config State
  const [promptTemplate, setPromptTemplate] = useState<string>(DEFAULT_PROMPT_TEMPLATE);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [tempPrompt, setTempPrompt] = useState<string>('');

  // Mode States
  const [isAddMode, setIsAddMode] = useState(false);
  const [editingPost, setEditingPost] = useState<PostIdea | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedRawId, setCopiedRawId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form States
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [hashtags, setHashtags] = useState('');

  // AI Generator States
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiBrandRules, setAiBrandRules] = useState('Tom elegante, sensual, discreto e premium (Discreta Boutique). Foco no empoderamento, curiosidade refinada e descrição de benefícios práticos e sensoriais (ex: texturas de lingeries, vibrações silenciosas, aromas estimulantes). Evite termos chulos ou vulgares.');
  const [aiObjectives, setAiObjectives] = useState<string[]>(['Desejo', 'Conversão']);
  const [customObjective, setCustomObjective] = useState('');
  const [aiPostsPerDay, setAiPostsPerDay] = useState(1);
  const [aiStartDate, setAiStartDate] = useState('');
  const [aiEndDate, setAiEndDate] = useState('');
  const [aiSelectedWeekdays, setAiSelectedWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon to Fri by default
  const [isGenerating, setIsGenerating] = useState(false);

  // Days in month calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Update dates on calendar transition
  useEffect(() => {
    const startObj = new Date(year, month, 1);
    const endObj = new Date(year, month + 1, 0);

    const pad = (num: number) => String(num).padStart(2, '0');
    const startStr = `${startObj.getFullYear()}-${pad(startObj.getMonth() + 1)}-01`;
    const endStr = `${endObj.getFullYear()}-${pad(endObj.getMonth() + 1)}-${pad(endObj.getDate())}`;

    setAiStartDate(startStr);
    setAiEndDate(endStr);
  }, [currentDate, year, month]);

  // Load configuration and data
  useEffect(() => {
    const loadConfigAndData = async () => {
      try {
        setLoading(true);
        
        // 1. Get Prompt Template
        const configRef = doc(db, 'settings', 'postagem_config');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          const configData = configSnap.data() as PromptConfig;
          if (configData.promptTemplate) {
            setPromptTemplate(configData.promptTemplate);
          }
        } else {
          // Initialize in firestore if not exists
          await setDoc(configRef, { promptTemplate: DEFAULT_PROMPT_TEMPLATE });
        }

        // 1.2 Get AI Generator Settings (if any)
        try {
          const aiConfigRef = doc(db, 'settings', 'postagem_ai_generator');
          const aiConfigSnap = await getDoc(aiConfigRef);
          if (aiConfigSnap.exists()) {
            const aiData = aiConfigSnap.data();
            if (aiData.brandRules) setAiBrandRules(aiData.brandRules);
            if (aiData.objectives) setAiObjectives(aiData.objectives);
          }
        } catch (aiErr) {
          console.warn("Could not load ai rules:", aiErr);
        }

        // 2. Load Post Ideas
        const postsRef = collection(db, 'marketing_calendar');
        const postsSnap = await getDocs(postsRef);
        const postsList: PostIdea[] = [];
        postsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          postsList.push({
            id: docSnap.id,
            date: data.date,
            titulo: data.titulo || '',
            descricao: data.descricao || '',
            hashtags: data.hashtags || '',
          });
        });
        setPostIdeias(postsList);
      } catch (err: any) {
        console.error('Erro ao buscar dados da página Postagem:', err);
        toast('Erro ao sincronizar informações de postagens', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadConfigAndData();
  }, [toast]);

  // Handle month change
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format Helper
  const formatDateStr = (dayNum: number) => {
    const dStr = String(dayNum).padStart(2, '0');
    const mStr = String(month + 1).padStart(2, '0');
    return `${year}-${mStr}-${dStr}`;
  };

  // Save Prompt template config
  const handleSaveConfig = async () => {
    try {
      const configRef = doc(db, 'settings', 'postagem_config');
      await setDoc(configRef, { promptTemplate: tempPrompt }, { merge: true });
      setPromptTemplate(tempPrompt);
      setIsConfigOpen(false);
      toast('Prompt padrão atualizado com sucesso!', 'success');
    } catch (e: any) {
      toast('Erro ao salvar configuração de prompt', 'error');
    }
  };

  // Create post idea
  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateStr) return;
    if (!titulo.trim() || !descricao.trim()) {
      toast('Título e descrição são obrigatórios', 'warning');
      return;
    }

    try {
      const payload = {
        date: selectedDateStr,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        hashtags: hashtags.trim(),
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'marketing_calendar'), payload);
      const newPost: PostIdea = {
        id: docRef.id,
        ...payload
      };

      setPostIdeias(prev => [...prev, newPost]);
      toast('Ideia de post agendada com sucesso!', 'success');
      
      // Clean up
      setTitulo('');
      setDescricao('');
      setHashtags('');
      setIsAddMode(false);
    } catch (err: any) {
      toast('Erro ao agendar ideia de postagem', 'error');
    }
  };

  // Edit action setup
  const startEdit = (post: PostIdea) => {
    setEditingPost(post);
    setTitulo(post.titulo);
    setDescricao(post.descricao);
    setHashtags(post.hashtags);
  };

  // Save edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    if (!titulo.trim() || !descricao.trim()) {
      toast('Título e descrição são obrigatórios', 'warning');
      return;
    }

    try {
      const docRef = doc(db, 'marketing_calendar', editingPost.id);
      await setDoc(docRef, {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        hashtags: hashtags.trim()
      }, { merge: true });

      setPostIdeias(prev => prev.map(p => p.id === editingPost.id 
        ? { ...p, titulo: titulo.trim(), descricao: descricao.trim(), hashtags: hashtags.trim() }
        : p
      ));

      toast('Ideia de postagem atualizada!', 'success');
      
      // Clear
      setEditingPost(null);
      setTitulo('');
      setDescricao('');
      setHashtags('');
    } catch (err: any) {
      toast('Erro ao atualizar postagem', 'error');
    }
  };

  // Delete action
  const handleDeletePost = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'marketing_calendar', id));
      setPostIdeias(prev => prev.filter(p => p.id !== id));
      toast('Ideia de postagem removida com sucesso.', 'success');
    } catch (err: any) {
      toast('Erro ao remover ideia de postagem', 'error');
    }
  };

  // Copy computed prompt
  const copyFormattedPrompt = (post: PostIdea) => {
    // Generate text merging promptTemplate and post attributes
    let finalPrompt = promptTemplate
      .replace(/\[TITULO\]/g, post.titulo)
      .replace(/\[DESCRICAO\]/g, post.descricao)
      .replace(/\[HASHTAGS\]/g, post.hashtags || '#discretaboutique');

    navigator.clipboard.writeText(finalPrompt)
      .then(() => {
        setCopiedId(post.id);
        toast('Prompt formatado copiado para a área de transferência!', 'success');
        setTimeout(() => setCopiedId(null), 2500);
      })
      .catch(() => {
        // Fallback standard text copy
        const textarea = document.createElement('textarea');
        textarea.value = finalPrompt;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          setCopiedId(post.id);
          toast('Prompt copiado! (fallback)', 'success');
          setTimeout(() => setCopiedId(null), 2500);
        } catch (e: any) {
          toast('Não foi possível copiar automaticamente', 'error');
        }
        document.body.removeChild(textarea);
      });
  };

  // Copy raw text for the feed description
  const copyRawFeedText = (post: PostIdea) => {
    const rawText = `${post.titulo}\n\n${post.descricao}\n\n${post.hashtags || '#discretaboutique'}`;

    navigator.clipboard.writeText(rawText)
      .then(() => {
        setCopiedRawId(post.id);
        toast('Texto completo para o feed copiado!', 'success');
        setTimeout(() => setCopiedRawId(null), 2500);
      })
      .catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = rawText;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          setCopiedRawId(post.id);
          toast('Texto copiado para o feed! (fallback)', 'success');
          setTimeout(() => setCopiedRawId(null), 2500);
        } catch {
          toast('Não foi possível copiar o texto automaticamente', 'error');
        }
        document.body.removeChild(textarea);
      });
  };

  // Help organize day contents
  const getPostsForDay = (dayStr: string) => {
    return postIdeias.filter(post => post.date === dayStr);
  };

  // Generate post ideas using OpenAI
  const handleGenerateAiPosts = async () => {
    if (!aiStartDate || !aiEndDate) {
      toast('As datas de início e fim são obrigatórias.', 'warning');
      return;
    }

    const start = new Date(aiStartDate + 'T12:00:00');
    const end = new Date(aiEndDate + 'T12:00:00');

    if (end < start) {
      toast('A data final deve ser posterior ou igual à data inicial.', 'warning');
      return;
    }

    // List all dates in the range that match checked weekdays
    const daysToGenerate: string[] = [];
    const tempDate = new Date(start);

    // Safety limit: generate up to 31 days at once to prevent high token usage
    let safeLoopCount = 0;
    while (tempDate <= end && safeLoopCount < 60) {
      safeLoopCount++;
      const currentDayOfWeek = tempDate.getDay(); // 0 is Sunday, 1 is Monday...
      if (aiSelectedWeekdays.includes(currentDayOfWeek)) {
        const yearStr = tempDate.getFullYear();
        const monthStr = String(tempDate.getMonth() + 1).padStart(2, '0');
        const dateStr = String(tempDate.getDate()).padStart(2, '0');
        daysToGenerate.push(`${yearStr}-${monthStr}-${dateStr}`);
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    if (daysToGenerate.length === 0) {
      toast('Nenhum dia correspondente aos dias da semana selecionados foi encontrado no período.', 'warning');
      return;
    }

    if (daysToGenerate.length > 31) {
      toast('Por questões de performance, você pode gerar no máximo 31 dias por vez.', 'warning');
      return;
    }

    try {
      setIsGenerating(true);

      // Save AI settings for the future
      const aiConfigRef = doc(db, 'settings', 'postagem_ai_generator');
      await setDoc(aiConfigRef, {
        brandRules: aiBrandRules,
        objectives: aiObjectives
      }, { merge: true });

      // Call API
      const response = await fetch('/api/ia/gerar-posts-calendario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brandRules: aiBrandRules,
          objectives: [...aiObjectives, customObjective].filter(Boolean).join(", "),
          days: daysToGenerate,
          postsPerDay: Number(aiPostsPerDay)
        })
      });

      if (!response.ok) {
        throw new Error('A API retornou um erro ao processar a solicitação com OpenAI');
      }

      const resData = await response.json();
      if (!resData.success || !resData.ideas) {
        throw new Error(resData.error || 'Erro na resposta da inteligência artificial');
      }

      const generatedIdeas = resData.ideas; // array of { date, titulo, descricao, hashtags }
      
      // Save all generated ideas to firestore and update local state
      const savedIdeas: PostIdea[] = [];
      
      for (const idea of generatedIdeas) {
        const payload = {
          date: idea.date,
          titulo: idea.titulo,
          descricao: idea.descricao,
          hashtags: idea.hashtags || '',
          createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'marketing_calendar'), payload);
        savedIdeas.push({
          id: docRef.id,
          ...payload
        });
      }

      setPostIdeias(prev => [...prev, ...savedIdeas]);
      toast(`Pronto! Geradas com sucesso ${savedIdeas.length} ideias de post pelo robô da Discreta Boutique.`, 'success');
      setShowAiGenerator(false);
    } catch (err: any) {
      console.error('Erro ao gerar postagens por IA:', err);
      toast(err.message || 'Erro inesperado ao gerar ideias por IA. Tente novamente.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Megaphone className="text-red-500" />
            Ideias de Feed & Calendário de Postagem
          </h2>
          <p className="text-sm font-bold text-slate-500">
            Planeje os temas, posts e copies elegantes para o Instagram com auxílio do ChatGPT
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => setShowAiGenerator(prev => !prev)} 
            variant="outline" 
            className="gap-2 border-red-500/20 text-slate-100 hover:bg-slate-800"
          >
            <Sparkles className="w-4 h-4 text-red-500 animate-pulse" />
            Gerador Inteligente por IA
          </Button>

          <Button 
            onClick={() => {
              setTempPrompt(promptTemplate);
              setIsConfigOpen(true);
            }} 
            variant="outline" 
            className="gap-2 border-red-500/20 text-slate-100 hover:bg-slate-800"
          >
            <SettingsIcon className="w-4 h-4 text-red-500" />
            Configurar Prompt ChatGPT
          </Button>
        </div>
      </div>

      {/* AI Post Generator Panel */}
      {showAiGenerator && (
        <div className={cn("rounded-3xl border p-6 shadow-md transition-all space-y-4", theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800")}>
           <div className="flex justify-between items-center border-b border-rose-500/10 pb-3">
              <h3 className="text-md font-black uppercase text-red-500 flex items-center gap-2">
                 <Sparkles className="text-red-500 w-5 h-5 animate-pulse" />
                 Módulo de Geração em Massa com IA (OpenAI)
              </h3>
              <button onClick={() => setShowAiGenerator(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                 <X size={18} />
              </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Side: Setup & Objectives */}
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                       Regras de Adequação da Marca (Tom & Diretrizes)
                    </label>
                    <textarea
                       value={aiBrandRules}
                       onChange={(e) => setAiBrandRules(e.target.value)}
                       rows={4}
                       className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500"
                       placeholder="Diretrizes gerais de estilo, restrições e tom de voz..."
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                       Objetivos das Campanhas
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                       {[
                         'Criar expectativa', 
                         'Engajamento', 
                         'Prova social', 
                         'Desejo', 
                         'Conversão', 
                         'Autoridade', 
                         'Cliques no site', 
                         'Pré-vendas Dia dos Namorados'
                       ].map((obj) => {
                          const isSelected = aiObjectives.includes(obj);
                          return (
                             <button
                                key={obj}
                                type="button"
                                onClick={() => {
                                   if (isSelected) {
                                      setAiObjectives(prev => prev.filter(x => x !== obj));
                                   } else {
                                      setAiObjectives(prev => [...prev, obj]);
                                   }
                                }}
                                className={cn(
                                   "text-[10px] px-2.5 py-1 rounded-full border transition-all font-bold uppercase cursor-pointer",
                                   isSelected 
                                     ? "bg-red-650 text-white border-red-500 shadow-sm" 
                                     : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700 hover:text-slate-300"
                                )}
                             >
                                {obj}
                             </button>
                          );
                       })}
                    </div>
                    <Input
                       placeholder="Outro objetivo da sua campanha? Digite aqui..."
                       value={customObjective}
                       onChange={(e) => setCustomObjective(e.target.value)}
                       className="text-xs h-9 bg-slate-950 border-slate-800 text-slate-100"
                    />
                 </div>
              </div>

              {/* Right Side: Frequency, Period & Weekdays */}
              <div className="space-y-4 flex flex-col justify-between">
                 <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                       <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                             Feeds / Dia
                          </label>
                          <select
                             value={aiPostsPerDay}
                             onChange={(e) => setAiPostsPerDay(Number(e.target.value))}
                             className="w-full text-xs h-9 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:ring-1 focus:ring-red-500 px-2"
                          >
                             <option value={1}>1 feed</option>
                             <option value={2}>2 feeds</option>
                             <option value={3}>3 feeds</option>
                          </select>
                       </div>

                       <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                             De (Data Inicial)
                          </label>
                          <Input
                             type="date"
                             value={aiStartDate}
                             onChange={(e) => setAiStartDate(e.target.value)}
                             className="text-xs h-9 bg-slate-950 border-slate-800 text-slate-100"
                          />
                       </div>

                       <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                             Até (Data Final)
                          </label>
                          <Input
                             type="date"
                             value={aiEndDate}
                             onChange={(e) => setAiEndDate(e.target.value)}
                             className="text-xs h-9 bg-slate-950 border-slate-800 text-slate-100"
                          />
                       </div>
                    </div>

                    <div>
                       <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                          Quais dias das semanas serão preenchidos?
                       </label>
                       <div className="flex gap-1.5 justify-between">
                          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((wd, dayIdx) => {
                             const isSelected = aiSelectedWeekdays.includes(dayIdx);
                             return (
                                <button
                                   key={wd}
                                   type="button"
                                   onClick={() => {
                                      if (isSelected) {
                                         setAiSelectedWeekdays(prev => prev.filter(x => x !== dayIdx));
                                      } else {
                                         setAiSelectedWeekdays(prev => [...prev, dayIdx]);
                                      }
                                   }}
                                   className={cn(
                                      "flex-1 text-[10px] py-2 rounded-lg border text-center transition-all font-bold cursor-pointer",
                                      isSelected 
                                        ? "bg-red-600 text-white border-red-500" 
                                        : "bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700"
                                   )}
                                >
                                   {wd}
                                </button>
                             );
                          })}
                       </div>
                    </div>
                 </div>

                 <div className="pt-4 flex justify-end gap-3 border-t border-rose-500/10">
                    <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setShowAiGenerator(false)}
                       className="text-xs"
                    >
                       Cancelar
                    </Button>
                    <Button
                       disabled={isGenerating}
                       onClick={handleGenerateAiPosts}
                       size="sm"
                       className="bg-red-600 hover:bg-red-700 font-bold uppercase tracking-wider text-xs gap-1.5 cursor-pointer text-white"
                    >
                       {isGenerating ? (
                          <>
                             <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                             Gerando Ideias por IA...
                          </>
                       ) : (
                          <>
                             <Sparkles size={14} className="text-white" />
                             Gerar Cronograma por IA
                          </>
                       )}
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Large Interactive Calendar */}
        <div className={cn("lg:col-span-2 rounded-3xl border p-4 sm:p-6 shadow-sm flex flex-col justify-between", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
          
          {/* Calendar top navigation */}
          <div className="flex items-center justify-between pb-6 mb-4 border-b border-rose-500/10">
            <h3 className="text-lg font-black uppercase text-red-500 tracking-wider">
              {MONTHS_PT[month]} {year}
            </h3>
            <div className="flex items-center gap-2">
              <Button onClick={goToToday} variant="secondary" className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                Hoje
              </Button>
              <button onClick={prevMonth} className={cn("p-2 rounded-lg border hover:bg-red-500/10 transition-colors", theme === 'dark' ? "border-slate-800 text-slate-400 hover:text-white" : "border-slate-200 text-slate-600 hover:text-black")}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={nextMonth} className={cn("p-2 rounded-lg border hover:bg-red-500/10 transition-colors", theme === 'dark' ? "border-slate-800 text-slate-400 hover:text-white" : "border-slate-200 text-slate-600 hover:text-black")}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Day title headers */}
              <div className="grid grid-cols-7 text-center font-black uppercase tracking-widest text-[10px] text-slate-500 pb-2">
                {WEEKDAYS_PT.map((wd) => (
                  <div key={wd}>{wd}</div>
                ))}
              </div>

              {/* Day Grid cells */}
              <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                
                {/* Pad previous month offsets */}
                {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                  <div 
                    key={`offset-${idx}`} 
                    className={cn("aspect-square rounded-2xl bg-transparent opacity-20 border border-dashed border-slate-800")}
                  />
                ))}

                {/* Actual days of the month */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dayStr = formatDateStr(dayNum);
                  const posts = getPostsForDay(dayStr);
                  const isSelected = selectedDateStr === dayStr;
                  const isToday = new Date().toDateString() === new Date(year, month, dayNum).toDateString();

                  return (
                    <button
                      key={dayStr}
                      onClick={() => {
                        setSelectedDateStr(dayStr);
                        setIsAddMode(false);
                        setEditingPost(null);
                      }}
                      className={cn(
                        "aspect-square rounded-2xl p-2 flex flex-col justify-between text-left transition-all border relative group text-xs",
                        isSelected 
                          ? "ring-2 ring-red-500 border-red-500" 
                          : isToday 
                            ? "border-red-500/50 bg-red-500/5" 
                            : theme === 'dark' 
                              ? "bg-slate-950/40 border-slate-800 hover:border-slate-700" 
                              : "bg-slate-50/50 border-slate-100 hover:border-slate-300",
                        posts.length > 0 && !(isSelected) ? "border-rose-500/30" : ""
                      )}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className={cn(
                          "font-bold text-sm",
                          isToday 
                            ? "text-red-500" 
                            : theme === 'dark' ? "text-slate-300" : "text-slate-800"
                        )}>
                          {dayNum}
                        </span>

                        {isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        )}
                      </div>

                      {/* Post summary inside day cell */}
                      <div className="w-full mt-1 flex flex-col gap-0.5 overflow-hidden">
                        {posts.map(p => (
                          <div 
                            key={p.id} 
                            className="text-[9px] font-semibold text-white bg-red-600/90 rounded px-1 py-0.5 truncate leading-tight shadow-sm"
                          >
                            {p.titulo}
                          </div>
                        ))}
                      </div>

                      {/* Small plus indicator on hover if empty */}
                      {posts.length === 0 && (
                        <div className="absolute bottom-1 right-2 opacity-0 group-hover:opacity-60 transition-opacity">
                          <Plus size={12} className="text-slate-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Column: Active Day & Details Panel */}
        <div className="space-y-6">
          
          {/* Main Info Box */}
          <div className={cn("rounded-3xl border p-6 shadow-sm flex flex-col justify-between", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
            
            {/* If no selected day */}
            {!selectedDateStr ? (
              <div className="py-12 text-center space-y-3">
                <CalendarIcon className="w-12 h-12 text-slate-500 mx-auto animate-bounce" />
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">Nenhum Dia Selecionado</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Clique em um dia do calendário à esquerda para verificar inspirações de posts ou criar a sua ideia.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Day Header */}
                <div className="flex items-center justify-between pb-4 border-b border-rose-500/10">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Postagem para:</h4>
                    <p className="text-base font-black text-red-500">
                      {new Date(selectedDateStr + 'T12:00:00').toLocaleDateString('pt-BR', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long' 
                      })}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedDateStr(null)} 
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Show Items Scheduled for Selected Day */}
                <div className="space-y-4">
                  
                  {/* Ideas listing */}
                  {getPostsForDay(selectedDateStr).length === 0 ? (
                    <div className="py-6 text-center space-y-2 border border-dashed border-slate-800 rounded-2xl">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sem postagens agendadas</p>
                      <Button 
                        onClick={() => {
                          setIsAddMode(true);
                          setEditingPost(null);
                        }} 
                        size="sm" 
                        className="gap-1 text-xs"
                      >
                        <Plus size={14} /> Adicionar Ideia de Feed
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Ideias de conteúdos:</span>
                        {!isAddMode && !editingPost && (
                          <Button 
                            onClick={() => {
                              setIsAddMode(true);
                              setEditingPost(null);
                              setTitulo('');
                              setDescricao('');
                              setHashtags('');
                            }} 
                            size="sm" 
                            variant="outline" 
                            className="text-xs h-7 px-2"
                          >
                            <Plus size={12} className="mr-1" /> Mais uma
                          </Button>
                        )}
                      </div>

                      {/* Render each post scheduled */}
                      {!isAddMode && !editingPost && getPostsForDay(selectedDateStr).map((post) => (
                        <div 
                          key={post.id} 
                          className={cn(
                            "p-4 rounded-2xl border flex flex-col justify-between space-y-3",
                            theme === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"
                          )}
                        >
                          <div>
                            <h5 className="font-bold text-sm text-red-500">{post.titulo}</h5>
                            <p className="text-[11px] font-mono text-zinc-500 mt-1 line-clamp-2">{post.descricao}</p>
                            {post.hashtags && (
                              <p className="text-[10px] text-zinc-600 mt-2 font-semibold">
                                {post.hashtags}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 pt-2 border-t border-rose-500/5">
                            <div className="flex items-center justify-between">
                              {deleteConfirmId === post.id ? (
                                <div className="flex items-center gap-1 bg-red-950/40 p-0.5 rounded-lg border border-red-500/30">
                                  <span className="text-[9px] font-bold uppercase text-red-400 px-1">Excluir?</span>
                                  <button 
                                    onClick={() => {
                                      handleDeletePost(post.id);
                                      setDeleteConfirmId(null);
                                    }}
                                    type="button"
                                    className="text-[9px] font-bold text-white bg-red-650 hover:bg-red-700 px-1.5 py-0.5 rounded transition-all uppercase cursor-pointer"
                                  >
                                    Sim
                                  </button>
                                  <button 
                                    onClick={() => setDeleteConfirmId(null)}
                                    type="button"
                                    className="text-[9px] font-bold text-slate-400 hover:text-white px-1.5 py-0.5 rounded transition-all uppercase cursor-pointer"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-1.5">
                                  <button 
                                    onClick={() => startEdit(post)}
                                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700"
                                    title="Editar postagem"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button 
                                    onClick={() => setDeleteConfirmId(post.id)}
                                    className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors border border-transparent hover:border-red-500/20"
                                    title="Remover postagem"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}

                              <div className="flex gap-1">
                                {/* Copy raw post text button */}
                                <Button 
                                  onClick={() => copyRawFeedText(post)}
                                  size="sm" 
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] h-7 px-2 gap-1 font-bold uppercase tracking-wider",
                                    theme === 'dark' ? "border-slate-800 hover:bg-slate-800 hover:text-white" : "border-slate-200 hover:bg-slate-100",
                                    copiedRawId === post.id ? "bg-emerald-950 text-emerald-400 border-emerald-500" : ""
                                  )}
                                >
                                  {copiedRawId === post.id ? (
                                    <>
                                      <Check size={10} /> Copiado!
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={10} /> Copiar Feed
                                    </>
                                  )}
                                </Button>

                                {/* Copy for ChatGPT template button */}
                                <Button 
                                  onClick={() => copyFormattedPrompt(post)}
                                  size="sm" 
                                  className={cn(
                                    "text-[9px] h-7 px-2 gap-1 font-bold uppercase tracking-wider",
                                    copiedId === post.id ? "bg-emerald-600 text-white" : "bg-red-600 hover:bg-red-700"
                                  )}
                                >
                                  {copiedId === post.id ? (
                                    <>
                                      <Check size={10} /> Copiado!
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={10} /> ChatGPT
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Mode Form */}
                  {isAddMode && (
                    <form onSubmit={handleAddPost} className="space-y-4 p-4 rounded-2xl border border-red-500/20 bg-red-500/5">
                      <div className="flex items-center justify-between border-b border-rose-500/5 pb-2">
                        <h5 className="font-black text-xs uppercase tracking-wider text-red-500 flex items-center gap-1">
                          <FileText size={14} /> Nova Postagem
                        </h5>
                        <button type="button" onClick={() => setIsAddMode(false)} className="text-slate-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Título do Post</label>
                          <Input 
                            value={titulo} 
                            onChange={e => setTitulo(e.target.value)} 
                            placeholder="Ex: Calcinha Renda Preta Provocante" 
                            className="text-xs h-8 bg-black border-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 font-sans">Temas / Conceito</label>
                          <textarea 
                            value={descricao} 
                            onChange={e => setDescricao(e.target.value)} 
                            placeholder="Descreva a ideia principal, que benefício destacar, qual o apelo sensual de lingerie ou sextoys..." 
                            rows={3} 
                            className="w-full rounded-md border text-xs p-2 bg-black border-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-200"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Hashtags</label>
                          <Input 
                            value={hashtags} 
                            onChange={e => setHashtags(e.target.value)} 
                            placeholder="#sexshop #lingerie #discretaboutique" 
                            className="text-xs h-8 bg-black border-slate-800"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsAddMode(false)} className="text-[11px] h-7 px-3">
                          Cancelar
                        </Button>
                        <Button type="submit" size="sm" className="text-[11px] h-7 px-3 bg-red-600">
                          Salvar Post
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Edit Mode Form */}
                  {editingPost && (
                    <form onSubmit={handleSaveEdit} className="space-y-4 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                      <div className="flex items-center justify-between border-b border-rose-500/5 pb-2">
                        <h5 className="font-black text-xs uppercase tracking-wider text-amber-500 flex items-center gap-1">
                          <Edit2 size={12} /> Editar Postagem
                        </h5>
                        <button type="button" onClick={() => setEditingPost(null)} className="text-slate-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Título do Post</label>
                          <Input 
                            value={titulo} 
                            onChange={e => setTitulo(e.target.value)} 
                            placeholder="Ex: Título da Postagem" 
                            className="text-xs h-8 bg-black border-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 font-sans">Temas / Conceito</label>
                          <textarea 
                            value={descricao} 
                            onChange={e => setDescricao(e.target.value)} 
                            placeholder="Explicação do post" 
                            rows={3} 
                            className="w-full rounded-md border text-xs p-2 bg-black border-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-200"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Hashtags</label>
                          <Input 
                            value={hashtags} 
                            onChange={e => setHashtags(e.target.value)} 
                            placeholder="Ex: #sexy #sensual" 
                            className="text-xs h-8 bg-black border-slate-800"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingPost(null)} className="text-[11px] h-7 px-3">
                          Cancelar
                        </Button>
                        <Button type="submit" size="sm" className="text-[11px] h-7 px-3 bg-amber-600">
                          Atualizar Post
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ChatGPT Config Modal Overlay */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={cn("w-full max-w-2xl rounded-3xl border p-6 space-y-4 shadow-xl", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
            <div className="flex items-center justify-between border-b border-rose-500/10 pb-3">
              <h4 className="text-base font-black uppercase tracking-wider text-red-500 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" /> Configuração do Prompt para ChatGPT
              </h4>
              <button 
                onClick={() => setIsConfigOpen(false)} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Você pode criar um roteiro do seu prompt de engajamento padrão em português. O sistema preencherá as chaves dinâmicas:
              </p>
              <div className="flex gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-black p-2.5 rounded-xl border border-slate-800">
                <span><code>[TITULO]</code> - Titulo do post</span>
                <span><code>[DESCRICAO]</code> - Ideia/Conceito</span>
                <span><code>[HASHTAGS]</code> - Tags do post</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Template de Prompt Padrão</label>
                <textarea 
                  value={tempPrompt} 
                  onChange={e => setTempPrompt(e.target.value)} 
                  rows={12} 
                  className="w-full text-xs font-mono p-3 bg-black border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-rose-500/10">
              <Button onClick={() => setIsConfigOpen(false)} variant="outline">
                Cancelar
              </Button>
              <Button onClick={handleSaveConfig} className="bg-red-600">
                Salvar Prompt
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
