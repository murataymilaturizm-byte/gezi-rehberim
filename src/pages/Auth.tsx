import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plane } from "lucide-react";
import turzzLogo from "@/assets/turzz-logo-orange.png";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email({ message: "Geçerli bir email adresi girin" }),
  password: z.string().min(6, { message: "Şifre en az 6 karakter olmalı" }),
});

const signupSchema = authSchema.extend({
  fullName: z.string().trim().min(2, { message: "Ad Soyad en az 2 karakter olmalı" }).max(100, { message: "Ad Soyad en fazla 100 karakter olabilir" }),
  agencyName: z.string().trim().min(2, { message: "Acente adı en az 2 karakter olmalı" }).max(100, { message: "Acente adı en fazla 100 karakter olabilir" }),
  phone: z.string().trim().min(10, { message: "Geçerli bir telefon numarası girin" }).max(20, { message: "Telefon numarası çok uzun" }),
  city: z.string().trim().min(2, { message: "Şehir en az 2 karakter olmalı" }).max(50, { message: "Şehir en fazla 50 karakter olabilir" }),
  region: z.string().trim().optional(),
  planType: z.enum(["starter", "professional", "enterprise"], { message: "Lütfen bir plan seçin" }),
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // URL parametrelerinden mode, plan ve billing bilgisini al
  const modeParam = searchParams.get("mode");
  const planParam = searchParams.get("plan");
  const billingParam = searchParams.get("billing");
  
  const [isLogin, setIsLogin] = useState(modeParam !== "signup");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [isYearly, setIsYearly] = useState(billingParam === "yearly");
  const [planType, setPlanType] = useState<"starter" | "professional" | "enterprise">(
    (planParam === "başlangıç" ? "starter" : 
     planParam === "profesyonel" ? "professional" : 
     planParam === "kurumsal" ? "enterprise" : 
     "starter") as "starter" | "professional" | "enterprise"
  );

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/admin");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/admin");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = isLogin 
      ? authSchema.safeParse({ email, password })
      : signupSchema.safeParse({ email, password, fullName, agencyName, phone, city, region, planType });
      
    if (!validation.success) {
      toast({
        title: "Hata",
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Email veya şifre hatalı");
          }
          throw error;
        }

        toast({
          title: "Başarılı! ✅",
          description: "Giriş yapıldı",
        });
      } else {
        // Sign up
        const redirectUrl = `${window.location.origin}/admin`;
        
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName.trim()
            }
          }
        });

        if (authError) {
          if (authError.message.includes("User already registered")) {
            throw new Error("Bu email adresi zaten kayıtlı");
          }
          throw authError;
        }

        if (!authData.user) {
          throw new Error("Kullanıcı oluşturulamadı");
        }

        // Create agency with plan information
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 days trial

        const { error: agencyError } = await supabase
          .from("agencies")
          .insert({
            user_id: authData.user.id,
            agency_name: agencyName.trim(),
            city: city.trim(),
            region: region.trim() || null,
            twilio_account_sid: "TEMP_SID", // Will be updated later
            twilio_auth_token: "TEMP_TOKEN", // Will be updated later
            twilio_phone_number: "TEMP_PHONE", // Will be updated later
            active: false, // Will be activated after Twilio setup
            plan_type: planType,
            trial_ends_at: trialEndsAt.toISOString(),
            subscription_status: "trial"
          });

        if (agencyError) {
          console.error("Agency creation error:", agencyError);
          throw new Error("Acente kaydı oluşturulamadı");
        }

        toast({
          title: "Başarılı! ✅",
          description: "Hesap oluşturuldu! 14 gün deneme süreniz başladı.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "İşlem sırasında bir hata oluştu",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={turzzLogo} alt="Turzz Logo" className="h-32 w-auto" />
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? "Admin Paneli" : "TurzzAI'ya Hoş Geldiniz"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Giriş yapın" : "14 gün ücretsiz deneme ile başlayın"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Ad Soyad</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ahmet Yılmaz"
                    required
                    disabled={isLoading}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agencyName">Acente Adı</Label>
                  <Input
                    id="agencyName"
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Mavi Tur Seyahat"
                    required
                    disabled={isLoading}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon Numarası</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0555 123 45 67"
                    required
                    disabled={isLoading}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    Destek için sizinle iletişime geçmemiz gerekebilir
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Şehir</Label>
                    <Input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="İstanbul"
                      required
                      disabled={isLoading}
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Bölge (İsteğe Bağlı)</Label>
                    <Input
                      id="region"
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder="Marmara"
                      disabled={isLoading}
                      maxLength={50}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Plan Seçimi</Label>
                  <div className="bg-accent/30 border border-primary/20 rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <span className="text-primary">🎉</span>
                      <span>İlk 14 gün <strong>tamamen ücretsiz!</strong></span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Kredi kartı gerekmez • İstediğiniz zaman iptal edebilirsiniz
                    </p>
                  </div>
                  
                  {/* Billing Period Toggle */}
                  <div className="flex items-center justify-center gap-3 p-3 bg-card rounded-lg border border-border mb-3">
                    <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold text-sm" : "text-muted-foreground text-sm"}>
                      Aylık
                    </Label>
                    <Switch
                      id="billing-toggle"
                      checked={isYearly}
                      onCheckedChange={setIsYearly}
                      disabled={isLoading}
                    />
                    <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold text-sm" : "text-muted-foreground text-sm"}>
                      Yıllık
                    </Label>
                    {isYearly && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        %10 İndirim
                      </span>
                    )}
                  </div>
                  
                  <div className="grid gap-3">
                    <label
                      className={`relative flex cursor-pointer rounded-lg border p-4 transition-all ${
                        planType === "starter"
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "border-border hover:border-primary/50"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value="starter"
                        checked={planType === "starter"}
                        onChange={(e) => setPlanType(e.target.value as "starter")}
                        disabled={isLoading}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">Başlangıç</span>
                          <div className="text-right">
                            <span className="text-sm text-muted-foreground line-through">
                              {isYearly ? "32.388₺/yıl" : "2.999₺/ay"}
                            </span>
                            <div className="text-lg font-bold text-primary">İlk 14 Gün ÜCRETSIZ</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">500 mesaj/ay • Temel özellikler</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isYearly ? "Yıllık 29.149₺ - %10 indirimli" : "Aylık 2.999₺"}
                        </p>
                      </div>
                    </label>

                    <label
                      className={`relative flex cursor-pointer rounded-lg border p-4 transition-all ${
                        planType === "professional"
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "border-border hover:border-primary/50"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value="professional"
                        checked={planType === "professional"}
                        onChange={(e) => setPlanType(e.target.value as "professional")}
                        disabled={isLoading}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">Profesyonel</span>
                          <div className="text-right">
                            <span className="text-sm text-muted-foreground line-through">
                              {isYearly ? "86.388₺/yıl" : "7.999₺/ay"}
                            </span>
                            <div className="text-lg font-bold text-primary">İlk 14 Gün ÜCRETSIZ</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">2.000 mesaj/ay • Gelişmiş özellikler</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isYearly ? "Yıllık 77.749₺ - %10 indirimli" : "Aylık 7.999₺"}
                        </p>
                      </div>
                    </label>

                    <label
                      className={`relative flex cursor-pointer rounded-lg border p-4 transition-all ${
                        planType === "enterprise"
                          ? "border-primary bg-primary/5 ring-2 ring-primary"
                          : "border-border hover:border-primary/50"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value="enterprise"
                        checked={planType === "enterprise"}
                        onChange={(e) => setPlanType(e.target.value as "enterprise")}
                        disabled={isLoading}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">Kurumsal</span>
                          <div className="text-right">
                            <span className="text-sm text-muted-foreground line-through">
                              {isYearly ? "161.988₺/yıl" : "14.999₺/ay"}
                            </span>
                            <div className="text-lg font-bold text-primary">İlk 14 Gün ÜCRETSIZ</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">Sınırsız • Tüm özellikler</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isYearly ? "Yıllık 145.789₺ - %10 indirimli" : "Aylık 14.999₺"}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-ocean hover:opacity-90 transition-smooth"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  İşleniyor...
                </>
              ) : isLogin ? (
                "Giriş Yap"
              ) : (
                "Kayıt Ol"
              )}
            </Button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
                disabled={isLoading}
              >
                {isLogin ? "Hesabınız yok mu? Kayıt olun" : "Zaten hesabınız var mı? Giriş yapın"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
