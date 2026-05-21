import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCityRegionLanguage } from "@/utils/cityLanguageMapper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Dile göre varsayılan para birimi (signup formu için)
const LANG_DEFAULT_CURRENCY: Record<string, string> = {
  tr: 'TRY', en: 'USD', de: 'EUR', fr: 'EUR',
  es: 'EUR', ru: 'RUB', ar: 'SAR',
};

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();

  const authSchema = z.object({
    email: z.string().email({ message: t("auth.validation.invalidEmail") }),
    password: z.string().min(6, { message: t("auth.validation.passwordMinLength") }),
  });

  const signupSchema = authSchema.extend({
    fullName: z.string().trim().min(2, { message: t("auth.validation.fullNameMinLength") }).max(100, { message: t("auth.validation.fullNameMaxLength") }),
    agencyName: z.string().trim().min(2, { message: t("auth.validation.agencyNameMinLength") }).max(100, { message: t("auth.validation.agencyNameMaxLength") }),
    phone: z.string().trim().min(10, { message: t("auth.validation.phoneMinLength") }).max(20, { message: t("auth.validation.phoneMaxLength") }),
    city: z.string().trim().min(2, { message: t("auth.validation.cityMinLength") }).max(50, { message: t("auth.validation.cityMaxLength") }),
    region: z.string().trim().optional(),
    planType: z.enum(["starter", "professional", "enterprise"], { message: t("auth.validation.selectPlan") }),
  });
  
  // URL parametrelerinden mode, plan ve billing bilgisini al
  const modeParam = searchParams.get("mode");
  const planParam = searchParams.get("plan");
  const billingParam = searchParams.get("billing");
  
  const [isLogin, setIsLogin] = useState(modeParam !== "signup");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [isYearly, setIsYearly] = useState(billingParam === "yearly");
  const [currency, setCurrency] = useState(() => LANG_DEFAULT_CURRENCY[i18n.language] || 'USD');
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
    
    // Validate input — collect field-level errors for inline display
    const validation = isLogin
      ? authSchema.safeParse({ email, password })
      : signupSchema.safeParse({ email, password, fullName, agencyName, phone, city, region, planType });

    if (!validation.success) {
      const errs: Record<string, string> = {};
      validation.error.errors.forEach((e) => {
        const field = e.path[0] as string;
        if (!errs[field]) errs[field] = e.message;
      });
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

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
            throw new Error(t("auth.errors.invalidCredentials"));
          }
          throw error;
        }

        toast({
          title: t("auth.success.title"),
          description: t("auth.success.loginComplete"),
        });
      } else {
        // Sign up
        const redirectUrl = `${window.location.origin}/admin`;
        
        // Agency verileri handle_new_user trigger'ı tarafından okunacak.
        // signUp sonrası session null olduğu için (email doğrulaması bekliyor)
        // doğrudan agencies INSERT yapılamaz. Tüm veriler raw_user_meta_data'ya
        // gömülüyor, trigger SECURITY DEFINER ile DB'de agency'yi oluşturuyor.
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);
        const languagePreference = getCityRegionLanguage(city.trim(), region.trim());

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name:           fullName.trim(),
              agency_name:         agencyName.trim(),
              agency_city:         city.trim(),
              agency_region:       region.trim() || null,
              agency_lang:         languagePreference,
              agency_plan:         planType,
              agency_trial_ends:   trialEndsAt.toISOString(),
              agency_currency:     currency,
            }
          }
        });

        if (authError) {
          if (authError.message.includes("User already registered")) {
            throw new Error(t("auth.errors.emailExists"));
          }
          throw authError;
        }

        if (!authData.user) {
          throw new Error(t("auth.errors.signupFailed"));
        }

        toast({
          title: t("auth.success.title"),
          description: t("auth.success.signupComplete"),
        });
      }
    } catch (error: any) {
      toast({
        title: t("auth.errors.title"),
        description: error.message || t("auth.errors.loginFailed"),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (error: any) {
      toast({
        title: t("auth.errors.title"),
        description: error.message || t("auth.errors.resetFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/"><img src={turzzLogo} alt="Turzz Logo" className="h-14 sm:h-16 w-auto transition-transform duration-300 hover:scale-105 cursor-pointer" /></a>
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground">{t("hero.subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSelector />
              <ThemeToggle />
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/">{t("nav.home")}</a>
              </Button>
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/yardim">{t("nav.help")}</a>
              </Button>
              <Button asChild variant="ghost" className="hidden md:inline-flex hover:scale-105 transition-transform duration-300">
                <a href="/nasil-baslarim">{t("nav.gettingStarted")}</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center p-4 py-12">
      {isForgotPassword ? (
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={turzzLogo} alt="Turzz Logo" className="h-20 w-auto" />
            </div>
            <CardTitle className="text-2xl">{t("auth.forgotPasswordTitle")}</CardTitle>
            <CardDescription>{t("auth.forgotPasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {forgotSent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">{t("auth.resetLinkSent")}</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setIsForgotPassword(false); setForgotSent(false); }}
                >
                  {t("auth.backToLogin")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">{t("auth.email")}</Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder={t("auth.placeholders.email")}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-ocean hover:opacity-90 transition-smooth"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("auth.processing")}</>
                  ) : (
                    t("auth.sendResetLink")
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(false)}
                    className="text-sm text-primary hover:underline"
                    disabled={isLoading}
                  >
                    {t("auth.backToLogin")}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
      <Card className="w-full max-w-2xl shadow-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={turzzLogo} alt="Turzz Logo" className="h-20 w-auto" />
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? t("auth.login") : "TurzzAI"}
          </CardTitle>
          <CardDescription>
            {isLogin ? t("auth.login") : t("auth.trialInfo")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("auth.placeholders.fullName")}
                    required
                    disabled={isLoading}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agencyName">{t("auth.agencyName")}</Label>
                  <Input
                    id="agencyName"
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder={t("auth.placeholders.agencyName")}
                    required
                    disabled={isLoading}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t("auth.phone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("auth.placeholders.phone")}
                    required
                    disabled={isLoading}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("auth.phoneHelp")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">{t("auth.city")}</Label>
                    <Input
                      id="city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t("auth.placeholders.city")}
                      required
                      disabled={isLoading}
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">{t("auth.region")}</Label>
                    <Input
                      id="region"
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder={t("auth.placeholders.region")}
                      disabled={isLoading}
                      maxLength={50}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>{t("auth.planSelection")}</Label>
                  <div className="bg-accent/30 border border-primary/20 rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <span className="text-primary">🎉</span>
                      <span>{t("auth.trialInfo")}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("auth.trialDetails")}
                    </p>
                  </div>
                  
                  {/* Billing Period Toggle */}
                  <div className="flex items-center justify-center gap-3 p-3 bg-card rounded-lg border border-border mb-3">
                    <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold text-sm" : "text-muted-foreground text-sm"}>
                      {t("auth.monthly")}
                    </Label>
                    <Switch
                      id="billing-toggle"
                      checked={isYearly}
                      onCheckedChange={setIsYearly}
                      disabled={isLoading}
                    />
                    <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold text-sm" : "text-muted-foreground text-sm"}>
                      {t("auth.yearly")}
                    </Label>
                    {isYearly && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        {t("auth.discount10")}
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
                          <span className="font-semibold text-foreground">{t("admin.agency.plans.starter")}</span>
                          <div className="text-right">
                            <span className="text-sm text-muted-foreground line-through">
                              {isYearly ? "35.988₺" + t("auth.perYear") : "2.999₺" + t("auth.perMonth")}
                            </span>
                            <div className="text-lg font-bold text-primary">{t("auth.trialInfo")}</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{t("admin.subscription.planOptions.starter.features.0")} • {t("admin.subscription.planOptions.starter.features.1")}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isYearly ? "32.389₺" + t("auth.perYear") + " - " + t("auth.discount10") : "2.999₺" + t("auth.perMonth")}
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
                          <span className="font-semibold text-foreground">{t("admin.agency.plans.professional")}</span>
                          <div className="text-right">
                            <span className="text-sm text-muted-foreground line-through">
                              {isYearly ? "59.988₺" + t("auth.perYear") : "4.999₺" + t("auth.perMonth")}
                            </span>
                            <div className="text-lg font-bold text-primary">{t("auth.trialInfo")}</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{t("admin.subscription.planOptions.professional.features.0")} • {t("admin.subscription.planOptions.professional.features.1")}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isYearly ? "53.989₺" + t("auth.perYear") + " - " + t("auth.discount10") : "4.999₺" + t("auth.perMonth")}
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
                          <span className="font-semibold text-foreground">{t("admin.agency.plans.enterprise")}</span>
                          <div className="text-right">
                            <span className="text-sm text-muted-foreground line-through">
                              {isYearly ? "95.988₺" + t("auth.perYear") : "7.999₺" + t("auth.perMonth")}
                            </span>
                            <div className="text-lg font-bold text-primary">{t("auth.trialInfo")}</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{t("admin.subscription.planOptions.enterprise.features.0")} • {t("admin.subscription.planOptions.enterprise.features.1")}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isYearly ? "86.389₺" + t("auth.perYear") + " - " + t("auth.discount10") : "7.999₺" + t("auth.perMonth")}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Para birimi seçimi */}
                <div className="space-y-2">
                  <Label htmlFor="currency">{t("auth.currency")}</Label>
                  <Select value={currency} onValueChange={setCurrency} disabled={isLoading}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">₺ Türk Lirası (TRY)</SelectItem>
                      <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                      <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                      <SelectItem value="GBP">£ British Pound (GBP)</SelectItem>
                      <SelectItem value="SAR">﷼ Saudi Riyal (SAR)</SelectItem>
                      <SelectItem value="AED">د.إ UAE Dirham (AED)</SelectItem>
                      <SelectItem value="RUB">₽ Russian Ruble (RUB)</SelectItem>
                      <SelectItem value="CHF">CHF Swiss Franc</SelectItem>
                      <SelectItem value="JPY">¥ Japanese Yen (JPY)</SelectItem>
                      <SelectItem value="CNY">¥ Chinese Yuan (CNY)</SelectItem>
                      <SelectItem value="KWD">KD Kuwaiti Dinar (KWD)</SelectItem>
                      <SelectItem value="QAR">QR Qatari Riyal (QAR)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("auth.currencyHelp")}</p>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: "" })); }}
                placeholder={t("auth.placeholders.email")}
                disabled={isLoading}
                className={fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.password")}</Label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setForgotEmail(email); }}
                    className="text-xs text-primary hover:underline"
                    disabled={isLoading}
                  >
                    {t("auth.forgotPassword")}
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: "" })); }}
                placeholder={t("auth.placeholders.password")}
                disabled={isLoading}
                minLength={6}
                className={fieldErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-ocean hover:opacity-90 transition-smooth"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("auth.processing")}
                </>
              ) : isLogin ? (
                t("auth.login")
              ) : (
                t("auth.signup")
              )}
            </Button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
                disabled={isLoading}
              >
                {isLogin ? t("auth.dontHaveAccount") : t("auth.alreadyHaveAccount")}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}
      </div>
    </div>
  );
};

export default Auth;
