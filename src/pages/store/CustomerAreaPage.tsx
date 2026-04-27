import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserCircle, Save, Search, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useFeedback } from '../../contexts/FeedbackContext';
import { customerService } from '../../services/customerService';
import { deliveryAreaService, State, City, DeliveryArea } from '../../services/deliveryAreaService';

export function CustomerAreaPage() {
  const { user } = useAuthStore();
  const { currentCustomer, setCustomer, clearCustomer } = useCustomerAuthStore();
  const { toast } = useFeedback();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    nome: '',
    email: '',
    dataNascimento: '',
    enderecoObj: {
      rua: '', numero: '', bairro: '', cidade: '', estado: '', complemento: '', referencia: ''
    }
  });

  const [searchedWhatsapp, setSearchedWhatsapp] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  // We consider "customer found" either by auth user acting as customer or our customer auth store presence
  const customerFound = !!currentCustomer;
  const foundCustomerId = currentCustomer?.id || null;

  // Delivery Areas Data for suggestions
  const [allStates, setAllStates] = useState<State[]>([]);
  const [allCities, setAllCities] = useState<City[]>([]);
  const [allBairros, setAllBairros] = useState<DeliveryArea[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Load active delivery areas
    const loadDeliveryAreas = async () => {
      try {
        const states = await deliveryAreaService.listStates();
        const cities = await deliveryAreaService.listCities();
        const bairros = await deliveryAreaService.listDeliveryAreas();
        setAllStates(states.filter(s => s.status === 'ativo'));
        setAllCities(cities.filter(c => c.status === 'ativo'));
        setAllBairros(bairros.filter(b => b.status === 'ativo'));
      } catch (e) {
        console.error("Erro ao carregar áreas de entrega", e);
      }
    };
    loadDeliveryAreas();
  }, []);

  const availableCities = useMemo(() => {
    if (!data.enderecoObj.estado) return allCities;
    const currentState = allStates.find(s => s.sigla.toLowerCase() === data.enderecoObj.estado.toLowerCase());
    if (currentState) {
      return allCities.filter(c => c.stateId === currentState.id);
    }
    return allCities;
  }, [allCities, allStates, data.enderecoObj.estado]);

  const availableBairros = useMemo(() => {
    let filtered = allBairros;
    if (data.enderecoObj.estado) {
      const currentState = allStates.find(s => s.sigla.toLowerCase() === data.enderecoObj.estado.toLowerCase());
      if (currentState) {
        filtered = filtered.filter(b => b.stateId === currentState.id);
      }
    }
    if (data.enderecoObj.cidade) {
       const selectedCityName = data.enderecoObj.cidade.toLowerCase();
       filtered = filtered.filter(b => b.cityName.toLowerCase() === selectedCityName);
    }
    return filtered;
  }, [allBairros, allStates, data.enderecoObj.estado, data.enderecoObj.cidade]);


  // Load user data prioritizing currentCustomer store, then Firebase auth
  useEffect(() => {
    if (currentCustomer && !user) {
      setSearchedWhatsapp(currentCustomer.whatsapp);
      setData({
        nome: currentCustomer.nome || '',
        email: currentCustomer.email || '',
        dataNascimento: currentCustomer.dataNascimento || '',
        enderecoObj: currentCustomer.enderecoObj ? { ...currentCustomer.enderecoObj } : {
           rua: '', numero: '', bairro: '', cidade: '', estado: '', complemento: '', referencia: ''
        }
      });
    } else if (user) {
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          const d = snap.data();
          setData({
            nome: d.nome || user.displayName || '',
            email: d.email || user.email || '',
            dataNascimento: d.dataNascimento || '',
            enderecoObj: typeof d.endereco === 'object' && d.endereco !== null ? {
              rua: d.endereco.rua || '',
              numero: d.endereco.numero || '',
              bairro: d.endereco.bairro || '',
              cidade: d.endereco.cidade || '',
              estado: d.endereco.estado || '',
              complemento: d.endereco.complemento || '',
              referencia: d.endereco.referencia || ''
            } : {
              rua: typeof d.endereco === 'string' ? d.endereco : '',
              numero: '',
              bairro: '',
              cidade: '',
              estado: '',
              complemento: '',
              referencia: ''
            }
          });
        } else {
          setData(prev => ({
            ...prev,
            nome: user.displayName || '',
            email: user.email || ''
          }));
        }
      });
    }
  }, [user, currentCustomer]);

  const handleSearchCustomer = async () => {
    const cleanPhone = searchedWhatsapp.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      toast('Digite um número de telefone válido.', 'warning');
      return;
    }
    setLoadingSearch(true);
    try {
      let customer = await customerService.getCustomerByWhatsapp(searchedWhatsapp);
      
      if (!customer) {
        // If not found, create a placeholder record immediately to let them sign in/register seamlessly
        const newCustomerId = await customerService.saveCustomer({
           nome: 'Novo Cliente',
           whatsapp: searchedWhatsapp,
           status: 'ativo',
           endereco: {
             estado: '', cidade: '', bairro: '', rua: '', numero: '', referencia: '', complemento: ''
           }
        });
        customer = await customerService.getCustomerById(newCustomerId);
        toast('Cadastro iniciado. Preencha seus dados abaixo.', 'info');
      } else {
        toast('Carregamos o seu cadastro.', 'success');
      }

      if (customer) {
        const currentEnd = {
          rua: customer.endereco?.rua || '',
          numero: customer.endereco?.numero || '',
          bairro: customer.endereco?.bairro || '',
          cidade: customer.endereco?.cidade || '',
          estado: customer.endereco?.estado || '',
          complemento: customer.endereco?.complemento || '',
          referencia: customer.endereco?.referencia || ''
        };
        
        setCustomer({
           id: customer.id!,
           nome: customer.nome,
           email: customer.email,
           whatsapp: customer.whatsapp,
           dataNascimento: customer.dataNascimento,
           enderecoObj: currentEnd
        });
      }
    } catch (err) {
      toast('Erro ao buscar dados.', 'error');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          nome: data.nome,
          email: data.email,
          dataNascimento: data.dataNascimento,
          endereco: data.enderecoObj
        });
      } else if (foundCustomerId) {
        await updateDoc(doc(db, 'customers', foundCustomerId), {
          nome: data.nome,
          email: data.email,
          dataNascimento: data.dataNascimento,
          endereco: data.enderecoObj
        });
        // Update local auth store so context stays updated
        setCustomer({
          ...currentCustomer!,
          nome: data.nome,
          email: data.email,
          dataNascimento: data.dataNascimento,
          enderecoObj: data.enderecoObj
        });
      }
      toast('Seus dados foram atualizados.', 'success');
    } catch (err) {
      toast('Falha ao atualizar dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
      clearCustomer();
      setSearchedWhatsapp('');
      setData({
        nome: '',
        email: '',
        dataNascimento: '',
        enderecoObj: { rua: '', numero: '', bairro: '', cidade: '', estado: '', complemento: '', referencia: '' }
      });
      toast('Você saiu com sucesso.', 'info');
  };

  const handleRequestDeletion = () => {
    if (!data.nome || (!data.email && !searchedWhatsapp)) {
      toast('Preencha seus dados para identificação.', 'error');
      return;
    }
    const endStr = [data.enderecoObj.rua, data.enderecoObj.numero, data.enderecoObj.bairro, data.enderecoObj.cidade, data.enderecoObj.estado].filter(Boolean).join(', ');
    const text = `Olá, solicito a exclusão do meu cadastro e de todos os meus dados do sistema da Discreta Boutique.%0A%0A*Meus Dados para Identificação:*%0A- Nome: ${data.nome}%0A- E-mail: ${data.email}%0A- Data de Nascimento: ${data.dataNascimento}%0A- WhatsApp: ${searchedWhatsapp}%0A- Endereço: ${endStr}`;
    window.open(`https://wa.me/5588992340317?text=${text}`, '_blank');
  };

  const updateEndereco = (field: string, value: string) => {
    setData(prev => ({
      ...prev,
      enderecoObj: {
        ...prev.enderecoObj,
        [field]: value
      }
    }));
  };

  return (
    <div className="flex-1 bg-black text-white py-16 px-4">
      <div className="max-w-3xl mx-auto bg-zinc-950 p-8 md:p-12 rounded-[2rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="flex flex-col items-center justify-center text-center gap-4 mb-10 relative z-10">
          <div className="w-16 h-16 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center">
            <UserCircle size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Área do Cliente</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2 block">
              {user || customerFound ? 'Gerencie seus dados e privacidade' : 'Acesse seus dados cadastrais'}
            </p>
          </div>
        </div>

        {!user && !customerFound ? (
          <div className="max-w-sm mx-auto space-y-6 relative z-10 pb-4">
            <p className="text-sm text-zinc-400 text-center">
              Você não está logado. Para visualizar ou alterar seu cadastro, informe seu número de WhatsApp abaixo.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Seu WhatsApp</label>
              <Input 
                value={searchedWhatsapp} 
                onChange={e => setSearchedWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
                className="bg-black border-zinc-800 text-white h-12 text-center text-lg"
              />
            </div>
            <Button 
              onClick={handleSearchCustomer}
              disabled={loadingSearch}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs h-12 rounded-full shadow-lg shadow-red-900/20"
            >
              {loadingSearch ? 'Buscando...' : <><Search size={16} className="mr-2" /> Buscar Meu Cadastro</>}
            </Button>
          </div>
        ) : (
          <div className="space-y-8 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Nome Completo *</label>
                <Input 
                  value={data.nome} 
                  onChange={e => setData({...data, nome: e.target.value})}
                  className="bg-black border-zinc-800 text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">E-mail *</label>
                <Input 
                  value={data.email} 
                  onChange={e => setData({...data, email: e.target.value})}
                  className="bg-black border-zinc-800 text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Data de Nascimento</label>
                <Input 
                  type="date"
                  value={data.dataNascimento} 
                  onChange={e => setData({...data, dataNascimento: e.target.value})}
                  className="bg-black border-zinc-800 text-white css-invert-calendar"
                />
              </div>
            </div>

            <div className="border-t border-zinc-900 pt-8 mt-8">
              <h3 className="text-xl font-bold uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                Endereço de Entrega
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Estado</label>
                  <Input 
                    list="estados-sugestoes"
                    value={data.enderecoObj.estado} 
                    onChange={e => updateEndereco('estado', e.target.value)}
                    className="bg-black border-zinc-800 text-white"
                    placeholder="UF (Ex: CE)"
                  />
                  <datalist id="estados-sugestoes">
                    {allStates.map(state => (
                      <option key={state.id} value={state.sigla}>{state.nome}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Cidade</label>
                  <Input 
                    list="cidades-sugestoes"
                    value={data.enderecoObj.cidade} 
                    onChange={e => updateEndereco('cidade', e.target.value)}
                    className="bg-black border-zinc-800 text-white"
                  />
                  <datalist id="cidades-sugestoes">
                    {availableCities.map(city => (
                      <option key={city.id} value={city.nome} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Bairro</label>
                  <Input 
                    list="bairros-sugestoes"
                    value={data.enderecoObj.bairro} 
                    onChange={e => updateEndereco('bairro', e.target.value)}
                    className="bg-black border-zinc-800 text-white"
                  />
                  <datalist id="bairros-sugestoes">
                    {availableBairros.map(bairro => (
                      <option key={bairro.id} value={bairro.bairro} />
                    ))}
                  </datalist>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Rua / Avenida</label>
                  <Input 
                    value={data.enderecoObj.rua} 
                    onChange={e => updateEndereco('rua', e.target.value)}
                    className="bg-black border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Número</label>
                  <Input 
                    value={data.enderecoObj.numero} 
                    onChange={e => updateEndereco('numero', e.target.value)}
                    className="bg-black border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Complemento</label>
                  <Input 
                    value={data.enderecoObj.complemento} 
                    onChange={e => updateEndereco('complemento', e.target.value)}
                    className="bg-black border-zinc-800 text-white"
                    placeholder="Apto, Bloco, etc (Opcional)"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Ponto de Referência</label>
                  <Input 
                    value={data.enderecoObj.referencia} 
                    onChange={e => updateEndereco('referencia', e.target.value)}
                    className="bg-black border-zinc-800 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-zinc-800 flex flex-col items-center gap-6">
              <div className="flex gap-4 w-full sm:w-auto">
                <Button 
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs h-12 px-8 rounded-full shadow-lg shadow-red-900/20"
                >
                  {loading ? 'Salvando...' : (
                    <><Save size={16} className="mr-2" /> Salvar</>
                  )}
                </Button>
                
                {customerFound && !user && (
                    <Button 
                      onClick={handleLogout}
                      variant="outline"
                      className="flex-1 sm:flex-none border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white font-bold uppercase tracking-widest text-xs h-12 px-8 rounded-full"
                    >
                      <LogOut size={16} className="mr-2" /> Sair
                    </Button>
                )}
              </div>

              <button 
                onClick={handleRequestDeletion}
                className="text-zinc-600 hover:text-zinc-400 text-[10px] uppercase tracking-widest transition-colors flex items-center bg-transparent border-none cursor-pointer p-2"
              >
                Solicitar exclusão dos dados
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
