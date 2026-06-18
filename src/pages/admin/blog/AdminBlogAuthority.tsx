
import { FileText } from "lucide-react";

export function AdminBlogAuthority() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <h1 className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-2 text-white">
        <FileText className="text-red-500" />
        Autoridade SEO
      </h1>
      <p className="text-zinc-400">Dashboard de autoridade em construção.</p>
    </div>
  );
}
