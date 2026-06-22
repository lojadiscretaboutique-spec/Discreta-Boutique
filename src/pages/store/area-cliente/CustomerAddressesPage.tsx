import { PageLayout } from '../../../components/ui/PageLayout';
export const CustomerAddressesPage = () => (
    <PageLayout title="Meus Endereços">
        <p className="text-slate-500 mb-4">Nenhum endereço cadastrado.</p>
        <button className="bg-red-600 text-white px-4 py-2 rounded">Adicionar endereço</button>
    </PageLayout>
);
