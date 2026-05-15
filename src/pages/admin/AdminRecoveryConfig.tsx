import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Settings, Save, AlertCircle, Clock, Link as LinkIcon, ShieldCheck, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useFeedback } from '../../contexts/FeedbackContext';

export const AdminRecoveryConfig = () => {
    const { toast, confirm } = useFeedback();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        active: false,
        webhookUrl: '',
        decayMinutes: 30,
        maxAttempts: 1,
        cooldownHours: 24
    });

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const snap = await getDoc(doc(db, 'settings', 'recovery'));
            if (snap.exists()) {
                setConfig({ ...config, ...snap.data() });
            }
        } catch (e) {
            console.error(e);
            toast("Erro ao carregar configurações de recuperação", "error");
        } finally {
            setLoading(false);
        }
    };

    const [testing, setTesting] = useState(false);

    const handleTestWebhook = async () => {
        if (!config.webhookUrl) {
            toast("Insira uma URL de webhook para testar.", "warning");
            return;
        }

        const ok = await confirm({
            title: "Testar Webhook?",
            message: "Será enviado um payload de teste com dados fictícios para validar sua URL.",
            confirmText: "Enviar Teste",
            cancelText: "Agora Não"
        });

        if (!ok) return;

        setTesting(true);
        try {
            const response = await fetch('/api/admin/test-recovery-webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: "Cliente Teste", 
                    phone: "88999266723" // Test number provided by the user
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                toast("Webhook de teste enviado com sucesso!", "success");
            } else {
                toast(data.error || "O webhook respondeu com erro. Verifique os logs.", "error");
            }
        } catch (e: any) {
            toast("Erro na conexão com o servidor.", "error");
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!config.webhookUrl && config.active) {
            toast("A URL do Webhook é obrigatória para ativar a recuperação.", "warning");
            return;
        }

        const ok = await confirm({
            title: "Salvar Alterações?",
            message: "As novas regras de monitoramento de carrinho entrarão em vigor imediatamente.",
            confirmText: "Sim, Salvar",
            cancelText: "Voltar"
        });

        if (!ok) return;

        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'recovery'), config);
            toast("Configurações de recuperação salvas!", "success");
        } catch (e: any) {
            console.error(e);
            toast("Erro ao salvar configurações: " + e.message, "error");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
             <RefreshCcw className="text-red-600 animate-spin mb-4" size={40} />
             <div className="text-white font-black uppercase italic tracking-tighter animate-pulse">Sincronizando Sistema...</div>
        </div>
    );

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <header className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter flex items-center gap-3">
                        <Settings className="text-red-600" /> Recuperador de Carrinho
                    </h1>
                    <p className="text-slate-400 mt-2">Configure o monitoramento inteligente e discreto de abandono de checkout.</p>
                </div>
                <button 
                  onClick={handleTestWebhook}
                  disabled={testing || !config.webhookUrl}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-slate-700 transition-all disabled:opacity-30"
                >
                  {testing ? "Testando..." : "Testar Conexão"}
                </button>
            </header>

            <div className="space-y-6">
                {/* Ativação */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-white font-bold text-lg">Status do Sistema</h3>
                            <p className="text-slate-500 text-sm">Ative ou desative o disparo automático de webhooks.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={config.active}
                                onChange={e => setConfig({ ...config, active: e.target.checked })}
                            />
                            <div className="w-14 h-7 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                    </div>
                </div>

                {/* Webhook URL */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-3 mb-4 text-white">
                        <LinkIcon className="text-red-600" size={20} />
                        <h3 className="font-bold text-lg">Webhook de Recuperação</h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">URL do Webhook Externo</label>
                            <input 
                                type="url" 
                                placeholder="https://api.seurecuperador.com/webhook..."
                                className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-600 transition-colors"
                                value={config.webhookUrl}
                                onChange={e => setConfig({ ...config, webhookUrl: e.target.value })}
                            />
                        </div>
                        <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-4 flex gap-3">
                            <AlertCircle className="text-red-500 shrink-0" size={18} />
                            <p className="text-xs text-red-200/70 leading-relaxed">
                                <strong className="text-red-400 block mb-1">PRIVACIDADE GARANTIDA:</strong>
                                O sistema enviará apenas o <strong>nome</strong> e <strong>telefone</strong> para esta URL. 
                                Ninguém saberá o conteúdo do carrinho, preservando o sigilo total da sua cliente.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Regras de Tempo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4 text-white">
                            <Clock className="text-red-600" size={20} />
                            <h3 className="font-bold text-lg">Tempo de Abandono</h3>
                        </div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Minutos após última atividade</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="number" 
                                className="w-24 bg-black border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-600 center"
                                value={config.decayMinutes}
                                onChange={e => setConfig({ ...config, decayMinutes: parseInt(e.target.value) })}
                            />
                            <span className="text-slate-400 text-sm font-bold">Minutos</span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-4 italic">Recomendado: 30 minutos.</p>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4 text-white">
                            <ShieldCheck className="text-red-600" size={20} />
                            <h3 className="font-bold text-lg">Regras Anti-Spam</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Cooldown (Intervalo Mín.)</label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number" 
                                        className="w-24 bg-black border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-red-600 center"
                                        value={config.cooldownHours}
                                        onChange={e => setConfig({ ...config, cooldownHours: parseInt(e.target.value) })}
                                    />
                                    <span className="text-slate-400 text-sm font-bold">Horas</span>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-2">Não envia mais de uma vez para o mesmo telefone em menos de X horas.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Botão Salvar */}
                <div className="flex justify-end pt-4">
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-tighter px-8 py-4 rounded-2xl flex items-center gap-3 transition-all transform hover:scale-105 disabled:opacity-50"
                    >
                        {saving ? "Salvando..." : <><Save size={20} /> Salvar Configurações</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminRecoveryConfig;
