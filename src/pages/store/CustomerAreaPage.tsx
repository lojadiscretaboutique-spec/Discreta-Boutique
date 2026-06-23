import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, updatePassword } from 'firebase/auth';
import { 
  collection, doc, getDoc, getDocs, updateDoc, setDoc, 
  query, where, serverTimestamp, addDoc 
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Phone, Calendar, CreditCard, MapPin, 
  ArrowLeft, Check, AlertCircle, Eye, EyeOff, ShieldCheck,
  Package, Heart, Star, Headphones, Lock, LogOut, ChevronRight,
  Bell, Award, CheckCircle, Clock, ShoppingBag, Send
} from 'lucide-react';

// Tradução amigável de erros de senha
const getPasswordErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
        case 'auth/weak-password':
            return 'A nova senha escolhida é muito fraca. Insira pelo menos 6 caracteres.';
        case 'auth/requires-recent-login':
            return 'Por segurança, esta operação exige uma autenticação recente. Por favor, saia e faça login novamente para alterar sua senha.';
        default:
            return 'Não foi possível alterar a sua senha. Caso persista, entre em contato com o suporte.';
    }
};

// Funções de formatação de máscaras
const formatCPF = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return clean
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatWhatsApp = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 10) {
        return clean
            .slice(0, 10)
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return clean
        .slice(0, 11)
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
};

const formatCEP = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return clean
        .slice(0, 8)
        .replace(/(\d{5})(\d)/, '$1-$2');
};

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// Validadores simples
const validateCPF = (cpf: string): boolean => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(clean)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(clean.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(clean.substring(10, 11))) return false;
    
    return true;
};

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variantId?: string;
  sku?: string;
}

interface Order {
  id: string;
  createdAt: { toDate: () => Date } | null | any;
  customerName: string;
  customerWhatsapp: string;
  customerAddress: string;
  items: OrderItem[];
  notes?: string;
  total: number;
  status: string;
  paymentMethod?: string;
  deliveryFee?: number;
  subTotal?: number;
}

export const CustomerAreaPage = () => {
    const { user, isLoading: authLoading } = useAuthStore();
    const navigate = useNavigate();

    // Estados da página
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    const location = useLocation();

    // Map pathnames to activeSection codes
    const getSectionFromPath = (path: string) => {
        if (path.endsWith('/dados')) return 'dados';
        if (path.endsWith('/pedidos')) return 'pedidos';
        if (path.endsWith('/enderecos')) return 'enderecos';
        if (path.endsWith('/favoritos')) return 'favoritos';
        if (path.endsWith('/fidelidade')) return 'fidelidade';
        if (path.endsWith('/avaliacoes')) return 'avaliacoes';
        if (path.endsWith('/notificacoes')) return 'notificacoes';
        if (path.endsWith('/suporte')) return 'suporte';
        if (path.endsWith('/alterar-senha')) return 'senha';
        return null;
    };

    const activeSection = getSectionFromPath(location.pathname);

    const setActiveSection = (section: string | null) => {
        if (!section) {
            navigate('/area-cliente');
        } else if (section === 'senha') {
            navigate('/area-cliente/alterar-senha');
        } else {
            navigate(`/area-cliente/${section}`);
        }
    };

    // Mensagens de Feedback
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Dados para Edição de Cadastro
    const [fullName, setFullName] = useState('');
    const [cpf, setCpf] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    // Dados para Edição de Endereço
    const [cep, setCep] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [neighborhood, setNeighborhood] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [reference, setReference] = useState('');
    const [loadingCep, setLoadingCep] = useState(false);
    const [addressLoading, setAddressLoading] = useState(false);
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [isDefault, setIsDefault] = useState(true);
    const [addrErrors, setAddrErrors] = useState<Record<string, string>>({});
    const [loadingLocation, setLoadingLocation] = useState(false);

    // Múltiplos Endereços
    const [addresses, setAddresses] = useState<any[]>([]);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [addressType, setAddressType] = useState('casa'); // 'casa', 'trabalho', 'outro'
    const [customAddressType, setCustomAddressType] = useState('');

    // Mudança de Senha
    const [oldPassword, setOldPassword] = useState(''); // useful hint for requiredRecentLogin
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    // Suporte Form
    const [supportSubject, setSupportSubject] = useState('');
    const [supportMessage, setSupportMessage] = useState('');
    const [supportLoading, setSupportLoading] = useState(false);

    // Avaliações Form
    const [reviewMessage, setReviewMessage] = useState('');
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewLoading, setReviewLoading] = useState(false);

    // Estado para abrir detalhes de um pedido
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [sendingVerif, setSendingVerif] = useState(false);

    // Segurança: Redireciona se não estiver logado
    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login', { replace: true });
        }
    }, [user, authLoading, navigate]);

    // Buscar perfil do banco users/{uid}
    useEffect(() => {
        if (!user?.uid) return;

        const syncProfile = async () => {
            setLoading(true);
            try {
                // Sincronizar o estado de emailVerified com o Authentication
                try {
                    await user.reload();
                } catch (reloadErr) {
                    console.warn("Nao foi possivel recarregar dados do Firebase Auth:", reloadErr);
                }

                const userRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(userRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    if (data.accountStatus === 'pending_otp') {
                        navigate('/ativar-conta', { replace: true });
                        return;
                    }
                    
                    // Se o auth tiver verificado mas o Firestore nao, atualizar e disparar webhook de ativacao
                    const isAuthVerified = user.emailVerified;
                    const isFsVerified = data.emailVerified === true;

                    if (isAuthVerified && !isFsVerified) {
                        await updateDoc(userRef, {
                            emailVerified: true,
                            accountStatus: 'active',
                            updatedAt: serverTimestamp()
                        });
                        data.emailVerified = true;
                        data.accountStatus = 'active';

                        // Disparar Webhook de Ativacao de Conta (Assincrono / Nao-bloqueante)
                        fetch('/api/customer-events/activate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                uid: user.uid,
                                fullName: data.fullName || '',
                                email: data.email || user.email || '',
                                whatsapp: data.whatsapp || '',
                                activatedAt: new Date().toISOString()
                            })
                        }).catch(webhookErr => {
                            console.error("Erro ao chamar webhook de ativacao:", webhookErr);
                        });
                    }

                    setProfile(data);
                    
                    // Fill inputs
                    setFullName(data.fullName || '');
                    setCpf(data.cpf ? formatCPF(data.cpf) : '');
                    setBirthDate(data.birthDate || '');
                    setWhatsapp(data.whatsapp ? formatWhatsApp(data.whatsapp) : '');

                    // Carregar múltiplos endereços com suporte a migração legada
                    let loadedAddresses = data.addresses || [];
                    if (loadedAddresses.length === 0 && data.address) {
                        const initialAddr = {
                            id: 'legacy-default',
                            cep: data.address.cep ? formatCEP(data.address.cep) : '',
                            street: data.address.street || '',
                            number: data.address.number || '',
                            complement: data.address.complement || '',
                            neighborhood: data.address.neighborhood || '',
                            city: data.address.city || '',
                            state: data.address.state || '',
                            reference: data.address.reference || '',
                            latitude: data.address.latitude !== undefined ? data.address.latitude : null,
                            longitude: data.address.longitude !== undefined ? data.address.longitude : null,
                            isDefault: true,
                            type: 'casa',
                            createdAt: data.address.createdAt || new Date().toISOString(),
                            updatedAt: data.address.updatedAt || new Date().toISOString()
                        };
                        loadedAddresses = [initialAddr];
                    }
                    setAddresses(loadedAddresses);
                    
                    // Encontrar o endereço principal atual para os inputs (se houver)
                    const defaultAddr = loadedAddresses.find((a: any) => a.isDefault) || loadedAddresses[0];
                    if (defaultAddr) {
                        setCep(defaultAddr.cep ? formatCEP(defaultAddr.cep) : '');
                        setStreet(defaultAddr.street || '');
                        setNumber(defaultAddr.number || '');
                        setComplement(defaultAddr.complement || '');
                        setNeighborhood(defaultAddr.neighborhood || '');
                        setCity(defaultAddr.city || '');
                        setState(defaultAddr.state || '');
                        setReference(defaultAddr.reference || '');
                        setLatitude(defaultAddr.latitude !== undefined ? defaultAddr.latitude : null);
                        setLongitude(defaultAddr.longitude !== undefined ? defaultAddr.longitude : null);
                        setIsDefault(defaultAddr.isDefault !== undefined ? defaultAddr.isDefault : true);
                        
                        const currentType = defaultAddr.type || 'casa';
                        if (['casa', 'trabalho'].includes(currentType.toLowerCase())) {
                            setAddressType(currentType.toLowerCase());
                            setCustomAddressType('');
                        } else {
                            setAddressType('outro');
                            setCustomAddressType(currentType);
                        }
                    }
                } else {
                    // Create minimal structure
                    const minDoc = {
                        uid: user.uid,
                        role: 'customer',
                        type: 'customer',
                        email: user.email || '',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };
                    await setDoc(userRef, minDoc);
                    setProfile(minDoc);
                }
            } catch (err) {
                console.error("Erro ao sincronizar perfil:", err);
                setError("Erro de conexão ao carregar suas informações.");
            } finally {
                setLoading(false);
            }
        };

        syncProfile();
    }, [user]);

    // Buscar pedidos quando "pedidos" for acessado
    useEffect(() => {
        if (activeSection === 'pedidos' && profile) {
            fetchOrders();
        }
    }, [activeSection, profile]);

    const fetchOrders = async () => {
        if (!profile) return;
        setOrdersLoading(true);
        try {
            const ordersRef = collection(db, 'orders');
            const cleanWhatsapp = (profile.whatsapp || '').replace(/\D/g, '');

            // Queremos buscar de forma extremamente resiliente, por whatsapp direto, formatado ou por uid.
            // Para contornar limitações de índices compostos em bancos de desenvolvimento, 
            // fazemos as consultas simples separadamente e unificamos/ordenamos na memória.
            const queryPromises = [];
            
            if (cleanWhatsapp) {
                queryPromises.push(getDocs(query(ordersRef, where('customerWhatsapp', '==', cleanWhatsapp))));
                queryPromises.push(getDocs(query(ordersRef, where('customerWhatsapp', '==', profile.whatsapp))));
                queryPromises.push(getDocs(query(ordersRef, where('customerId', '==', cleanWhatsapp))));
            }
            queryPromises.push(getDocs(query(ordersRef, where('customerId', '==', user?.uid))));

            const snapshots = await Promise.all(queryPromises);
            const resultsMap: Record<string, any> = {};

            snapshots.forEach(snap => {
                snap.docs.forEach(doc => {
                    resultsMap[doc.id] = { id: doc.id, ...doc.data() };
                });
            });

            const uniqueOrders = Object.values(resultsMap) as Order[];

            // Ordena em memória por data decrescente de criação
            uniqueOrders.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });

            setOrders(uniqueOrders);
        } catch (err) {
            console.error("Erro ao buscar histórico de pedidos:", err);
        } finally {
            setOrdersLoading(false);
        }
    };

    const normalizeCity = (cityStr: string) => {
        return cityStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };
    const normalizeState = (stateStr: string) => {
        return stateStr.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    };

    // Google Geolocalização e Geocoding
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setError("Seu navegador não suporta geolocalização.");
            return;
        }

        setLoadingLocation(true);
        setError(null);
        setSuccess(null);
        setAddrErrors({});

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setLatitude(lat);
                setLongitude(lng);

                try {
                    const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || "";
                    if (!apiKey) {
                        setError("Google Maps API Key não configurada. Configure GOOGLE_MAPS_PLATFORM_KEY.");
                        setLoadingLocation(false);
                        return;
                    }

                    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
                    const data = await response.json();

                    if (data.status === "OK" && data.results && data.results.length > 0) {
                        const result = data.results[0];
                        const components = result.address_components;

                        let foundCep = '';
                        let foundStreet = '';
                        let foundNumber = '';
                        let foundNeighborhood = '';
                        let foundCity = '';
                        let foundState = '';

                        for (const comp of components) {
                            if (comp.types.includes('postal_code')) {
                                foundCep = comp.long_name;
                            }
                            if (comp.types.includes('route')) {
                                foundStreet = comp.long_name;
                            }
                            if (comp.types.includes('street_number')) {
                                foundNumber = comp.long_name;
                            }
                            if (comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality')) {
                                foundNeighborhood = comp.long_name;
                            }
                            if (comp.types.includes('administrative_area_level_2')) {
                                foundCity = comp.long_name;
                            }
                            if (comp.types.includes('administrative_area_level_1')) {
                                foundState = comp.short_name;
                            }
                        }

                        if (foundCep) setCep(formatCEP(foundCep));
                        if (foundStreet) setStreet(foundStreet);
                        if (foundNumber) setNumber(foundNumber);
                        if (foundNeighborhood) setNeighborhood(foundNeighborhood);
                        if (foundCity) setCity(normalizeCity(foundCity));
                        if (foundState) setState(normalizeState(foundState));

                        setSuccess("Endereço preenchido com sucesso pela sua localização!");
                        setAddrErrors({});
                    } else {
                        setError("Não conseguimos encontrar seu endereço automaticamente.");
                    }
                } catch (err) {
                    console.error("Erro no geocoding do Google:", err);
                    setError("Não conseguimos encontrar seu endereço automaticamente.");
                } finally {
                    setLoadingLocation(false);
                }
            },
            (error) => {
                console.error("Erro ao obter geolocalização:", error);
                if (error.code === error.PERMISSION_DENIED) {
                    setError("Permissão de localização negada.");
                } else {
                    setError("Não conseguimos obter sua localização.");
                }
                setLoadingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // CEP auto-completa
    const handleCepLookup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = formatCEP(e.target.value);
        setCep(value);
        setAddrErrors(prev => ({ ...prev, cep: '' }));

        const clean = value.replace(/\D/g, '');
        if (clean.length === 8) {
            setLoadingCep(true);
            setError(null);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
                const data = await response.json();
                if (data.erro) {
                    setError('Não encontramos esse CEP. Preencha manualmente.');
                    setAddrErrors(prev => ({ ...prev, cep: 'Não encontramos esse CEP. Preencha manualmente.' }));
                } else {
                    setStreet(data.logradouro || '');
                    setNeighborhood(data.bairro || '');
                    setCity(data.localidade ? normalizeCity(data.localidade) : '');
                    setState(data.uf ? normalizeState(data.uf) : '');
                    
                    // Clear field errors
                    setAddrErrors(prev => ({
                        ...prev,
                        cep: '',
                        street: data.logradouro ? '' : prev.street,
                        neighborhood: data.bairro ? '' : prev.neighborhood,
                        city: data.localidade ? '' : prev.city,
                        state: data.uf ? '' : prev.state
                    }));
                }
            } catch (err) {
                console.error("Erro ViaCEP:", err);
                setError("Não encontramos esse CEP. Preencha manualmente.");
                setAddrErrors(prev => ({ ...prev, cep: 'Não encontramos esse CEP. Preencha manualmente.' }));
            } finally {
                setLoadingCep(false);
            }
        }
    };

    // Logout
    const handleLogoutSubmit = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (err) {
            console.error("Erro ao deslogar:", err);
        }
    };

    // Reenviar e-mail de ativação
    const handleResendVerification = async () => {
        if (!user) return;
        setSendingVerif(true);
        setError(null);
        setSuccess(null);
        try {
            await sendEmailVerification(user);
            setSuccess("E-mail de ativação reenviado com sucesso! Verifique sua caixa de entrada ou spam.");
        } catch (err: any) {
            console.error("Erro ao reenviar e-mail:", err);
            setError("Não foi possível reenviar o e-mail de ativação. Tente novamente mais tarde.");
        } finally {
            setSendingVerif(false);
        }
    };

    // Salvar Dados Cadastrais
    const handleSaveCadastro = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) {
            setError('Por favor, digite seu nome e sobrenome.');
            return;
        }
        if (!validateCPF(cpf)) {
            setError('O CPF informado é inválido.');
            return;
        }
        if (!birthDate) {
            setError('Sua data de nascimento é obrigatória.');
            return;
        }
        const cleanPhone = whatsapp.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
            setError('Por favor, informe seu WhatsApp brasileiro com DDD.');
            return;
        }

        setEditLoading(true);
        try {
            const userRef = doc(db, 'users', user!.uid);
            const updatePayload = {
                fullName: fullName.trim(),
                cpf: cpf.replace(/\D/g, ''),
                birthDate,
                whatsapp: cleanPhone,
                updatedAt: serverTimestamp()
            };
            await updateDoc(userRef, updatePayload);
            setProfile((prev: any) => ({ ...prev, ...updatePayload }));
            setSuccess('Dados cadastrais atualizados com sucesso!');
        } catch (err: any) {
            console.error("Erro ao salvar cadastro:", err);
            setError('Não foi possível salvar os novos dados de perfil.');
        } finally {
            setEditLoading(false);
        }
    };

    // Limpar campos de endereço
    const clearAddressInputs = () => {
        setCep('');
        setStreet('');
        setNumber('');
        setComplement('');
        setNeighborhood('');
        setCity('');
        setState('');
        setReference('');
        setLatitude(null);
        setLongitude(null);
        setIsDefault(false);
        setAddressType('casa');
        setCustomAddressType('');
        setAddrErrors({});
    };

    // Clique em editar endereço
    const handleEditAddressClick = (addr: any) => {
        setError(null);
        setSuccess(null);
        setEditingAddressId(addr.id);
        setCep(addr.cep ? formatCEP(addr.cep) : '');
        setStreet(addr.street || '');
        setNumber(addr.number || '');
        setComplement(addr.complement || '');
        setNeighborhood(addr.neighborhood || '');
        setCity(addr.city || '');
        setState(addr.state || '');
        setReference(addr.reference || '');
        setLatitude(addr.latitude !== undefined ? addr.latitude : null);
        setLongitude(addr.longitude !== undefined ? addr.longitude : null);
        setIsDefault(addr.isDefault || false);
        
        const currentType = addr.type || 'casa';
        if (['casa', 'trabalho'].includes(currentType.toLowerCase())) {
            setAddressType(currentType.toLowerCase());
            setCustomAddressType('');
        } else {
            setAddressType('outro');
            setCustomAddressType(currentType);
        }
        setAddrErrors({});
        setIsFormOpen(true);
    };

    // Definir endereço principal
    const handleSetDefaultAddress = async (addressId: string) => {
        setError(null);
        setSuccess(null);
        try {
            const userRef = doc(db, 'users', user!.uid);
            const updatedList = addresses.map(addr => ({
                ...addr,
                isDefault: addr.id === addressId
            }));

            const defaultAddress = updatedList.find(addr => addr.isDefault) || updatedList[0];

            await updateDoc(userRef, {
                addresses: updatedList,
                address: defaultAddress || null,
                updatedAt: serverTimestamp()
            });

            setAddresses(updatedList);
            setProfile((prev: any) => ({
                ...prev,
                addresses: updatedList,
                address: defaultAddress || null
            }));
            
            setSuccess('Endreço principal definido com sucesso!');
        } catch (err: any) {
            console.error("Erro ao definir endereço padrão:", err);
            setError('Não foi possível alterar seu endereço principal.');
        }
    };

    // Excluir endereço
    const handleDeleteAddress = async (addressId: string) => {
        setError(null);
        setSuccess(null);
        
        const target = addresses.find(addr => addr.id === addressId);
        if (target?.isDefault && addresses.length > 1) {
            setError('Defina outro endereço como principal antes de excluir este.');
            return;
        }

        try {
            const userRef = doc(db, 'users', user!.uid);
            let updatedList = addresses.filter(addr => addr.id !== addressId);

            // Regra: se sobrar algum endereço e nenhum for default, o primeiro vira default
            if (updatedList.length > 0 && !updatedList.some(addr => addr.isDefault)) {
                updatedList[0].isDefault = true;
            }

            const defaultAddress = updatedList.find(addr => addr.isDefault) || null;

            await updateDoc(userRef, {
                addresses: updatedList,
                address: defaultAddress,
                updatedAt: serverTimestamp()
            });

            setAddresses(updatedList);
            setProfile((prev: any) => ({
                ...prev,
                addresses: updatedList,
                address: defaultAddress
            }));

            setSuccess('Endereço removido com sucesso!');
        } catch (err: any) {
            console.error("Erro ao deletar endereço:", err);
            setError('Não foi possível excluir o endereço.');
        }
    };

    // Salvar Endereço (Modificado para Múltiplos)
    const handleSaveAddress = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const errors: Record<string, string> = {};

        if (!cep.trim()) {
            errors.cep = 'Campo CEP é obrigatório.';
        } else if (cep.replace(/\D/g, '').length !== 8) {
            errors.cep = 'CEP deve conter exatamente 8 dígitos.';
        }

        if (!street.trim()) {
            errors.street = 'Campo Rua é obrigatório.';
        }

        if (!number.trim()) {
            errors.number = 'Campo Número é obrigatório.';
        }

        if (!neighborhood.trim()) {
            errors.neighborhood = 'Campo Bairro é obrigatório.';
        }

        if (!city.trim()) {
            errors.city = 'Campo Cidade é obrigatório.';
        }

        if (!state.trim()) {
            errors.state = 'Campo Estado (UF) é obrigatório.';
        }

        if (!complement.trim()) {
            errors.complement = 'Campo Complemento é obrigatório.';
        }

        if (!reference.trim()) {
            errors.reference = 'Campo Ponto de Referência é obrigatório.';
        }

        if (addressType === 'outro' && !customAddressType.trim()) {
            errors.customType = 'Por favor, defina o tipo personalizado.';
        }

        if (Object.keys(errors).length > 0) {
            setAddrErrors(errors);
            setError('Complete os campos que faltam.');
            return;
        }

        setAddressLoading(true);
        try {
            const userRef = doc(db, 'users', user!.uid);

            const typeLabel = addressType === 'outro' ? customAddressType.trim() : addressType;
            const targetId = editingAddressId || ('addr_' + Math.random().toString(36).substring(2, 11));
            const existingAddr = addresses.find(a => a.id === targetId);

            const addressObj = {
                id: targetId,
                cep: cep.replace(/\D/g, ''),
                street: street.trim(),
                number: number.trim(),
                complement: complement.trim(),
                neighborhood: neighborhood.trim(),
                city: city.trim(),
                state: state.toUpperCase().trim(),
                reference: reference.trim(),
                latitude: latitude !== undefined ? latitude : null,
                longitude: longitude !== undefined ? longitude : null,
                isDefault: addresses.length === 0 ? true : isDefault,
                type: typeLabel.toLowerCase(),
                createdAt: existingAddr?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            let updatedList = [];
            if (editingAddressId) {
                updatedList = addresses.map(addr => addr.id === editingAddressId ? addressObj : addr);
            } else {
                updatedList = [...addresses, addressObj];
            }

            // Regra do principal
            if (addressObj.isDefault) {
                updatedList = updatedList.map(addr => {
                    if (addr.id !== targetId) {
                        return { ...addr, isDefault: false };
                    }
                    return addr;
                });
            } else {
                const hasDefault = updatedList.some(addr => addr.isDefault);
                if (!hasDefault && updatedList.length > 0) {
                    updatedList[0].isDefault = true;
                }
            }

            const defaultAddress = updatedList.find(addr => addr.isDefault) || updatedList[0];

            await updateDoc(userRef, {
                addresses: updatedList,
                address: defaultAddress || null,
                updatedAt: serverTimestamp()
            });

            setAddresses(updatedList);
            setProfile((prev: any) => ({ 
                ...prev, 
                addresses: updatedList,
                address: defaultAddress || null 
            }));

            setSuccess(editingAddressId ? 'Endereço atualizado com sucesso!' : 'Endereço cadastrado com sucesso!');
            setIsFormOpen(false);
            setEditingAddressId(null);
            clearAddressInputs();
        } catch (err: any) {
            console.error("Erro ao salvar endereço:", err);
            setError('Não foi possível registrar o endereço.');
        } finally {
            setAddressLoading(false);
        }
    };

    // Alterar Senha
    const handleSavePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (newPassword.length < 6) {
            setError('A nova senha deve possuir no mínimo 6 caracteres.');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setError('A confirmação de senha não confere.');
            return;
        }

        setPasswordLoading(true);
        try {
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
                setSuccess('Sua senha de segurança foi alterada com sucesso!');
                setNewPassword('');
                setConfirmNewPassword('');
            } else {
                setError('Usuário não autenticado.');
            }
        } catch (err: any) {
            console.error("Erro ao redefinir senha:", err);
            setError(getPasswordErrorMessage(err.code));
        } finally {
            setPasswordLoading(false);
        }
    };

    // Enviar Suporte ticket
    const handleSendSupport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!supportSubject.trim() || !supportMessage.trim()) {
            setError('Por favor, preencha o assunto e a sua mensagem.');
            return;
        }

        setSupportLoading(true);
        try {
            await addDoc(collection(db, 'support_tickets'), {
                userId: user!.uid,
                customerName: profile?.fullName || 'Nome não definido',
                customerEmail: profile?.email || user!.email,
                customerWhatsapp: profile?.whatsapp || '',
                subject: supportSubject.trim(),
                message: supportMessage.trim(),
                status: 'aberto',
                createdAt: serverTimestamp()
            });

            setSuccess('Sua solicitação de suporte foi aberta de forma ultra segura. Retornaremos via e-mail/whatsapp em até 12 horas úteis.');
            setSupportSubject('');
            setSupportMessage('');
        } catch (err) {
            console.error("Erro suporte:", err);
            setError('Falha ao registrar ticket de suporte.');
        } finally {
            setSupportLoading(false);
        }
    };

    // Enviar Avaliação do Cliente
    const handleSendReview = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!reviewMessage.trim()) {
            setError('Por favor, compartilhe sua opinião sobre nossa boutique.');
            return;
        }

        setReviewLoading(true);
        try {
            await addDoc(collection(db, 'reviews'), {
                userId: user!.uid,
                customerName: profile?.fullName ? profile.fullName.split(' ')[0] : 'Cliente Secreto',
                rating: reviewRating,
                comment: reviewMessage.trim(),
                approved: false, // Moderado pelo admin
                createdAt: serverTimestamp()
            });
            setSuccess('Muito obrigado! Sua avaliação secreta foi enviada e ajudará nosso controle interno de qualidade.');
            setReviewMessage('');
        } catch (err) {
            console.error("Erro avaliação:", err);
            setError('Falha ao enviar sua avaliação.');
        } finally {
            setReviewLoading(false);
        }
    };

    // Status da compra design mapping
    const getStatusDesign = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'entregue':
            case 'delivered':
            case 'pago':
                return { label: 'Entregue', bg: 'bg-green-950/50 text-green-400 border border-green-900/50' };
            case 'cancelado':
            case 'cancelled':
            case 'rejeitado':
                return { label: 'Cancelado', bg: 'bg-red-950/50 text-red-500 border border-red-900/50' };
            case 'preparando':
            case 'preparing':
                return { label: 'Em Preparação', bg: 'bg-yellow-950/50 text-yellow-500 border border-yellow-900/50' };
            case 'enviado':
            case 'shipped':
            case 'saiu para entrega':
                return { label: 'Enviado', bg: 'bg-blue-950/50 text-blue-400 border border-blue-900/50' };
            default:
                return { label: 'Recebido / Pendente', bg: 'bg-zinc-900 text-zinc-400 border border-zinc-800' };
        }
    };

    // Calcular pontos de fidelidade dinamicos com base nos pedidos entregues
    const completedOrders = orders.filter(o => ['entregue', 'delivered', 'pago'].includes(o.status?.toLowerCase()));
    const calculatedPoints = completedOrders.reduce((acc, o) => acc + Math.floor(o.total || 0), 0);

    // Calcular nível com base nos pontos
    const getLoyaltyTier = (pts: number) => {
        if (pts >= 1000) return { name: 'Platinum Black (VIP)', color: 'text-zinc-100', border: 'border-zinc-300' };
        if (pts >= 500) return { name: 'Gold Member', color: 'text-amber-400', border: 'border-amber-500' };
        if (pts >= 200) return { name: 'Silver Member', color: 'text-zinc-400', border: 'border-zinc-500' };
        return { name: 'Bronze Member', color: 'text-red-400', border: 'border-red-900' };
    };
    const tier = getLoyaltyTier(calculatedPoints);

    // Loader Premium da Discreta
    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white font-sans">
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-24 h-24 border border-red-500/20 rounded-full animate-ping duration-1000" />
                    <div className="w-14 h-14 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    <div className="absolute font-black tracking-widest text-[9px] text-red-500 uppercase animate-pulse">DB</div>
                </div>
                <p className="mt-6 text-zinc-400 text-[10px] tracking-[0.25em] uppercase font-bold animate-pulse">Acessando ambiente criptografado...</p>
            </div>
        );
    }

    // Definição dos cartões de menu
    const menuCards = [
        { id: 'dados', label: 'Dados da conta', desc: 'Edite suas infos sigilosas', icon: User },
        { id: 'pedidos', label: 'Meus pedidos', desc: 'Histórico e status de entrega', icon: Package },
        { id: 'enderecos', label: 'Meus endereços', desc: 'Endereço principal de despacho', icon: MapPin },
        { id: 'favoritos', label: 'Favoritos', desc: 'Lista de desejos secretos', icon: Heart },
        { id: 'fidelidade', label: 'Fidelidade', desc: 'Veja seus pontos acumulados', icon: Star },
        { id: 'avaliacoes', label: 'Minhas avaliações', desc: 'Deixe sua opinião interna', icon: Award },
        { id: 'notificacoes', label: 'Notificações', desc: 'Minhas mensagens enviadas', icon: Bell },
        { id: 'suporte', label: 'Suporte especializado', desc: 'Precisa de ajuda discreta?', icon: Headphones },
        { id: 'senha', label: 'Alterar senha', desc: 'Troque sua senha de acesso', icon: Lock },
    ];

    return (
        <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden pb-12 pt-8">
            {/* Efeitos visuais vermelhos discretos */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-red-950/10 blur-[130px] rounded-full pointer-events-none" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

                {/* Alerta de Verificação do E-mail */}
                {user && !user.emailVerified && (
                    <div className="mb-6 p-5 rounded-3xl bg-zinc-950/90 border border-amber-500/20 shadow-[0_0_25px_rgba(245,158,11,0.04)] flex flex-col md:flex-row items-center justify-between gap-4 font-sans text-sm backdrop-blur-md">
                        <div className="flex items-center gap-3.5">
                            <div className="h-11 w-11 rounded-full bg-amber-950/50 border border-amber-500/35 flex items-center justify-center text-amber-500 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <div>
                                <span className="font-extrabold text-white block text-sm">E-mail não verificado</span>
                                <span className="text-xs text-zinc-400">Confirme seu e-mail para ativar todos os recursos da sua conta.</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                            {sendingVerif ? (
                                <span className="text-zinc-500 text-xs font-bold py-2 px-4">Enviando link...</span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleResendVerification}
                                    className="bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold px-5 py-2.5 rounded-2xl text-xs transition duration-300 shadow-[0_4px_12px_rgba(245,158,11,0.2)] cursor-pointer whitespace-nowrap font-sans"
                                >
                                    Reenviar e-mail de ativação
                                </button>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Visual Header do Perfil */}
                <div className="mb-8 p-6 rounded-3xl bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800/60 shadow-[0_4px_30px_rgba(220,38,38,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="h-16 w-16 rounded-full bg-zinc-900 border border-red-600/35 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.1)] text-red-500 shrink-0">
                            <User className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="flex items-center flex-wrap gap-2">
                                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-0.5">
                                    {profile?.fullName || 'Cliente Criptografada(o)'}
                                </h1>
                                <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-500/30 shadow-[0_0_8px_rgba(220,38,38,0.25)]`}>
                                    Selo Cliente Discreta
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1 font-medium select-all">
                                <Mail className="h-3 w-3 shrink-0 text-zinc-500" /> {profile?.email || user?.email}
                            </p>
                            {profile?.whatsapp && (
                                <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5 font-medium select-all">
                                    <Phone className="h-3 w-3 shrink-0 text-zinc-500" /> {formatWhatsApp(profile.whatsapp)}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button 
                            onClick={() => {
                                setError(null);
                                setSuccess(null);
                                setActiveSection('dados');
                            }}
                            className="bg-zinc-900/80 text-zinc-300 hover:text-white border border-zinc-800 px-4 py-2 rounded-xl text-xs font-bold transition duration-300 hover:border-zinc-700 hover:bg-zinc-800 cursor-pointer flex items-center gap-1.5"
                        >
                            <User className="h-3.5 w-3.5 text-red-500" /> Editar Perfil
                        </button>
                        <button 
                            onClick={handleLogoutSubmit}
                            className="bg-red-950/40 text-red-400 hover:text-white border border-red-900/40 px-4 py-2 rounded-xl text-xs font-bold transition duration-300 hover:border-red-650 hover:bg-red-900/60 cursor-pointer flex items-center gap-1.5"
                        >
                            <LogOut className="h-3.5 w-3.5" /> Sair
                        </button>
                    </div>
                </div>

                {/* Sub-título ou Banner */}
                {activeSection && (
                    <div className="mb-6">
                        <button 
                            onClick={() => {
                                setError(null);
                                setSuccess(null);
                                setActiveSection(null);
                            }}
                            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold transition"
                        >
                            <ArrowLeft className="h-4 w-4" /> Voltar ao Menu Principal
                        </button>
                    </div>
                )}

                {/* Grid Responsivo Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* MENU DE SELEÇÃO: Esquerda no desktop, Ocultado quando seção ativa no mobile */}
                    <div className={`col-span-1 lg:col-span-4 space-y-3 ${activeSection !== null ? 'hidden lg:block' : 'block'}`}>
                        <div className="px-1 mb-4 select-none">
                            <h2 className="text-xs uppercase font-extrabold tracking-[0.25em] text-zinc-500">Navegação Segura</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                            {menuCards.map((card) => {
                                const Icon = card.icon;
                                const isActive = activeSection === card.id;
                                return (
                                    <button
                                        key={card.id}
                                        onClick={() => {
                                            setError(null);
                                            setSuccess(null);
                                            setActiveSection(card.id);
                                        }}
                                        className={`w-full text-left p-4 rounded-2xl border transition duration-300 flex items-center justify-between group cursor-pointer ${
                                            isActive 
                                                ? 'bg-zinc-950 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.06)]' 
                                                : 'bg-zinc-950/60 hover:bg-zinc-900/70 border-zinc-900 hover:border-zinc-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl transition duration-300 ${
                                                isActive ? 'bg-red-900/30 text-red-500' : 'bg-zinc-900 text-zinc-400 group-hover:text-white'
                                            }`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className={`text-sm font-bold transition duration-300 ${
                                                    isActive ? 'text-white' : 'text-zinc-300 group-hover:text-white'
                                                }`}>
                                                    {card.label}
                                                </h3>
                                                <p className="text-[11px] text-zinc-500">{card.desc}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 transition duration-300 ${
                                            isActive ? 'text-red-500 translate-x-0.5' : 'text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5'
                                        }`} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* CONTEÚDO PRINCIPAL: Direita no desktop, Ocupa todo espaço se ativo no mobile */}
                    <div className={`col-span-1 lg:col-span-8 ${activeSection === null ? 'hidden lg:block' : 'block'}`}>
                        
                        {/* Se nenhuma seção estiver ativa e estiver no Desktop */}
                        {activeSection === null && (
                            <div className="rounded-3xl bg-zinc-950/60 border border-zinc-900 p-8 text-center flex flex-col items-center justify-center min-h-[460px] select-none">
                                <div className="h-16 w-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-6 animate-pulse">
                                    <ShieldCheck className="h-8 w-8 text-red-500" />
                                </div>
                                <h2 className="text-xl font-bold tracking-tight text-white mb-2">Sua Central Discreta</h2>
                                <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">
                                    Selecione uma das opções no painel lateral para visualizar seus pedidos secretos, atualizar endereço e gerenciar seus dados de assinante.
                                </p>
                                <div className="text-[10px] text-zinc-500 tracking-[0.15em] uppercase font-bold bg-zinc-900/50 py-1.5 px-4 rounded-full border border-zinc-900">
                                    Conexão Segura SSL de 256 bits
                                </div>
                            </div>
                        )}

                        {/* Seção Dados da Conta */}
                        {activeSection === 'dados' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Dados da Conta</h2>
                                        <p className="text-zinc-500 text-xs">Mantenha seus dados sempre vigentes.</p>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-6 flex items-start gap-3 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs font-semibold">
                                        <AlertCircle className="h-5 w-5 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="mb-6 flex items-start gap-3 p-3.5 bg-green-950/35 border border-green-900/40 rounded-xl text-green-400 text-xs font-semibold">
                                        <CheckCircle className="h-5 w-5 shrink-0" />
                                        <span>{success}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSaveCadastro} className="space-y-4">
                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Nome Completo</label>
                                        <input 
                                            type="text" 
                                            value={fullName}
                                            onChange={e => setFullName(e.target.value)}
                                            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">CPF</label>
                                            <input 
                                                type="text" 
                                                value={cpf}
                                                onChange={e => setCpf(formatCPF(e.target.value))}
                                                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Data de Nascimento</label>
                                            <input 
                                                type="date" 
                                                value={birthDate}
                                                onChange={e => setBirthDate(e.target.value)}
                                                className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">WhatsApp</label>
                                        <input 
                                            type="text" 
                                            value={whatsapp}
                                            onChange={e => setWhatsapp(formatWhatsApp(e.target.value))}
                                            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Endereço de E-mail (Identificador)</label>
                                        <input 
                                            type="text" 
                                            disabled
                                            value={profile?.email || user?.email || ''}
                                            className="w-full px-4 py-3 bg-zinc-900/20 border border-zinc-900 text-zinc-500 rounded-xl text-sm cursor-not-allowed"
                                        />
                                        <span className="text-[10px] text-zinc-600 mt-1 block">O e-mail cadastrado serve de chave única de acesso e não pode ser reeditado livremente.</span>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={editLoading}
                                        className="w-full mt-6 py-3.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {editLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Alterações'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Seção Meus Pedidos */}
                        {activeSection === 'pedidos' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                        <Package className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Meus Pedidos</h2>
                                        <p className="text-zinc-500 text-xs">Todos os despachos possuem protocolo de rastreio e são privados.</p>
                                    </div>
                                </div>

                                {ordersLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                                        <div className="h-10 w-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs text-zinc-400">Varrendo bancos seguros...</span>
                                    </div>
                                ) : orders.length === 0 ? (
                                    <div className="py-16 text-center text-zinc-500 flex flex-col items-center">
                                        <ShoppingBag className="h-12 w-12 text-zinc-700 mb-4" />
                                        <span className="text-sm font-bold text-zinc-400 mb-1">Nenhum pedido encontrado</span>
                                        <span className="text-xs text-zinc-500 max-w-xs mb-6">Você ainda não realizou transações sob este cadastro ou telefone.</span>
                                        <Link to="/catalogo" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl tracking-wider transition-all">
                                            Ir para o catálogo
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {orders.map((order) => {
                                            const design = getStatusDesign(order.status);
                                            const formattedDate = order.createdAt?.toDate 
                                                ? new Date(order.createdAt.toDate()).toLocaleDateString('pt-BR') 
                                                : order.createdAt 
                                                    ? new Date(order.createdAt).toLocaleDateString('pt-BR') 
                                                    : 'Data não informada';
                                            const isExpanded = expandedOrder === order.id;

                                            return (
                                                <div key={order.id} className="border border-zinc-900 bg-zinc-900/30 rounded-2xl overflow-hidden transition">
                                                    
                                                    {/* Card Header */}
                                                    <div 
                                                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                                        className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/50 transition select-none"
                                                    >
                                                        <div>
                                                            <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider mb-1">Cód: #{order.id.slice(0, 8)}</span>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm font-bold text-white">{formatCurrency(order.total || 0)}</span>
                                                                <span className="text-zinc-600">|</span>
                                                                <span className="text-xs text-zinc-400">{formattedDate}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${design.bg}`}>
                                                                {design.label}
                                                            </span>
                                                            <ChevronRight className={`h-4 w-4 text-zinc-550 transition duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                                                        </div>
                                                    </div>

                                                    {/* Card Details (Accordion Expand) */}
                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div 
                                                                initial={{ height: 0 }}
                                                                animate={{ height: 'auto' }}
                                                                exit={{ height: 0 }}
                                                                className="overflow-hidden bg-zinc-950/40 border-t border-zinc-900"
                                                            >
                                                                <div className="p-5 space-y-4 text-xs text-zinc-400">
                                                                    <div>
                                                                        <h4 className="text-xs text-white font-black uppercase tracking-wider mb-2">Resumo da compra</h4>
                                                                        <div className="space-y-2">
                                                                            {order.items?.map((item, idx) => (
                                                                                <div key={idx} className="flex justify-between border-b border-zinc-900/50 pb-2">
                                                                                    <span>{item.name} <strong className="text-zinc-500">x{item.quantity}</strong></span>
                                                                                    <span className="text-zinc-300">{formatCurrency(item.price * item.quantity)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                                                        <div>
                                                                            <h4 className="text-xs text-white font-black uppercase tracking-wider mb-1.5">Endereço de Entrega</h4>
                                                                            <p className="text-zinc-400 leading-relaxed italic">{order.customerAddress || 'Endereço não definido'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-xs text-white font-black uppercase tracking-wider mb-1.5">Pagamento</h4>
                                                                            <p className="text-zinc-400 uppercase font-bold tracking-wider">{order.paymentMethod || 'Não informado'}</p>
                                                                            <div className="mt-2 text-zinc-500 flex flex-col gap-0.5">
                                                                                <span>Subtotal: {formatCurrency(order.subTotal || order.total - (order.deliveryFee || 0))}</span>
                                                                                <span>Entrega: {formatCurrency(order.deliveryFee || 0)}</span>
                                                                                <span className="text-white font-bold">Total Pago: {formatCurrency(order.total)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Seção Meus Endereços */}
                        {activeSection === 'enderecos' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in animate-duration-300">
                                <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                            <MapPin className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white">Meus Endereços</h2>
                                            <p className="text-zinc-500 text-xs font-medium">Configure seus locais de despacho discretos com total conveniência.</p>
                                        </div>
                                    </div>
                                    
                                    {!isFormOpen && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                clearAddressInputs();
                                                setEditingAddressId(null);
                                                setIsFormOpen(true);
                                                setError(null);
                                                setSuccess(null);
                                            }}
                                            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] font-bold text-xs uppercase tracking-wider text-white rounded-xl transition flex items-center gap-2 cursor-pointer"
                                        >
                                            <span>+ Novo Endereço</span>
                                        </button>
                                    )}
                                </div>

                                {error && (
                                    <div className="mb-6 flex items-start gap-3 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs font-semibold">
                                        <AlertCircle className="h-5 w-5 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="mb-6 flex items-start gap-3 p-3.5 bg-green-950/35 border border-green-900/40 rounded-xl text-green-400 text-xs font-semibold">
                                        <CheckCircle className="h-5 w-5 shrink-0" />
                                        <span>{success}</span>
                                    </div>
                                )}

                                {/* Lista de Endereços Salvos */}
                                {!isFormOpen && (
                                    <div className="space-y-4">
                                        {addresses.length === 0 ? (
                                            <div className="py-16 border border-dashed border-zinc-800 rounded-2xl text-center text-zinc-500 flex flex-col items-center justify-center">
                                                <MapPin className="h-10 w-10 text-zinc-800 mb-3" />
                                                <p className="text-sm font-semibold text-zinc-400">Nenhum endereço cadastrado ainda.</p>
                                                <p className="text-xs text-zinc-600 mt-1 max-w-xs leading-relaxed">Você pode cadastrar quantos endereços quiser (ex: Casa, Trabalho, Praia) e escolher o principal.</p>
                                                <button
                                                    onClick={() => {
                                                        clearAddressInputs();
                                                        setEditingAddressId(null);
                                                        setIsFormOpen(true);
                                                    }}
                                                    className="mt-4 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                                                >
                                                    Cadastrar meu primeiro endereço
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {addresses.map((addr) => (
                                                    <div key={addr.id} className="relative rounded-2xl border border-zinc-900 bg-zinc-900/10 p-5 flex flex-col justify-between hover:border-zinc-800 transition duration-300">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                                {/* Badge Tipo do Endereço */}
                                                                <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-850 text-[10px] font-black uppercase rounded-full tracking-wider text-zinc-300">
                                                                    {addr.type === 'casa' ? '🏠 Casa' : addr.type === 'trabalho' ? '💼 Trabalho' : `📍 ${addr.type}`}
                                                                </span>

                                                                {/* Badge Principal */}
                                                                {addr.isDefault && (
                                                                    <span className="px-2.5 py-1 bg-red-950/40 border border-red-900/40 text-[10px] font-bold uppercase rounded-full tracking-wider text-red-500">
                                                                        ★ Principal
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <p className="text-sm text-zinc-150 font-semibold leading-relaxed">
                                                                {addr.street}, {addr.number}
                                                                {addr.complement && ` - ${addr.complement}`}
                                                            </p>
                                                            <p className="text-xs text-zinc-500 mt-1">
                                                                {addr.neighborhood} | {addr.city} - {addr.state}
                              </p>
                                                            <p className="text-xs text-zinc-600 mt-0.5 font-mono">
                                                                CEP: {formatCEP(addr.cep)}
                                                            </p>

                                                            {addr.reference && (
                                                                <p className="text-[11px] text-zinc-550 italic mt-3 border-t border-zinc-900/60 pt-2 leading-relaxed">
                                                                    Ref: {addr.reference}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="mt-5 pt-3 border-t border-zinc-900/60 flex items-center justify-between gap-3 flex-wrap">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleEditAddressClick(addr)}
                                                                    className="px-3 py-1.5 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-[10px] font-bold uppercase text-zinc-300 rounded-lg tracking-wider transition cursor-pointer"
                                                                >
                                                                    Editar
                                                                </button>
                                                                {!addr.isDefault && (
                                                                    <button
                                                                        onClick={() => handleDeleteAddress(addr.id)}
                                                                        className="px-3 py-1.5 bg-zinc-900/40 hover:bg-red-950/20 border border-zinc-850 hover:border-red-900/30 text-[10px] font-bold uppercase text-zinc-500 hover:text-red-500 rounded-lg tracking-wider transition cursor-pointer"
                                                                    >
                                                                        Excluir
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {!addr.isDefault && (
                                                                <button
                                                                    onClick={() => handleSetDefaultAddress(addr.id)}
                                                                    className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-wider transition cursor-pointer"
                                                                >
                                                                    Definir Principal
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Formulário de Endereço (Adicionar / Editar) */}
                                {isFormOpen && (
                                    <div className="bg-zinc-950/40 border border-zinc-900/50 rounded-2xl p-5 sm:p-6 space-y-4 animate-fade-in animate-duration-300">
                                        <div className="flex items-center justify-between gap-2 border-b border-zinc-900/60 pb-3">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                                                {editingAddressId ? 'Editar Endereço' : 'Cadastrar Novo Endereço'}
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsFormOpen(false);
                                                    setEditingAddressId(null);
                                                    clearAddressInputs();
                                                }}
                                                className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase font-bold tracking-wider transition cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <button
                                                type="button"
                                                onClick={handleGetLocation}
                                                disabled={loadingLocation || loadingCep || addressLoading}
                                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-900 hover:bg-zinc-850 text-white border border-zinc-850 hover:border-zinc-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 disabled:opacity-55 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
                                            >
                                                <MapPin className={`h-4 w-4 text-red-500 ${loadingLocation ? 'animate-bounce' : ''}`} />
                                                {loadingLocation ? 'Buscando Localização...' : 'Preencher pela minha localização'}
                                            </button>
                                        </div>

                                        {(loadingCep || loadingLocation) && (
                                            <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-900/30 rounded-xl text-red-400 text-xs font-bold animate-pulse">
                                                <div className="h-4 w-4 border-2 border-red-650 border-t-transparent rounded-full animate-spin" />
                                                <span>Buscando endereço...</span>
                                            </div>
                                        )}

                                        <form onSubmit={handleSaveAddress} className="space-y-4">
                                            
                                            {/* Seletor Tipo de Endereço */}
                                            <div className="space-y-2">
                                                <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider">Tipo de Endereço</label>
                                                <div className="flex items-center gap-2">
                                                    {['casa', 'trabalho', 'outro'].map((t) => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => {
                                                                setAddressType(t);
                                                                setAddrErrors(prev => ({ ...prev, customType: '' }));
                                                            }}
                                                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize border transition-all duration-300 cursor-pointer ${
                                                                addressType === t 
                                                                    ? 'bg-red-600/10 border-red-500 text-red-500' 
                                                                    : 'bg-zinc-900/50 border-zinc-900 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-850'
                                                            }`}
                                                        >
                                                            {t === 'casa' ? '🏠 Casa' : t === 'trabalho' ? '💼 Trabalho' : '📍 Outro'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {addressType === 'outro' && (
                                                    <div className="animate-fade-in pt-1.5">
                                                        <label className="block text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-2">Qual o tipo? (ex: Sítio, Praia, Apartamento da Mãe)</label>
                                                        <input
                                                            type="text"
                                                            value={customAddressType}
                                                            placeholder="ex: Praia"
                                                            onChange={(e) => {
                                                                setCustomAddressType(e.target.value);
                                                                setAddrErrors(prev => ({ ...prev, customType: '' }));
                                                            }}
                                                            className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.customType ? 'border-red-650' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition`}
                                                        />
                                                        {addrErrors.customType && (
                                                            <span className="text-red-500 text-[10px] mt-1.5 block font-semibold animate-fade-in">{addrErrors.customType}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">CEP</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            value={cep}
                                                            onChange={handleCepLookup}
                                                            placeholder="00000-00"
                                                            className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.cep ? 'border-red-650 focus:border-red-500' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition duration-300`}
                                                        />
                                                        {loadingCep && (
                                                            <div className="absolute right-3.5 top-3.5 h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                        )}
                                                    </div>
                                                    {addrErrors.cep && (
                                                        <span className="text-red-500 text-[11px] mt-1.5 block font-semibold tracking-wide animate-fade-in">{addrErrors.cep}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Bairro</label>
                                                    <input 
                                                        type="text" 
                                                        value={neighborhood}
                                                        placeholder="ex: Centro"
                                                        onChange={e => {
                                                            setNeighborhood(e.target.value);
                                                            setAddrErrors(prev => ({ ...prev, neighborhood: '' }));
                                                        }}
                                                        className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.neighborhood ? 'border-red-650 focus:border-red-500' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition duration-300`}
                                                    />
                                                    {addrErrors.neighborhood && (
                                                        <span className="text-red-500 text-[11px] mt-1.5 block font-semibold tracking-wide animate-fade-in">{addrErrors.neighborhood}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Rua / Logradouro</label>
                                                <input 
                                                    type="text" 
                                                    value={street}
                                                    placeholder="ex: Avenida Paulista"
                                                    onChange={e => {
                                                        setStreet(e.target.value);
                                                        setAddrErrors(prev => ({ ...prev, street: '' }));
                                                    }}
                                                    className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.street ? 'border-red-650 focus:border-red-500' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition duration-300`}
                                                />
                                                {addrErrors.street && (
                                                    <span className="text-red-500 text-[11px] mt-1.5 block font-semibold tracking-wide animate-fade-in">{addrErrors.street}</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Número</label>
                                                    <input 
                                                        type="text" 
                                                        value={number}
                                                        placeholder="ex: 123"
                                                        onChange={e => {
                                                            setNumber(e.target.value);
                                                            setAddrErrors(prev => ({ ...prev, number: '' }));
                                                        }}
                                                        className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.number ? 'border-red-650 focus:border-red-500' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition duration-300`}
                                                    />
                                                    {addrErrors.number && (
                                                        <span className="text-red-500 text-[11px] mt-1.5 block font-semibold tracking-wide animate-fade-in">{addrErrors.number}</span>
                                                    )}
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Complemento</label>
                                                    <input 
                                                        type="text" 
                                                        value={complement}
                                                        placeholder="ex: Apto 42, Bloco B"
                                                        onChange={e => {
                                                            setComplement(e.target.value);
                                                            setAddrErrors(prev => ({ ...prev, complement: '' }));
                                                        }}
                                                        className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.complement ? 'border-red-650 focus:border-red-500' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition duration-300`}
                                                    />
                                                    {addrErrors.complement && (
                                                        <span className="text-red-500 text-[11px] mt-1.5 block font-semibold tracking-wide animate-fade-in">{addrErrors.complement}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Cidade</label>
                                                    <input 
                                                        type="text" 
                                                        value={city}
                                                        placeholder="ex: São Paulo"
                                                        onChange={e => {
                                                            setCity(e.target.value);
                                                            setAddrErrors(prev => ({ ...prev, city: '' }));
                                                        }}
                                                        className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.city ? 'border-red-650 focus:border-red-500' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition duration-300`}
                                                    />
                                                    {addrErrors.city && (
                                                        <span className="text-red-500 text-[11px] mt-1.5 block font-semibold tracking-wide animate-fade-in">{addrErrors.city}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Estado (UF)</label>
                                                    <input 
                                                        type="text" 
                                                        maxLength={2}
                                                        value={state}
                                                        placeholder="ex: SP"
                                                        onChange={e => {
                                                            setState(e.target.value);
                                                            setAddrErrors(prev => ({ ...prev, state: '' }));
                                                        }}
                                                        className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.state ? 'border-red-650 focus:border-red-500' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition duration-300 uppercase`}
                                                    />
                                                    {addrErrors.state && (
                                                        <span className="text-red-500 text-[11px] mt-1.5 block font-semibold tracking-wide animate-fade-in">{addrErrors.state}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Ponto de Referência</label>
                                                <input 
                                                    type="text" 
                                                    value={reference}
                                                    placeholder="ex: Próximo ao supermercado, portão marrom"
                                                    onChange={e => {
                                                        setReference(e.target.value);
                                                        setAddrErrors(prev => ({ ...prev, reference: '' }));
                                                    }}
                                                    className={`w-full px-4 py-3 bg-zinc-900/50 border ${addrErrors.reference ? 'border-red-650 focus:border-red-500' : 'border-zinc-800 focus:border-red-500 focus:ring-red-500'} rounded-xl text-sm text-white focus:outline-none focus:ring-1 transition duration-300`}
                                                />
                                                {addrErrors.reference && (
                                                    <span className="text-red-500 text-[11px] mt-1.5 block font-semibold tracking-wide animate-fade-in">{addrErrors.reference}</span>
                                                )}
                                            </div>

                                            {/* Checkbox Principal */}
                                            {addresses.length > 0 && (
                                                <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isDefault}
                                                        onChange={(e) => setIsDefault(e.target.checked)}
                                                        className="rounded bg-zinc-90 w-4 h-4 border-zinc-850 text-red-600 focus:ring-red-500"
                                                    />
                                                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Definir este endereço como Principal</span>
                                                </label>
                                            )}

                                            <button 
                                                type="submit" 
                                                disabled={addressLoading || loadingLocation || loadingCep}
                                                className="w-full mt-6 py-3.5 bg-red-600 hover:bg-red-700 hover:scale-[1.005] active:scale-[0.985] text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                            >
                                                {addressLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Endereço'}
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Seção Favoritos */}
                        {activeSection === 'favoritos' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                        <Heart className="h-5 w-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Seus Favoritos</h2>
                                        <p className="text-zinc-500 text-xs">Lista de produtos que você selecionou como desejos secretos.</p>
                                    </div>
                                </div>

                                {/* Resiliência de favoritos - exibe vazia estilizada */}
                                <div className="py-16 text-center text-zinc-500 flex flex-col items-center">
                                    <Heart className="h-12 w-12 text-zinc-850 mb-4" />
                                    <span className="text-sm font-bold text-zinc-400 mb-1">Nenhum produto favorito ainda</span>
                                    <span className="text-xs text-zinc-500 max-w-xs mb-6">Navegue pelas nossas categorias luxo e clique no ícone de coração para registrar o produto.</span>
                                    <Link to="/catalogo" className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl tracking-wider transition-all">
                                        Explorar Boutique
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Seção Fidelidade */}
                        {activeSection === 'fidelidade' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                        <Star className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Fidelidade Discreta</h2>
                                        <p className="text-zinc-500 text-xs">Acumule pontos em cada compra e troque por presentes ou cupons exclusivos.</p>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 shadow-2xl relative overflow-hidden select-none">
                                    <div className="absolute top-1/2 -right-10 w-44 h-44 bg-red-500/5 blur-[50px] rounded-full pointer-events-none" />
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block mb-1">Clube de Fidelidade</span>
                                            <h3 className="text-xl font-black text-white">DISCRETA BOUTIQUE</h3>
                                        </div>
                                        <span className={`text-[10px] font-black tracking-wider uppercase px-3 py-1 rounded-md border ${tier.border} ${tier.color}`}>
                                            {tier.name}
                                        </span>
                                    </div>

                                    <div className="mt-8 flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">Membro Associado</p>
                                            <p className="text-sm font-bold text-white select-all">{profile?.fullName?.toUpperCase() || 'Membro Secreto'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-0.5">Saldo de Pontos</p>
                                            <p className="text-2xl font-black text-red-500 tracking-tight">{calculatedPoints} <span className="text-xs text-zinc-400 font-bold">pts</span></p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900/60 text-xs text-zinc-400 space-y-2 leading-relaxed">
                                    <div className="flex items-center gap-2 mb-2 text-white font-bold">
                                        <Check className="h-4 w-4 text-red-500" />
                                        <span>Como funciona?</span>
                                    </div>
                                    <p>• R$ 1,00 gasto em compras entregues e confirmadas garante 1 ponto no clube.</p>
                                    <p>• Ao acumular 200 pontos você desbloqueia o nível **Silver Member**.</p>
                                    <p>• Ao acumular 500 pontos você conquista o nível **Gold Member** com direito a um presente secreto oficial.</p>
                                    <p>• Compras seguras, discretas e pontuadas automaticamente.</p>
                                </div>
                            </div>
                        )}

                        {/* Seção Minhas Avaliações */}
                        {activeSection === 'avaliacoes' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                        <Award className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Minhas Avaliações</h2>
                                        <p className="text-zinc-500 text-xs">Sua opinião é secreta e preservada. Compartilhe sua experiência conosco.</p>
                                    </div>
                                </div>

                                {success && (
                                    <div className="p-3.5 bg-green-950/35 border border-green-900/40 text-green-400 rounded-xl text-xs font-semibold">
                                        {success}
                                    </div>
                                )}
                                {error && (
                                    <div className="p-3.5 bg-red-950/40 border border-red-900/50 text-red-400 rounded-xl text-xs font-semibold">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSendReview} className="space-y-4">
                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Sua Nota (1 a 5 Estrelas)</label>
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    type="button"
                                                    key={star}
                                                    onClick={() => setReviewRating(star)}
                                                    className="p-1 text-zinc-500 hover:text-red-500 transition"
                                                >
                                                    <Star className={`h-6 w-6 cursor-pointer ${star <= reviewRating ? 'fill-red-500 text-red-500' : 'text-zinc-700'}`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Comentários / Sugestões</label>
                                        <textarea
                                            value={reviewMessage}
                                            rows={4}
                                            onChange={e => setReviewMessage(e.target.value)}
                                            placeholder="Compartilhe como foi seu atendimento, sua entrega sigilosa ou o que você mais gostou nos produtos..."
                                            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300 placeholder-zinc-650 resize-none"
                                        />
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={reviewLoading}
                                        className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {reviewLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>Enviar Avaliação</span>}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Seção Notificações */}
                        {activeSection === 'notificacoes' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                        <Bell className="h-5 w-5 animate-bounce" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Notificações</h2>
                                        <p className="text-zinc-500 text-xs">Comunicados importantes e ofertas privadas da nossa Boutique.</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="p-4 rounded-2xl bg-zinc-900/20 border border-zinc-900 flex items-start gap-3.5">
                                        <CheckCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-sm text-white">Seja bem-vinda(o) à Boutique Secreta!</h3>
                                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Seu cadastro está devidamente protegido com criptografia de ponta a ponta. Divirta-se explorando nosso catálogo de forma 100% privada.</p>
                                            <span className="text-[10px] text-zinc-600 font-bold block mt-2">Hoje</span>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-2xl bg-zinc-900/20 border border-zinc-900 flex items-start gap-3.5">
                                        <Clock className="h-5 w-5 text-zinc-500 mt-0.5 shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-sm text-white">Entrega Seguro e Sigilo Máximo</h3>
                                            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">Lembramos que todas as nossas caixas de remessa de mercadorias são totalmente lisas e discretas (sem nenhuma logomarca ou referência sex-shop), garantindo total privacidade em seu endereço comercial ou residencial.</p>
                                            <span className="text-[10px] text-zinc-600 font-bold block mt-2">1 dia atrás</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Seção Suporte */}
                        {activeSection === 'suporte' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                        <Headphones className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Suporte Especializado</h2>
                                        <p className="text-zinc-500 text-xs">Nossa equipe está pronta para atendê-la(o) com sigilo de dados absoluto e presteza.</p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-zinc-900/30 border border-zinc-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <h3 className="font-bold text-sm text-white">Falar Diretamente pelo WhatsApp</h3>
                                        <p className="text-xs text-zinc-400 mt-1">Clique para iniciar um canal sigiloso com nossa consultora.</p>
                                    </div>
                                    <a 
                                        href={'https://wa.me/5588992340317?text=Olá, preciso de suporte discreto com minha conta/pedido.'} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition duration-300 cursor-pointer flex items-center gap-1 shrink-0"
                                    >
                                        <Send className="h-3.5 w-3.5" /> Abrir WhatsApp support
                                    </a>
                                </div>

                                <hr className="border-zinc-900" />

                                {success && (
                                    <div className="p-3.5 bg-green-950/35 border border-green-900/40 text-green-400 rounded-xl text-xs font-semibold">
                                        {success}
                                    </div>
                                )}
                                {error && (
                                    <div className="p-3.5 bg-red-950/40 border border-red-900/50 text-red-400 rounded-xl text-xs font-semibold">
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleSendSupport} className="space-y-4">
                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Assunto / Tópico</label>
                                        <input 
                                            type="text" 
                                            value={supportSubject}
                                            onChange={e => setSupportSubject(e.target.value)}
                                            placeholder="Ex: Dúvida sobre embalagem discreta"
                                            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300 placeholder-zinc-650"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Mensagem Detalhada Opcional</label>
                                        <textarea
                                            value={supportMessage}
                                            rows={5}
                                            onChange={e => setSupportMessage(e.target.value)}
                                            placeholder="Escreva sua solicitação com riqueza de detalhes..."
                                            className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300 placeholder-zinc-650 resize-none"
                                        />
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={supportLoading}
                                        className="py-3 px-6 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {supportLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>Enviar Mensagem</span>}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Seção Alterar Senha */}
                        {activeSection === 'senha' && (
                            <div className="rounded-3xl bg-zinc-950/80 border border-zinc-900 p-6 sm:p-8 shadow-xl animate-fade-in">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="p-2 bg-red-950/30 text-red-500 rounded-xl">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Alterar Senha de Segurança</h2>
                                        <p className="text-zinc-500 text-xs">Garanta a integridade e privacidade de sua conta.</p>
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-6 flex items-start gap-3 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl text-red-500 text-xs font-semibold leading-relaxed">
                                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                        <span>{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="mb-6 flex items-start gap-3 p-3.5 bg-green-950/35 border border-green-900/45 rounded-xl text-green-400 text-xs font-semibold">
                                        <CheckCircle className="h-5 w-5 shrink-0" />
                                        <span>{success}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSavePassword} className="space-y-4">
                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Nova Senha</label>
                                        <div className="relative">
                                            <input 
                                                type={showNewPassword ? "text" : "password"}
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                placeholder="Mínimo de 6 algarismos"
                                                className="w-full pl-4 pr-11 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300 placeholder-zinc-650"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300 transition"
                                            >
                                                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Confirme a Nova Senha</label>
                                        <div className="relative">
                                            <input 
                                                type={showConfirmNewPassword ? "text" : "password"}
                                                value={confirmNewPassword}
                                                onChange={e => setConfirmNewPassword(e.target.value)}
                                                placeholder="Confirme sua nova senha"
                                                className="w-full pl-4 pr-11 py-3 bg-zinc-900/50 border border-zinc-800 focus:border-red-500 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 transition duration-300 placeholder-zinc-650"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                                                className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300 transition"
                                            >
                                                {showConfirmNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={passwordLoading}
                                        className="w-full mt-6 py-3.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 font-sans"
                                    >
                                        {passwordLoading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar Nova Senha'}
                                    </button>
                                </form>
                            </div>
                        )}

                    </div>
                </div>

            </div>
        </div>
    );
};
