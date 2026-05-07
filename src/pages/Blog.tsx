import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Tag } from "lucide-react";
import { getAllPosts, getAllCategories, type BlogPost } from "@/lib/blog";
import { BlogCoverImage } from "@/components/BlogCoverImage";

const schema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "name": "Turzz AI Blog",
  "description": "Seyahat acenteleri için WhatsApp chatbot, AI turizm teknolojisi ve dijital dönüşüm rehberleri.",
  "url": "https://turzzai.com/blog",
  "publisher": { "@type": "Organization", "name": "Turzz AI" },
};

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Card className="border-border/50 hover:border-orange-300 transition-all hover:-translate-y-0.5 overflow-hidden">
      <BlogCoverImage
        title={post.title}
        category={post.category}
        image={post.image}
        size="card"
      />
      <CardContent className="p-5">
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(post.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {post.readingTime} dk okuma
          </span>
        </div>
        <h2 className="font-semibold text-foreground mb-2 line-clamp-2 leading-snug">
          {post.title}
        </h2>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{post.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1 flex-wrap">
            {post.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Tag className="w-2.5 h-2.5" />{tag}
              </span>
            ))}
          </div>
          <Link to={`/blog/${post.slug}`} className="text-sm text-orange-500 hover:underline font-medium">
            Oku →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Blog() {
  let allPosts: BlogPost[] = [];
  try {
    allPosts = getAllPosts();
  } catch (err) {
    console.error("Blog posts yüklenemedi:", err);
  }

  const categories = ["Tümü", ...getAllCategories()];
  const [activeCategory, setActiveCategory] = useState("Tümü");

  const filtered = activeCategory === "Tümü"
    ? allPosts
    : allPosts.filter((p) => p.category === activeCategory);

  return (
    <Layout>
      <SEOHead
        title="Blog — WhatsApp Chatbot ve Turizm Teknolojisi Rehberleri"
        description="Seyahat acenteleri için WhatsApp chatbot rehberleri, AI turizm teknolojisi, dijital dönüşüm ipuçları. Turzz AI Blog."
        keywords="whatsapp chatbot blog, turizm teknolojisi, seyahat acentesi dijital dönüşüm, tur yazılımı rehber"
        canonical="/blog"
        schema={schema}
      />

      <section className="py-12 bg-gradient-to-b from-orange-50/30 to-background dark:from-orange-950/10">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Turzz AI Blog</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Seyahat acenteleri için WhatsApp chatbot, AI teknolojisi ve dijital dönüşüm rehberleri.
          </p>
        </div>
      </section>

      <section className="py-8 container mx-auto px-4 max-w-5xl">
        {/* Kategori filtresi */}
        <div className="flex gap-2 flex-wrap mb-8">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className={activeCategory === cat ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            >
              {cat}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Bu kategoride henüz yazı yok.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="py-12 bg-muted/30 text-center">
        <div className="container mx-auto px-4">
          <p className="text-muted-foreground mb-4">Turzz AI'ı denediniz mi?</p>
          <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
            <Link to="/auth?mode=signup">14 Gün Ücretsiz Başla</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
