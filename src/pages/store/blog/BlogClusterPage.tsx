import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTheme } from "../../../contexts/ThemeContext";
import { blogService, BlogPost } from "../../../services/blogService";
import { productService, Product } from "../../../services/productService";
import { ArrowLeft, Sparkles, ShoppingBag } from "lucide-react";

export function BlogClusterPage() {
  const { clusterSlug } = useParams<{ clusterSlug: string }>();
  const { currentTheme } = useTheme();
  
  const [cluster, setCluster] = useState<any>(null);
  const [pillar, setPillar] = useState<BlogPost | null>(null);
  const [secondaryPosts, setSecondaryPosts] = useState<BlogPost[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!clusterSlug) return;
      setLoading(true);
      try {
        const clusterData = await blogService.getClusterBySlug(clusterSlug);
        if (clusterData) {
          setCluster(clusterData);
          
          const allPosts = await blogService.listPosts(true) || [];
          
          if (clusterData.pillarPostId) {
            setPillar(allPosts.find(p => p.id === clusterData.pillarPostId) || null);
          }
          
          if (clusterData.clusterPostIds) {
            setSecondaryPosts(allPosts.filter(p => clusterData.clusterPostIds.includes(p.id!)));
          }

          if (clusterData.relatedProductIds) {
            const allProducts = await productService.listProducts();
            setRelatedProducts(allProducts.filter(p => clusterData.relatedProductIds.includes(p.id!)));
          }
        }
      } catch (err) {
        console.error("Erro ao carregar cluster:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [clusterSlug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!cluster || cluster.status !== 'active') return <div className="min-h-screen flex items-center justify-center">Cluster não encontrado.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12" style={{ backgroundColor: currentTheme.backgroundColor }}>
      <Link to="/blog" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:opacity-80">
        <ArrowLeft size={14} /> Voltar para o Blog
      </Link>

      <header className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tight">{cluster.title}</h1>
        <p className="text-lg opacity-80">{cluster.description}</p>
      </header>

      {pillar && (
        <section className="p-8 border rounded-3xl space-y-4 bg-purple-950/10">
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-500 flex items-center gap-2">
            <Sparkles size={12} /> Artigo Pilar (Guia Completo)
          </span>
          <h2 className="text-2xl font-bold">{pillar.title}</h2>
          <Link to={`/blog/${pillar.seo?.slug}`} className="text-sm font-bold underline">Ler Guia Completo</Link>
        </section>
      )}

      {secondaryPosts.length > 0 && (
        <section className="space-y-6">
          <h3 className="text-xl font-black uppercase tracking-widest">Artigos do Guia</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {secondaryPosts.map(post => (
              <Link key={post.id} to={`/blog/${post.seo?.slug}`} className="p-6 border rounded-2xl hover:bg-zinc-900/50 transition-all">
                <h4 className="font-bold">{post.title}</h4>
              </Link>
            ))}
          </div>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="space-y-6">
          <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
            <ShoppingBag /> Produtos Relacionados
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map(prod => (
              <Link key={prod.id} to={`/produto/${prod.seo?.slug || prod.id}`} className="border rounded-xl p-4 text-center">
                <img src={prod.images?.[0]?.url} alt={prod.name} className="w-full aspect-square object-cover mb-2" />
                <h5 className="text-xs font-black uppercase">{prod.name}</h5>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
