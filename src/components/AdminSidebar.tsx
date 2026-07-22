import {
  LayoutDashboard,
  Plane,
  Calendar,
  MessageSquare,
  Settings,
  BarChart3,
  Users,
  FileText,
  Languages,
  History,
  Building2,
  Mail,
  Phone,
  HelpCircle,
  MessageCircle,
  ChevronDown,
  MapPin,
  CreditCard,
  ScrollText,
  Bell,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AdminSidebarProps {
  isSuperAdmin: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  agencyName?: string;
  planFeatures?: {
    has_user_profiles: boolean;
    has_analytics: boolean;
    has_templates: boolean;
    has_feedback: boolean;
  } | null;
}

export function AdminSidebar({ isSuperAdmin, activeTab, onTabChange, agencyName, planFeatures }: AdminSidebarProps) {
  const { state, setOpenMobile } = useSidebar();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isCollapsed = state === "collapsed";
  
  // Filter items based on plan features
  const shouldShowAnalytics = isSuperAdmin || planFeatures?.has_analytics;
  const shouldShowUserProfiles = isSuperAdmin || planFeatures?.has_user_profiles;
  const shouldShowTemplates = isSuperAdmin || planFeatures?.has_templates;
  const shouldShowFeedback = isSuperAdmin || planFeatures?.has_feedback;
  
  // Determine which group should be open based on active tab
  // 2026-07-22 MENÜ-SIRALAMA (Murat onaylı): günlük-akış üstte, ayar-sınıfı tek
  // "Ayarlar" grubunda. id/route DEĞİŞMEDİ — yalnız gruplama/sıralama.
  const getDefaultOpenGroup = () => {
    const generalIds = ["dashboard"];
    const tourIds = ["tours", "registrations"];
    // CRM: whatsapp_profiles "Müşteri Yönetimi" grubuna taşındı (eski activeTab key korunur).
    const customerIds = ["whatsapp_profiles"];
    const communicationIds = ["whatsapp", "complaints", "templates", "faq"];
    const settingsIds = ["settings", "agency_info", "payment_settings", "languages", "language_currencies", "history"];
    const reportingIds = ["analytics", "customer-analytics", "destination-analytics", "customer-feedback", "language-stats", "whatsapp-logs"];
    const supportIds = ["tickets"];
    const superAdminIds = ["agencies", "contact_forms", "whatsapp_management", "whatsapp_integrations", "whatsapp_settings", "super_tickets", "central_notifications", "central_send_log"];
    const testIds = ["whatsapp_test"];

    if (generalIds.includes(activeTab)) return "general";
    if (tourIds.includes(activeTab)) return "tours";
    if (customerIds.includes(activeTab)) return "customers";
    if (communicationIds.includes(activeTab)) return "communication";
    if (settingsIds.includes(activeTab)) return "settingsGroup";
    if (reportingIds.includes(activeTab)) return "reporting";
    if (supportIds.includes(activeTab)) return "support";
    if (superAdminIds.includes(activeTab)) return "superAdmin";
    if (testIds.includes(activeTab)) return "test";
    return "general";
  };

  const defaultOpen = getDefaultOpenGroup();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    general: defaultOpen === "general",
    tours: defaultOpen === "tours",
    customers: defaultOpen === "customers",
    communication: defaultOpen === "communication",
    settingsGroup: defaultOpen === "settingsGroup",
    reporting: defaultOpen === "reporting",
    support: defaultOpen === "support",
    superAdmin: defaultOpen === "superAdmin",
    test: defaultOpen === "test",
  });
  
  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const generalItems = [
    { id: "dashboard", icon: LayoutDashboard, label: t("admin.tabs.dashboard"), dataTour: "sidebar-dashboard" },
  ];

  const tourItems = [
    { id: "tours", icon: Plane, label: t("admin.tabs.tours"), dataTour: "sidebar-tours" },
    { id: "registrations", icon: Calendar, label: t("admin.tabs.registrations"), dataTour: "sidebar-registrations" },
  ];

  // CRM: "Müşteri Yönetimi" grubu — Tur Yönetimi'nin hemen altında, kanal ayarlarından
  // ayrı bir satış aracı kategorisi. activeTab key korunur (whatsapp_profiles).
  const customersItems = [
    ...(shouldShowUserProfiles ? [{ id: "whatsapp_profiles", icon: Users, label: t("admin.tabs.customers"), dataTour: "sidebar-customers" }] : []),
  ];

  // İLETİŞİM: günlük operasyon (konuşmalar/talepler/şablonlar/SSS).
  const communicationItems = [
    { id: "whatsapp", icon: MessageSquare, label: "WhatsApp", dataTour: "sidebar-whatsapp" },
    { id: "complaints", icon: MessageCircle, label: t("admin.tabs.complaints") },
    ...(shouldShowTemplates ? [{ id: "templates", icon: FileText, label: t("admin.tabs.templates"), dataTour: "sidebar-templates" }] : []),
    { id: "faq", icon: HelpCircle, label: t("admin.tabs.faq"), dataTour: "sidebar-faq" },
  ];

  // AYARLAR (2026-07-22 yeni grup): kurulum/nadir-kullanım öğeleri tek yerde.
  // (WhatsApp Bağlantı 2026-07-10 erişilemeyen-ekran fix'iyle menüye girmişti.)
  const settingsItems = [
    { id: "settings", icon: Settings, label: t("admin.tabs.whatsappConnection", { defaultValue: "WhatsApp Bağlantı" }), dataTour: "sidebar-whatsapp-connection" },
    { id: "agency_info", icon: Building2, label: t("admin.tabs.agencyInfo"), dataTour: "sidebar-agency-info" },
    { id: "payment_settings", icon: CreditCard, label: t("admin.tabs.paymentSettings"), dataTour: "sidebar-payment" },
    { id: "languages", icon: Languages, label: t("admin.tabs.languages"), dataTour: "sidebar-languages" },
    { id: "language_currencies", icon: CreditCard, label: t("admin.tabs.languageCurrencies") },
    { id: "history", icon: History, label: t("admin.tabs.history"), dataTour: "sidebar-history" },
  ];

  const reportingItems = [
    ...(shouldShowAnalytics ? [{ id: "analytics", icon: BarChart3, label: t("admin.tabs.analytics"), dataTour: "sidebar-analytics" }] : []),
    ...(shouldShowAnalytics ? [{ id: "customer-analytics", icon: Users, label: t("admin.tabs.customerAnalytics") }] : []),
    ...(shouldShowAnalytics ? [{ id: "destination-analytics", icon: MapPin, label: t("admin.tabs.destinationAnalytics") }] : []),
    ...(shouldShowFeedback ? [{ id: "customer-feedback", icon: MessageCircle, label: t("admin.tabs.customerFeedback") }] : []),
    { id: "language-stats", icon: Languages, label: t("admin.tabs.languageStats") },
    { id: "whatsapp-logs", icon: ScrollText, label: t("admin.tabs.whatsappLogs") },
  ];

  const supportItems = [
    { id: "tickets", icon: HelpCircle, label: t("admin.tabs.tickets"), dataTour: "sidebar-support" },
  ];

  const superAdminItems = [
    { id: "agencies", icon: Building2, label: t("admin.tabs.agencies") },
    { id: "contact_forms", icon: Mail, label: t("admin.tabs.contactForms") },
    { id: "whatsapp_management", icon: Phone, label: t("admin.tabs.whatsappManagement") },
    // 2026-07-22 UX-denetim: whatsapp_integrations render'da vardı ama menüde YOKTU
    // (WhatsApp-Bağlantı vakası sınıfı — erişilemeyen ekran). Menü öğesi eklendi.
    { id: "whatsapp_integrations", icon: MessageSquare, label: t("admin.tabs.whatsappIntegrations", { defaultValue: "WhatsApp Entegrasyonları" }) },
    { id: "whatsapp_settings", icon: Phone, label: t("admin.tabs.whatsappSettings") },
    { id: "super_tickets", icon: HelpCircle, label: t("admin.tabs.allTickets") },
    { id: "central_notifications", icon: Bell, label: t("admin.tabs.centralNotifications") },
    { id: "central_send_log", icon: ScrollText, label: t("admin.tabs.centralSendLog") },
  ];

  const testItems = [
    { id: "whatsapp_test", icon: MessageSquare, label: t("admin.tabs.whatsappTest") },
  ];

  const renderMenuItems = (items: (typeof generalItems[0] & { dataTour?: string })[]) => (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const button = (
          <SidebarMenuButton
            onClick={() => {
              onTabChange(item.id);
              if (isMobile) setOpenMobile(false);
            }}
            className={`h-9 ${isActive
              ? "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none"
              : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
            data-tour={item.dataTour}
          >
            <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
            {!isCollapsed && <span className="text-sm">{item.label}</span>}
          </SidebarMenuButton>
        );

        return (
          <SidebarMenuItem key={item.id}>
            {isCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" className="z-50 text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              button
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"}>
      <SidebarContent className="pt-2">
        {/* Mobile header inside sidebar */}
        {!isCollapsed && isMobile && agencyName && (
          <div className="px-4 py-3 mb-2 border-b border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("admin.groups.general")}</p>
            <p className="text-sm font-semibold truncate mt-1">{agencyName}</p>
          </div>
        )}
        {/* Genel Yönetim */}
        <Collapsible open={openGroups.general} onOpenChange={() => toggleGroup("general")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                {!isCollapsed && t("admin.groups.general")}
                {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.general ? "rotate-180" : ""}`} />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderMenuItems(generalItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Tur Yönetimi */}
        <Collapsible open={openGroups.tours} onOpenChange={() => toggleGroup("tours")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                {!isCollapsed && t("admin.groups.tours")}
                {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.tours ? "rotate-180" : ""}`} />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderMenuItems(tourItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Müşteri Yönetimi (CRM) — Tur Yönetimi'nin altında, plan gating: has_user_profiles */}
        {customersItems.length > 0 && (
          <Collapsible open={openGroups.customers} onOpenChange={() => toggleGroup("customers")}>
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                  {!isCollapsed && t("admin.groups.customers")}
                  {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.customers ? "rotate-180" : ""}`} />}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  {renderMenuItems(customersItems)}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* İletişim Yönetimi */}
        <Collapsible open={openGroups.communication} onOpenChange={() => toggleGroup("communication")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                {!isCollapsed && t("admin.groups.communication")}
                {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.communication ? "rotate-180" : ""}`} />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderMenuItems(communicationItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Raporlama - Sadece özellikler varsa */}
        {reportingItems.length > 0 && (
          <Collapsible open={openGroups.reporting} onOpenChange={() => toggleGroup("reporting")}>
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                  {!isCollapsed && t("admin.groups.reporting")}
                  {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.reporting ? "rotate-180" : ""}`} />}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  {renderMenuItems(reportingItems)}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Ayarlar (2026-07-22 yeni grup) — kurulum/nadir öğeler */}
        <Collapsible open={openGroups.settingsGroup} onOpenChange={() => toggleGroup("settingsGroup")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                {!isCollapsed && t("admin.groups.settings", { defaultValue: "Ayarlar" })}
                {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.settingsGroup ? "rotate-180" : ""}`} />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderMenuItems(settingsItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Destek */}
        <Collapsible open={openGroups.support} onOpenChange={() => toggleGroup("support")}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                {!isCollapsed && t("admin.groups.support")}
                {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.support ? "rotate-180" : ""}`} />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderMenuItems(supportItems)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Super Admin - Sadece super adminler için */}
        {isSuperAdmin && (
          <Collapsible open={openGroups.superAdmin} onOpenChange={() => toggleGroup("superAdmin")}>
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                  {!isCollapsed && t("admin.groups.superAdmin")}
                  {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.superAdmin ? "rotate-180" : ""}`} />}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  {renderMenuItems(superAdminItems)}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Test - Sadece super adminler için */}
        {isSuperAdmin && (
          <Collapsible open={openGroups.test} onOpenChange={() => toggleGroup("test")}>
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:bg-accent/50 rounded-md cursor-pointer">
                  {!isCollapsed && t("admin.groups.test")}
                  {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${openGroups.test ? "rotate-180" : ""}`} />}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  {renderMenuItems(testItems)}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
