import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Instagram, 
  Mail, 
  MessageCircle, 
  MapPin, 
  Sparkles, 
  Search, 
  X,
  Megaphone,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import { MktInfluencer, MktTask } from '../marketingTypes';

interface MktInfluencersProps {
  influencers: MktInfluencer[];
  tasks: MktTask[];
  saveInfluencer: (inf: MktInfluencer) => Promise<void>;
  createInfluencer: (inf: Omit<MktInfluencer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  deleteInfluencer: (id: string) => Promise<void>;
}

export function MktInfluencers({
  influencers,
  tasks,
  saveInfluencer,
  createInfluencer,
  deleteInfluencer
}: MktInfluencersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [instagram, setInstagram] = useState('');
  const [followers, setFollowers] = useState<number>(10000);
  const [city, setCity] = useState('');
  const [niche, setNiche] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<MktInfluencer['status']>('prospectado');
  const [notes, setNotes] = useState('');

  // Sstatus options
  const statusOptions: Array<{ id: MktInfluencer['status']; label: string; bg: string; text: string }> = [
    { id: 'prospectado', label: 'Prospectado', bg: 'bg-blue-950/60 border-blue-900', text: 'text-blue-300' },
    { id: 'contatado', label: 'Contatado', bg: 'bg-zinc-800 border-zinc-700', text: 'text-zinc-300' },
    { id: 'negociando', label: 'Negociando', bg: 'bg-amber-950/60 border-amber-900', text: 'text-amber-300 font-bold' },
    { id: 'confirmado', label: 'Confirmado', bg: 'bg-violet-950/60 border-violet-900', text: 'text-purple-300' },
    { id: 'recebido_enviado', label: 'Recebido Enviado', bg: 'bg-rose-950/60 border-rose-900', text: 'text-rose-300' },
    { id: 'publicado', label: 'Publicado', bg: 'bg-indigo-950/60 border-indigo-900', text: 'text-sky-305 text-sky-300' },
    { id: 'finalizado', label: 'Finalizado', bg: 'bg-emerald-950/60 border-emerald-900', text: 'text-emerald-300 font-medium' }
  ];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instagram.trim()) return;

    await createInfluencer({
      name,
      instagram: instagram.startsWith('@') ? instagram : `@${instagram}`,
      followers: Number(followers),
      city,
      niche,
      whatsapp,
      email,
      status,
      notes
    });

    setName('');
    setInstagram('');
    setFollowers(10000);
    setCity('');
    setNiche('');
    setWhatsapp('');
    setEmail('');
    setNotes('');
    setShowAddForm(false);
  };

  const handleUpdateStatus = async (inf: MktInfluencer, newStatus: MktInfluencer['status']) => {
    const updated = { ...inf, status: newStatus };
    await saveInfluencer(updated);
  };

  const filtered = influencers.filter(inf => {
    const matchesSearch = inf.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inf.instagram.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inf.niche.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || inf.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusObj = (s: MktInfluencer['status']) => {
    return statusOptions.find(opt => opt.id === s) || statusOptions[0];
  };

  // Compile specific CRM automation tasks
  const influencerTasks = tasks.filter(t => t.phase === 'influenciadores');

  return (
    <div className="space-y-6 animate-fade-in text-white z-10 relative">
      {/* HEADER SUMMARY SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-2">
        {/* TOTAL CRM SUMS */}
        <div className="lg:col-span-8 bg-zinc-950/60 border border-zinc-805 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 backdrop-blur-md">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Users className="w-4 h-4 text-rose-500" />
              <span className="text-xs uppercase font-extrabold tracking-wider">CRM de Contatos de Parceiros</span>
            </div>
            <h3 className="text-md font-bold text-rose-50">Influenciadoras Selecionadas</h3>
            <p className="text-[11px] text-zinc-400 max-w-md">
              Acompanhe a régua e o pipeline de negociações para garantir o engajamento correto da marca Discreta Boutique.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="p-3 bg-zinc-900 border border-zinc-800 text-center rounded-xl min-w-[90px]">
              <span className="text-lg font-black text-white">{influencers.length}</span>
              <span className="text-[9px] text-zinc-500 block uppercase">Registros</span>
            </div>
            <div className="p-3 bg-indigo-950/40 border border-indigo-900/40 text-center rounded-xl min-w-[90px]">
              <span className="text-lg font-black text-rose-300">
                {influencers.filter(i => i.status === 'confirmado').length}
              </span>
              <span className="text-[9px] text-purple-400 block uppercase">Confirmadas</span>
            </div>
            <div className="p-3 bg-emerald-950/40 border border-emerald-900/40 text-center rounded-xl min-w-[90px]">
              <span className="text-lg font-black text-emerald-400">
                {influencers.filter(i => i.status === 'publicado' || i.status === 'finalizado').length}
              </span>
              <span className="text-[9px] text-emerald-400 block uppercase">Publicadas</span>
            </div>
          </div>
        </div>

        {/* INFLUENCER SPECIFIC CHECKS */}
        <div className="lg:col-span-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5 border-b border-zinc-800 pb-2">
            <CalendarDays className="w-3.5 h-3.5 text-rose-500" /> Checklist Cronograma CRM (Junho)
          </h4>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {influencerTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-[11px] hover:text-zinc-100 transition-colors">
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${t.column === 'concluido' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span className={`truncate ${t.column === 'concluido' ? 'line-through text-zinc-500' : 'text-zinc-350'}`}>
                  {t.name} (Dia {t.dueDate.split('-')[2]})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SPREADSHEET TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/60 p-5 rounded-2xl border border-zinc-805 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase block">Procurar Contato</label>
            <input 
              type="text" 
              placeholder="Nome, instagram, nicho..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 p-2 text-xs rounded-xl outline-none text-white focus:border-red-650 w-48 transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase block">Filtro Funil Status</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 p-2 text-xs rounded-xl outline-none text-white focus:border-red-650 transition-all font-semibold"
            >
              <option value="todos">Todos Status</option>
              {statusOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 font-bold text-xs rounded-xl transition-all shadow-[0_4px_12px_rgba(220,38,38,0.2)] flex items-center gap-1.5 cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Cadastrar Influenciadora
        </button>
      </div>

      {/* NEW PROFILE INSERTOR DRAWER */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-down">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Nome Artístico</label>
            <input 
              type="text" 
              required
              placeholder="Ex: Gabriela Brandão"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none focus:border-red-500 text-white"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Instagram</label>
            <input 
              type="text" 
              required
              placeholder="Ex: @gabi_brandao_m"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none focus:border-red-500 text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Seguidores</label>
            <input 
              type="number" 
              placeholder="Ex: 145000"
              value={followers}
              onChange={(e) => setFollowers(Number(e.target.value))}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Cidade - Estado</label>
            <input 
              type="text" 
              placeholder="Ex: São Paulo - Capital"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Nicho Temático</label>
            <input 
              type="text" 
              placeholder="Ex: Moda Íntima / Lifestyle"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Número WhatsApp</label>
            <input 
              type="text" 
              placeholder="Ex: 11999990011"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">E-mail</label>
            <input 
              type="email" 
              placeholder="Ex: gabi@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Status Inicial</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none text-white font-semibold"
            >
              {statusOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="text-[10px] text-zinc-400 font-bold uppercase">Anotações Internas / Roteiro acordado / Kits</label>
            <textarea 
              placeholder="Ex: Enviado Kit Sedutora com Lingerie Rubi. Combinado stories e Reels no dia 05/06..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-950 p-2 text-xs border border-zinc-800 rounded outline-none focus:border-red-500 text-white h-11 resize-none"
            />
          </div>

          <div className="flex items-end gap-2 justify-end">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 text-xs bg-rose-650 hover:bg-rose-700 bg-red-600 text-white font-bold rounded-lg"
            >
              Cadastrar
            </button>
          </div>
        </form>
      )}

      {/* SPREADSHEET TABLE GRID CONTAINER */}
      <div className="bg-zinc-950/45 border border-zinc-805 rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left text-xs text-zinc-100">
            {/* Table headers */}
            <thead className="bg-zinc-900/80 border-b border-zinc-800 uppercase text-[10px] text-zinc-400 font-extrabold tracking-wider">
              <tr>
                <th className="p-4">Nome & Nicho</th>
                <th className="p-4">Instagram</th>
                <th className="p-4">Alcance / Seg.</th>
                <th className="p-4">Localização</th>
                <th className="p-4 w-44">Status Proposta</th>
                <th className="p-4">Anotações</th>
                <th className="p-4 text-center">Contato</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>

            {/* Table body rows */}
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filtered.map(inf => {
                const optObj = getStatusObj(inf.status);
                return (
                  <tr key={inf.id} className="hover:bg-zinc-900/40 group transition-colors">
                    {/* Name */}
                    <td className="p-4 space-y-0.5">
                      <div className="font-bold text-zinc-200 group-hover:text-white transition-colors">{inf.name}</div>
                      <div className="text-[10px] text-zinc-500 font-medium">{inf.niche || 'Lingerie Review'}</div>
                    </td>

                    {/* Instagram */}
                    <td className="p-4 font-mono font-bold text-rose-400/80 hover:text-rose-400 transition-colors">
                      <a 
                        href={`https://instagram.com/${inf.instagram.replace('@', '')}`} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        rel="noreferrer"
                        className="flex items-center gap-1.5"
                      >
                        <Instagram className="w-3.5 h-3.5" /> {inf.instagram}
                      </a>
                    </td>

                    {/* Followers count */}
                    <td className="p-4 font-mono font-bold text-zinc-300">
                      {inf.followers.toLocaleString('pt-BR')}
                    </td>

                    {/* Local or City */}
                    <td className="p-4 text-zinc-400 font-medium">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{inf.city || 'São Paulo'}</span>
                      </div>
                    </td>

                    {/* Status Dropdowns */}
                    <td className="p-4">
                      <select 
                        value={inf.status}
                        onChange={(e) => handleUpdateStatus(inf, e.target.value as any)}
                        className={`w-full p-1.5 px-2.5 rounded-lg border text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer text-center ${optObj.bg}`}
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.id} value={opt.id} className="bg-zinc-950 text-white font-medium capitalize">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Internal Notes area */}
                    <td className="p-4 text-zinc-400 leading-relaxed font-sans max-w-sm truncate" title={inf.notes}>
                      {inf.notes || 'Sem anotações de cronograma adicionais.'}
                    </td>

                    {/* WhatsApp Action links */}
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        {inf.whatsapp && (
                          <a 
                            href={`https://wa.me/${inf.whatsapp}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-1.5 bg-emerald-950 border border-emerald-900/60 text-emerald-400 rounded-lg hover:bg-emerald-900 hover:text-white transition-all cursor-pointer inline-flex items-center"
                            title="Conversar WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}

                        {inf.email && (
                          <a 
                            href={`mailto:${inf.email}`} 
                            className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-450 text-zinc-400 rounded-lg hover:bg-zinc-800 hover:text-white transition-all inline-flex items-center"
                            title="Enviar E-mail"
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Delete action hooks */}
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => {
                          if (confirm(`Excluir ${inf.name} do CRM de Marketing?`)) {
                            deleteInfluencer(inf.id);
                          }
                        }}
                        className="text-zinc-500 hover:text-red-400 p-1.5 hover:bg-red-950/20 rounded-lg transition-all cursor-pointer"
                        title="Deletar Registro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-500 font-medium">
                    Nenhum influenciador encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE PORTRAIT COMPACT CARD VIEW CONTAINER */}
        <div className="block md:hidden divide-y divide-zinc-900/50">
          {filtered.map(inf => {
            const optObj = getStatusObj(inf.status);
            return (
              <div key={inf.id} className="p-5 space-y-4 bg-zinc-950/65 hover:bg-zinc-900/10 transition-all text-white">
                {/* Header: Name, niche & Followers */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-zinc-100">{inf.name}</h4>
                    <span className="text-[10px] text-zinc-500 font-medium font-mono capitalize">{inf.niche || 'Instagrammer'}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-rose-400 block text-xs">{inf.followers.toLocaleString('pt-BR')}</span>
                    <span className="text-[9px] text-zinc-500 block font-bold uppercase font-mono">SEGUIDORES</span>
                  </div>
                </div>

                {/* Info pills: Instagram & City */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <a 
                    href={`https://instagram.com/${inf.instagram.replace('@', '')}`} 
                    target="_blank" 
                    referrerPolicy="no-referrer"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 font-mono font-bold text-rose-350 text-rose-400 hover:text-red-400 transition-colors"
                  >
                    <Instagram className="w-3.5 h-3.5 text-rose-500" /> {inf.instagram}
                  </a>
                  <div className="flex items-center gap-1 text-zinc-400 font-medium">
                    <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                    <span>{inf.city || 'São Paulo'}</span>
                  </div>
                </div>

                {/* Status Dropdowns */}
                <div className="space-y-1">
                  <span className="text-[9px] text-zinc-500 font-bold uppercase block tracking-wider">Status Proposta</span>
                  <select 
                    value={inf.status}
                    onChange={(e) => handleUpdateStatus(inf, e.target.value as any)}
                    className={`w-full p-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer text-center ${optObj.bg}`}
                  >
                    {statusOptions.map(opt => (
                      <option key={opt.id} value={opt.id} className="bg-zinc-950 text-white font-medium capitalize">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                {inf.notes && (
                  <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-850 text-[11px] text-zinc-400 leading-relaxed">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Anotações</span>
                    {inf.notes}
                  </div>
                )}

                {/* Action Row */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-900/60 font-sans">
                  <div className="flex gap-2">
                    {inf.whatsapp && (
                      <a 
                        href={`https://wa.me/${inf.whatsapp}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-3 py-2 bg-emerald-950 border border-emerald-900/60 text-emerald-400 rounded-xl hover:bg-emerald-900 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1.5 text-[10px] font-black"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    {inf.email && (
                      <a 
                        href={`mailto:${inf.email}`} 
                        className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-all inline-flex items-center gap-1.5 text-[10px] font-bold"
                      >
                        <Mail className="w-3.5 h-3.5" /> E-mail
                      </a>
                    )}
                  </div>

                  <button 
                    onClick={() => {
                      if (confirm(`Excluir ${inf.name} do CRM de Marketing?`)) {
                        deleteInfluencer(inf.id);
                      }
                    }}
                    className="text-zinc-500 hover:text-red-400 p-2 hover:bg-red-955/20 hover:bg-red-950/20 rounded-xl transition-all cursor-pointer border border-zinc-900 hover:border-red-900/20"
                    title="Deletar Registro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-zinc-500 font-medium">
              Nenhum influenciador encontrado com os filtros selecionados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
