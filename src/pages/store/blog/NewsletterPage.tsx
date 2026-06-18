
import { useState } from "react";
import { newsletterService } from "../../../services/newsletterService";

export function NewsletterPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await newsletterService.subscribe({ name, email, status: 'pending', createdAt: '', tags: [] });
    alert("Inscrição realizada! Verifique seu email.");
  };

  return (
    <div className="p-10 max-w-xl mx-auto text-center space-y-6">
      <h1 className="text-4xl font-black italic">Assine nossa Newsletter</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Seu nome" onChange={e => setName(e.target.value)} className="w-full p-4 bg-zinc-900 rounded-xl" />
        <input type="email" placeholder="Seu melhor email" onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-zinc-900 rounded-xl" />
        <button className="w-full p-4 bg-white text-black font-black rounded-xl">Inscrever-se</button>
      </form>
    </div>
  );
}
