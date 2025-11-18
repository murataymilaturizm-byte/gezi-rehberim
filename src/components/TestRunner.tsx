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
import { Play, Download, CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react';

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

          <div className="flex gap-2">
            <Button onClick={runTests} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testler Çalışıyor...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Testleri Çalıştır
                </>
              )}
            </Button>

            {results.length > 0 && (
              <Button onClick={exportResults} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Raporu İndir
              </Button>
            )}
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
