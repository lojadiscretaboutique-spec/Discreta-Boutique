import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { ListRestart, CheckCircle2, XCircle, Search, RefreshCcw, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';
import { useFeedback } from '../../contexts/FeedbackContext';

export const AdminRecoveryLogs = () => {
    const { toast } = useFeedback();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'recovery_logs'),
                orderBy('sentAt', 'desc'),
                limit(100)
            );
            const snap = await getDocs(q);
            setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) {
            console.error(e);
            toast("Erro ao carregar logs de recuperação", "error");
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => 
        log.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.customerPhone?.includes(searchTerm)
    );

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter flex items-center gap-3">
                        <ListRestart className="text-red-600" /> Logs de Recuperação
                    </h1>
                    <p className="text-slate-400 mt-2">Relatório de disparos enviados pelo sistema de abandono.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar cliente ou tel..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white text-sm outline-none focus:border-red-600"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={loadLogs}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors"
                        title="Atualizar"
                    >
                        <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/50 border-b border-slate-800">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">WhatsApp</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Resposta</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Data/Hora</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-600 animate-pulse font-bold italic uppercase tracking-tighter">
                                        Monitorando abandono...
                                    </td>
                                </tr>
                            )}

                            {!loading && filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-600 font-bold italic uppercase tracking-tighter">
                                        Nenhum log encontrado.
                                    </td>
                                </tr>
                            )}

                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white uppercase text-xs">{log.customerName}</div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                                        {log.customerPhone}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                            {log.status === 'success' ? (
                                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase italic">
                                                    <CheckCircle2 size={10} /> Enviado
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-500/20 text-[9px] font-black uppercase italic">
                                                    <XCircle size={10} /> Falhou
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`text-[11px] font-bold ${log.responseStatus >= 200 && log.responseStatus < 300 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {log.responseStatus || '—'}
                                        </span>
                                        {log.errorMessage && (
                                            <div className="text-[8px] text-red-600 uppercase font-black truncate max-w-[150px] mx-auto opacity-50 font-sans">
                                                {log.errorMessage}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">
                                            {log.sentAt?.toDate ? format(log.sentAt.toDate(), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : '—'}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminRecoveryLogs;
