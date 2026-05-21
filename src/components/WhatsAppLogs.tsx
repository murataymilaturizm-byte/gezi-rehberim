import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Calendar as CalendarIcon, Filter, X, RefreshCw, User, Building2 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface WhatsAppLog {
  id: string;
  phone: string;
  role: string;
  content: string;
  metadata?: Record<string, any> | null;
  created_at: string;
  agency_id: string;
  agencies?: {
    name: string;
  };
}

export function WhatsAppLogs() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState("");
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadAgencies();
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchPhone, selectedAgency, selectedRole, dateRange]);

  const loadAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error: any) {
      console.error('Error loading agencies:', error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      // Get current user and check if super admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      // Check if super admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      const isSuperAdmin = !!roleData;

      let query = supabase
        .from('whatsapp_conversations')
        .select(`
          id,
          phone,
          role,
          content,
          metadata,
          created_at,
          agency_id,
          agencies (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      // If not super admin, filter by agency
      if (!isSuperAdmin) {
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!agencyData) {
          return;
        }

        query = query.eq('agency_id', agencyData.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error loading logs:', error);
      toast({
        title: t("common.error"),
        description: t("whatsapp.logs.loadError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Phone filter
    if (searchPhone) {
      filtered = filtered.filter(log => 
        log.phone.toLowerCase().includes(searchPhone.toLowerCase())
      );
    }

    // Agency filter
    if (selectedAgency !== "all") {
      filtered = filtered.filter(log => log.agency_id === selectedAgency);
    }

    // Role filter
    if (selectedRole !== "all") {
      filtered = filtered.filter(log => log.role === selectedRole);
    }

    // Date range filter
    if (dateRange?.from) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        const startDate = dateRange.from!;
        const endDate = dateRange.to || dateRange.from!;
        
        return logDate >= startDate && logDate <= endDate;
      });
    }

    setFilteredLogs(filtered);
  };

  const clearFilters = () => {
    setSearchPhone("");
    setSelectedAgency("all");
    setSelectedRole("all");
    setDateRange(undefined);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'user':
        return 'default';
      case 'assistant':
        return 'secondary';
      case 'system':
        return 'outline';
      default:
        return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'user': return t("whatsapp.logs.roleUser");
      case 'assistant': return t("whatsapp.logs.roleAssistant");
      case 'system': return t("whatsapp.logs.roleSystem");
      default: return role;
    }
  };

  // Map known error/system content patterns to user-friendly text
  const getFriendlyContent = (log: WhatsAppLog): { display: string; isTechnical: boolean; badge?: string } => {
    const c = log.content || "";
    const meta = log.metadata as Record<string, any> | null;

    // Subscription dropped (from whatsapp-webhook/index.ts:272)
    if (meta?.dropped_reason?.startsWith("subscription_")) {
      const sub = meta.dropped_reason.replace("subscription_", "");
      return { display: t("whatsapp.logs.errors.subscriptionDropped", { status: sub }), isTechnical: true, badge: "subscription" };
    }
    if (c.startsWith("[Abonelik ")) {
      return { display: t("whatsapp.logs.errors.subscriptionNote"), isTechnical: true, badge: "subscription" };
    }

    // Webhook subscription expired
    if (meta?.dropped_reason === "webhook_not_subscribed" || c.includes("webhook_subscribed")) {
      return { display: t("whatsapp.logs.errors.webhookNotSubscribed"), isTechnical: true, badge: "webhook" };
    }

    // Quota exceeded
    if (meta?.dropped_reason === "quota_exceeded" || c.includes("message limit")) {
      return { display: t("whatsapp.logs.errors.quotaExceeded"), isTechnical: true, badge: "quota" };
    }

    // Bot paused / human takeover
    if (meta?.dropped_reason === "bot_paused" || c.includes("bot_paused")) {
      return { display: t("whatsapp.logs.errors.botPaused"), isTechnical: true, badge: "takeover" };
    }

    // AI context data (JSON from adapter.ts) — very long JSON blobs
    if (log.role === "system" && c.trimStart().startsWith("{") && c.length > 200) {
      return { display: t("whatsapp.logs.errors.systemContext"), isTechnical: true, badge: "context" };
    }

    // Long system prompts (AI instructions)
    if (log.role === "system" && (c.startsWith("You are") || c.startsWith("Sen bir") || c.length > 500)) {
      return { display: t("whatsapp.logs.errors.systemPrompt"), isTechnical: true, badge: "prompt" };
    }

    // Meta / 24h window error in content
    if (c.includes("OUTSIDE_24H") || c.includes("outside_24h")) {
      return { display: t("whatsapp.logs.errors.outside24h"), isTechnical: true, badge: "meta" };
    }
    if (c.includes("META_403") || c.includes("meta_403")) {
      return { display: t("whatsapp.logs.errors.meta403"), isTechnical: true, badge: "meta" };
    }
    if (c.includes("META_RATE_LIMIT") || c.includes("rate_limit")) {
      return { display: t("whatsapp.logs.errors.metaRateLimit"), isTechnical: true, badge: "meta" };
    }
    if (c.includes("TEMPLATE_NOT_FOUND") || c.includes("template_not")) {
      return { display: t("whatsapp.logs.errors.templateNotFound"), isTechnical: true, badge: "meta" };
    }

    return { display: c, isTechnical: false };
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("whatsapp.logs.title")}</h2>
          <p className="text-muted-foreground">{t("whatsapp.logs.subtitle")}</p>
        </div>
        <Button onClick={loadLogs} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t("common.filters")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Phone Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <User className="h-4 w-4 inline mr-1" />
                {t("whatsapp.logs.phoneNumber")}
              </label>
              <Input
                placeholder={t("whatsapp.logs.phoneSearch")}
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
              />
            </div>

            {/* Agency Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <Building2 className="h-4 w-4 inline mr-1" />
                {t("whatsapp.logs.agency")}
              </label>
              <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                <SelectTrigger>
                  <SelectValue placeholder={t("whatsapp.logs.agencySelect")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <MessageSquare className="h-4 w-4 inline mr-1" />
                {t("whatsapp.logs.role")}
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder={t("whatsapp.logs.roleSelect")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="user">{t("whatsapp.logs.roleUser")}</SelectItem>
                  <SelectItem value="assistant">{t("whatsapp.logs.roleAssistant")}</SelectItem>
                  <SelectItem value="system">{t("whatsapp.logs.roleSystem")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <CalendarIcon className="h-4 w-4 inline mr-1" />
                {t("whatsapp.logs.dateRange")}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd MMM yyyy", { locale: tr })} -{" "}
                          {format(dateRange.to, "dd MMM yyyy", { locale: tr })}
                        </>
                      ) : (
                        format(dateRange.from, "dd MMM yyyy", { locale: tr })
                      )
                    ) : (
                      <span>{t("common.selectDate")}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={tr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clear Filters Button */}
          {(searchPhone || selectedAgency !== "all" || selectedRole !== "all" || dateRange) && (
            <div className="mt-4">
              <Button onClick={clearFilters} variant="ghost" size="sm">
                <X className="h-4 w-4 mr-2" />
                {t("whatsapp.logs.clearFilters")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("whatsapp.logs.results", { count: filteredLogs.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("whatsapp.logs.loading")}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("whatsapp.logs.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("whatsapp.logs.colDate")}</TableHead>
                    <TableHead>{t("whatsapp.logs.colAgency")}</TableHead>
                    <TableHead>{t("whatsapp.logs.colPhone")}</TableHead>
                    <TableHead>{t("whatsapp.logs.colRole")}</TableHead>
                    <TableHead>{t("whatsapp.logs.colMessage")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: tr })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {log.agencies?.name || t("whatsapp.logs.unknown")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {log.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(log.role)}>
                          {getRoleLabel(log.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {(() => {
                          const { display, isTechnical, badge } = getFriendlyContent(log);
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className={`text-left hover:text-primary transition-colors ${isTechnical ? "text-muted-foreground italic" : ""}`}>
                                  {isTechnical ? (
                                    <span className="flex items-center gap-1">
                                      {badge && <Badge variant="outline" className="text-xs py-0 h-4">{badge}</Badge>}
                                      {display}
                                    </span>
                                  ) : (
                                    truncateContent(display)
                                  )}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-96" side="left">
                                <div className="space-y-2">
                                  <div className="font-semibold">{t("whatsapp.logs.fullMessage")}</div>
                                  {isTechnical && (
                                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded font-mono break-all">
                                      {log.content.slice(0, 500)}{log.content.length > 500 ? "…" : ""}
                                    </div>
                                  )}
                                  {!isTechnical && (
                                    <div className="text-sm whitespace-pre-wrap break-words">{log.content}</div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
