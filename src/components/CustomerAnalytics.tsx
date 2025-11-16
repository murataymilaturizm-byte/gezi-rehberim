import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, TrendingUp, MessageSquare, Star, Award, Calendar, DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface CustomerStats {
  totalCustomers: number;
  vipCustomers: number;
  regularCustomers: number;
  potentialCustomers: number;
  inactiveCustomers: number;
  averageMessages: number;
  averageBookings: number;
  topCustomers: Array<{
    phone: string;
    full_name: string | null;
    total_bookings: number;
    total_spent: number;
    tags: string[];
  }>;
  customersByLanguage: Array<{ language: string; count: number }>;
  customersByTag: Array<{ tag: string; count: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

export const CustomerAnalytics = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCustomerStats();
  }, []);

  const loadCustomerStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if super admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();

      const isSuperAdmin = !!roleData;

      let agencyId = null;
      if (!isSuperAdmin) {
        const { data: agency } = await supabase
          .from("agencies")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!agency) return;
        agencyId = agency.id;
      }

      // Get all user profiles
      let profilesQuery = supabase
        .from("whatsapp_user_profiles")
        .select("*");

      if (agencyId) {
        profilesQuery = profilesQuery.eq("agency_id", agencyId);
      }

      const { data: profiles } = await profilesQuery;

      if (!profiles) {
        setStats(null);
        return;
      }

      // Calculate stats
      const totalCustomers = profiles.length;
      const vipCustomers = profiles.filter(p => p.tags?.includes('vip')).length;
      const regularCustomers = profiles.filter(p => p.tags?.includes('regular')).length;
      const potentialCustomers = profiles.filter(p => p.tags?.includes('potential')).length;
      const inactiveCustomers = profiles.filter(p => p.tags?.includes('inactive')).length;

      const averageMessages = profiles.reduce((sum, p) => sum + (p.total_messages || 0), 0) / totalCustomers;
      const averageBookings = profiles.reduce((sum, p) => sum + (p.total_bookings || 0), 0) / totalCustomers;

      // Top customers by spending
      const topCustomers = profiles
        .filter(p => (p.total_spent || 0) > 0)
        .sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
        .slice(0, 10)
        .map(p => ({
          phone: p.phone,
          full_name: p.full_name,
          total_bookings: p.total_bookings || 0,
          total_spent: p.total_spent || 0,
          tags: p.tags || []
        }));

      // Customers by language
      const languageCounts: Record<string, number> = {};
      profiles.forEach(p => {
        const lang = p.language_preference || 'Belirtilmemiş';
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      });

      const customersByLanguage = Object.entries(languageCounts).map(([language, count]) => ({
        language,
        count
      }));

      // Customers by tag
      const tagCounts: Record<string, number> = {};
      profiles.forEach(p => {
        if (p.tags) {
          p.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      const customersByTag = Object.entries(tagCounts).map(([tag, count]) => ({
        tag,
        count
      }));

      setStats({
        totalCustomers,
        vipCustomers,
        regularCustomers,
        potentialCustomers,
        inactiveCustomers,
        averageMessages,
        averageBookings,
        topCustomers,
        customersByLanguage,
        customersByTag
      });
    } catch (error) {
      console.error("Customer analytics error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted" />
              <CardContent className="h-24 bg-muted/50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">{t("customerAnalytics.noCustomerData")}</p>
          <p className="text-sm text-muted-foreground mt-2">{t("customerAnalytics.noCustomerDataDescription")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Özet Kartlar */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("customerAnalytics.totalCustomers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("customerAnalytics.allCustomers")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("customerAnalytics.vipCustomers")}</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.vipCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("customerAnalytics.vipDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("customerAnalytics.regularCustomers")}</CardTitle>
            <Award className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.regularCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("customerAnalytics.regularDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("customerAnalytics.potentialCustomers")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.potentialCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("customerAnalytics.potentialDescription")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("customerAnalytics.inactiveCustomers")}</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.inactiveCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("customerAnalytics.inactiveDescription")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ortalama Metrikler */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("customerAnalytics.averageMessages")}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageMessages.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("customerAnalytics.perCustomer")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("customerAnalytics.averageBookings")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageBookings.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("customerAnalytics.perCustomer")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Müşteri Segmentasyonu */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Müşteri Segmentleri</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.customersByTag}
                  dataKey="count"
                  nameKey="tag"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.tag}: ${entry.count}`}
                >
                  {stats.customersByTag.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dil Tercihleri</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.customersByLanguage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="language" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" name="Müşteri Sayısı" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* En Çok Harcama Yapan Müşteriler */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("customerAnalytics.topCustomers")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.topCustomers.map((customer, index) => (
              <div key={customer.phone} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{customer.full_name || customer.phone}</p>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    <div className="flex gap-1 mt-1">
                      {customer.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {new Intl.NumberFormat('tr-TR').format(customer.total_spent)} TL
                  </p>
                  <p className="text-sm text-muted-foreground">{customer.total_bookings} {t("customerAnalytics.reservations")}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
