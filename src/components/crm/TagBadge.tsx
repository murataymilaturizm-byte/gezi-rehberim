// TagBadge — CRM etiket görünümü.
//   • Otomatik etiket: AutoTagKey ile, renkli, ikonlu, sistem-türevli (silinemez,
//     hover'da kilit ikon + tooltip "otomatik etiket").
//   • Manuel etiket: serbest metin, nötr renkli, X butonu opsiyonel.
// Aynı bileşen iki modu da kapsar — liste/detay/filtre her yerde tutarlı.
import { useTranslation } from "react-i18next";
import { Lock, X } from "lucide-react";
import {
  AUTO_TAG_STYLES,
  AUTO_TAG_I18N_KEYS,
  MANUAL_TAG_STYLE,
  type AutoTagKey,
} from "./customerTags";

interface AutoTagBadgeProps {
  tag: AutoTagKey;
  size?: "xs" | "sm";
  showIcon?: boolean;
}

export const AutoTagBadge = ({ tag, size = "sm", showIcon = true }: AutoTagBadgeProps) => {
  const { t } = useTranslation();
  const style = AUTO_TAG_STYLES[tag];
  const label = t(AUTO_TAG_I18N_KEYS[tag]);
  const sizing =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-0.5"
      : "text-xs px-2 py-0.5 gap-1";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${style.bg} ${style.text} ${style.border} ${sizing}`}
      title={t("admin.whatsapp.userProfiles.autoTags.autoTagTooltip", {
        defaultValue: "Otomatik etiket (sistem tarafından atandı)",
      })}
    >
      {showIcon && <span aria-hidden="true">{style.icon}</span>}
      <span>{label}</span>
      <Lock className={size === "xs" ? "w-2 h-2 opacity-60" : "w-2.5 h-2.5 opacity-60"} aria-hidden="true" />
    </span>
  );
};

interface ManualTagBadgeProps {
  label: string;
  size?: "xs" | "sm";
  onRemove?: () => void;
}

export const ManualTagBadge = ({ label, size = "sm", onRemove }: ManualTagBadgeProps) => {
  const sizing =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-0.5"
      : "text-xs px-2 py-0.5 gap-1";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${MANUAL_TAG_STYLE.bg} ${MANUAL_TAG_STYLE.text} ${MANUAL_TAG_STYLE.border} ${sizing}`}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${label}`}
          className="ms-0.5 inline-flex items-center justify-center rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
        >
          <X className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </button>
      )}
    </span>
  );
};
