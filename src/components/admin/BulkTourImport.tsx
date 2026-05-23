import { useState } from "react";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ParsedTour {
  rowIndex: number;
  title: string;
  destination: string;
  type: "DAYTRIP" | "N2" | "N3";
  currency: string;
  program_kisa: string;
  title_en?: string;
  title_de?: string;
  title_fr?: string;
  title_es?: string;
  title_ru?: string;
  title_ar?: string;
  errors: string[];
  isValid: boolean;
}

interface BulkTourImportProps {
  agencyId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const VALID_TYPES = ["DAYTRIP", "N2", "N3"];
const VALID_CURRENCIES = ["TRY", "USD", "EUR", "GBP", "SAR", "AED", "RUB"];

export function BulkTourImport({ agencyId, open, onClose, onSuccess }: BulkTourImportProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [parsedTours, setParsedTours] = useState<ParsedTour[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

        const parsed: ParsedTour[] = rows.map((row, idx) => {
          const errors: string[] = [];

          const title = String(row.title || row.Title || "").trim();
          const destination = String(row.destination || row.Destination || "").trim();
          const rawType = String(row.type || row.Type || "DAYTRIP").trim().toUpperCase();
          const rawCurrency = String(row.currency || row.Currency || "TRY").trim().toUpperCase();

          if (!title) errors.push(t("bulkImport.errors.titleRequired"));
          if (!destination) errors.push(t("bulkImport.errors.destinationRequired"));
          if (!VALID_TYPES.includes(rawType)) errors.push(`type: "${rawType}" ${t("bulk.invalidType")} (DAYTRIP/N2/N3)`);
          if (!VALID_CURRENCIES.includes(rawCurrency)) errors.push(`currency: "${rawCurrency}" ${t("bulk.invalidCurrency")}`);

          return {
            rowIndex: idx + 2,
            title,
            destination,
            type: VALID_TYPES.includes(rawType) ? (rawType as "DAYTRIP" | "N2" | "N3") : "DAYTRIP",
            currency: VALID_CURRENCIES.includes(rawCurrency) ? rawCurrency : "TRY",
            program_kisa: String(row.program_kisa || row.Program || row.Description || "").trim(),
            title_en: row.title_en || row.TitleEN || undefined,
            title_de: row.title_de || row.TitleDE || undefined,
            title_fr: row.title_fr || row.TitleFR || undefined,
            title_es: row.title_es || row.TitleES || undefined,
            title_ru: row.title_ru || row.TitleRU || undefined,
            title_ar: row.title_ar || row.TitleAR || undefined,
            errors,
            isValid: errors.length === 0,
          };
        });

        setParsedTours(parsed);
        const validCount = parsed.filter((p) => p.isValid).length;
        toast({
          title: t("common.success"),
          description: t("bulkImport.parsed", { valid: validCount, total: parsed.length }),
        });
      } catch (err: any) {
        console.error(err);
        toast({ title: t("common.error"), description: t("bulkImport.errors.parseError"), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleImport = async () => {
    const valid = parsedTours.filter((p) => p.isValid);
    if (valid.length === 0) {
      toast({ title: t("common.error"), description: t("bulkImport.errors.noValid"), variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const rows = valid.map((p) => ({
        agency_id: agencyId,
        title: p.title,
        destination: p.destination,
        type: p.type,
        currency: p.currency,
        program_kisa: p.program_kisa || null,
        title_en: p.title_en || null,
        title_de: p.title_de || null,
        title_fr: p.title_fr || null,
        title_es: p.title_es || null,
        title_ru: p.title_ru || null,
        title_ar: p.title_ar || null,
        min_pax: 1,
        visa_required: false,
      }));

      const { error } = await supabase.from("tours").insert(rows);
      if (error) throw error;

      supabase.functions.invoke("invalidate-tour-cache", { body: { agencyId } }).catch(() => {});

      toast({ title: t("common.success"), description: t("bulkImport.success", { count: rows.length }) });
      onSuccess();
      onClose();
      setParsedTours([]);
    } catch (err: any) {
      // Madde 1: Ham hata kullanıcıya gösterilmesin
      console.error("Import failed:", err?.message || err);
      toast({
        title: t("common.error"),
        description: t("bulkImport.errors.importFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        title: "Kapadokya Balon Turu",
        destination: "Kapadokya",
        type: "DAYTRIP",
        currency: "TRY",
        program_kisa: "Sabah erken kalkış, balon turu, öğle yemeği...",
        title_en: "Cappadocia Balloon Tour",
        title_de: "Kappadokien Ballonfahrt",
        title_fr: "Tour en montgolfière en Cappadoce",
        title_es: "Tour en globo por Capadocia",
        title_ru: "Тур на воздушном шаре в Каппадокии",
        title_ar: "جولة بالمنطاد في كابادوكيا",
      },
      {
        title: "Pamukkale Turu",
        destination: "Pamukkale",
        type: "DAYTRIP",
        currency: "TRY",
        program_kisa: "Pamukkale travertenleri ve Hierapolis antik kenti...",
        title_en: "Pamukkale Tour",
        title_de: "Pamukkale Tour",
        title_fr: "Tour de Pamukkale",
        title_es: "Tour de Pamukkale",
        title_ru: "Тур в Памуккале",
        title_ar: "جولة باموكالي",
      },
      {
        title: "İstanbul 2 Gece Turu",
        destination: "İstanbul",
        type: "N2",
        currency: "USD",
        program_kisa: "Topkapı Sarayı, Aya Sofya, Boğaz turu...",
        title_en: "Istanbul 2 Night Tour",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    // Column widths
    ws["!cols"] = [
      { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 8 },
      { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
      { wch: 30 }, { wch: 30 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("bulk.importSheetName"));
    XLSX.writeFile(wb, `${t("bulk.importFilename")}.xlsx`);
  };

  const validCount = parsedTours.filter((p) => p.isValid).length;
  const invalidCount = parsedTours.filter((p) => !p.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${isMobile ? "w-full max-w-none h-[95dvh]" : "max-w-4xl max-h-[90vh]"} overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t("bulkImport.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t("bulkImport.subtitle")}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template download */}
          <Card className="p-4 bg-muted/30 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-medium text-sm">{t("bulkImport.needTemplate")}</p>
              <p className="text-xs text-muted-foreground">{t("bulkImport.templateDescription")}</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t("bulkImport.downloadTemplate")}
            </Button>
          </Card>

          {/* Upload area */}
          <Card className="p-6 border-dashed text-center space-y-3">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <Label htmlFor="excel-upload" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    {t("bulkImport.selectFile")}
                  </span>
                </Button>
              </Label>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("bulkImport.fileHint")}</p>
          </Card>

          {/* Parsed preview */}
          {parsedTours.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="font-semibold text-sm">{t("bulkImport.parsedTours")}</p>
                <div className="flex gap-2">
                  <Badge className="bg-green-500 text-white gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {validCount} {t("bulkImport.valid")}
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {invalidCount} {t("bulkImport.invalid")}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t("admin.tours.title")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("admin.tours.destination")}</TableHead>
                      <TableHead className="hidden sm:table-cell">Tip</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTours.map((tour) => (
                      <TableRow key={tour.rowIndex} className={!tour.isValid ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{tour.rowIndex}</TableCell>
                        <TableCell className="font-medium max-w-[160px] truncate">{tour.title || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{tour.destination || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">{tour.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {tour.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <div>
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              <p className="text-xs text-destructive mt-0.5">{tour.errors[0]}</p>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleImport} disabled={isLoading || validCount === 0}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("bulkImport.importing")}</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />{t("bulkImport.importButton", { count: validCount })}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
