import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useFeedback } from '../../contexts/FeedbackContext';
import { roleService, AppRole, MODULES, ACTIONS } from '../../services/roleService';
import { Plus, Edit2, Trash2, X, Lock, Save, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export function AdminRoles() {
    const { toast, confirm } = useFeedback();
    const { hasPermission } = useAuthStore();
    
    const [roles, setRoles] = useState<AppRole[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    
    // Form States
    const [formId, setFormId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [active, setActive] = useState(true);
    const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await roleService.listRoles();
            setRoles(data);
        } catch(e: any) {
            toast("Erro: " + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const resetForm = () => {
        setFormId(null);
        setName('');
        setDescription('');
        setActive(true);
        
        const initialPerms: any = {};
        MODULES.forEach(m => {
            initialPerms[m.id] = {};
            ACTIONS.forEach(a => initialPerms[m.id][a] = false);
        });
        setPermissions(initialPerms);
    };

    const handleNew = () => {
        resetForm();
        setView('form');
    };

    const handleEdit = (role: AppRole) => {
        setFormId(role.id!);
        setName(role.name);
        setDescription(role.description || '');
        setActive(role.active !== false);
        
        // Merge permissions
        const mergedPerms: any = {};
        MODULES.forEach(m => {
            mergedPerms[m.id] = {};
            ACTIONS.forEach(a => {
                mergedPerms[m.id][a] = role.permissions?.[m.id]?.[a] || false;
            });
        });
        setPermissions(mergedPerms);
        setView('form');
    };

    const handleTogglePerm = (mod: string, act: string) => {
        setPermissions(prev => ({
            ...prev,
            [mod]: {
                ...prev[mod],
                [act]: !prev[mod]?.[act]
            }
        }));
    };

    const handleToggleRow = (mod: string) => {
        setPermissions(prev => {
            const currentState = prev[mod] || {};
            const isAllTrue = ACTIONS.every(a => currentState[a]);
            const newRow: any = {};
            ACTIONS.forEach(a => newRow[a] = !isAllTrue);
            return {
                ...prev,
                [mod]: newRow
            };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return toast("Nome do perfil é obrigatório.", "warning");

        setSubmitting(true);
        try {
            await roleService.saveRole({
                id: formId || undefined,
                name,
                description,
                active,
                permissions
            });
            toast("Perfil salvo com sucesso!", "success");
            setView('list');
            loadData();
        } catch (e: any) {
            toast("Erro: " + e.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (role: AppRole) => {
        const ok = await confirm({
            title: "Excluir Perfil",
            message: `Tem certeza que excluir o perfil "${role.name}"? Usuários com este perfil perderão os acessos.`,
            confirmText: "Excluir",
            variant: "danger"
        });
        if (ok) {
            try {
                await roleService.deleteRole(role.id!);
                toast("Perfil excluído.");
                loadData();
            } catch(e) {
                toast("Erro ao excluir.", 'error');
            }
        }
    };

    if (view === 'form') return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800 py-4 px-6 rounded-xl border">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('list')} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-white">{formId ? 'Editar Perfil de Acesso' : 'Novo Perfil de Acesso'}</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setView('list')}>Cancelar</Button>
                <Button onClick={handleSave} disabled={submitting} className="bg-slate-900 hover:bg-slate-800">
                  {submitting ? 'Salvando...' : <><Save size={18} className="mr-2"/> Salvar Perfil</>}
                </Button>
              </div>
            </header>

            <div className="bg-slate-900 rounded-xl shadow-sm border p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold mb-1">Nome do Perfil <span className="text-red-500">*</span></label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Vendedor, Gerente..." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-1">Descrição</label>
                        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Função na empresa" />
                    </div>
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-lg border w-fit">
                            <input type="checkbox" id="active" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 text-white" />
                            <label htmlFor="active" className="text-sm font-bold">Perfil Ativo</label>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-slate-100">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Lock size={18} /> Matriz de Permissões
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">Defina exatamente o que este perfil pode fazer em cada módulo do sistema.</p>
                    </div>

                    <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-800 border-b">
                                <tr>
                                    <th className="p-4 font-bold text-slate-200 w-48">Módulo</th>
                                    {ACTIONS.map(a => (
                                        <th key={a} className="p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider text-center">
                                            {a}
                                        </th>
                                    ))}
                                    <th className="p-4 text-center">Tudo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {MODULES.map(mod => (
                                    <tr key={mod.id} className="hover:bg-slate-800/50">
                                        <td className="p-4 font-medium text-slate-100">{mod.label}</td>
                                        {ACTIONS.map(act => (
                                            <td key={act} className="p-4 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 text-red-600 rounded border-slate-600"
                                                    checked={permissions[mod.id]?.[act] || false}
                                                    onChange={() => handleTogglePerm(mod.id, act)}
                                                />
                                            </td>
                                        ))}
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => handleToggleRow(mod.id)}
                                                className="text-[10px] font-bold uppercase text-slate-400 hover:text-white border border-slate-700 px-2 py-1 rounded bg-slate-900"
                                            >
                                                Toggle
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Perfis de Acesso</h1>
                <p className="text-slate-400">Crie grupos com permissões específicas para atribuir aos usuários.</p>
                </div>
                {hasPermission('roles', 'criar') && (
                    <Button onClick={handleNew} className="bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200">
                        <Plus size={18} className="mr-2" /> Novo Perfil
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="p-6 text-center text-slate-400 font-medium">Carregando perfis...</div>
                ) : roles.map(role => (
                    <div key={role.id} className="bg-slate-900 border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-950 rounded-lg flex items-center justify-center text-slate-300"><Lock size={20} /></div>
                                <div>
                                    <h3 className="font-bold text-white">{role.name}</h3>
                                    <p className="text-xs text-slate-400">{role.description || 'Sem descrição'}</p>
                                </div>
                            </div>
                            {!role.active && <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded uppercase">Inativo</span>}
                        </div>
                        
                        <div className="mt-auto pt-4 border-t flex items-center justify-end gap-2">
                            {hasPermission('roles', 'editar') && (
                                <button onClick={() => handleEdit(role)} className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-950 rounded-lg transition-colors">
                                    <Edit2 size={16} />
                                </button>
                            )}
                            {hasPermission('roles', 'excluir') && (
                                <button onClick={() => handleDelete(role)} className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
