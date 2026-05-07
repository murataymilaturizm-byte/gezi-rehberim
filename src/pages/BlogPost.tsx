import { useParams, Link, Navigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowLeft, Share2, Tag } from "lucide-react";
import { getPostBySlug, getAllPosts, type BlogPost } from "@/lib/blog";
import { BlogCoverImage } from "@/components/BlogCoverImage";

function RelatedPosts({ current }: { current: BlogPost }) {
  const related = getAllPosts()
    .filter((p) => p.slug !== current.slug && p.category === current.category)
    .slice(0, 3);
  if (related.length === 0) return null;
  return (
    <aside>
      <h3 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-wider">İlgili Yazılar</h3>
      <ul className="space-y-3">
        {related.map((p) => (
          <li key={p.slug}>
            <Link to={`/blog/${p.slug}`} className="block group">
              <p className="text-sm font-medium text-foreground group-hover:text-orange-500 transition-colors line-clamp-2">{p.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{p.readingTime} dk okuma</p>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/blog" replace />;

  const post = getPostBySlug(slug);
  if (!post) return <Navigate to="/blog" replace />;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.description,
    "image": `https://turzzai.com${post.image}`,
    "author": { "@type": "Organization", "name": post.author },
    "publisher": { "@type": "Organization", "name": "Turzz AI", "url": "https://turzzai.com" },
    "datePublished": post.date,
    "keywords": post.tags.join(", "),
  };

  const shareUrl = `https://turzzai.com/blog/${post.slug}`;

  return (
    <Layout>
      <SEOHead
        title={post.title}
        description={post.description}
        keywords={post.tags.join(", ")}
        ogImage={`https://turzzai.com${post.image}`}
        canonical={`/blog/${post.slug}`}
        schema={schema}
        type="article"
      />

      <div className="container mx-auto px-4 max-w-6xl py-8">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-orange-500 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Blog'a Dön
        </Link>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main content */}
          <article className="flex-1 min-w-0">
            {/* Header */}
            <header className="mb-8">
              <Badge className="mb-3 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-0">
                {post.category}
              </Badge>
              <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight mb-4">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(post.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {post.readingTime} dakika okuma
                </span>
                <span>{post.author}</span>
              </div>
            </header>

            {/* Cover image — kendi aspect-ratio wrapper'ı var */}
            <BlogCoverImage
              title={post.title}
              category={post.category}
              image={post.image}
              size="hero"
              className="mb-8"
            />

            {/* Markdown Content */}
            <div className="prose prose-lg prose-slate dark:prose-invert max-w-none
              prose-h1:text-3xl prose-h1:font-bold prose-h1:text-foreground
              prose-h2:text-2xl prose-h2:font-bold prose-h2:text-foreground prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:font-semibold prose-h3:text-foreground
              prose-p:text-foreground/80 prose-p:leading-relaxed
              prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
              prose-strong:text-foreground prose-strong:font-semibold
              prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
              prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
              prose-blockquote:border-l-4 prose-blockquote:border-orange-400 prose-blockquote:text-muted-foreground prose-blockquote:italic
              prose-ul:list-disc prose-ol:list-decimal
              prose-li:text-foreground/80
              prose-img:rounded-lg prose-img:w-full
              prose-hr:border-border">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {post.content}
              </ReactMarkdown>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
              {post.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                  <Tag className="w-3 h-3" />{tag}
                </span>
              ))}
            </div>

            {/* Paylaş */}
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.share?.({ title: post.title, url: shareUrl }) || window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`, "_blank")}
              >
                <Share2 className="w-4 h-4 mr-1" /> Paylaş
              </Button>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="lg:w-72 space-y-8">
            <RelatedPosts current={post} />

            {/* CTA */}
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-2 text-sm">Turzz AI'ı Denediniz mi?</h3>
              <p className="text-xs text-muted-foreground mb-4">
                14 gün ücretsiz, kredi kartı gerekmez.
              </p>
              <Button asChild size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                <Link to="/auth?mode=signup">Ücretsiz Başla</Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
