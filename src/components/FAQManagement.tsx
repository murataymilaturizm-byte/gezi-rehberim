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
}

export default function FAQManagement() {
  const { t, i18n } = useTranslation();
  const [faqs, setFaqs] = useState<FAQTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQTemplate | null>(null);
  
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
    const { data, error } = await supabase
      .from("faq_templates")
      .select("*")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading FAQs:", error);
      toast.error(t("common.error"));
      return;
    }

    setFaqs(data || []);
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
      toast.error("Lütfen tüm gerekli alanları doldurun");
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
        toast.success("FAQ güncellendi");
      } else {
        const { error } = await supabase
          .from("faq_templates")
          .insert(faqData);

        if (error) throw error;
        toast.success("FAQ eklendi");
      }

      await loadFaqs(agencyId);
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving FAQ:", error);
      toast.error(t("common.error"));
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

  const handleDelete = async (id: string) => {
    if (!confirm("Bu FAQ'i silmek istediğinize emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("faq_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("FAQ silindi");
      if (agencyId) await loadFaqs(agencyId);
    } catch (error) {
      console.error("Error deleting FAQ:", error);
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
          <h2 className="text-2xl font-bold">Sık Sorulan Sorular</h2>
          <p className="text-muted-foreground">
            Otomatik yanıt şablonlarınızı yönetin
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yeni FAQ Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFaq ? "FAQ Düzenle" : "Yeni FAQ Ekle"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="language">Dil</Label>
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
                <Label htmlFor="question">Soru *</Label>
                <Input
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Örn: Rezervasyon nasıl yapabilirim?"
                />
              </div>

              <div>
                <Label htmlFor="answer">Cevap *</Label>
                <Textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Detaylı cevap yazın..."
                  rows={6}
                />
              </div>

              <div>
                <Label htmlFor="keywords">
                  Anahtar Kelimeler (virgülle ayırın)
                </Label>
                <Input
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="rezervasyon, kayıt, ödeme, iptal"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Kullanıcı mesajında bu kelimeler geçerse otomatik yanıt verilir
                </p>
              </div>

              <div>
                <Label htmlFor="category">Kategori (Opsiyonel)</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Örn: Rezervasyon, Ödeme, Genel"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="active">Aktif</Label>
              </div>

              <Button onClick={handleSubmit} className="w-full">
                {editingFaq ? "Güncelle" : "Ekle"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {faqs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Henüz FAQ eklenmemiş. İlk FAQ'inizi ekleyerek başlayın.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{faq.question}</CardTitle>
                      <Badge variant={faq.is_active ? "default" : "secondary"}>
                        {faq.is_active ? "Aktif" : "Pasif"}
                      </Badge>
                      <Badge variant="outline">{faq.language.toUpperCase()}</Badge>
                      {faq.category && (
                        <Badge variant="secondary">{faq.category}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>
              </CardHeader>
              
              {(faq.keywords.length > 0 || faq.usage_count > 0) && (
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    {faq.keywords.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Anahtar kelimeler:</span>
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
                        <span>{faq.usage_count} kez kullanıldı</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
