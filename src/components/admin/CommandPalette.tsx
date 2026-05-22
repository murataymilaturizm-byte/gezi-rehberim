import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, MapPin, ClipboardList, MessageSquare, FileText,
  Building2, CreditCard, Plus, FileSpreadsheet, Sparkles,
  Sun, Moon, Languages, HelpCircle, LogOut, Search, PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CommandPaletteProps {
  onTabChange: (tab: string) => void;
  onNewTour?: () => void;
  onBulkImport?: () => void;
  onManualReg?: () => void;
  onLogout?: () => void;
  agencyId?: string;
  onRestartTour?: () => void;
}

function getTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function toggleTheme() {
  const root = document.documentElement;
  if (root.classList.contains("dark")) {
    root.classList.replace("dark", "light");
    localStorage.setItem("theme", "light");
  } else {
    root.classList.replace("light", "dark");
    localStorage.setItem("theme", "dark");
  }
}

export function CommandPalette({ onTabChange, onNewTour, onBulkImport, onManualReg, onLogout, agencyId, onRestartTour }: CommandPaletteProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => getTheme() === "dark");

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const run = useCallback((action: () => void) => {
    setOpen(false);
    // Small delay so dialog closes cleanly before action
    setTimeout(action, 50);
  }, []);

  const handleThemeToggle = () => {
    toggleTheme();
    setIsDark((d) => !d);
  };

  const LANGS = [
    { code: "tr", label: "🇹🇷 Türkçe" },
    { code: "en", label: "🇬🇧 English" },
    { code: "de", label: "🇩🇪 Deutsch" },
    { code: "fr", label: "🇫🇷 Français" },
    { code: "es", label: "🇪🇸 Español" },
    { code: "ru", label: "🇷🇺 Русский" },
    { code: "ar", label: "🇸🇦 العربية" },
  ];

  return (
    <>
      {/* Header trigger button */}
      <Button
        variant="outline"
        size="sm"
        className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-3"
        onClick={() => setOpen(true)}
        data-tour="header-command-palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">{t("commandPalette.search")}</span>
        <kbd className="ml-2 pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[9px] font-medium">
          <span>⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("commandPalette.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("commandPalette.empty")}</CommandEmpty>

          {/* Navigation */}
          <CommandGroup heading={t("commandPalette.navigation")}>
            <CommandItem onSelect={() => run(() => onTabChange("dashboard"))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t("admin.tabs.dashboard", { defaultValue: "Dashboard" })}
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => onTabChange("tours"))}>
              <MapPin className="mr-2 h-4 w-4" />
              {t("admin.tabs.tours")}
              <CommandShortcut>⌘T</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => onTabChange("registrations"))}>
              <ClipboardList className="mr-2 h-4 w-4" />
              {t("admin.tabs.registrations")}
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => onTabChange("whatsapp"))}>
              <MessageSquare className="mr-2 h-4 w-4" />
              WhatsApp
              <CommandShortcut>⌘W</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => onTabChange("templates"))}>
              <FileText className="mr-2 h-4 w-4" />
              {t("admin.tabs.templates")}
            </CommandItem>
            <CommandItem onSelect={() => run(() => onTabChange("agency_info"))}>
              <Building2 className="mr-2 h-4 w-4" />
              {t("admin.tabs.agencyInfo")}
            </CommandItem>
            <CommandItem onSelect={() => run(() => onTabChange("history"))}>
              <CreditCard className="mr-2 h-4 w-4" />
              {t("admin.tabs.history")}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Quick Actions */}
          <CommandGroup heading={t("commandPalette.actions")}>
            <CommandItem onSelect={() => run(() => { onTabChange("tours"); onNewTour?.(); })}>
              <Plus className="mr-2 h-4 w-4" />
              {t("commandPalette.newTour")}
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => { onTabChange("tours"); onBulkImport?.(); })}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {t("commandPalette.bulkImport")}
            </CommandItem>
            <CommandItem onSelect={() => run(() => { onTabChange("registrations"); onManualReg?.(); })}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t("commandPalette.manualRegistration")}
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Preferences */}
          <CommandGroup heading={t("commandPalette.preferences")}>
            <CommandItem onSelect={() => run(handleThemeToggle)}>
              {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {isDark ? t("commandPalette.lightMode") : t("commandPalette.darkMode")}
            </CommandItem>
            {LANGS.map((lang) => (
              <CommandItem key={lang.code} onSelect={() => run(() => i18n.changeLanguage(lang.code))}>
                <Languages className="mr-2 h-4 w-4" />
                {lang.label}
                {i18n.language === lang.code && (
                  <span className="ml-auto text-xs text-primary">✓</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {/* Help */}
          <CommandGroup heading={t("commandPalette.help")}>
            <CommandItem onSelect={() => run(() => window.open("/nasil-baslarim", "_blank"))}>
              <HelpCircle className="mr-2 h-4 w-4" />
              {t("commandPalette.gettingStarted")}
            </CommandItem>
            {onRestartTour && (
              <CommandItem onSelect={() => run(() => onRestartTour())}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {t("commandPalette.restartTour")}
              </CommandItem>
            )}
            <CommandItem onSelect={() => run(() => onLogout?.())} className="text-destructive data-[selected=true]:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {t("commandPalette.logout")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
