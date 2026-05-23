import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, X, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PdfUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

export const PdfUploader = ({ value, onChange }: PdfUploaderProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"upload" | "url">(value && !value.includes("tour-programs") ? "url" : "upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (!file.type.includes("pdf")) {
      toast({
        title: t("common.error"),
        description: t("admin.tourForm.pdfOnly", { defaultValue: "Sadece PDF dosyaları yüklenebilir." }),
        variant: "destructive",
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: t("common.error"),
        description: t("admin.tourForm.fileTooLarge", { defaultValue: "Dosya boyutu 10MB'dan küçük olmalı." }),
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("tour-programs")
        .upload(fileName, file, { contentType: "application/pdf" });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("tour-programs").getPublicUrl(fileName);
      onChange(urlData.publicUrl);
      toast({
        title: t("common.success"),
        description: t("admin.tourForm.pdfUploaded", { defaultValue: "PDF yüklendi." }),
      });
    } catch (err) {
      console.error("Upload error:", err);
      toast({
        title: t("common.error"),
        description: t("admin.tourForm.pdfUploadFailed", { defaultValue: "PDF yüklenemedi. Lütfen tekrar deneyin." }),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        <Button
          type="button"
          variant={mode === "upload" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("upload")}
          className="text-xs"
        >
          <Upload className="w-3 h-3 mr-1" /> PDF Yükle
        </Button>
        <Button
          type="button"
          variant={mode === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("url")}
          className="text-xs"
        >
          <LinkIcon className="w-3 h-3 mr-1" /> URL Gir
        </Button>
      </div>

      {mode === "upload" ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed h-16"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Yükleniyor...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> PDF dosyası seçin (max 10MB)</>
            )}
          </Button>
        </div>
      ) : (
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/program.pdf"
        />
      )}

      {value && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50 text-sm">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <a href={value} target="_blank" rel="noopener noreferrer" className="truncate text-primary hover:underline flex-1">
            {value.split("/").pop() || value}
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} className="h-6 w-6 p-0">
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
