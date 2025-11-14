import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MessageTemplate {
  id: string;
  template_key: string;
  language: string;
  subject: string;
  content: string;
  variables: any;
  is_active: boolean;
}

const LANGUAGES = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

const TEMPLATE_TYPES = [
  { key: 'reservation_confirmed', name: 'Rezervasyon Onayı' },
  { key: 'reservation_cancelled', name: 'Rezervasyon İptali' },
  { key: 'tour_reminder', name: 'Tur Hatırlatma' },
];

export default function MessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('tr');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    // Varsayılan şablonları otomatik yükle
    if (!loading && templates.length === 0) {
      copyDefaultTemplates();
    }
  }, [loading, templates.length]);

  const fetchTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) return;

      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('agency_id', agency.id)
        .order('template_key')
        .order('language');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Hata",
        description: "Şablonlar yüklenirken bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) return;

      const templateData = {
        agency_id: agency.id,
        template_key: editingTemplate.template_key,
        language: editingTemplate.language,
        subject: editingTemplate.subject,
        content: editingTemplate.content,
        variables: editingTemplate.variables,
        is_active: editingTemplate.is_active,
      };

      if (editingTemplate.id) {
        const { error } = await supabase
          .from('message_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('message_templates')
          .insert(templateData);

        if (error) throw error;
      }

      toast({
        title: "Başarılı",
        description: "Şablon kaydedildi",
      });

      setEditDialogOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Hata",
        description: "Şablon kaydedilirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Bu şablonu silmek istediğinizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Şablon silindi",
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: "Hata",
        description: "Şablon silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const copyDefaultTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agency } = await supabase
        .from('agencies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agency) return;

      // Varsayılan şablonları kopyala
      const { data: defaultTemplates } = await supabase
        .from('message_templates')
        .select('*')
        .eq('agency_id', '00000000-0000-0000-0000-000000000000');

      if (!defaultTemplates || defaultTemplates.length === 0) return;

      const newTemplates = defaultTemplates.map(t => ({
        agency_id: agency.id,
        template_key: t.template_key,
        language: t.language,
        subject: t.subject,
        content: t.content,
        variables: t.variables,
        is_active: t.is_active,
      }));

      const { error } = await supabase
        .from('message_templates')
        .insert(newTemplates);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Varsayılan şablonlar kopyalandı",
      });

      fetchTemplates();
    } catch (error: any) {
      console.error('Error copying templates:', error);
      toast({
        title: "Hata",
        description: "Şablonlar kopyalanırken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const getTemplatesByLanguage = (lang: string) => {
    return templates.filter(t => t.language === lang);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mesaj Şablonları</h2>
          <p className="text-muted-foreground">
            Rezervasyon onayı, iptal bildirimi gibi otomatik mesajlar için çok dilli şablonlar
          </p>
        </div>
        {templates.length === 0 && (
          <Button onClick={copyDefaultTemplates}>
            <Copy className="mr-2 h-4 w-4" />
            Varsayılan Şablonları Yükle
          </Button>
        )}
      </div>

      <Tabs value={selectedLanguage} onValueChange={setSelectedLanguage}>
        <TabsList className="grid grid-cols-7 w-full">
          {LANGUAGES.map((lang) => (
            <TabsTrigger key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {LANGUAGES.map((lang) => (
          <TabsContent key={lang.code} value={lang.code} className="space-y-4">
            <div className="grid gap-4">
              {TEMPLATE_TYPES.map((type) => {
                const template = getTemplatesByLanguage(lang.code).find(
                  t => t.template_key === type.key
                );

                return (
                  <Card key={type.key}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{type.name}</CardTitle>
                          <CardDescription>
                            {template ? template.subject : 'Henüz oluşturulmadı'}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingTemplate(template || {
                                id: '',
                                template_key: type.key,
                                language: lang.code,
                                subject: '',
                                content: '',
                                variables: [],
                                is_active: true,
                              } as MessageTemplate);
                              setEditDialogOpen(true);
                            }}
                          >
                            {template ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </Button>
                          {template && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {template && (
                      <CardContent>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {template.content.substring(0, 200)}
                            {template.content.length > 200 && '...'}
                          </div>
                          {template.variables && template.variables.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {template.variables.map((variable) => (
                                <span
                                  key={variable}
                                  className="inline-flex items-center px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                                >
                                  {`{${variable}}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Şablon Düzenle</DialogTitle>
            <DialogDescription>
              Mesaj şablonunu düzenleyin. Değişkenler {'{}'} içinde yazılmalıdır.
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Şablon Tipi</Label>
                <Select
                  value={editingTemplate.template_key}
                  onValueChange={(value) =>
                    setEditingTemplate({ ...editingTemplate, template_key: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((type) => (
                      <SelectItem key={type.key} value={type.key}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Dil</Label>
                <Select
                  value={editingTemplate.language}
                  onValueChange={(value) =>
                    setEditingTemplate({ ...editingTemplate, language: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Konu</Label>
                <Input
                  value={editingTemplate.subject}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, subject: e.target.value })
                  }
                  placeholder="Şablon konusu"
                />
              </div>

              <div>
                <Label>Mesaj İçeriği</Label>
                <Textarea
                  value={editingTemplate.content}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, content: e.target.value })
                  }
                  placeholder="Mesaj içeriği... {full_name}, {tour_name} gibi değişkenler kullanabilirsiniz"
                  rows={10}
                />
              </div>

              <div>
                <Label>Değişkenler (virgülle ayırın)</Label>
                <Input
                  value={editingTemplate.variables?.join(', ') || ''}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      variables: e.target.value.split(',').map(v => v.trim()).filter(v => v),
                    })
                  }
                  placeholder="full_name, tour_name, date, pax"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Örnek: full_name, tour_name, date, pax, total_amount, currency
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSaveTemplate}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
