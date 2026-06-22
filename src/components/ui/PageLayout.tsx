import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const PageLayout = ({ title, children }: { title: string, children: React.ReactNode }) => {
    const navigate = useNavigate();
    return (
        <div className="bg-white min-h-screen p-6">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-6 text-slate-600">
                <ArrowLeft size={20} /> Voltar
            </button>
            <h1 className="text-2xl font-bold mb-6 text-slate-900">{title}</h1>
            {children}
        </div>
    );
};
