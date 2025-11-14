import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const languages = [
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

export const LanguageSelector = () => {
  const [currentLang, setCurrentLang] = useState(() => {
    return localStorage.getItem("preferred-language") || "tr";
  });

  const handleLanguageChange = (langCode: string) => {
    setCurrentLang(langCode);
    localStorage.setItem("preferred-language", langCode);
    // Trigger language change event for other components
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: langCode }));
  };

  const currentLanguage = languages.find(lang => lang.code === currentLang);

  return (
    <Select value={currentLang} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[140px] bg-background/95 backdrop-blur border-border/50 hover:bg-muted/50 transition-all duration-300">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span>{currentLanguage?.flag}</span>
              <span className="hidden sm:inline">{currentLanguage?.name}</span>
            </span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-background border-border/50 backdrop-blur-xl">
        {languages.map((lang) => (
          <SelectItem 
            key={lang.code} 
            value={lang.code}
            className="hover:bg-muted/50 cursor-pointer transition-colors duration-200"
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
