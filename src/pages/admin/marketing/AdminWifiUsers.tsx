import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  RefreshCw, Users, Search, Download, Trash2, 
  Calendar, Smartphone, Info, Wifi, Tag, MapPin 
} from 'lucide-react';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface WifiLead {
  id: string;
  name: string;
  whatsapp: string;
  createdAt: any;
  updatedAt: any;
  mac?: string;
  ip?: string;
  source?: string;
  userAgent?: string;
  origin?: string;
}

export default function AdminWifiUsers() {
  const [leads, setLeads] = useState<WifiLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('todos');
  const { toast, confirm } = useFeedback();

  // Load leads with real-time sync
  useEffect(() => {
    setLoading(true);
    
    // Subscribe to wifiLeads collection
    const unsubscribe = onSnapshot(
      collection(db, 'wifiLeads'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as WifiLead[];
        
        // Sort in memory by createdAt descending
        data.sort((a, b) => {
          const dateA = getDateFromTimestamp(a.createdAt || a.updatedAt);
          const dateB = getDateFromTimestamp(b.createdAt || b.updatedAt);
          return dateB.getTime() - dateA.getTime();
        });

        setLeads(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to wifiLeads:', error);
        toast('Erro ao carregar os dados em tempo real.', 'error');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Safe Timestamp parsing helper
  const getDateFromTimestamp = (item: any): Date => {
    if (!item) return new Date(0);
    if (item.toDate && typeof item.toDate === 'function') {
      return item.toDate();
    }
    if (item.seconds) {
      return new Date(item.seconds * 1000);
    }
    const date = new Date(item);
    return isNaN(date.getTime()) ? new Date(0) : date;
  };

  // Delete Lead
  const handleDeleteLead = async (lead: WifiLead) => {
    const ok = await confirm({
      title: 'Excluir Lead de Wi-Fi',
      message: `Tem certeza que deseja remover o cadastro de ${lead.name || 'este cliente'}? Esta ação é permanente.`,
      confirmText: 'Excluir',
      variant: 'danger',
    });

    if (ok) {
      try {
        await deleteDoc(doc(db, 'wifiLeads', lead.id));
        toast('Cadastro removido com sucesso!', 'success');
      } catch (err) {
        console.error('Error deleting lead:', err);
        toast('Erro ao remover o cliente da lista.', 'error');
      }
    }
  };

  // Filter logic
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search term
      const term = searchTerm.toLowerCase();
      const matchName = lead.name?.toLowerCase().includes(term);
      const matchPhone = lead.whatsapp?.toLowerCase().includes(term);
      const matchMac = lead.mac?.toLowerCase().includes(term);
      const matchIp = lead.ip?.toLowerCase().includes(term);

      if (searchTerm && !matchName && !matchPhone && !matchMac && !matchIp) {
        return false;
      }

      // Source Filter
      if (sourceFilter !== 'todos' && (lead.source || 'wifi_loja') !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [leads, searchTerm, sourceFilter]);

  // Statistics
  const statistics = useMemo(() => {
    const total = leads.length;
    
    // Count registered today
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const today = leads.filter((lead) => {
      const date = getDateFromTimestamp(lead.createdAt || lead.updatedAt);
      return date.getTime() >= todayStart;
    }).length;

    // Source breakdown
    const sources = leads.reduce((acc: Record<string, number>, lead) => {
      const src = lead.source || 'wifi_loja';
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});

    return { total, today, sources };
  }, [leads]);

  // Handle CSV Export
  const exportToCSV = () => {
    if (filteredLeads.length === 0) {
      toast('Nenhum dado para exportar.', 'error');
      return;
    }

    const headers = ['Nome', 'WhatsApp', 'Data de Cadastro', 'MAC Address', 'IP', 'Dispositivo', 'Origem'];
    const rows = filteredLeads.map((lead) => [
      lead.name || '',
      lead.whatsapp || '',
      lead.createdAt || lead.updatedAt ? getDateFromTimestamp(lead.createdAt || lead.updatedAt).toLocaleString('pt-BR') : '',
      lead.mac || '',
      lead.ip || '',
      lead.userAgent ? lead.userAgent.replace(/,/g, ';').replace(/"/g, '""') : '',
      lead.source || 'wifi_loja',
    ]);

    // Use BOM for Excel compatibility with special characters
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_wifi_discreta_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Lista de leads exportada!', 'success');
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase italic flex items-center gap-2">
            <Wifi className="text-red-500 animate-pulse" size={28} /> Leads do Wi-Fi Hotspot
          </h1>
          <p className="text-zinc-400">
            Gerencie e exporte os leads capturados na tela de login do Wi-Fi físico da Boutique.
          </p>
        </div>
        <Button 
          onClick={exportToCSV} 
          className="bg-red-600 hover:bg-red-700 text-white font-bold shrink-0 flex items-center gap-2"
        >
          <Download size={18} /> Exportar Lista (CSV)
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Total de Leads Wi-Fi</p>
            <Users className="text-red-500" size={18} />
          </div>
          <p className="text-3xl font-black text-white">{statistics.total}</p>
          <p className="text-xs text-zinc-500 mt-1">Clientes cadastrados na loja física</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Conexões de Hoje</p>
            <Calendar className="text-red-500" size={18} />
          </div>
          <p className="text-3xl font-black text-white">{statistics.today}</p>
          <p className="text-xs text-zinc-500 mt-1">Novos clientes cadastrados hoje</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Distribuição por Origem</p>
            <Tag className="text-red-500" size={18} />
          </div>
          <div className="space-y-1 mt-1">
            {Object.entries(statistics.sources).map(([source, count]) => (
              <div key={source} className="flex justify-between text-xs font-semibold text-zinc-300">
                <span className="capitalize">{source.replace('_', ' ')}:</span>
                <span className="text-white font-bold">{count} ({Math.round((count / (statistics.total || 1)) * 100)}%)</span>
              </div>
            ))}
            {Object.keys(statistics.sources).length === 0 && (
              <p className="text-3xl font-black text-white">0</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters Table Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, WhatsApp, MAC, IP..." 
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 text-white outline-none rounded-lg border border-zinc-800 focus:border-red-600 transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="border border-zinc-800 py-2 px-3 rounded-lg bg-zinc-950 text-white text-sm outline-none w-full sm:w-auto font-medium"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="todos">Todos as Origens</option>
          <option value="wifi_loja">Wi-Fi Loja Física</option>
          <option value="manual">Cadastro Manual</option>
        </select>
      </div>

      {/* Leads List Table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-bold">Cliente</th>
                <th className="px-6 py-4 font-bold">WhatsApp / Telefone</th>
                <th className="px-6 py-4 font-bold text-center">Data de Cadastro</th>
                <th className="px-6 py-4 font-bold text-center">Origem</th>
                <th className="px-6 py-4 font-bold">Dispositivo/MAC</th>
                <th className="px-6 py-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin text-red-500" size={18} />
                      Carregando leads do Wi-Fi...
                    </div>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-zinc-500 font-medium">
                    Nenhum cliente atendeu aos filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const regDate = getDateFromTimestamp(lead.createdAt || lead.updatedAt);
                  return (
                    <tr key={lead.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-white whitespace-normal break-words max-w-[220px]">
                          {lead.name}
                        </p>
                        <p className="text-zinc-500 font-mono text-[10px] truncate max-w-[220px]">
                          ID: {lead.id}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-semibold font-mono text-zinc-100">
                        {lead.whatsapp}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="font-bold text-zinc-200">
                          {regDate.toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-medium">
                          {regDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight bg-zinc-950 border border-zinc-850 text-red-400">
                          {lead.source || 'wifi_loja'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-zinc-400">
                        {lead.mac && (
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-500 text-[10px]">MAC:</span>
                            <span>{lead.mac}</span>
                          </div>
                        )}
                        {lead.ip && (
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-500 text-[10px]">IP:</span>
                            <span>{lead.ip}</span>
                          </div>
                        )}
                        {lead.userAgent && (
                          <div className="flex items-center gap-1 mt-0.5 max-w-[200px] text-[10px] text-zinc-500 truncate" title={lead.userAgent}>
                            <Smartphone size={10} className="shrink-0" />
                            <span>{lead.userAgent}</span>
                          </div>
                        )}
                        {!lead.mac && !lead.ip && !lead.userAgent && (
                          <span className="text-zinc-600 italic">Dispositivo físico</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteLead(lead)}
                          className="w-8 h-8 inline-flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors" 
                          title="Excluir Lead"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
