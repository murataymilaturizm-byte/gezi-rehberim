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
  created_at: string;
  agency_id: string;
  agencies?: {
    agency_name: string;
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
  const [agencies, setAgencies] = useState<Array<{ id: string; agency_name: string }>>([]);

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
        .select('id, agency_name')
        .order('agency_name');

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
        console.log('No user found');
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
      console.log('Is super admin:', isSuperAdmin);

      let query = supabase
        .from('whatsapp_conversations')
        .select(`
          id,
          phone,
          role,
          content,
          created_at,
          agency_id,
          agencies (
            agency_name
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
          .single();

        if (!agencyData) {
          console.log('No agency found for user');
          return;
        }

        console.log('Filtering by agency:', agencyData.id);
        query = query.eq('agency_id', agencyData.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log('Loaded logs:', data?.length);
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error loading logs:', error);
      toast({
        title: "Hata",
        description: "Loglar yüklenirken bir hata oluştu: " + error.message,
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
      case 'user':
        return 'Kullanıcı';
      case 'assistant':
        return 'Asistan';
      case 'system':
        return 'Sistem';
      default:
        return role;
    }
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">WhatsApp Mesaj Logları</h2>
          <p className="text-muted-foreground">
            Tüm WhatsApp konuşmalarını görüntüleyin ve filtreleyin
          </p>
        </div>
        <Button onClick={loadLogs} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtreler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Phone Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <User className="h-4 w-4 inline mr-1" />
                Telefon Numarası
              </label>
              <Input
                placeholder="Telefon ara..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
              />
            </div>

            {/* Agency Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <Building2 className="h-4 w-4 inline mr-1" />
                Acente
              </label>
              <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                <SelectTrigger>
                  <SelectValue placeholder="Acente seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.agency_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <MessageSquare className="h-4 w-4 inline mr-1" />
                Rol
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="user">Kullanıcı</SelectItem>
                  <SelectItem value="assistant">Asistan</SelectItem>
                  <SelectItem value="system">Sistem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                <CalendarIcon className="h-4 w-4 inline mr-1" />
                Tarih Aralığı
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
                      <span>Tarih seçin</span>
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
                Filtreleri Temizle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            Mesaj Logları ({filteredLogs.length} sonuç)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loglar yükleniyor...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Gösterilecek log bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Acente</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Mesaj</TableHead>
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
                          {log.agencies?.agency_name || 'Bilinmiyor'}
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
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-left hover:text-primary transition-colors">
                              {truncateContent(log.content)}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96" side="left">
                            <div className="space-y-2">
                              <div className="font-semibold">Tam Mesaj:</div>
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {log.content}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
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
