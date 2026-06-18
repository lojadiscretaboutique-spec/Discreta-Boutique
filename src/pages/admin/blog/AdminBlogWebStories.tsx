
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, BarChart, Settings, LayoutGrid } from "lucide-react";
import { webStoryService } from "../../../services/webStoryService";

export function AdminBlogWebStories() {
  const [stories, setStories] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadStories() {
      const data = await webStoryService.listStories();
      setStories(data);
    }
    loadStories();
  }, []);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-2 text-white">
          <LayoutGrid className="text-pink-500" />
          Web Stories
        </h1>
        <div className="flex gap-4">
          <Link to="/admin/blog/web-stories/estatisticas" className="flex items-center gap-2 p-2 px-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800">
            <BarChart size={16} /> Estatísticas
          </Link>
          <Link to="/admin/blog/web-stories/novo" className="flex items-center gap-2 p-2 px-4 bg-pink-600 rounded-xl hover:bg-pink-700 font-bold">
            <Plus size={16} /> Novo Story
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {stories.map(story => (
          <div key={story.id} className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
            <img src={story.coverImage} alt={story.title} className="w-full h-40 object-cover rounded-xl" />
            <h3 className="font-bold text-lg">{story.title}</h3>
            <p className="text-zinc-400 text-sm">{story.status}</p>
            <div className="flex gap-2">
              <Link to={`/admin/blog/web-stories/editar/${story.id}`} className="text-xs p-2 bg-zinc-800 rounded-md">Editar</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
