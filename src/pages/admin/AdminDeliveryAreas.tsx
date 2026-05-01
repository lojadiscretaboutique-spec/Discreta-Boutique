import { useEffect, useState } from 'react';
import { State, City, DeliveryArea, deliveryAreaService } from '../../services/deliveryAreaService';
import { useFeedback } from '../../contexts/FeedbackContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Edit2, Trash2, Plus, ChevronRight, ArrowLeft, X, Download, Upload } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';

import { useAuthStore } from '../../store/authStore';

type ViewMode = 'states' | 'cities' | 'areas';

export function AdminDeliveryAreas() {
    const { toast, confirm } = useFeedback();
    const { hasPermission } = useAuthStore();
    
    const canCreate = hasPermission('areasEntrega', 'criar');
    const canEdit = hasPermission('areasEntrega', 'editar');
    const canDelete = hasPermission('areasEntrega', 'excluir');
    
    const [viewMode, setViewMode] = useState<ViewMode>('states');
    const [selectedState, setSelectedState] = useState<State | null>(null);
    const [selectedCity, setSelectedCity] = useState<City | null>(null);

    // Data lists
    const [states, setStates] = useState<State[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [areas, setAreas] = useState<DeliveryArea[]>([]);
    const [loading, setLoading] = useState(true);

    // Form modals state
    const [formModalOpen, setFormModalOpen] = useState(false);
    const [editItemId, setEditItemId] = useState<string | null>(null);

    const [stateForm, setStateForm] = useState<Partial<State>>({});
    const [cityForm, setCityForm] = useState<Partial<City>>({});
    const [areaForm, setAreaForm] = useState<Partial<DeliveryArea>>({});

    const loadData = async () => {
        setLoading(true);
        try {
            if (viewMode === 'states') {
                const s = await deliveryAreaService.listStates();
                setStates(s);
            } else if (viewMode === 'cities' && selectedState) {
                const c = await deliveryAreaService.listCities(selectedState.id);
                setCities(c);
            } else if (viewMode === 'areas' && selectedCity) {
                const a = await deliveryAreaService.listDeliveryAreas(selectedCity.id);
                setAreas(a);
            }
        } catch (error) {
            toast('Erro ao carregar dados', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [viewMode, selectedState, selectedCity]);

    // Handle Breadcrumbs
    const goBackToStates = () => {
        setSelectedState(null);
        setSelectedCity(null);
        setViewMode('states');
    };

    const goBackToCities = () => {
        setSelectedCity(null);
        setViewMode('cities');
    };

    // Delete Handlers
    const handleDeleteState = async (s: State) => {
        const ok = await confirm({ title: 'Excluir Estado', message: `Deseja excluir o estado ${s.nome}?` });
        if (ok) {
            try {
                await deliveryAreaService.deleteState(s.id!);
                toast('Estado excluído.', 'success');
                loadData();
            } catch (error: any) {
                toast(error.message || 'Erro ao excluir.', 'error');
            }
        }
    };

    const handleDeleteCity = async (c: City) => {
        const ok = await confirm({ title: 'Excluir Cidade', message: `Deseja excluir a cidade ${c.nome}?` });
        if (ok) {
            try {
                await deliveryAreaService.deleteCity(c.id!);
                toast('Cidade excluída.', 'success');
                loadData();
            } catch (error: any) {
                toast(error.message || 'Erro ao excluir.', 'error');
            }
        }
    };

    const handleDeleteArea = async (a: DeliveryArea) => {
        const ok = await confirm({ title: 'Excluir Bairro', message: `Deseja excluir o bairro/área ${a.bairro}?` });
        if (ok) {
            try {
                await deliveryAreaService.deleteDeliveryArea(a.id!);
                toast('Bairro excluído.', 'success');
                loadData();
            } catch (error: any) {
                toast(error.message || 'Erro ao excluir.', 'error');
            }
        }
    };

    // Edit Handlers
    const openStateForm = (s?: State) => {
        setEditItemId(s?.id || null);
        setStateForm(s ? { ...s } : { nome: '', sigla: '', status: 'ativo', ordem: 0, observacoes: '' });
        setFormModalOpen(true);
    };

    const openCityForm = (c?: City) => {
        setEditItemId(c?.id || null);
        setCityForm(c ? { ...c } : { nome: '', status: 'ativo', ordem: 0, observacoes: '' });
        setFormModalOpen(true);
    };

    const openAreaForm = (a?: DeliveryArea) => {
        setEditItemId(a?.id || null);
        setAreaForm(a ? { ...a } : { 
            bairro: '', taxaEntrega: 0, pedidoMinimo: 0, tempoEntrega: 0, 
            cepInicial: '', cepFinal: '', freteGratisAcima: 0, 
            status: 'ativo', ordem: 0, observacoes: '' 
        });
        setFormModalOpen(true);
    };

    // Submit Handlers
    const onSubmitState = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await deliveryAreaService.saveState({ id: editItemId || undefined, ...stateForm } as State);
            toast('Estado salvo com sucesso.', 'success');
            setFormModalOpen(false);
            loadData();
        } catch (error: any) {
            toast(error.message || 'Erro ao salvar estado', 'error');
        }
    };

    const onSubmitCity = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await deliveryAreaService.saveCity({ 
                id: editItemId || undefined, 
                ...cityForm,
                stateId: selectedState!.id,
                stateName: selectedState!.nome
            } as City);
            toast('Cidade salva com sucesso.', 'success');
            setFormModalOpen(false);
            loadData();
        } catch (error: any) {
            toast(error.message || 'Erro ao salvar cidade', 'error');
        }
    };

    const onSubmitArea = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await deliveryAreaService.saveDeliveryArea({ 
                id: editItemId || undefined, 
                ...areaForm,
                stateId: selectedState!.id,
                stateName: selectedState!.nome,
                cityId: selectedCity!.id,
                cityName: selectedCity!.nome
            } as DeliveryArea);
            toast('Bairro salvo com sucesso.', 'success');
            setFormModalOpen(false);
            loadData();
        } catch (error: any) {
            toast(error.message || 'Erro ao salvar bairro', 'error');
        }
    };

    const handleExportCSV = async () => {
        try {
            setLoading(true);
            const allAreas = await deliveryAreaService.listDeliveryAreas();
            if (allAreas.length === 0) {
                toast('Não há áreas para exportar', 'info');
                return;
            }

            const headers = ['id', 'estado', 'cidade', 'bairro', 'taxa_entrega', 'pedido_minimo', 'tempo_entrega', 'frete_gratis_acima', 'status'];
            const rows = allAreas.map(a => [
                a.id || '',
                a.stateName || '',
                a.cityName || '',
                a.bairro || '',
                a.taxaEntrega || 0,
                a.pedidoMinimo || 0,
                a.tempoEntrega || 0,
                a.freteGratisAcima || 0,
                a.status || 'ativo'
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `areas_entrega_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            toast('Exportação concluída', 'success');
        } catch (error) {
            toast('Erro ao exportar CSV', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length <= 1) {
                    toast('Arquivo CSV vazio ou inválido', 'error');
                    return;
                }

                // Detect separator
                const separator = lines[0].includes(';') ? ';' : ',';

                const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, '').toLowerCase());
                const dataRows = lines.slice(1);

                setLoading(true);
                let count = 0;
                let errors = 0;

                const allStates = await deliveryAreaService.listStates();
                const allExistingAreas = await deliveryAreaService.listDeliveryAreas();

                for (const row of dataRows) {
                    // Enhanced CSV parsing for quoted values considering the separator
                    const regex = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`);
                    const values = row.split(regex).map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        obj[h] = values[i];
                    });

                    try {
                        const stateName = obj.estado;
                        const cityName = obj.cidade;
                        const bairroName = obj.bairro;

                        if (!stateName || !cityName || !bairroName) continue;
                        
                        const normalizeString = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : '';
                        
                        let state = allStates.find(s => normalizeString(s.nome) === normalizeString(stateName));
                        if (!state) {
                            try {
                                const newStateId = await deliveryAreaService.saveState({
                                    nome: stateName.trim(),
                                    uf: stateName.trim().substring(0, 2).toUpperCase(),
                                    status: 'ativo'
                                });
                                state = { id: newStateId, nome: stateName.trim(), uf: stateName.trim().substring(0, 2).toUpperCase(), status: 'ativo' };
                                allStates.push(state);
                            } catch (e) {
                                console.error(`Falha ao criar estado ${stateName}`, e);
                                errors++;
                                continue;
                            }
                        }
                        
                        const citiesInState = await deliveryAreaService.listCities(state.id!);
                        let city = citiesInState.find(c => normalizeString(c.nome) === normalizeString(cityName));
                        
                        if (!city) {
                            const newCityId = await deliveryAreaService.saveCity({
                                nome: cityName.trim(),
                                stateId: state.id!,
                                stateName: state.nome,
                                status: 'ativo'
                            });
                            city = { id: newCityId, nome: cityName.trim(), stateId: state.id!, stateName: state.nome, status: 'ativo' };
                        }

                        // Try to find if area already exists even without ID in CSV
                        let existingId = obj.id;
                        if (!existingId || existingId === 'undefined' || existingId === 'null') {
                            const match = allExistingAreas.find(a => 
                                a.cityId === city!.id && 
                                normalizeString(a.bairro) === normalizeString(bairroName)
                            );
                            if (match) existingId = match.id;
                            else existingId = undefined;
                        }

                        const parseNumber = (val: any) => {
                            if (!val) return 0;
                            const clean = String(val).replace(/[^\d.,-]/g, '').replace(',', '.');
                            return Number(clean) || 0;
                        };

                        const areaPayload: Partial<DeliveryArea> = {
                            id: existingId,
                            stateId: state.id,
                            stateName: state.nome,
                            cityId: city.id,
                            cityName: city.nome,
                            bairro: bairroName,
                            taxaEntrega: parseNumber(obj.taxa_entrega),
                            pedidoMinimo: parseNumber(obj.pedido_minimo),
                            tempoEntrega: parseNumber(obj.tempo_entrega),
                            freteGratisAcima: parseNumber(obj.frete_gratis_acima),
                            status: (obj.status?.toLowerCase() === 'inativo' ? 'inativo' : 'ativo') as any
                        };

                        await deliveryAreaService.saveDeliveryArea(areaPayload);
                        count++;
                    } catch (err) {
                        console.error('Import error for row:', row, err);
                        errors++;
                    }
                }

                toast(`Importação concluída: ${count} sucessos, ${errors} erros`, errors > 0 ? 'info' : 'success');
                loadData();
            } catch (error) {
                toast('Erro ao processar CSV', 'error');
            } finally {
                setLoading(false);
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="flex flex-col gap-6 pb-20">
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Áreas de Entrega</h1>
                    <div className="flex items-center text-sm font-medium text-slate-400 bg-slate-900 border px-4 py-2 rounded-lg w-max shadow-sm">
                        <button onClick={goBackToStates} className={`hover:text-red-600 transition-colors ${viewMode === 'states' ? 'text-red-600 font-bold' : ''}`}>Estados</button>
                        {selectedState && (
                            <>
                                <ChevronRight size={16} className="mx-2" />
                                <button onClick={goBackToCities} className={`hover:text-red-600 transition-colors ${viewMode === 'cities' ? 'text-red-600 font-bold' : ''}`}>{selectedState.sigla} - {selectedState.nome}</button>
                            </>
                        )}
                        {selectedCity && (
                            <>
                                <ChevronRight size={16} className="mx-2" />
                                <span className="text-slate-100 font-bold">{selectedCity.nome}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading} className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800">
                        <Download size={14} className="mr-2" /> Exportar CSV
                    </Button>
                    <label className={cn(
                        "cursor-pointer flex items-center bg-slate-900 text-slate-300 px-3 py-1.5 rounded-md text-sm font-bold border border-slate-700 hover:bg-slate-800 transition-colors",
                        loading && "opacity-50 pointer-events-none"
                    )}>
                        <Upload size={14} className="mr-2" /> Importar CSV
                        <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" disabled={loading} />
                    </label>
                </div>
            </div>

            {/* Content Lists */}
            {viewMode === 'states' && (
                <div className="bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b bg-slate-800 text-slate-100">
                        <h2 className="font-bold">Estados Atendidos</h2>
                        {canCreate && (
                            <Button onClick={() => openStateForm()} className="bg-red-600 hover:bg-red-700 h-8 text-xs font-bold">
                                <Plus size={14} className="mr-1" /> Novo Estado
                            </Button>
                        )}
                    </div>
                    <div className="p-0 overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                            <thead className="border-b uppercase text-xs tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Estado</th>
                                    <th className="px-6 py-4 font-bold text-center">Sigla</th>
                                    <th className="px-6 py-4 font-bold text-center">Status</th>
                                    <th className="px-6 py-4 font-bold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && states.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-400">Carregando...</td></tr> : null}
                                {!loading && states.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-medium">Nenhum estado cadastrado. Adicione um para iniciar.</td></tr> : null}
                                {states.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-800 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-100">{s.nome}</td>
                                        <td className="px-6 py-4 text-center font-bold text-slate-300">{s.sigla}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${s.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-950 text-slate-400'}`}>{s.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 items-center">
                                                <button onClick={() => { setSelectedState(s); setViewMode('cities'); }} className="px-3 py-1.5 flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded transition-colors mr-2">
                                                    Ver Cidades <ChevronRight size={14}/>
                                                </button>
                                                {canEdit && (
                                                    <button onClick={() => openStateForm(s)} className="p-2 text-slate-400 hover:text-white rounded"><Edit2 size={16}/></button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDeleteState(s)} className="p-2 text-slate-400 hover:text-red-600 rounded"><Trash2 size={16}/></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {viewMode === 'cities' && selectedState && (
                <div className="bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b bg-slate-800">
                        <div className="flex items-center gap-3">
                            <button onClick={goBackToStates} className="p-1.5 bg-slate-900 border rounded hover:bg-slate-950"><ArrowLeft size={16}/></button>
                            <h2 className="font-bold text-slate-100">Cidades em: {selectedState.nome}</h2>
                        </div>
                        {canCreate && (
                            <Button onClick={() => openCityForm()} className="bg-red-600 hover:bg-red-700 h-8 text-xs font-bold">
                                <Plus size={14} className="mr-1" /> Nova Cidade
                            </Button>
                        )}
                    </div>
                    <div className="p-0 overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                            <thead className="border-b uppercase text-xs tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Cidade</th>
                                    <th className="px-6 py-4 font-bold text-center">Status</th>
                                    <th className="px-6 py-4 font-bold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && cities.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-slate-400">Carregando...</td></tr> : null}
                                {!loading && cities.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-medium">Nenhuma cidade cadastrada neste estado.</td></tr> : null}
                                {cities.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-800 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-100">{c.nome}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${c.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-950 text-slate-400'}`}>{c.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 items-center">
                                                <button onClick={() => { setSelectedCity(c); setViewMode('areas'); }} className="px-3 py-1.5 flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded transition-colors mr-2">
                                                    Configurar Bairros <ChevronRight size={14}/>
                                                </button>
                                                {canEdit && (
                                                    <button onClick={() => openCityForm(c)} className="p-2 text-slate-400 hover:text-white rounded"><Edit2 size={16}/></button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDeleteCity(c)} className="p-2 text-slate-400 hover:text-red-600 rounded"><Trash2 size={16}/></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {viewMode === 'areas' && selectedCity && (
                <div className="bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b bg-slate-800 gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={goBackToCities} className="p-1.5 bg-slate-900 border rounded hover:bg-slate-950"><ArrowLeft size={16}/></button>
                            <h2 className="font-bold text-slate-100 leading-tight">Bairros de {selectedCity.nome}</h2>
                        </div>
                        {canCreate && (
                            <Button onClick={() => openAreaForm()} className="bg-red-600 hover:bg-red-700 h-8 text-xs font-bold shrink-0">
                                <Plus size={14} className="mr-1" /> Novo Bairro
                            </Button>
                        )}
                    </div>
                    <div className="p-0 overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                            <thead className="border-b uppercase text-xs tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Bairro</th>
                                    <th className="px-6 py-4 font-bold">Taxa Entrega</th>
                                    <th className="px-6 py-4 font-bold">Tempo (Min)</th>
                                    <th className="px-6 py-4 font-bold text-center">Status</th>
                                    <th className="px-6 py-4 font-bold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && areas.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">Carregando...</td></tr> : null}
                                {!loading && areas.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-medium">Nenhum bairro configurado para esta cidade.</td></tr> : null}
                                {areas.map(a => (
                                    <tr key={a.id} className="hover:bg-slate-800 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-100">{a.bairro}</td>
                                        <td className="px-6 py-4 text-red-600 font-bold">{a.taxaEntrega > 0 ? formatCurrency(a.taxaEntrega) : 'Grátis'}</td>
                                        <td className="px-6 py-4 font-medium text-slate-200">{a.tempoEntrega} min</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${a.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-950 text-slate-400'}`}>{a.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1 items-center">
                                                {canCreate && (
                                                    <button onClick={() => {
                                                        const clone = {...a}; delete clone.id; clone.bairro = `${clone.bairro} (Cópia)`; openAreaForm(clone);
                                                    }} className="px-2 py-1.5 flex items-center gap-1 text-slate-400 hover:text-slate-100 hover:bg-slate-200 text-xs rounded transition-colors mr-2 font-bold" title="Duplicar regra">
                                                        Duplicar
                                                    </button>
                                                )}
                                                {canEdit && (
                                                    <button onClick={() => openAreaForm(a)} className="p-2 text-slate-400 hover:text-white rounded"><Edit2 size={16}/></button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDeleteArea(a)} className="p-2 text-slate-400 hover:text-red-600 rounded"><Trash2 size={16}/></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals for Editing/Creating */}
            {formModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-xl shadow-xl border w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b bg-slate-800 shrink-0">
                            <h3 className="font-bold text-slate-100">
                                {viewMode === 'states' ? (editItemId ? 'Editar Estado' : 'Novo Estado') :
                                 viewMode === 'cities' ? (editItemId ? 'Editar Cidade' : 'Nova Cidade') :
                                 (editItemId ? 'Editar Bairro / Região' : 'Novo Bairro / Região')}
                            </h3>
                            <button onClick={() => setFormModalOpen(false)} className="p-1 hover:bg-slate-200 rounded"><X size={18} /></button>
                        </div>
                        
                        <div className="p-4 overflow-y-auto flex-1">
                            {viewMode === 'states' && (
                                <form id="modal-form" onSubmit={onSubmitState} className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Nome *</label>
                                            <Input required value={stateForm.nome || ''} onChange={e => setStateForm({...stateForm, nome: e.target.value})} placeholder="Pernambuco" autoFocus/>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Sigla *</label>
                                            <Input required value={stateForm.sigla || ''} onChange={e => setStateForm({...stateForm, sigla: e.target.value.toUpperCase()})} placeholder="PE" maxLength={2} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Ordem (Opcional)</label>
                                            <Input type="number" value={stateForm.ordem || 0} onChange={e => setStateForm({...stateForm, ordem: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Status</label>
                                            <select className="flex h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 font-bold" value={stateForm.status} onChange={e => setStateForm({...stateForm, status: e.target.value as any})}>
                                                <option value="ativo">Ativo</option>
                                                <option value="inativo">Inativo</option>
                                            </select>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {viewMode === 'cities' && (
                                <form id="modal-form" onSubmit={onSubmitCity} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Nome da Cidade *</label>
                                        <Input required value={cityForm.nome || ''} onChange={e => setCityForm({...cityForm, nome: e.target.value})} placeholder="Ex: Recife" autoFocus/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Ordem (Opcional)</label>
                                            <Input type="number" value={cityForm.ordem || 0} onChange={e => setCityForm({...cityForm, ordem: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Status</label>
                                            <select className="flex h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 font-bold" value={cityForm.status} onChange={e => setCityForm({...cityForm, status: e.target.value as any})}>
                                                <option value="ativo">Ativo</option>
                                                <option value="inativo">Inativo</option>
                                            </select>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {viewMode === 'areas' && (
                                <form id="modal-form" onSubmit={onSubmitArea} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Bairro / Nome da Região *</label>
                                        <Input required value={areaForm.bairro || ''} onChange={e => setAreaForm({...areaForm, bairro: e.target.value})} placeholder="Ex: Boa Viagem" autoFocus/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 bg-slate-800 p-4 border rounded-xl">
                                        <div>
                                            <label className="block text-xs font-bold flex text-slate-200 mb-1">
                                                Taxa de Entrega (R$) *
                                            </label>
                                            <Input required min={0} step={0.01} type="number" value={areaForm.taxaEntrega ?? ''} onChange={e => setAreaForm({...areaForm, taxaEntrega: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-200 mb-1">Tempo Médio (Minutos) *</label>
                                            <Input required min={0} type="number" value={areaForm.tempoEntrega ?? ''} onChange={e => setAreaForm({...areaForm, tempoEntrega: Number(e.target.value)})} placeholder="Ex: 45"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Frete Grátis Acima de (R$)</label>
                                        <Input min={0} step={0.01} type="number" value={areaForm.freteGratisAcima || 0} onChange={e => setAreaForm({...areaForm, freteGratisAcima: Number(e.target.value)})} placeholder="0 = desativado" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                       <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Ordem (Opcional)</label>
                                            <Input type="number" value={areaForm.ordem || 0} onChange={e => setAreaForm({...areaForm, ordem: Number(e.target.value)})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Status</label>
                                            <select className="flex h-10 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-600 font-bold" value={areaForm.status} onChange={e => setAreaForm({...areaForm, status: e.target.value as any})}>
                                                <option value="ativo">Ativo</option>
                                                <option value="inativo">Inativo</option>
                                            </select>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="p-4 border-t bg-slate-800 shrink-0 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setFormModalOpen(false)}>Cancelar</Button>
                            <Button form="modal-form" type="submit">Salvar</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
