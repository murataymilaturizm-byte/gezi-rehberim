import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { tr, enUS, de, ru, ar, fr, es } from "date-fns/locale";
import { getAllPosts } from "@/lib/blog";

const DATE_LOCALE_MAP = { tr, en: enUS, de, ru, ar, fr, es };

export function IndexBlogSection() {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALE_MAP[i18n.language as keyof typeof DATE_LOCALE_MAP] || tr;

  let posts: ReturnType<typeof getAllPosts> = [];
  try {
    posts = getAllPosts(i18n.language).slice(0, 3);
  } catch {
    return null;
  }

  if (posts.length === 0) return null;

  return (
    <section id="blog" className="py-14 bg-card/30">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8"
        >
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {t("indexBlog.title")}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {t("indexBlog.subtitle")}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="self-start sm:self-auto">
            <Link to="/blog">
              {t("indexBlog.allPosts")} <ArrowRight className="w-4 h-4 ms-1 rtl:rotate-180" />
            </Link>
          </Button>
        </motion.div>

        <ul className="divide-y divide-border/60 border-y border-border/60">
          {posts.map((post, idx) => (
            <motion.li
              key={post.slug}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: idx * 0.06, ease: "easeOut" }}
            >
              <Link
                to={`/blog/${post.slug}`}
                className="group flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-4 hover:bg-accent/30 -mx-2 px-2 rounded-md transition-colors"
              >
                <h3 className="flex-1 text-sm sm:text-base font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {post.title}
                </h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.date ? format(new Date(post.date), "d MMM yyyy", { locale: dateLocale }) : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.readingTime} {t("indexBlog.minutes")}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180" />
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
