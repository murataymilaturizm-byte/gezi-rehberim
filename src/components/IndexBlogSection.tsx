import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { getAllPosts } from "@/lib/blog";
import { BlogCoverImage } from "@/components/BlogCoverImage";

export function IndexBlogSection() {
  let posts: ReturnType<typeof getAllPosts> = [];
  try {
    posts = getAllPosts().slice(0, 3);
  } catch {
    return null;
  }

  if (posts.length === 0) return null;

  return (
    <section id="blog" className="py-20 bg-card/30">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Sektörel İçerikler</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Seyahat acentesi yönetimi hakkında değerli rehberler ve ipuçları.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Card key={post.slug} className="border-border/50 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <BlogCoverImage
                title={post.title}
                category={post.category}
                image={post.image}
                size="card"
              />
              <CardContent className="p-5">
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.date
                      ? new Date(post.date).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readingTime} dk
                  </span>
                </div>
                <h3 className="font-semibold text-foreground mb-2 line-clamp-2 leading-snug">
                  {post.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{post.description}</p>
                <Link
                  to={`/blog/${post.slug}`}
                  className="text-sm text-orange-500 hover:underline font-medium inline-flex items-center gap-1"
                >
                  Devamını oku <ArrowRight className="w-3 h-3" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button asChild variant="outline" size="lg">
            <Link to="/blog">Tüm Yazılar <ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
