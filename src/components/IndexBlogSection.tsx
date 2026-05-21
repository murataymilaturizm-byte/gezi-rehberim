import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { getAllPosts } from "@/lib/blog";
import { BlogCoverImage } from "@/components/BlogCoverImage";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

export function IndexBlogSection() {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

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
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t("indexBlog.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("indexBlog.subtitle")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {posts.map((post, idx) => (
            <motion.div
              key={post.slug}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: idx * 0.1, ease: "easeOut" }}
              whileHover={{ y: -4 }}
            >
              <Card className="border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300 h-full">
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
                      {post.date ? format(new Date(post.date), "d MMMM yyyy", { locale: dateLocale }) : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.readingTime} {t("indexBlog.minutes")}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-2 leading-snug">
                    {post.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{post.description}</p>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
                  >
                    {t("indexBlog.readMore")} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button asChild variant="outline" size="lg">
            <Link to="/blog">
              {t("indexBlog.allPosts")} <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
