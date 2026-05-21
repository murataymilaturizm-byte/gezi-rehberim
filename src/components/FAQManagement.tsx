import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit, MessageSquare, TrendingUp } from "lucide-react";

interface FAQTemplate {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  language: string;
  is_active: boolean;
  category: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
  agency_id: string;
  is_template?: boolean;
}

export default function FAQManagement() {
  const { t, i18n } = useTranslation();
  const [faqs, setFaqs] = useState<FAQTemplate[]>([]);
  const [filteredFaqs, setFilteredFaqs] = useState<FAQTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQTemplate | null>(null);
  const [translating, setTranslating] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  // Form states
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [language, setLanguage] = useState(i18n.language);
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadAgencyAndFaqs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [faqs, searchQuery, filterLanguage, filterCategory, filterStatus, sortBy, sortOrder]);

  const loadAgencyAndFaqs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (agency) {
        setAgencyId(agency.id);
        await loadFaqs(agency.id);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const loadFaqs = async (agencyId: string) => {
    // Load agency FAQs (all languages)
    const { data: agencyFaqs, error: agencyError } = await supabase
      .from("faq_templates")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });

    // Load template FAQs filtered by current language
    const { data: templateFaqs, error: templateError } = await supabase
      .from("faq_templates")
      .select("*")
      .eq("agency_id", "00000000-0000-0000-0000-000000000000")
      .eq("language", i18n.language)
      .order("created_at", { ascending: false });

    if (agencyError || templateError) {
      console.error("Error loading FAQs:", agencyError || templateError);
      toast.error(t("common.error"));
      return;
    }

    // Mark templates and combine
    const marked = (templateFaqs || []).map(faq => ({ ...faq, is_template: true }));
    setFaqs([...(agencyFaqs || []), ...marked]);
  };

  const applyFilters = () => {
    let filtered = [...faqs];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(faq => 
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.keywords.some(k => k.toLowerCase().includes(query)) ||
        (faq.category && faq.category.toLowerCase().includes(query))
      );
    }

    // Language filter
    if (filterLanguage !== "all") {
      filtered = filtered.filter(faq => faq.language === filterLanguage);
    }

    // Category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter(faq => faq.category === filterCategory);
    }

    // Status filter
    if (filterStatus === "active") {
      filtered = filtered.filter(faq => faq.is_active);
    } else if (filterStatus === "inactive") {
      filtered = filtered.filter(faq => !faq.is_active);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof FAQTemplate];
      let bValue: any = b[sortBy as keyof FAQTemplate];

      if (sortBy === "usage_count") {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }

      if (sortBy === "created_at" || sortBy === "updated_at") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredFaqs(filtered);
  };

  const getUniqueCategories = (): string[] => {
    const categories = faqs
      .map(faq => faq.category)
      .filter((cat): cat is string => cat !== null && cat !== "");
    return Array.from(new Set(categories)).sort();
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterLanguage("all");
    setFilterCategory("all");
    setFilterStatus("all");
    setSortBy("created_at");
    setSortOrder("desc");
  };

  const resetForm = () => {
    setQuestion("");
    setAnswer("");
    setKeywords("");
    setLanguage(i18n.language);
    setCategory("");
    setIsActive(true);
    setEditingFaq(null);
  };

  const handleSubmit = async () => {
    if (!agencyId || !question.trim() || !answer.trim()) {
      toast.error(t("faq.validationError"));
      return;
    }

    const keywordArray = keywords
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const faqData = {
      agency_id: agencyId,
      question: question.trim(),
      answer: answer.trim(),
      keywords: keywordArray,
      language,
      is_active: isActive,
      category: category.trim() || null,
    };

    try {
      if (editingFaq) {
        const { error } = await supabase
          .from("faq_templates")
          .update(faqData)
          .eq("id", editingFaq.id);

        if (error) throw error;
        toast.success(t("admin.faq.messages.updated"));
      } else {
        const { data: newFaq, error } = await supabase
          .from("faq_templates")
          .insert(faqData)
          .select()
          .single();

        if (error) throw error;
        toast.success(t("admin.faq.messages.added"));

        // Auto-translate to other languages
        const allLanguages = ["tr", "en", "de", "ru", "ar", "fr", "es"];
        const targetLanguages = allLanguages.filter(lang => lang !== language);
        
        if (targetLanguages.length > 0) {
          setTranslating(true);
          const { error: translateError } = await supabase.functions.invoke("translate-faq", {
            body: {
              faqId: newFaq.id,
              sourceLanguage: language,
              targetLanguages,
            },
          });

          if (translateError) {
            console.error("Translation error:", translateError);
            toast.error(t("admin.faq.translationError"));
          } else {
            toast.success(t("admin.faq.translationSuccess"));
          }
          setTranslating(false);
        }
      }

      await loadFaqs(agencyId);
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving FAQ:", error);
      toast.error(t("common.error"));
      setTranslating(false);
    }
  };

  const handleEdit = (faq: FAQTemplate) => {
    setEditingFaq(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setKeywords(faq.keywords.join(", "));
    setLanguage(faq.language);
    setCategory(faq.category || "");
    setIsActive(faq.is_active);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const faq = faqs.find(f => f.id === id);
    if (faq?.is_template) {
      toast.error(t("admin.faq.cannotDeleteTemplate"));
      return;
    }
    setPendingDeleteId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      const { error } = await supabase
        .from("faq_templates")
        .delete()
        .eq("id", pendingDeleteId);

      if (error) throw error;

      toast.success(t("admin.faq.messages.deleted"));
      if (agencyId) await loadFaqs(agencyId);
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      toast.error(t("common.error"));
    } finally {
      setPendingDeleteId(null);
    }
  };

  const copyTemplateToAgency = async (templateFaq: FAQTemplate) => {
    if (!agencyId) return;

    try {
      const { error } = await supabase
        .from("faq_templates")
        .insert({
          agency_id: agencyId,
          question: templateFaq.question,
          answer: templateFaq.answer,
          keywords: templateFaq.keywords,
          language: templateFaq.language,
          category: templateFaq.category,
          is_active: true,
        });

      if (error) throw error;

      toast.success(t("admin.faq.templateCopied"));
      await loadFaqs(agencyId);
    } catch (error) {
      console.error("Error copying template:", error);
      toast.error(t("common.error"));
    }
  };

  const toggleActive = async (faq: FAQTemplate) => {
    try {
      const { error } = await supabase
        .from("faq_templates")
        .update({ is_active: !faq.is_active })
        .eq("id", faq.id);

      if (error) throw error;
      
      if (agencyId) await loadFaqs(agencyId);
    } catch (error) {
      console.error("Error toggling FAQ:", error);
      toast.error(t("common.error"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("admin.faq.title")}</h2>
          <p className="text-muted-foreground">
            {t("admin.faq.subtitle")}
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("admin.faq.addNew")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFaq ? t("admin.faq.edit") : t("admin.faq.addNew")}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="language">{t("admin.faq.form.language")}</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tr">Türkçe</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="question">{t("admin.faq.form.question")}</Label>
                <Input
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t("admin.faq.form.question_placeholder")}
                />
              </div>

              <div>
                <Label htmlFor="answer">{t("admin.faq.form.answer")}</Label>
                <Textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t("admin.faq.form.answer_placeholder")}
                  rows={6}
                />
              </div>

              <div>
                <Label htmlFor="keywords">
                  {t("admin.faq.form.keywords")}
                </Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder={t("admin.faq.form.keywords_placeholder")}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("admin.faq.form.keywords_help")}
                </p>
              </div>

              <div>
                <Label htmlFor="category">{t("admin.faq.form.category")}</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={t("admin.faq.form.category_placeholder")}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="active">{t("admin.faq.form.active")}</Label>
              </div>

              <Button onClick={handleSubmit} className="w-full" disabled={translating}>
                {translating ? t("admin.faq.translating") : (editingFaq ? t("admin.faq.form.update") : t("admin.faq.form.add"))}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter Section */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <Input
                placeholder={t("admin.faq.search_placeholder") || "FAQ ara (soru, cevap, anahtar kelime...)"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Language Filter */}
            <Select value={filterLanguage} onValueChange={setFilterLanguage}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.faq.all_languages") || "Tüm Diller"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.faq.all_languages") || "Tüm Diller"}</SelectItem>
                <SelectItem value="tr">Türkçe</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.faq.all_categories") || "Tüm Kategoriler"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.faq.all_categories") || "Tüm Kategoriler"}</SelectItem>
                {getUniqueCategories().map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t("admin.faq.status") || "Durum"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.faq.all_status") || "Tümü"}</SelectItem>
                <SelectItem value="active">{t("admin.faq.active") || "Aktif"}</SelectItem>
                <SelectItem value="inactive">{t("admin.faq.inactive") || "Pasif"}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("admin.faq.sort_by") || "Sırala"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">{t("admin.faq.sort_created") || "Oluşturulma"}</SelectItem>
                <SelectItem value="updated_at">{t("admin.faq.sort_updated") || "Güncellenme"}</SelectItem>
                <SelectItem value="usage_count">{t("admin.faq.sort_usage") || "Kullanım"}</SelectItem>
                <SelectItem value="question">{t("admin.faq.sort_question") || "Soru (A-Z)"}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? t("admin.faq.sort_ascending") : t("admin.faq.sort_descending")}
            </Button>

            {/* Clear Filters */}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              {t("admin.faq.clear_filters") || "Filtreleri Temizle"}
            </Button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{t("admin.faq.total") || "Toplam"}: {faqs.length}</span>
            <span>{t("admin.faq.showing") || "Gösterilen"}: {filteredFaqs.length}</span>
            <span>{t("admin.faq.active_count") || "Aktif"}: {faqs.filter(f => f.is_active).length}</span>
          </div>
        </CardContent>
      </Card>

      {filteredFaqs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {t("admin.faq.empty_state")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredFaqs.map((faq) => (
            <Card key={faq.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{faq.question}</CardTitle>
                      {faq.is_template && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {t("admin.faq.template")}
                        </Badge>
                      )}
                      <Badge variant={faq.is_active ? "default" : "secondary"}>
                        {faq.is_active ? t("admin.faq.active") : t("admin.faq.inactive")}
                      </Badge>
                      <Badge variant="outline">{faq.language.toUpperCase()}</Badge>
                      {faq.category && (
                        <Badge variant="secondary">{faq.category}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {faq.is_template ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => copyTemplateToAgency(faq)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {t("admin.faq.useTemplate")}
                      </Button>
                    ) : (
                      <>
                        <Switch
                          checked={faq.is_active}
                          onCheckedChange={() => toggleActive(faq)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(faq)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(faq.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {(faq.keywords.length > 0 || faq.usage_count > 0) && (
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    {faq.keywords.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{t("admin.faq.card.keywords_label")}</span>
                        <div className="flex gap-1 flex-wrap">
                          {faq.keywords.map((keyword, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {faq.usage_count > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        <span>{faq.usage_count} {t("admin.faq.card.times_used")}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.faq.deleteTitle", "Silmek istediğinize emin misiniz?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.faq.messages.delete_confirm", "Bu SSS kalıcı olarak silinecek. Bu işlem geri alınamaz.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "İptal")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete", "Sil")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
