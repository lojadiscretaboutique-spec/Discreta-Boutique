import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Search, Filter, MessageSquare, Clipboard, Brain, AlertCircle, 
  Trash2, Save, Sparkles, Check, ChevronRight, User, Phone, Mail, 
  MapPin, Calendar, Clock, DollarSign, HelpCircle, Edit2, Sliders, ChevronDown, Loader2
} from 'lucide-react';
import { candidateService } from '../../services/candidateService';
import { aiFrontendService } from '../../services/aiFrontendService';
import { Candidate, ChatMessage } from '../../types/candidate';
import { useFeedback } from '../../contexts/FeedbackContext';

export default function AdminTrabalheConosco() {
  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();
  
  // Data state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  
  // Filtering & Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [cityFilter, setCityFilter] = useState<string>('todas');
  
  // Active Tab in candidate view
  const [activeTab, setActiveTab] = useState<'ficha' | 'conversa' | 'ia' | 'notas'>('ficha');
  
  // Internal Notes and state
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  
  // AI analysis active state
  const [analyzingIA, setAnalyzingIA] = useState(false);

  // Load candidates on mount
  const loadData = async () => {
    try {
      setLoading(true);
      const data = await candidateService.listCandidates();
      setCandidates(data);
      
      // Select first candidate if available
      if (data.length > 0 && !selectedCandidate) {
        setSelectedCandidate(data[0]);
        setInternalNotes(data[0].adminNotes || '');
      } else if (selectedCandidate) {
        const updated = data.find(c => c.id === selectedCandidate.id);
        if (updated) {
          setSelectedCandidate(updated);
          setInternalNotes(updated.adminNotes || '');
        }
      }
    } catch (err) {
      console.error('[LOAD_DATA_ERROR]', err);
      toast('Erro ao carregar lista de candidatos de recrutamento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update notes field when selected candidate changes
  useEffect(() => {
    if (selectedCandidate) {
      setInternalNotes(selectedCandidate.adminNotes || '');
    }
  }, [selectedCandidate]);

  // Handle Save Internal Admin Notes
  const handleSaveNotes = async () => {
    if (!selectedCandidate?.id) return;
    try {
      setSavingNotes(true);
      await candidateService.updateCandidateNotes(selectedCandidate.id, internalNotes);
      toast('Observações internas atualizadas com sucesso!', 'success');
      
      setCandidates(prev => prev.map(c => 
        c.id === selectedCandidate.id ? { ...c, adminNotes: internalNotes } : c
      ));
      setSelectedCandidate(prev => prev ? { ...prev, adminNotes: internalNotes } : null);
    } catch (err) {
      console.error('[SAVE_NOTES_ERROR]', err);
      toast('Falha ao salvar observações internas.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  // Handle Candidate Status Change
  const handleStatusChange = async (newStatus: Candidate['status']) => {
    if (!selectedCandidate?.id) return;
    try {
      await candidateService.updateCandidateStatus(selectedCandidate.id, newStatus);
      toast(`Status do candidato alterado para: ${newStatus}`, 'success');
      
      setCandidates(prev => prev.map(c => 
        c.id === selectedCandidate.id ? { ...c, status: newStatus } : c
      ));
      setSelectedCandidate(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      console.error('[STATUS_UPDATE_ERROR]', err);
      toast('Falha ao atualizar o status do candidato.', 'error');
    }
  };

  // Delete candidate (Compliance with LGPD Right to be Forgotten)
  const handleDeleteCandidate = async (candidateId: string) => {
    const confirmation = await confirm({
      title: 'Confirmar Exclusão (Conformidade LGPD)',
      message: 'ATENÇÃO (Conformidade LGPD): Esta ação excluirá permanentemente todos os dados deste candidato, incluindo o registro de inscrição, ficha estruturada, histórico original do chat e pareceres de IA. Esta ação é IRREVERSÍVEL. Deseja prosseguir?',
      confirmText: 'Excluir Permanentemente',
      variant: 'danger'
    });
    if (!confirmation) return;

    try {
      await candidateService.deleteCandidate(candidateId);
      toast('Inscrição e histórico de dados excluídos em conformidade com as diretrizes da LGPD.', 'success');
      
      const remaining = candidates.filter(c => c.id !== candidateId);
      setCandidates(remaining);
      
      if (remaining.length > 0) {
        setSelectedCandidate(remaining[0]);
      } else {
        setSelectedCandidate(null);
      }
    } catch (err) {
      console.error('[DELETE_CANDIDATE_ERROR]', err);
      toast('Falha ao deletar candidato.', 'error');
    }
  };

  // Trigger candidate profile evaluation through OpenAI
  const handleTriggerIAAnalysis = async () => {
    if (!selectedCandidate?.id) return;
    try {
      setAnalyzingIA(true);
      
      // Fetch custom settings prompt if any
      const settings = await candidateService.getSettings();
      const promptAnalise = settings?.promptAnalise;

      // Extract details for the prompt
      const rawCandidate = {
        id: selectedCandidate.id,
        nome: selectedCandidate.candidateName,
        telefone: selectedCandidate.phone,
        email: selectedCandidate.email,
        cidade: selectedCandidate.city,
        bairro: selectedCandidate.neighborhood,
        status: selectedCandidate.status,
        dadosEstruturados: selectedCandidate.structuredData,
        conversaCompleta: selectedCandidate.chatMessages?.map(m => `[${m.sender === 'bot' ? 'Recrutadora Aurora' : 'Candidato'}]: ${m.text}`).join('\n')
      };

      const result = await aiFrontendService.analyzeCandidate(rawCandidate, promptAnalise);
      
      // Save AI analysis directly in Firestore candidate model
      await candidateService.updateCandidateAIAnalysis(selectedCandidate.id, result);
      toast('Análise de Perfil da Inteligência Artificial gerada com sucesso!', 'success');

      setCandidates(prev => prev.map(c => 
        c.id === selectedCandidate.id ? { ...c, aiAnalysis: result } : c
      ));
      setSelectedCandidate(prev => prev ? { ...prev, aiAnalysis: result } : null);
    } catch (err: any) {
      console.error('[IA_ANALYSIS_ERROR]', err);
      toast(err.message || 'Falha ao processar avaliação com Inteligência Artificial.', 'error');
    } finally {
      setAnalyzingIA(false);
    }
  };

  // Filter and search computation
  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = 
      (c.candidateName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (c.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
      (c.phone || '').includes(searchTerm);
    
    const matchesStatus = statusFilter === 'todos' || c.status === statusFilter;
    const matchesCity = cityFilter === 'todas' || (c.city?.toLowerCase() || '') === cityFilter.toLowerCase();
    
    return matchesSearch && matchesStatus && matchesCity;
  });

  // Extract unique cities list
  const uniqueCities = Array.from(new Set(candidates.map(c => c.city).filter(Boolean)));

  // Helpers for Status Styling
  const getStatusBadgeStyle = (status: Candidate['status']) => {
    switch (status) {
      case 'NOVO': 
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'EM_ANALISE': 
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'CHAMAR_ENTREVISTA': 
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'APROVADO': 
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'REPROVADO': 
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'ARQUIVADO': 
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      case 'INCOMPLETA':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      default: 
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2 font-serif">
            <Users className="text-red-600" />
            Trabalhe Conosco <span className="text-xs bg-red-600/25 border border-red-600/40 text-red-400 font-sans font-semibold rounded-full px-2.5 py-0.5">Painel de Candidaturas</span>
          </h1>
          <p className="text-sm text-slate-400">Gerencie candidatos inscritos, leia as entrevistas conduzidas por IA e gere pareceres da OpenAI</p>
        </div>
        
        <button
          onClick={() => navigate('/admin/trabalhe-conosco/configuracoes')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition-all text-sm font-semibold shadow-sm"
        >
          <Sliders size={16} />
          Configurar Recrutamento IA
        </button>
      </div>

      {/* Main Content Layout */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-4">
          <Loader2 size={32} className="text-red-600 animate-spin" />
          <span className="text-sm text-slate-400 font-mono">Carregando inscrições de candidatos...</span>
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-900/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center max-w-xl mx-auto">
          <div className="w-14 h-14 bg-slate-950 rounded-full flex items-center justify-center text-slate-500 border border-slate-800/80 mb-4">
            <Users size={24} />
          </div>
          <h2 className="text-lg font-bold text-slate-200">Sem candidaturas registradas</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
            As fichas e diálogos de candidatos que se inscreverem pelo canal público aparecerão listadas aqui para triagem automatizada e humana.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Candidates Column Master list (col-span-4) */}
          <div className="lg:col-span-4 bg-slate-900/50 border border-slate-900/60 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[80vh]">
            
            {/* Search and Filters panel */}
            <div className="p-4 bg-slate-950/40 border-b border-slate-800 space-y-3 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, email, fone..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-red-600 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300"
                  >
                    <option value="todos">Todos</option>
                    <option value="NOVO">Novo</option>
                    <option value="EM_ANALISE">Em Análise</option>
                    <option value="CHAMAR_ENTREVISTA">Chamar Entrevista</option>
                    <option value="APROVADO">Aprovado</option>
                    <option value="REPROVADO">Reprovado</option>
                    <option value="ARQUIVADO">Arquivado</option>
                    <option value="INCOMPLETA">Incompleta</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Cidade</label>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300"
                  >
                    <option value="todas">Todas</option>
                    {uniqueCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Candidates Scroll List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-950 max-h-[50vh] lg:max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-800">
              {filteredCandidates.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  Nenhum candidato localizado nos filtros aplicados.
                </div>
              ) : (
                filteredCandidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCandidate(c);
                      setActiveTab('ficha');
                    }}
                    className={`w-full p-4 text-left flex items-center justify-between gap-3 transition-all border-l-2 ${
                      selectedCandidate?.id === c.id 
                        ? 'bg-slate-800/35 border-red-600 text-white' 
                        : 'border-transparent text-slate-400 hover:bg-slate-850/20 hover:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold truncate text-slate-200">{c.candidateName}</h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 font-medium ${getStatusBadgeStyle(c.status)}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{c.email} • {c.phone}</p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin size={10} className="text-slate-600" />
                          {c.city} {c.neighborhood ? `(${c.neighborhood})` : ''}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[9px]">
                          <Clock size={10} className="text-slate-600" />
                          {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 shrink-0" />
                  </button>
                ))
              )}
            </div>

            {/* Total Footer panel */}
            <div className="p-3 bg-slate-950/40 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between shrink-0">
              <span>Filtro: {filteredCandidates.length} perfis</span>
              <span>Total: {candidates.length}</span>
            </div>
          </div>

          {/* Candidates Detail Panel (col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedCandidate ? (
              <div className="bg-slate-900/50 border border-slate-900/60 rounded-xl overflow-hidden shadow-sm flex flex-col">
                
                {/* Detail Header panel */}
                <div className="p-6 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-600/10 border border-red-600/20 text-red-600 flex items-center justify-center font-serif text-lg font-bold uppercase shrink-0">
                      {selectedCandidate.candidateName.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white font-serif">{selectedCandidate.candidateName}</h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-600" />
                          Inscrito em: {selectedCandidate.createdAt?.toDate ? selectedCandidate.createdAt.toDate().toLocaleString() : (selectedCandidate.createdAt ? new Date(selectedCandidate.createdAt).toLocaleString() : '')}
                        </span>
                        <span>•</span>
                        <span>{selectedCandidate.structuredData?.idade || 'N/A'} anos</span>
                        {selectedCandidate.aiAnalysis && (
                          <>
                            <span>•</span>
                            <span className="text-red-400 font-semibold flex items-center gap-1">
                              <Brain size={12} />
                              Análise IA Gerada
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions (Status selection and Delete) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Etapa Seletiva:</label>
                      <select
                        value={selectedCandidate.status}
                        onChange={(e) => handleStatusChange(e.target.value as Candidate['status'])}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-600"
                      >
                        <option value="NOVO">Novo</option>
                        <option value="EM_ANALISE">Em Análise</option>
                        <option value="CHAMAR_ENTREVISTA">Chamar Entrevista</option>
                        <option value="APROVADO">Aprovado</option>
                        <option value="REPROVADO">Reprovado</option>
                        <option value="ARQUIVADO">Arquivado</option>
                        <option value="INCOMPLETA">Incompleta</option>
                      </select>
                    </div>

                    <button
                      onClick={() => handleDeleteCandidate(selectedCandidate.id!)}
                      className="p-2 text-slate-500 hover:text-red-500 rounded-lg hover:bg-red-950/20 transition-colors border border-transparent hover:border-red-950/40"
                      title="Excluir Dados (LGPD Compliance)"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex border-b border-slate-950 bg-slate-950/10 shrink-0">
                  <button
                    onClick={() => setActiveTab('ficha')}
                    className={`flex-1 py-3 text-xs font-bold tracking-wide border-b-2 transition-all ${
                      activeTab === 'ficha' 
                        ? 'border-red-600 text-white bg-slate-850/15' 
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Ficha Cadastral
                  </button>
                  <button
                    onClick={() => setActiveTab('conversa')}
                    className={`flex-1 py-3 text-xs font-bold tracking-wide border-b-2 transition-all ${
                      activeTab === 'conversa' 
                        ? 'border-red-600 text-white bg-slate-850/15' 
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Conversa Original ({selectedCandidate.chatMessages?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('ia')}
                    className={`flex-1 py-3 text-xs font-bold tracking-wide border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === 'ia' 
                        ? 'border-red-600 text-white bg-slate-850/15' 
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Brain size={14} className={activeTab === 'ia' ? 'text-red-500' : 'text-slate-400'} />
                    Análise IA
                  </button>
                  <button
                    onClick={() => setActiveTab('notas')}
                    className={`flex-1 py-3 text-xs font-bold tracking-wide border-b-2 transition-all ${
                      activeTab === 'notas' 
                        ? 'border-red-600 text-white bg-slate-850/15' 
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Parecer Interno
                  </button>
                </div>

                {/* Tab Content Display Area */}
                <div className="p-6 min-h-[400px]">
                  
                  {/* TAB 1: FICHA CADASTRAL ESTRUTURADA */}
                  {activeTab === 'ficha' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      {/* Contact and Basics Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-950 border border-slate-900 rounded-lg flex items-center gap-3">
                          <Phone size={16} className="text-red-500" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 uppercase block font-bold">WhatsApp</span>
                            <a href={`https://wa.me/${selectedCandidate.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-300 font-semibold hover:underline block truncate">
                              {selectedCandidate.phone}
                            </a>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-950 border border-slate-900 rounded-lg flex items-center gap-3">
                          <Mail size={16} className="text-red-500" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 uppercase block font-bold">E-mail</span>
                            <span className="text-xs text-slate-300 font-semibold block truncate" title={selectedCandidate.email}>
                              {selectedCandidate.email}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-950 border border-slate-900 rounded-lg flex items-center gap-3">
                          <MapPin size={16} className="text-red-500" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 uppercase block font-bold">Localidade</span>
                            <span className="text-xs text-slate-300 font-semibold block truncate">
                              {selectedCandidate.city} {selectedCandidate.neighborhood ? `- ${selectedCandidate.neighborhood}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Complete Structured Q&A mapped directly from structuredData */}
                      <div className="space-y-4 pt-2">
                        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">Respostas à Entrevista Conversacional</h3>
                        
                        {selectedCandidate.structuredData ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Disponibilidade</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.disponibilidadeHorarios || (selectedCandidate.structuredData as any).disponibilidadeHorario || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Disponibilidade aos Sábados</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.disponibilidadeSabados || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Disponibilidade para Eventos / Lives</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.disponibilidadeDatasEspeciais || (selectedCandidate.structuredData as any).disponibilidadeEventos || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Quando pode começar</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.dataInicio || (selectedCandidate.structuredData as any).quandoComecar || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Tipo de Interesse profissional</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.tipoInteresse || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Resumo da Experiência Profissional</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.experienciaProfissional || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Experiência com Atendimento</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.experienciaAtendimento || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Experiência com Vendas / Metas</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.experienciaVendas || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Experiência com Estoque / Caixa / PDV</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.experienciaLojaCaixaEstoquePdv || (selectedCandidate.structuredData as any).experienciaLoja || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">WhatsApp Comercial</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.experienciaWhatsappComercial || (selectedCandidate.structuredData as any).experienciaWhatsComercial || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Última Experiência Detalhada</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                <strong>Trajetória:</strong> {selectedCandidate.structuredData.ultimaExperiencia || 'N/A'}<br />
                                <strong>Cargo:</strong> {selectedCandidate.structuredData.cargoUltimaExperiencia || 'N/A'}<br />
                                <strong>Tempo de Permanência:</strong> {selectedCandidate.structuredData.tempoPermanencia || 'N/A'}<br />
                                <strong>Motivo de Saída:</strong> {selectedCandidate.structuredData.motivoSaida || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Soft Skills (Aprendizado, Organização e Equipe)</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                <strong>Facilidade em Aprender:</strong> {selectedCandidate.structuredData.facilidadeAprender || 'N/A'}<br />
                                <strong>Organização Pessoal:</strong> {selectedCandidate.structuredData.organizacao || 'N/A'}<br />
                                <strong>Trabalho em Equipe:</strong> {selectedCandidate.structuredData.trabalhoEquipe || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Conforto com Segmento Íntimo / Lingerie</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.confortoProdutosIntimos || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Entendimento de Discrição no Atendimento</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.entendimentoDiscricao || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Lidar com cliente indeciso</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.clienteIndeciso || (selectedCandidate.structuredData as any).comoLidariaClienteIndeciso || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Lidar com perguntas íntimas</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.perguntasIntimas || (selectedCandidate.structuredData as any).comoLidariaPerguntasIntimas || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900 md:col-span-2">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Uso de Instagram / Redes Sociais</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.facilidadeRedesSociais || (selectedCandidate.structuredData as any).facilidadeInstagram || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Ponto Forte</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.pontoForte || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Ponto a Desenvolver</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.pontoDesenvolver || (selectedCandidate.structuredData as any).pontoMelhorar || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Expectativa Salarial</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.expectativaSalarial || 'N/A'}
                              </p>
                            </div>

                            <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900">
                              <span className="text-[10px] uppercase font-bold text-slate-500">Mensagem Final para a Empresa</span>
                              <p className="text-xs text-slate-200 leading-relaxed">
                                {selectedCandidate.structuredData.mensagemFinal || 'N/A'}
                              </p>
                            </div>

                          </div>
                        ) : (
                          <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 border border-slate-900 rounded-lg">
                            Esta candidatura antiga não possui dados estruturados associados.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 2: CONVERSA ORIGINAL COMPLETA */}
                  {activeTab === 'conversa' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg text-xs text-slate-400 leading-relaxed mb-2">
                        Histórico bruto de mensagens trocadas em tempo real durante a entrevista virtual.
                      </div>
                      
                      <div className="space-y-4 max-h-[520px] overflow-y-auto p-4 border border-slate-900 bg-slate-950/35 rounded-xl">
                        {selectedCandidate.chatMessages && selectedCandidate.chatMessages.length > 0 ? (
                          selectedCandidate.chatMessages.map((msg: ChatMessage) => {
                            const isBot = msg.sender === 'bot';
                            return (
                              <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                                  isBot 
                                    ? 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none' 
                                    : 'bg-red-950/40 border border-red-900/30 text-slate-200 rounded-tr-none'
                                }`}>
                                  <span className="text-[10px] font-bold text-slate-500 block mb-1">
                                    {isBot ? 'Recrutadora Aurora' : selectedCandidate.candidateName.split(' ')[0]}
                                  </span>
                                  <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                                  <span className="block text-[8px] text-slate-600 mt-1.5 text-right font-mono">
                                    {msg.timestamp || ''}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-12 text-xs text-slate-500 font-mono">
                            Nenhum registro de conversa encontrado neste candidato.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 3: ANÁLISE IA (OPENAI INTEGRATION) */}
                  {activeTab === 'ia' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-950 border border-slate-900 rounded-xl">
                        <div className="flex gap-3">
                          <div className="w-9 h-9 rounded-full bg-red-600/10 border border-red-600/20 text-red-600 flex items-center justify-center shrink-0">
                            <Brain size={18} />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-200">Parecer Consultivo com OpenAI</h3>
                            <p className="text-[10px] text-slate-400">Analisa o fit de marca, pontua virtudes, ressalvas e sugere roteiro sob medida</p>
                          </div>
                        </div>

                        <button
                          onClick={handleTriggerIAAnalysis}
                          disabled={analyzingIA}
                          className="px-4 py-2 bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border border-red-800 shadow-[0_4px_15px_rgba(220,38,38,0.15)] disabled:opacity-50 font-sans"
                        >
                          {analyzingIA ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Sintetizando...
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              {selectedCandidate.aiAnalysis ? 'Atualizar Avaliação por IA' : 'Gerar Avaliação por IA'}
                            </>
                          )}
                        </button>
                      </div>

                      {selectedCandidate.aiAnalysis ? (
                        <div className="space-y-6">
                          
                          {/* Nivel de Aderencia card banner */}
                          <div className="p-4 bg-slate-950 border border-slate-900 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-500 block">Nível de Aderência Recomendado</span>
                              <span className="text-xs text-slate-400">Com base no fit cultural da Discreta Boutique</span>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full border text-xs font-bold uppercase ${
                              selectedCandidate.aiAnalysis.nivelAderencia === 'alto' 
                                ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                : selectedCandidate.aiAnalysis.nivelAderencia === 'medio'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              Aderência: {selectedCandidate.aiAnalysis.nivelAderencia}
                            </span>
                          </div>

                          {/* Resumo */}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Resumo Profissional da IA</span>
                            <p className="text-xs text-slate-300 bg-slate-950/25 p-4 border border-slate-900 rounded-lg leading-relaxed italic">
                              "{selectedCandidate.aiAnalysis.resumoProfissional}"
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Strengths */}
                            <div className="space-y-1 bg-slate-950/20 p-4 border border-slate-900 rounded-lg">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-green-400 block mb-2">Pontos Fortes</span>
                              {selectedCandidate.aiAnalysis.pontosFortes && selectedCandidate.aiAnalysis.pontosFortes.length > 0 ? (
                                <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-300">
                                  {selectedCandidate.aiAnalysis.pontosFortes.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-slate-500 font-mono">Nenhum mapeado</span>
                              )}
                            </div>

                            {/* Weaknesses / Points of attention */}
                            <div className="space-y-1 bg-slate-950/20 p-4 border border-slate-900 rounded-lg">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block mb-2">Pontos de Atenção</span>
                              {selectedCandidate.aiAnalysis.pontosAtencao && selectedCandidate.aiAnalysis.pontosAtencao.length > 0 ? (
                                <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-300">
                                  {selectedCandidate.aiAnalysis.pontosAtencao.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-slate-500 font-mono">Nenhum mapeado</span>
                              )}
                            </div>
                          </div>

                          {/* Justificativa Objetiva */}
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Justificativa Objetiva de Recomendação</span>
                            <p className="text-xs text-slate-300 bg-slate-950/25 p-4 border border-slate-900 rounded-lg leading-relaxed">
                              {selectedCandidate.aiAnalysis.justificativaObjetiva}
                            </p>
                          </div>

                          {/* Suggested Interview script */}
                          <div className="space-y-2 bg-slate-950/20 p-4 border border-slate-900 rounded-lg">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block border-b border-slate-800 pb-1.5">Roteiro Recomendado para Entrevista Presencial</span>
                            {selectedCandidate.aiAnalysis.perguntasRecomendadas && selectedCandidate.aiAnalysis.perguntasRecomendadas.length > 0 ? (
                              <ul className="list-decimal pl-4 space-y-2 text-xs text-slate-300">
                                {selectedCandidate.aiAnalysis.perguntasRecomendadas.map((p, i) => (
                                  <li key={i} className="leading-relaxed">{p}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">Nenhuma pergunta sugerida</span>
                            )}
                          </div>

                          {/* Final Observation */}
                          {selectedCandidate.aiAnalysis.observacaoFinal && (
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Observação Final do Avaliador IA</span>
                              <p className="text-xs text-slate-400 bg-slate-950/10 p-3 rounded-lg border border-slate-900/60 leading-relaxed font-sans">
                                {selectedCandidate.aiAnalysis.observacaoFinal}
                              </p>
                            </div>
                          )}

                          <div className="text-[9px] text-slate-600 font-mono text-center flex items-center justify-center gap-1 mt-4">
                            <AlertCircle size={10} />
                            <span>Nota: Parecer técnico consultivo de inteligência artificial. Decisão final e homologação restrita à liderança humana.</span>
                          </div>

                        </div>
                      ) : (
                        <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center bg-slate-950/10">
                          <Brain size={28} className="text-slate-600 mb-2" />
                          <h4 className="text-xs font-bold text-slate-300">Nenhum parecer gerado</h4>
                          <p className="text-[10px] text-slate-500 mt-1 max-w-sm leading-relaxed">
                            Aperte o botão superior "Gerar Avaliação por IA" para submeter a ficha estruturada do candidato ao motor OpenAI e obter insights automatizados.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* TAB 4: PARECER / NOTAS INTERNAS */}
                  {activeTab === 'notas' && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Anotações e Pareceres do Time Humano</label>
                        <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                          Utilize este espaço privativo dos recrutadores para registrar percepções de entrevistas presenciais ou telefônicas, notas de dinâmica e acompanhamentos internos.
                        </p>
                        <textarea
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          placeholder="Digite suas observações de entrevista presencial, notas de comportamento e feedback de gestão..."
                          className="w-full h-64 bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 resize-y leading-relaxed"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={savingNotes}
                          onClick={handleSaveNotes}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {savingNotes ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} className="text-red-500" />}
                          Salvar Parecer Interno
                        </button>
                      </div>
                    </motion.div>
                  )}

                </div>

              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-900/60 rounded-xl p-12 text-center flex flex-col items-center justify-center">
                <Users size={24} className="text-slate-600 mb-2 animate-pulse" />
                <h3 className="text-xs font-bold text-slate-400">Selecione um candidato ao lado para abrir os dados completos</h3>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
