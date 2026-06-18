
import { BarChart, Search, Link as LinkIcon, AlertTriangle, Activity, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export function AdminBlogIntelligence() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <h1 className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-2 text-white">
        <Activity className="text-purple-500" />
        Inteligência SEO
      </h1>
      <p className="text-zinc-400">Hub central de inteligência SEO.</p>
      
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { name: "Palavras-Chave", icon: Search, path: "/admin/blog/palavras-chave" },
          { name: "Canibalização", icon: AlertTriangle, path: "/admin/blog/canibalizacao" },
          { name: "Conteúdo Órfão", icon: FileText, path: "/admin/blog/conteudo-orfao" },
          { name: "Links Internos", icon: LinkIcon, path: "/admin/blog/links-internos" },
        ].map((item) => (
          <Link key={item.name} to={item.path} className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-purple-500">
            <item.icon className="text-purple-400 mb-4" />
            <span className="font-bold">{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
