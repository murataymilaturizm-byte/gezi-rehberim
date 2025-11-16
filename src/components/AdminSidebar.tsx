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
  User,
  MessageCircle,
  ScrollText,
  ChevronDown
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTranslation } from "react-i18next";
import { useState } from "react";

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
  planFeatures?: {
    has_user_profiles: boolean;
    has_analytics: boolean;
    has_templates: boolean;
    has_feedback: boolean;
  } | null;
}

export function AdminSidebar({ isSuperAdmin, activeTab, onTabChange, planFeatures }: AdminSidebarProps) {
  const { state } = useSidebar();
  const { t } = useTranslation();
  const isCollapsed = state === "collapsed";
  
  // Filter items based on plan features
  const shouldShowAnalytics = isSuperAdmin || planFeatures?.has_analytics;
  const shouldShowUserProfiles = isSuperAdmin || planFeatures?.has_user_profiles;
  const shouldShowTemplates = isSuperAdmin || planFeatures?.has_templates;
  const shouldShowFeedback = isSuperAdmin || planFeatures?.has_feedback;
  
  // Determine which group should be open based on active tab
  const getDefaultOpenGroup = () => {
    const generalIds = ["dashboard", "settings", "languages", "history"];
    const tourIds = ["tours", "registrations"];
    const communicationIds = ["whatsapp", "whatsapp_profiles", "templates", "whatsapp_logs"];
    const reportingIds = ["analytics", "customer-analytics", "customer-feedback"];
    const supportIds = ["tickets"];
    const superAdminIds = ["agencies", "contact_forms", "twilio_settings", "super_tickets"];
    
    if (generalIds.includes(activeTab)) return "general";
    if (tourIds.includes(activeTab)) return "tours";
    if (communicationIds.includes(activeTab)) return "communication";
    if (reportingIds.includes(activeTab)) return "reporting";
    if (supportIds.includes(activeTab)) return "support";
    if (superAdminIds.includes(activeTab)) return "superAdmin";
    return "general";
  };
  
  const defaultOpen = getDefaultOpenGroup();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    general: defaultOpen === "general",
    tours: defaultOpen === "tours",
    communication: defaultOpen === "communication",
    reporting: defaultOpen === "reporting",
    support: defaultOpen === "support",
    superAdmin: defaultOpen === "superAdmin",
  });
  
  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const generalItems = [
    { id: "dashboard", icon: LayoutDashboard, label: t("admin.tabs.dashboard") },
    { id: "settings", icon: Settings, label: t("admin.tabs.settings") },
    { id: "languages", icon: Languages, label: t("admin.tabs.languages") },
    { id: "history", icon: History, label: t("admin.tabs.history") },
  ];

  const tourItems = [
    { id: "tours", icon: Plane, label: t("admin.tabs.tours") },
    { id: "registrations", icon: Calendar, label: t("admin.tabs.registrations") },
  ];

  const communicationItems = [
    { id: "whatsapp", icon: MessageSquare, label: t("admin.tabs.whatsapp") },
    ...(shouldShowUserProfiles ? [{ id: "whatsapp_profiles", icon: User, label: t("admin.tabs.userProfiles") }] : []),
    ...(shouldShowTemplates ? [{ id: "templates", icon: FileText, label: t("admin.tabs.templates") }] : []),
    { id: "whatsapp_logs", icon: ScrollText, label: t("admin.tabs.whatsappLogs") },
  ];

  const reportingItems = [
    ...(shouldShowAnalytics ? [{ id: "analytics", icon: BarChart3, label: t("admin.tabs.analytics") }] : []),
    ...(shouldShowAnalytics ? [{ id: "customer-analytics", icon: Users, label: t("admin.tabs.customerAnalytics") }] : []),
    ...(shouldShowFeedback ? [{ id: "customer-feedback", icon: MessageCircle, label: t("admin.tabs.customerFeedback") }] : []),
  ];

  const supportItems = [
    { id: "tickets", icon: HelpCircle, label: t("admin.tabs.tickets") },
  ];

  const superAdminItems = [
    { id: "agencies", icon: Building2, label: t("admin.tabs.agencies") },
    { id: "contact_forms", icon: Mail, label: t("admin.tabs.contactForms") },
    { id: "twilio_settings", icon: Phone, label: t("admin.tabs.twilioSettings") },
    { id: "super_tickets", icon: HelpCircle, label: t("admin.tabs.allTickets") },
  ];

  const renderMenuItems = (items: typeof generalItems) => (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton 
              onClick={() => onTabChange(item.id)}
              className={isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50"}
            >
              <item.icon className="h-4 w-4" />
              {!isCollapsed && <span>{item.label}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"}>
      <SidebarContent>
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
      </SidebarContent>
    </Sidebar>
  );
}
