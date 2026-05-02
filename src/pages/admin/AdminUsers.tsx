import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { User, userService } from '../../services/userService';
import { AppRole, roleService, MODULES, ACTIONS } from '../../services/roleService';
import { useFeedback } from '../../contexts/FeedbackContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Edit2, Trash2, X, Shield, Save, ArrowLeft, User as UserIcon, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  
  const { toast, confirm } = useFeedback();
  const { hasPermission } = useAuthStore();

  const canCreate = hasPermission('users', 'criar');
  const canEdit = hasPermission('users', 'editar');
  const canDelete = hasPermission('users', 'excluir');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formId, setFormId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<User>>({});
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [individualPerms, setIndividualPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uData, rData] = await Promise.all([
         userService.listUsers(),
         roleService.listRoles()
      ]);
      setUsers(uData);
      setRoles(rData);
    } catch(e: any) {
      toast("Erro ao listar contas", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
      setFormId(null);
      setForm({
          name: '',
          email: '',
          phone: '',
          cpf: '',
          status: 'ativo',
          notes: '',
          commission: 0
      });
      setSelectedRoles([]);
      setIndividualPerms({});
  };

  const handleNew = () => {
      resetForm();
      setView('form');
  };

  const handleEdit = (u: User) => {
      setFormId(u.id!);
      setForm({
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          cpf: u.cpf || '',
          status: u.status || (u.active ? 'ativo' : 'inativo'),
          notes: u.notes || '',
          commission: u.commission || 0
      });
      setSelectedRoles(u.roles || (u.role ? [u.role] : [])); // Migrate legacy
      
      const p = u.individualPermissions || {};
      const filled: any = {};
      MODULES.forEach(m => {
          filled[m.id] = {};
          ACTIONS.forEach(a => {
              filled[m.id][a] = p[m.id]?.[a] || false;
          });
      });
      setIndividualPerms(filled);
      setView('form');
  };

  const handleToggleIndvPerm = (mod: string, act: string) => {
      setIndividualPerms(prev => ({
          ...prev,
          [mod]: {
              ...prev[mod],
              [act]: !prev[mod]?.[act]
          }
      }));
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.name || !form.email) return toast("Nome e Email são obrigatórios.", "warning");
      if (!formId && !((form as any).password)) return toast("Você precisa definir uma senha inicial para este usuário.", "warning");
      if (!formId && ((form as any).password?.length < 6)) return toast("A senha deve ter pelo menos 6 caracteres.", "warning");

      setSubmitting(true);
      try {
          await userService.saveUser(formId || `temp_${Date.now()}`, {
              ...form,
              roles: selectedRoles,
              individualPermissions: individualPerms
          } as any);
          toast("Usuário salvo com sucesso!", "success");
          setView('list');
          loadData();
      } catch (e: any) {
          toast("Erro: " + e.message, "error");
      } finally {
          setSubmitting(false);
      }
  };

  const handleDelete = async (u: User) => {
      const ok = await confirm({
          title: "Excluir Conta",
          message: `Tem certeza que deseja excluir "${u.name}" permanentemente?`,
          confirmText: "Excluir",
          variant: "danger"
      });
      if (ok) {
          try {
              await userService.deleteUser(u.id!);
              toast("Usuário excluído.");
              loadData();
          } catch(e) {
              toast("Erro ao excluir. Verifique permissões.", 'error');
          }
      }
  };

  const handleResetPassword = async () => {
    if (!form.email) return;
    const ok = await confirm({
        title: "Recuperar Senha",
        message: `Enviar e-mail de recuperação de senha para ${form.email}?`,
        confirmText: "Enviar E-mail"
    });

    if (ok) {
        try {
            await sendPasswordResetEmail(auth, form.email);
            toast("E-mail de recuperação enviado com sucesso!", "success");
        } catch (e: any) {
            toast("Erro: " + e.message, "error");
        }
    }
  };

  const filteredUsers = users.filter(u => {
      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          if (!u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) return false;
      }
      return true;
  });

  if (view === 'form') return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800 py-4 px-6 rounded-xl border">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('list')} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-white">{formId ? 'Editar Usuário' : 'Novo Usuário (Pré-Cadastro)'}</h1>
                  {!formId && <p className="text-xs text-slate-400 mt-1">Ao salvar, o sistema preparará o perfil deste e-mail.</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setView('list')}>Cancelar</Button>
                <Button onClick={handleSave} disabled={submitting} className="bg-slate-900 hover:bg-slate-800">
                  {submitting ? 'Salvando...' : <><Save size={18} className="mr-2"/> Salvar Conta</>}
                </Button>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Coluna Dados Pessoais */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-slate-900 rounded-xl shadow-sm border p-6 space-y-4">
                        <h3 className="font-bold flex items-center gap-2 text-slate-100"><UserIcon size={18} /> Dados da Conta</h3>
                        <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-400">Nome Completo *</label>
                            <Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Maria Souza" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-400">Email (Login) *</label>
                            <Input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} disabled={!!formId} placeholder="nome@empresa.com" className="disabled:bg-slate-950 disabled:text-slate-400" />
                        </div>
                        {!formId && (
                            <div>
                                <label className="block text-xs font-bold mb-1 uppercase text-slate-400">Definir Senha Inicial *</label>
                                <Input type="password" value={(form as any).password || ''} onChange={e => setForm({...form, password: e.target.value} as any)} placeholder="Mínimo 6 caracteres" />
                                <p className="text-[10px] text-slate-400 mt-1">Esta senha será usada pelo colaborador para o primeiro acesso.</p>
                            </div>
                        )}
                        {formId && (
                            <div className="pt-2">
                                <Button type="button" variant="outline" className="w-full text-xs gap-2" onClick={handleResetPassword}>
                                    <Mail size={14} /> Enviar E-mail de Recuperação
                                </Button>
                                <p className="text-[10px] text-slate-400 mt-2 text-center italic">Envia link oficial do Firebase para o e-mail cadastrado.</p>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-400">Telefone / WhatsApp</label>
                            <Input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(00) 00000-0000" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-400">CPF (Opcional)</label>
                            <Input value={form.cpf || ''} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-400">Status de Acesso</label>
                            <select className="w-full border border-slate-600 p-2.5 rounded-md text-sm outline-none focus:ring-2 focus:ring-slate-900 bg-slate-800 font-semibold" value={form.status || ''} onChange={e => setForm({...form, status: e.target.value as any})}>
                                <option value="ativo">Ativo (Pode acessar)</option>
                                <option value="bloqueado">Bloqueado (Acesso Negado)</option>
                                <option value="inativo">Inativo (Desligado)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-400">Anotações Internas (RH)</label>
                            <textarea className="w-full border border-slate-600 p-3 rounded-md text-sm outline-none min-h-[100px]" value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Observações..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 uppercase text-slate-400">Comissão de Venda Física (%)</label>
                            <Input type="number" step="0.1" value={form.commission ?? 0} onChange={e => setForm({...form, commission: Number(e.target.value)})} placeholder="Ex: 5" />
                        </div>
                    </div>
                </div>

                {/* Coluna Acessos e Matriz */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-slate-900 rounded-xl shadow-sm border p-6 space-y-4">
                        <h3 className="font-bold flex items-center gap-2 text-slate-100 border-b pb-3"><Shield size={18} /> Vinculação de Perfis Base</h3>
                        <p className="text-sm text-slate-400">Selecione 1 ou mais perfis de acesso padronizados. As permissões serão somadas.</p>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            {roles.map(r => (
                                <label key={r.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedRoles.includes(r.id!) ? 'border-red-600 bg-red-50' : 'border-slate-700 hover:bg-slate-800'}`}>
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 text-red-600 rounded border-slate-600" 
                                        checked={selectedRoles.includes(r.id!)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedRoles(prev => [...prev, r.id!]);
                                            else setSelectedRoles(prev => prev.filter(id => id !== r.id));
                                        }}
                                    />
                                    <div>
                                        <p className="font-bold text-sm text-white">{r.name}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl shadow-sm border p-6 space-y-4">
                        <div>
                            <h3 className="font-bold flex items-center gap-2 text-slate-100 text-lg">Permissões Individuais Extras</h3>
                            <p className="text-sm text-slate-400 mt-1">Marque caixas nesta matriz apenas se quiser atribuir uma permissão exclusiva a este usuário, ignorando as restrições dos seus Perfis Base.</p>
                        </div>
                        
                        <div className="overflow-x-auto border rounded-xl mt-4">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-800 border-b">
                                <tr>
                                    <th className="p-4 font-bold text-slate-200 w-48">Módulo (Sobrescrita)</th>
                                    {ACTIONS.map(a => (
                                        <th key={a} className="p-4 font-bold text-slate-400 uppercase text-[10px] tracking-wider text-center">
                                            {a}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {MODULES.map(mod => (
                                    <tr key={mod.id} className="hover:bg-slate-800/50">
                                        <td className="p-4 text-slate-100 text-xs font-bold uppercase">{mod.label}</td>
                                        {ACTIONS.map(act => (
                                            <td key={act} className="p-4 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    title="Adicionar permissão extra"
                                                    className="w-4 h-4 text-white rounded border-slate-600"
                                                    checked={individualPerms[mod.id]?.[act] || false}
                                                    onChange={() => handleToggleIndvPerm(mod.id, act)}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    </div>
                </div>

            </div>
      </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-center sm:text-left">Usuários</h1>
            <p className="text-slate-400 text-center sm:text-left">Contas de acesso à plataforma.</p>
        </div>
        {hasPermission('users', 'criar') && (
            <Button onClick={handleNew} className="w-full sm:w-auto shadow-lg bg-slate-900 hover:bg-slate-800">
                <Plus size={18} className="mr-2" /> Novo Usuário
            </Button>
        )}
      </div>

      <div className="bg-slate-900 border rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b bg-slate-800">
              <Input 
                placeholder="Buscar usuário por nome ou email..." 
                className="max-w-md bg-slate-900 h-10" 
                value={searchTerm || ''}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-800 border-b">
                <tr className="text-slate-400 text-xs uppercase tracking-wider text-left">
                <th className="p-4 font-semibold w-[300px]">Nome Empregado</th>
                <th className="p-4 font-semibold">Perfis Vinculados</th>
                <th className="p-4 font-semibold w-32">Status</th>
                <th className="p-4 font-semibold w-40">Último Login</th>
                <th className="p-4 font-semibold w-24 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {loading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Carregando usuários...</td></tr>
                ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhuma conta encontrada.</td></tr>
                ) : filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-slate-800 transition-colors">
                    <td className="p-4">
                        <p className="font-bold text-white whitespace-normal break-words max-w-[200px]">{u.name}</p>
                        <p className="text-xs text-slate-400 whitespace-normal break-words max-w-[200px]">{u.email}</p>
                    </td>
                    <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                            {(!u.roles || u.roles.length === 0) ? (
                                <span className="bg-slate-950 text-slate-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">{u.role || 'Sem Perfil'}</span>
                            ) : (
                                u.roles.map(rId => {
                                    const rObj = roles.find(ro => ro.id === rId);
                                    return <span key={rId} className="bg-slate-950 border text-slate-200 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">{rObj?.name || rId}</span>
                                })
                            )}
                        </div>
                    </td>
                    <td className="p-4">
                        <span className={`px-2 py-1 flex items-center justify-center font-bold tracking-wider rounded text-[10px] uppercase w-fit ${(u.status === 'ativo' || u.active) ? 'bg-emerald-100 text-emerald-700' : u.status === 'bloqueado' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-300'}`}>
                            {u.status || (u.active ? 'Ativo' : 'Inativo')}
                        </span>
                    </td>
                    <td className="p-4 text-xs text-slate-400 font-medium">
                        {u.lastLoginAt ? format(u.lastLoginAt?.toDate?.() || new Date(), "dd/MM/yy 'às' HH:mm", {locale: ptBR}) : 'Nunca'}
                    </td>
                    <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                            {hasPermission('users', 'editar') && (
                                <button onClick={() => handleEdit(u)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-200 rounded-lg transition-all" title="Editar Controles">
                                    <Edit2 size={16} />
                                </button>
                            )}
                            {hasPermission('users', 'excluir') && (
                                <button onClick={() => handleDelete(u)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Banir/Excluir Permanentemente">
                                    <Trash2 size={16} />
                                </button>
                            )}
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
}
