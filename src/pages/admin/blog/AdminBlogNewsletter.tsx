
import { Mail, Users, Send, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export function AdminBlogNewsletter() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <h1 className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-2 text-white">
        <Mail className="text-blue-500" />
        Newsletter & Automações
      </h1>
      
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { name: "Inscritos", icon: Users, path: "/admin/blog/newsletter/inscritos" },
          { name: "Campanhas", icon: Send, path: "/admin/blog/newsletter/campanhas" },
          { name: "Configurações", icon: Settings, path: "/admin/blog/newsletter/configuracoes" },
        ].map((item) => (
          <Link key={item.name} to={item.path} className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-blue-500">
            <item.icon className="text-blue-400 mb-4" />
            <span className="font-bold">{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
