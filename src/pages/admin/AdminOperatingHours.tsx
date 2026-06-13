import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';
import { settingsService, OperatingHoursSettings, ClosedDate } from '../../services/settingsService';
import { Plus, Trash2, Save, Clock, Calendar, X } from 'lucide-react';

const DAYS_NAMES = {
  domingo: 'Domingo',
  segunda: 'Segunda-feira',
  terça: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sábado: 'Sábado'
};

export function AdminOperatingHours() {
  const { hasPermission } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useFeedback();

  const [settings, setSettings] = useState<OperatingHoursSettings>({
    weekly: [],
    closedDates: []
  });

  const canEdit = hasPermission('settings', 'editar');

  useEffect(() => {
    async function load() {
      try {
        const data = await settingsService.getOperatingHours();
        setSettings(data);
      } catch (e) {
        console.error(e);
        toast("Erro ao carregar horários", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.saveOperatingHours(settings);
      toast("Configurações salvas!");
    } catch (e) {
        console.error(e);
      toast("Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (index: number) => {
    if (!canEdit) return;
    const newWeekly = [...settings.weekly];
    newWeekly[index].isOpen = !newWeekly[index].isOpen;
    setSettings({ ...settings, weekly: newWeekly });
  };

  const addSlot = (dayIndex: number) => {
    if (!canEdit) return;
    const newWeekly = [...settings.weekly];
    newWeekly[dayIndex].slots.push({ from: '09:00', to: '18:00' });
    setSettings({ ...settings, weekly: newWeekly });
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    if (!canEdit) return;
    const newWeekly = [...settings.weekly];
    newWeekly[dayIndex].slots.splice(slotIndex, 1);
    setSettings({ ...settings, weekly: newWeekly });
  };

  const updateSlot = (dayIndex: number, slotIndex: number, field: 'from' | 'to', value: string) => {
    if (!canEdit) return;
    const newWeekly = [...settings.weekly];
    newWeekly[dayIndex].slots[slotIndex][field] = value;
    setSettings({ ...settings, weekly: newWeekly });
  };

  const addClosedDate = () => {
    if (!canEdit) return;
    setSettings({
      ...settings,
      closedDates: [...settings.closedDates, { date: '', reason: '' }]
    });
  };

  const removeClosedDate = (index: number) => {
    if (!canEdit) return;
    const newClosed = [...settings.closedDates];
    newClosed.splice(index, 1);
    setSettings({ ...settings, closedDates: newClosed });
  };

  const updateClosedDate = (index: number, field: keyof ClosedDate, value: string) => {
    if (!canEdit) return;
    const newClosed = [...settings.closedDates];
    newClosed[index][field] = value;
    setSettings({ ...settings, closedDates: newClosed });
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-center sm:text-left">Horários de Funcionamento</h1>
          <p className="text-slate-400 mt-1 text-center sm:text-left">Defina quando sua loja está aberta para receber pedidos.</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving || !canEdit}
          className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 shadow-lg px-8 h-12 rounded-xl"
        >
          {saving ? 'Salvando...' : <><Save size={18} className="mr-2" /> Salvar Alterações</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Weekly Hours */}
        <section className="bg-slate-900 rounded-2xl shadow-sm border p-8">
          <div className="flex items-center gap-2 mb-6 text-slate-100">
            <Clock size={20} className="text-red-600" />
            <h2 className="text-xl font-bold uppercase tracking-wider text-sm">Horários por Dia da Semana</h2>
          </div>

          <div className="space-y-4">
            {settings.weekly.map((dayConfig, dayIdx) => (
              <div key={dayConfig.day} className={`p-4 rounded-xl border transition-all ${dayConfig.isOpen ? 'bg-slate-900 border-slate-700' : 'bg-slate-800 border-slate-100 opacity-60'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[150px]">
                    <button
                      onClick={() => toggleDay(dayIdx)}
                      className={`w-12 h-6 rounded-full relative transition-colors ${dayConfig.isOpen ? 'bg-red-600' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-slate-900 transition-all ${dayConfig.isOpen ? 'left-7' : 'left-1'}`} />
                    </button>
                    <span className="font-bold text-slate-100">{(DAYS_NAMES as any)[dayConfig.day]}</span>
                  </div>

                  <div className="flex-1 flex flex-wrap gap-2">
                    {dayConfig.isOpen ? (
                      dayConfig.slots.map((slot, slotIdx) => (
                        <div key={slotIdx} className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-100 animate-in zoom-in-95">
                          <Input 
                            type="time" 
                            value={slot.from} 
                            onChange={e => updateSlot(dayIdx, slotIdx, 'from', e.target.value)}
                            className="w-24 h-8 text-xs font-bold border-none bg-transparent"
                            disabled={!canEdit}
                          />
                          <span className="text-slate-400 text-xs">até</span>
                          <Input 
                            type="time" 
                            value={slot.to} 
                            onChange={e => updateSlot(dayIdx, slotIdx, 'to', e.target.value)}
                            className="w-24 h-8 text-xs font-bold border-none bg-transparent"
                            disabled={!canEdit}
                          />
                          {dayConfig.slots.length > 1 && canEdit && (
                            <button onClick={() => removeSlot(dayIdx, slotIdx)} className="text-slate-400 hover:text-red-500 p-1">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs font-bold text-slate-400 italic">Fechado</span>
                    )}
                    {dayConfig.isOpen && canEdit && (
                        <button 
                            onClick={() => addSlot(dayIdx)} 
                            className="flex items-center gap-1 text-[10px] font-black uppercase text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                        >
                            <Plus size={12} /> Adicionar Intervalo
                        </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Closed Dates */}
        <section className="bg-slate-900 rounded-2xl shadow-sm border p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-slate-100">
              <Calendar size={20} className="text-red-600" />
              <h2 className="text-xl font-bold uppercase tracking-wider text-sm">Datas Especiais / Feriados (Não funcionamos)</h2>
            </div>
            {canEdit && (
                <Button onClick={addClosedDate} variant="outline" size="sm" className="h-8 text-xs">
                    <Plus size={14} className="mr-1" /> Nova Data
                </Button>
            )}
          </div>

          <div className="space-y-3">
            {settings.closedDates.length > 0 ? (
                settings.closedDates.map((item, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-slate-800 p-4 rounded-xl border border-slate-100 animate-in slide-in-from-top-2">
                        <div className="w-full md:w-48">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Data</label>
                            <Input 
                                type="date" 
                                value={item.date} 
                                onChange={e => updateClosedDate(idx, 'date', e.target.value)}
                                className="h-10 text-sm font-bold"
                                disabled={!canEdit}
                            />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Motivo (Feriado, Recesso, etc)</label>
                            <Input 
                                value={item.reason} 
                                onChange={e => updateClosedDate(idx, 'reason', e.target.value)}
                                className="h-10 text-sm font-bold"
                                placeholder="Ex: Natal"
                                disabled={!canEdit}
                            />
                        </div>
                        {canEdit && (
                            <button onClick={() => removeClosedDate(idx)} className="mt-5 p-2 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                ))
            ) : (
                <div className="p-8 text-center border-2 border-dashed rounded-2xl bg-slate-800 border-slate-700">
                    <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-400 text-sm italic">Nenhuma data especial cadastrada.</p>
                </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
