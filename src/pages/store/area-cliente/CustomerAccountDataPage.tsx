import { PageLayout } from '../../../components/ui/PageLayout';
import { useSearchParams } from 'react-router-dom';

export const CustomerAccountDataPage = () => {
    const [searchParams] = useSearchParams();
    const returnTo = searchParams.get('returnTo');

    return (
        <PageLayout title="Dados da Conta">
            {returnTo && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-200 mb-6 text-red-800 text-sm">
                    Complete estes dados para continuar seu pagamento online.
                </div>
            )}
            <div className="text-slate-600">
                <p>Nome: Felipe Denis</p>
                <p>E-mail: usuario@exemplo.com</p>
                <p>CPF: 123.456.789-00</p>
                <p className="mt-4">Status: Cadastro completo</p>
            </div>
        </PageLayout>
    );
};
