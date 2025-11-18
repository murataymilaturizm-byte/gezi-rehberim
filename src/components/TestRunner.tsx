import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Play, Download, CheckCircle2, XCircle, MinusCircle, Loader2, Zap } from 'lucide-react';

interface TestResult {
  id: string;
  category: string;
  name: string;
  demoResult: 'pass' | 'fail' | 'skip';
  whatsappResult: 'pass' | 'fail' | 'skip';
  match: boolean;
  details: string;
  demoData?: any;
  whatsappData?: any;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  matchRate: number;
}

export default function TestRunner() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [profiles, setProfiles] = useState<any>(null);

  // Form state
  const [demoSessionId, setDemoSessionId] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [testType, setTestType] = useState<string>('');

  const runAutoTests = async () => {
    setLoading(true);
    setResults([]);
    setSummary(null);

    try {
      // Get current user's agency
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Kullanıcı bulunamadı');

      // Get user's agency
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id, agency_name')
        .eq('user_id', user.id)
        .single();

      if (!agencies) throw new Error('Agency bulunamadı');

      const currentAgencyId = agencies.id;

      // Get demo session - most recent from whatsapp_conversations where phone starts with 'session_'
      // Demo chats are stored with DEMO_AGENCY_ID, so we don't filter by current agency
      const { data: demoConversations, error: demoError } = await supabase
        .from('whatsapp_conversations')
        .select('phone')
        .like('phone', 'session_%')
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('Demo conversations query:', { demoConversations, demoError });

      if (!demoConversations || demoConversations.length === 0) {
        toast({
          title: 'Demo Profil Bulunamadı',
          description: 'Demo chat profili bulunamadı. Önce demo chat\'te bir konuşma yapın.',
          variant: 'destructive'
        });
        return;
      }

      const sessionId = demoConversations[0].phone;
      console.log('Found demo session:', sessionId);

      // Get WhatsApp profile - most recent from whatsapp_user_profiles
      const { data: whatsappProfile } = await supabase
        .from('whatsapp_user_profiles')
        .select('phone')
        .eq('agency_id', currentAgencyId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (!whatsappProfile) {
        toast({
          title: 'WhatsApp Profil Bulunamadı',
          description: 'WhatsApp profili bulunamadı. Önce WhatsApp\'tan bir konuşma yapın.',
          variant: 'destructive'
        });
        return;
      }

      // Auto-fill form
      setDemoSessionId(sessionId);
      setWhatsappPhone(whatsappProfile.phone);
      setAgencyId(currentAgencyId);

      // Run tests
      const { data, error } = await supabase.functions.invoke('test-suite', {
        body: {
          demoSessionId: sessionId,
          whatsappPhone: whatsappProfile.phone,
          agencyId: currentAgencyId,
          testType: 'all'
        }
      });

      if (error) throw error;

      setResults(data.results);
      setSummary(data.summary);
      setProfiles(data.profiles);

      toast({
        title: '✅ Otomatik Testler Tamamlandı',
        description: `${data.summary.passed}/${data.summary.total} test başarılı (${data.summary.matchRate}% eşleşme)`
      });
    } catch (error) {
      console.error('Auto test error:', error);
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Testler çalıştırılırken bir hata oluştu',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const runTests = async () => {
    if (!demoSessionId || !whatsappPhone || !agencyId) {
      toast({
        title: 'Hata',
        description: 'Lütfen tüm alanları doldurun',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setResults([]);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-suite', {
        body: {
          demoSessionId,
          whatsappPhone,
          agencyId,
          testType: testType || null
        }
      });

      if (error) throw error;

      setResults(data.results);
      setSummary(data.summary);
      setProfiles(data.profiles);

      toast({
        title: 'Testler Tamamlandı',
        description: `${data.summary.passed}/${data.summary.total} test başarılı (${data.summary.matchRate}% eşleşme)`
      });
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: 'Hata',
        description: 'Testler çalıştırılırken bir hata oluştu',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const runMockTests = async () => {
    setLoading(true);
    setResults([]);
    setSummary(null);

    try {
      // Get current user's agency
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Kullanıcı bulunamadı');

      // Get user's agency
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id, agency_name')
        .eq('user_id', user.id)
        .single();

      if (!agencies) throw new Error('Agency bulunamadı');

      const currentAgencyId = agencies.id;

      // Run tests with mock data
      const { data, error } = await supabase.functions.invoke('test-suite', {
        body: {
          demoSessionId: 'mock_session',
          whatsappPhone: '+905551234567',
          agencyId: currentAgencyId,
          testType: 'all',
          useMockData: true
        }
      });

      if (error) throw error;

      setResults(data.results);
      setSummary(data.summary);
      setProfiles(data.profiles);

      toast({
        title: '✅ Mock Testler Tamamlandı',
        description: `${data.summary.passed}/${data.summary.total} test başarılı (${data.summary.matchRate}% eşleşme)`,
        duration: 5000
      });
    } catch (error) {
      console.error('Mock test error:', error);
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Mock testler çalıştırılırken bir hata oluştu',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary,
      results,
      profiles
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Rapor İndirildi',
      description: 'Test raporu başarıyla indirildi'
    });
  };

  const getResultIcon = (result: 'pass' | 'fail' | 'skip') => {
    switch (result) {
      case 'pass':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'skip':
        return <MinusCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getResultBadge = (result: 'pass' | 'fail' | 'skip') => {
    const variants: Record<string, any> = {
      pass: 'default',
      fail: 'destructive',
      skip: 'secondary'
    };
    return <Badge variant={variants[result]}>{result.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🧪 Test Automation Suite</CardTitle>
          <CardDescription>
            Demo ve WhatsApp entegrasyonlarını otomatik olarak test edin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="demoSessionId">Demo Session ID</Label>
              <Input
                id="demoSessionId"
                placeholder="örn: abc123"
                value={demoSessionId}
                onChange={(e) => setDemoSessionId(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappPhone">WhatsApp Phone</Label>
              <Input
                id="whatsappPhone"
                placeholder="örn: +905551234567"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agencyId">Agency ID</Label>
              <Input
                id="agencyId"
                placeholder="UUID"
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="testType">Test Type (Opsiyonel)</Label>
              <select
                id="testType"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                disabled={loading}
              >
                <option value="">Tüm Testler</option>
                <option value="memory">Memory Tests</option>
                <option value="conversation">Conversation State Tests</option>
                <option value="insights">Profile Insights Tests</option>
                <option value="registrations">Registration Tests</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={runMockTests} disabled={loading} size="lg" className="w-full" variant="default">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Mock Test Çalışıyor...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  🎭 Mock Data ile Test (Konuşma Gerekmez)
                </>
              )}
            </Button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex-1 border-t" />
              <span>veya gerçek verilerle</span>
              <div className="flex-1 border-t" />
            </div>

            <Button onClick={runAutoTests} disabled={loading} size="lg" variant="outline" className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Testler Çalışıyor...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Gerçek Verilerle Otomatik Test
                </>
              )}
            </Button>

            {results.length > 0 && (
              <Button onClick={exportResults} variant="secondary" size="lg" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Raporu İndir
              </Button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">veya manuel test</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={runTests} disabled={loading} variant="outline" className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testler Çalışıyor...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Manuel Test Çalıştır
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Test Sonuçları</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.total}</div>
                  <div className="text-sm text-muted-foreground">Toplam Test</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
                  <div className="text-sm text-muted-foreground">Başarılı</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                  <div className="text-sm text-muted-foreground">Başarısız</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.matchRate}%</div>
                  <div className="text-sm text-muted-foreground">Eşleşme</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Eşleşme Oranı</span>
                  <span>{summary.matchRate}%</span>
                </div>
                <Progress value={summary.matchRate} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📋 Detaylı Test Sonuçları</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Test Adı</TableHead>
                  <TableHead>Demo</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Eşleşme</TableHead>
                  <TableHead>Detaylar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-mono text-sm">{result.id}</TableCell>
                    <TableCell>{result.category}</TableCell>
                    <TableCell>{result.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getResultIcon(result.demoResult)}
                        {getResultBadge(result.demoResult)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getResultIcon(result.whatsappResult)}
                        {getResultBadge(result.whatsappResult)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.match ? (
                        <Badge variant="default">✓ Match</Badge>
                      ) : (
                        <Badge variant="destructive">✗ No Match</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={result.details}>
                      {result.details}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {profiles && (
        <Card>
          <CardHeader>
            <CardTitle>👥 Profile Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Demo Profile</h4>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                  {JSON.stringify(profiles.demo, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold mb-2">WhatsApp Profile</h4>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
                  {JSON.stringify(profiles.whatsapp, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
