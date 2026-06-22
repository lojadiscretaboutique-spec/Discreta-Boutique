import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const CadastroPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    
    const navigate = useNavigate();

    const handleCadastro = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const auth = getAuth();
            const result = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'users', result.user.uid), {
                uid: result.user.uid,
                fullName,
                email,
                whatsapp,
                whatsappVerified: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            navigate('/area-cliente');
        } catch (err) {
            alert("Erro: " + err);
        }
    };
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Cadastro</h1>
            <form onSubmit={handleCadastro}>
                <input placeholder="Nome Completo" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-3 border rounded mb-4" required/>
                <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded mb-4" required/>
                <input placeholder="WhatsApp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full p-3 border rounded mb-4" required/>
                <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border rounded mb-4" required/>
                <button type="submit" className="w-full p-3 bg-red-600 text-white rounded font-bold">Criar Conta</button>
            </form>
        </div>
    );
};
