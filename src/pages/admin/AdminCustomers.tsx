import { useEffect, useState } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Customer, customerService } from '../../services/customerService';
import { State, City, DeliveryArea, deliveryAreaService } from '../../services/deliveryAreaService';
import { useFeedback } from '../../contexts/FeedbackContext';
import { formatCurrency, getDateFromTimestamp } from '../../lib/utils';
import { Search, Edit2, Trash2, ShoppingBag, Eye, X, MapPin, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, confirm } = useFeedback();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos'|'ativo'|'inativo'>('todos');
  const [viewState, setViewState] = useState<'list'|'edit'|'history'|'new'>('list');

  // Edit / History State
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Address logic state
  const [dbStates, setDbStates] = useState<State[]>([]);
  const [dbCities, setDbCities] = useState<City[]>([]);
  const [dbAreas, setDeliveryAreas] = useState<DeliveryArea[]>([]);
  const [selState, setSelState] = useState('');
  const [selCity, setSelCity] = useState('');
  const [selArea, setSelArea] = useState('');

  // Edit Form State
  const [editForm, setEditForm] = useState<Partial<Customer>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await customerService.listCustomers();
      setCustomers(data);
    } catch (err) {
      toast("Erro ao carregar clientes", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Pre-fetch states for forms
  useEffect(() => {
     if (viewState === 'new' || viewState === 'edit') {
         deliveryAreaService.listStates().then(s => setDbStates(s.filter(st => st.status === 'ativo')));
     }
  }, [viewState]);

  // Load cities when state changes
  useEffect(() => {
     if (selState) {
         deliveryAreaService.listCities(selState).then(c => {
             setDbCities(c.filter(ct => ct.status === 'ativo'));
             setSelCity('');
             setDeliveryAreas([]);
             setSelArea('');
         });
     } else {
         setDbCities([]);
         setDeliveryAreas([]);
     }
  }, [selState]);

  // Load areas when city changes
  useEffect(() => {
     if (selCity) {
         deliveryAreaService.listActiveDeliveryAreasForCity(selCity).then(a => {
             setDeliveryAreas(a);
             setSelArea('');
         });
     } else {
         setDeliveryAreas([]);
     }
  }, [selCity]);


  // --- Handlers ---

  const handleAddClick = () => {
      setCurrentCustomer(null);
      setSelState('');
      setSelCity('');
      setSelArea('');
      setEditForm({
          nome: '',
          whatsapp: '',
          status: 'ativo',
          notes: '',
          endereco: { estado: '', cidade: '', bairro: '', rua: '', numero: '', referencia: '', complemento: '' }
      });
      setViewState('new');
  };
  
  const handleEditClick = async (c: Customer) => {
      setCurrentCustomer(c);
      
      setEditForm({
          nome: c.nome,
          whatsapp: c.whatsapp,
          status: c.status,
          notes: c.notes || '',
          endereco: { ...c.endereco }
      });
      setViewState('edit');

      // Initialize selection states to load suggestions
      try {
          const states = await deliveryAreaService.listStates();
          const activeStates = states.filter(s => s.status === 'ativo');
          setDbStates(activeStates);

          const state = activeStates.find(s => s.sigla.trim().toUpperCase() === c.endereco.estado.trim().toUpperCase());
          if (state) {
              setSelState(state.id!);
              const cities = await deliveryAreaService.listCities(state.id!);
              const activeCities = cities.filter(ci => ci.status === 'ativo');
              setDbCities(activeCities);

              const city = activeCities.find(ct => ct.nome.trim().toLowerCase() === c.endereco.cidade.trim().toLowerCase());
              if (city) {
                  setSelCity(city.id!);
                  const areas = await deliveryAreaService.listActiveDeliveryAreasForCity(city.id!);
                  setDeliveryAreas(areas);
                  
                  const area = areas.find(a => a.bairro.trim().toLowerCase() === c.endereco.bairro.trim().toLowerCase());
                  if (area) {
                      setSelArea(area.id!);
                  }
              }
          }
      } catch (err) {
          console.error("Error initializing edit suggestions:", err);
      }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      const isNew = viewState === 'new';

      let fullAddress = { ...editForm.endereco! };

      if (isNew) {
          if (!selState || !selCity || !selArea) {
              toast("Selecione Estado, Cidade e Bairro nas opções listadas.", "error");
              return;
          }

          const sObj = dbStates.find(s => s.id === selState);
          const cObj = dbCities.find(c => c.id === selCity);
          const aObj = dbAreas.find(a => a.id === selArea);

          fullAddress.estado = sObj?.sigla || '';
          fullAddress.cidade = cObj?.nome || '';
          fullAddress.bairro = aObj?.bairro || '';
      } else {
          // Validation for Edit mode inputs
          if (!fullAddress.estado || !fullAddress.cidade || !fullAddress.bairro) {
              toast("Estado, Cidade e Bairro são obrigatórios.", "error");
              return;
          }

          const normalizedState = fullAddress.estado.trim().toUpperCase();
          const normalizedCity = fullAddress.cidade.trim().toLowerCase();
          const normalizedBairro = fullAddress.bairro.trim().toLowerCase();

          const validState = dbStates.find(s => s.sigla.trim().toUpperCase() === normalizedState);
          if (!validState) {
              toast("Selecione um Estado válido da lista de sugestões.", "error");
              return;
          }
          fullAddress.estado = validState.sigla;

          const validCity = dbCities.find(c => c.nome.trim().toLowerCase() === normalizedCity);
          if (!validCity) {
              toast("Selecione uma Cidade válida da lista de sugestões.", "error");
              return;
          }
          fullAddress.cidade = validCity.nome;

          const validBairro = dbAreas.find(a => a.bairro.trim().toLowerCase() === normalizedBairro);
          if (!validBairro) {
              toast("Selecione um Bairro válido da lista de sugestões.", "error");
              return;
          }
          fullAddress.bairro = validBairro.bairro;
      }

      try {
          await customerService.saveCustomer({
              id: currentCustomer?.id,
              ...editForm,
              endereco: fullAddress
          });
          toast(isNew ? "Cliente cadastrado com sucesso!" : "Cliente atualizado com sucesso!", "success");
          setViewState('list');
          loadData();
      } catch (e: any) {
          toast("Erro ao salvar.", "error");
      }
  };

  const handleDeleteOrDeactivate = async (c: Customer) => {
      const hasOrders = (c.totalOrders || 0) > 0;
      const msg = hasOrders 
        ? `Este cliente já possui ${c.totalOrders} pedidos. Ele não será apagado, mas inativado no sistema. Continuar?` 
        : `Deseja excluir permanentemente o cliente ${c.nome}?`;
        
      const ok = await confirm({
          title: hasOrders ? "Inativar Cliente" : "Excluir Cliente",
          message: msg,
          confirmText: hasOrders ? "Inativar" : "Excluir",
          variant: "danger"
      });

      if (ok) {
          try {
              await customerService.deleteOrDeactivateCustomer(c.id!, hasOrders);
              toast(hasOrders ? "Cliente inativado." : "Cliente excluído.");
              loadData();
          } catch(e) {
              toast("Erro ao remover.", "error");
          }
      }
  };

  const handleViewHistory = async (c: Customer) => {
      setCurrentCustomer(c);
      setViewState('history');
      setLoadingOrders(true);
      try {
          const q = query(
              collection(db, 'orders'), 
              where('customerId', '==', c.id)
              // orderBy required index if used with where, avoiding orderBy to avoid index requirement errors during demo, we'll sort manually.
          );
          const snap = await getDocs(q);
          const ordersRaw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Sort descending manually
          ordersRaw.sort((a: any, b: any) => {
             const dA = getDateFromTimestamp(a.createdAt).getTime();
             const dB = getDateFromTimestamp(b.createdAt).getTime();
             return dB - dA;
          });

          setCustomerOrders(ordersRaw);
      } catch (e: any) {
          toast("Erro ao buscar pedidos do cliente.", "error");
      } finally {
          setLoadingOrders(false);
      }
  };

  // --- Filter Logic ---
  
  const filteredList = customers.filter(c => {
      // 1. Status Filter
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      
      // 2. Search Filter
      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchName = c.nome?.toLowerCase().includes(term);
          const matchPhone = c.whatsapp?.toLowerCase().includes(term);
          const matchCity = c.endereco?.cidade?.toLowerCase().includes(term);
          const matchNbhd = c.endereco?.bairro?.toLowerCase().includes(term);
          
          if (!matchName && !matchPhone && !matchCity && !matchNbhd) return false;
      }
      return true;
  });

  // --- Views ---

  if (viewState === 'edit' || viewState === 'new') {
      const isNew = viewState === 'new';
      return (
          <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-12">
              <div className="flex items-center justify-between">
                  <div>
                      <h2 className="text-2xl font-bold">{isNew ? 'Novo Cliente' : 'Editar Cliente'}</h2>
                      <p className="text-slate-400">{isNew ? 'Cadastre um cliente manualmente.' : `Alterando dados para: ${currentCustomer?.nome}`}</p>
                  </div>
                  <Button variant="outline" onClick={() => setViewState('list')}><X size={18} className="mr-2"/> Cancelar</Button>
              </div>

              <form onSubmit={handleSaveEdit} className="bg-slate-900 rounded-xl shadow-sm border p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Nome *</label>
                          <Input required value={editForm.nome || ''} onChange={e => setEditForm({...editForm, nome: e.target.value})} placeholder="Nome completo" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-400 mb-1">WhatsApp *</label>
                          <Input required value={editForm.whatsapp || ''} onChange={e => setEditForm({...editForm, whatsapp: e.target.value})} placeholder="(11) 99999-9999" />
                      </div>

                      <div className="md:col-span-2 mt-4">
                          <h4 className="font-bold border-b pb-2 mb-4 text-slate-100">Endereço de Entrega</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             {isNew ? (
                               <>
                                 <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Estado *</label>
                                    <select required value={selState} onChange={e => setSelState(e.target.value)} className="flex h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600">
                                       <option value="">Selecione...</option>
                                       {dbStates.map(s => <option value={s.id} key={s.id}>{s.sigla} - {s.nome}</option>)}
                                    </select>
                                 </div>
                                 <div className="md:col-span-2">
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Cidade *</label>
                                    <select required value={selCity} onChange={e => setSelCity(e.target.value)} disabled={!selState} className="flex h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50">
                                       <option value="">Selecione...</option>
                                       {dbCities.map(c => <option value={c.id} key={c.id}>{c.nome}</option>)}
                                    </select>
                                 </div>
                                 <div className="md:col-span-3">
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Bairro *</label>
                                    <select required value={selArea} onChange={e => setSelArea(e.target.value)} disabled={!selCity} className="flex h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50">
                                       <option value="">Selecione...</option>
                                       {dbAreas.map(a => <option value={a.id} key={a.id}>{a.bairro}</option>)}
                                    </select>
                                 </div>
                               </>
                             ) : (
                               <>
                                 <div>
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Estado *</label>
                                    <Input 
                                      required 
                                      list="estados-list-edit"
                                      value={editForm.endereco?.estado || ''} 
                                      onChange={e => {
                                          const val = e.target.value.toUpperCase();
                                          setEditForm({...editForm, endereco: {...editForm.endereco!, estado: val}});
                                          const s = dbStates.find(st => st.sigla === val);
                                          if (s) setSelState(s.id!);
                                      }} 
                                      placeholder="UF"
                                    />
                                    <datalist id="estados-list-edit">
                                       {dbStates.map(s => <option key={s.id} value={s.sigla}>{s.nome}</option>)}
                                    </datalist>
                                 </div>
                                 <div className="md:col-span-2">
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Cidade *</label>
                                    <Input 
                                      required 
                                      list="cidades-list-edit"
                                      value={editForm.endereco?.cidade || ''} 
                                      onChange={e => {
                                          const val = e.target.value;
                                          setEditForm({...editForm, endereco: {...editForm.endereco!, cidade: val}});
                                          const c = dbCities.find(ci => ci.nome.toLowerCase() === val.toLowerCase());
                                          if (c) setSelCity(c.id!);
                                      }} 
                                      placeholder="Digite a cidade..."
                                    />
                                    <datalist id="cidades-list-edit">
                                       {dbCities.map(c => <option key={c.id} value={c.nome} />)}
                                    </datalist>
                                 </div>
                                 <div className="md:col-span-3">
                                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Bairro *</label>
                                    <Input 
                                      required 
                                      list="bairros-list-edit"
                                      value={editForm.endereco?.bairro || ''} 
                                      onChange={e => setEditForm({...editForm, endereco: {...editForm.endereco!, bairro: e.target.value}})} 
                                      placeholder="Digite para ver sugestões..."
                                    />
                                    <datalist id="bairros-list-edit">
                                       {dbAreas.map(a => <option key={a.id} value={a.bairro} />)}
                                    </datalist>
                                 </div>
                               </>
                             )}
                             <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Rua *</label>
                                <Input required value={editForm.endereco?.rua || ''} onChange={e => setEditForm({...editForm, endereco: {...editForm.endereco!, rua: e.target.value}})} placeholder="Avenida, Rua..."/>
                             </div>
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Nº *</label>
                                <Input required value={editForm.endereco?.numero || ''} onChange={e => setEditForm({...editForm, endereco: {...editForm.endereco!, numero: e.target.value}})} placeholder="123, S/N..."/>
                             </div>
                             <div className="md:col-span-3">
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Ponto de Referência</label>
                                <Input value={editForm.endereco?.referencia || ''} onChange={e => setEditForm({...editForm, endereco: {...editForm.endereco!, referencia: e.target.value}})} placeholder="Próx a..."/>
                             </div>
                          </div>
                      </div>

                      <div className="md:col-span-2 mt-4 border-t pt-4">
                          <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Observações Internas (Opcional)</label>
                          <textarea 
                              className="w-full border p-2 rounded-md focus:ring-red-500 focus:border-red-500 outline-none text-sm min-h-[80px]"
                              value={editForm.notes || ''}
                              onChange={e => setEditForm({...editForm, notes: e.target.value})}
                              placeholder="Anotações para a equipe (não visível ao cliente)..."
                          />
                      </div>

                      <div className="md:col-span-2 flex justify-between items-center bg-slate-800 p-4 rounded-lg mt-2 border">
                          <div>
                              <p className="font-bold">Status do Cliente</p>
                              <p className="text-xs text-slate-400">Inativar impede o envio mas preserva histórico.</p>
                          </div>
                          <select 
                            className="border p-2 rounded bg-slate-900 font-bold outline-none"
                            value={editForm.status || 'ativo'}
                            onChange={e => setEditForm({...editForm, status: e.target.value as any})}
                          >
                              <option value="ativo">Ativo - Liberado</option>
                              <option value="inativo">Inativo - Bloqueado</option>
                          </select>
                      </div>
                  </div>
                  <div className="pt-4 border-t flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setViewState('list')}>Cancelar</Button>
                      <Button type="submit">{isNew ? 'Cadastrar Cliente' : 'Salvar Alterações'}</Button>
                  </div>
              </form>
          </div>
      );
  }

  if (viewState === 'history' && currentCustomer) {
       const avgTicket = currentCustomer.totalOrders ? (currentCustomer.totalSpent || 0) / currentCustomer.totalOrders : 0;
       
       return (
           <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setViewState('list')} className="p-2 hover:bg-slate-200 rounded-full transition-colors bg-slate-950">
                        <X size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2"><ShoppingBag className="text-red-600"/> Histórico de Compras</h2>
                        <p className="text-slate-400">Cliente: <span className="font-bold text-slate-100">{currentCustomer.nome}</span></p>
                    </div>
                  </div>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 p-6 rounded-xl border shadow-sm">
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Total Pedidos</p>
                      <p className="text-3xl font-black text-slate-100">{currentCustomer.totalOrders || 0}</p>
                  </div>
                  <div className="bg-slate-900 p-6 rounded-xl border shadow-sm">
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Total Gasto</p>
                      <p className="text-3xl font-black text-green-600">{formatCurrency(currentCustomer.totalSpent || 0)}</p>
                  </div>
                  <div className="bg-slate-900 p-6 rounded-xl border shadow-sm">
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Ticket Médio</p>
                      <p className="text-3xl font-black text-blue-600">{formatCurrency(avgTicket)}</p>
                  </div>
                  <div className="bg-slate-900 p-6 rounded-xl border shadow-sm">
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Última Compra</p>
                      <p className="text-lg font-bold text-slate-100 break-words pt-1 leading-tight">
                          {currentCustomer.lastOrderAt ? format(getDateFromTimestamp(currentCustomer.lastOrderAt), "dd/MM/yyyy HH:mm", {locale: ptBR}) : 'Nenhuma'}
                      </p>
                  </div>
              </div>

              {/* Tabela de Pedidos */}
              <div className="bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
                <div className="bg-slate-800 px-6 py-4 border-b font-bold text-slate-100 flex justify-between items-center">
                    Detalhes dos Pedidos
                </div>
                <div className="p-0 overflow-x-auto">
                    {loadingOrders ? (
                        <div className="p-12 text-center text-slate-400">Buscando pedidos...</div>
                    ) : customerOrders.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">Este cliente ainda não realizou compras.</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-800 border-b">
                                <tr className="text-xs uppercase tracking-wider text-slate-400">
                                    <th className="px-6 py-4">Data / ID</th>
                                    <th className="px-6 py-4">Itens</th>
                                    <th className="px-6 py-4">Endereço de Entrega</th>
                                    <th className="px-6 py-4">Valor</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {customerOrders.map(o => (
                                    <tr key={o.id} className="hover:bg-slate-800">
                                        <td className="px-6 py-4">
                                            <p className="font-bold">{format(getDateFromTimestamp(o.createdAt), "dd/MM/yy 'às' HH:mm")}</p>
                                            <p className="font-mono text-xs text-slate-400">#{o.id.slice(-6).toUpperCase()}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <ul className="text-xs text-slate-300 list-disc list-inside">
                                                {o.items?.map((item:any, i:number) => (
                                                    <li key={i}><span className="font-bold text-slate-100">{item.quantity}x</span> {item.name}</li>
                                                ))}
                                            </ul>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-300 max-w-xs break-words whitespace-normal">
                                            <MapPin size={12} className="inline mr-1 text-slate-400 -mt-0.5"/>
                                            {o.customerAddress}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-white">{formatCurrency(o.total)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${o.status === 'entregue' ? 'bg-green-100 text-green-700' : o.status === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {o.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
              </div>
           </div>
       );
  }

  // --- List View ---
  return (
    <div className="flex flex-col gap-6 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-white">Carteira de Clientes</h1>
           <p className="text-slate-400">Gerencie todos os clientes cadastrados pela loja online.</p>
        </div>
        <Button onClick={handleAddClick} className="bg-red-600 hover:bg-red-700 font-bold shrink-0">
          <Plus size={18} className="mr-2"/> Novo Cliente
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-900 p-4 rounded-xl border shadow-sm">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
               type="text" 
               placeholder="Buscar por nome, whatsapp, cidade ou bairro..." 
               className="w-full pl-10 pr-4 py-2 bg-slate-800 outline-none rounded-lg border border-slate-700 focus:border-slate-400 transition-all font-medium text-sm"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         <select 
            className="border py-2 px-3 rounded-lg bg-slate-900 text-sm outline-none w-full sm:w-auto font-medium"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
         >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Somente Ativos</option>
            <option value="inativo">Inativos</option>
         </select>
      </div>
      
      <div className="bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-slate-800 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-4 font-bold">Cliente</th>
                <th className="px-6 py-4 font-bold">Localidade (Entrega base)</th>
                <th className="px-6 py-4 font-bold text-center">Status</th>
                <th className="px-6 py-4 font-bold text-center">Compras</th>
                <th className="px-6 py-4 font-bold text-right">LTV / Gasto</th>
                <th className="px-6 py-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Carregando carteira de clientes...</td></tr>
              ) : filteredList.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-medium">Nenhum cliente atendeu aos filtros da busca.</td></tr>
              ) : filteredList.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800 transition-colors">
                  <td className="px-6 py-4">
                      <p className="font-bold text-white whitespace-normal break-words max-w-[200px]">{c.nome}</p>
                      <p className="text-xs text-slate-400">{c.whatsapp} {c.email && `• ${c.email}`}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-300">
                      <p className="font-medium text-slate-100">{c.endereco?.cidade}-{c.endereco?.estado}</p>
                      <p className="text-slate-400 text-[11px] whitespace-normal break-words max-w-[250px]">
                          {c.endereco?.bairro}, {c.endereco?.rua}, {c.endereco?.numero}
                      </p>
                  </td>
                  <td className="px-6 py-4 text-center">
                       <span className={`px-2 flex items-center justify-center mx-auto py-1 rounded text-[10px] font-bold uppercase tracking-wider w-fit ${c.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-950 text-slate-400'}`}>
                           {c.status}
                       </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                       <div className="inline-flex flex-col">
                          <span className="font-black text-slate-100 text-base">{c.totalOrders || 0}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pedidos</span>
                       </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                       <p className="font-black text-green-600 text-base tracking-tight">{formatCurrency(c.totalSpent || 0)}</p>
                       <p className="text-[10px] uppercase font-bold text-slate-400">Total Vitalício</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                          <button 
                             onClick={() => handleViewHistory(c)}
                             className="px-3 py-1.5 flex items-center gap-1.5 bg-slate-950 hover:bg-slate-200 text-slate-200 hover:text-white font-bold text-xs rounded transition-colors"
                          >
                             <Eye size={14} /> Histórico
                          </button>
                          
                          <button 
                             onClick={() => handleEditClick(c)}
                             className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-950 rounded transition-colors ml-2" 
                             title="Editar Cliente"
                          >
                             <Edit2 size={16} />
                          </button>
                          
                          <button 
                             onClick={() => handleDeleteOrDeactivate(c)}
                             className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                             title={(c.totalOrders || 0) > 0 ? "Inativar Cliente" : "Excluir Definitivamente"}
                          >
                             <Trash2 size={16} />
                          </button>
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
