import { PageLayout } from '../../../components/ui/PageLayout';
export const CustomerAccountDataPage = () => (
    <PageLayout title="Dados da Conta">
        <div className="text-slate-600">
            <p>Nome: Felipe Denis</p>
            <p>E-mail: usuario@exemplo.com</p>
            <p>CPF: 123.456.789-00</p>
            <p className="mt-4">Status: Cadastro completo</p>
        </div>
    </PageLayout>
);
