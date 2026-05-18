import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
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
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem("preferred-language", langCode);

    // Blog sayfasındaysak URL'i de güncelle
    // /blog/... veya /{lang}/blog/... → /{newLang}/blog/...
    const blogMatch = location.pathname.match(/^(?:\/[a-z]{2})?(\/blog(?:\/.+)?)$/);
    if (blogMatch) {
      const blogPart = blogMatch[1]; // "/blog" veya "/blog/slug"
      const newPath = langCode === "tr" ? blogPart : `/${langCode}${blogPart}`;
      navigate(newPath);
    }
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language);

  return (
    <Select value={i18n.language} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[100px] sm:w-[140px] bg-background/95 backdrop-blur border-border/50 hover:bg-muted/50 transition-all duration-300">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          <SelectValue>
            <span className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-sm sm:text-base">{currentLanguage?.flag}</span>
              <span className="hidden sm:inline text-sm">{currentLanguage?.name}</span>
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
