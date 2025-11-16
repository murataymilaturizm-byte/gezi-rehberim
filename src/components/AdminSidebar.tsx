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
  ScrollText
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTranslation } from "react-i18next";

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

interface AdminSidebarProps {
  isSuperAdmin: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AdminSidebar({ isSuperAdmin, activeTab, onTabChange }: AdminSidebarProps) {
  const { state } = useSidebar();
  const { t } = useTranslation();
  const isCollapsed = state === "collapsed";

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
    { id: "whatsapp_profiles", icon: User, label: t("admin.tabs.userProfiles") },
    { id: "templates", icon: FileText, label: t("admin.tabs.templates") },
    { id: "whatsapp_logs", icon: ScrollText, label: t("admin.tabs.whatsappLogs") },
  ];

  const reportingItems = [
    { id: "analytics", icon: BarChart3, label: t("admin.tabs.analytics") },
    { id: "customer-feedback", icon: MessageCircle, label: t("admin.tabs.customerFeedback") },
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
        <SidebarGroup>
          <SidebarGroupLabel>{!isCollapsed && t("admin.groups.general")}</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(generalItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tur Yönetimi */}
        <SidebarGroup>
          <SidebarGroupLabel>{!isCollapsed && t("admin.groups.tours")}</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(tourItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* İletişim Yönetimi */}
        <SidebarGroup>
          <SidebarGroupLabel>{!isCollapsed && t("admin.groups.communication")}</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(communicationItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Raporlama */}
        <SidebarGroup>
          <SidebarGroupLabel>{!isCollapsed && t("admin.groups.reporting")}</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(reportingItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Destek */}
        <SidebarGroup>
          <SidebarGroupLabel>{!isCollapsed && t("admin.groups.support")}</SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(supportItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Super Admin - Sadece super adminler için */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{!isCollapsed && t("admin.groups.superAdmin")}</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(superAdminItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
