# NLU A/B koşum script'i — FAZ NLU-pilot-A ölçüm.
# demo-chat X-NLU-AB debug yolundan korpusu iki modelde (Haiku + Sonnet-4.6) koşar,
# fark tablosu + ham JSON üretir. CANLI DAVRANIŞ DEĞİŞMEZ (debug yolu state'e yazmaz).
#
# Kullanım:
#   $env:NLU_AB_TOKEN = "<secret>"   # demo-chat'e set edilen NLU_AB_TOKEN ile AYNI
#   ./scripts/nlu-ab-run.ps1
# Opsiyonel: -Url <fn-url> -Corpus <path> -Out <path>
#
# GÜVENLİK: token yoksa/yanlışsa debug yolu kapalı → script anlamlı çıktı alamaz.

param(
  [string]$Url = "https://yaxjygtjtjmzslajuctk.supabase.co/functions/v1/demo-chat",
  [string]$Corpus = "$PSScriptRoot/../docs/nlu-ab-corpus.json",
  [string]$Out = "$PSScriptRoot/../docs/nlu-ab-results.json",
  [string]$Token = $env:NLU_AB_TOKEN
)

if (-not $Token) { Write-Error "NLU_AB_TOKEN gerekli (env veya -Token). demo-chat secret'i ile ayni olmali."; exit 1 }

$corpusData = Get-Content $Corpus -Raw -Encoding utf8 | ConvertFrom-Json
$cases = $corpusData.cases
Write-Host "Korpus: $($cases.Count) vaka | Model: Haiku vs Sonnet-4.6`n" -ForegroundColor Cyan

$results = @()
$diffCount = 0

foreach ($c in $cases) {
  $payload = @{
    message       = $c.message
    sessionId     = "nlu-ab-$($c.id)"   # debug yolu state'e yazmaz ama alan zorunlu degil
    summary       = $c.summary
    state         = $c.state
    selectedTour  = $null
  } | ConvertTo-Json -Depth 6

  try {
    $resp = Invoke-WebRequest -Uri $Url -Method POST `
      -ContentType "application/json; charset=utf-8" `
      -Headers @{ "X-NLU-AB" = $Token } `
      -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 60
    $j = $resp.Content | ConvertFrom-Json
  } catch {
    Write-Host "[$($c.id)] HATA: $($_.Exception.Message)" -ForegroundColor Red
    continue
  }

  if (-not $j.ab) { Write-Host "[$($c.id)] debug yolu KAPALI (token yanlis?) — cikiliyor" -ForegroundColor Red; break }

  $hInt = $j.haiku.intent; $sInt = $j.sonnet.intent
  $hDates = ($j.haiku.entities.dates -join ",")
  $sDates = ($j.sonnet.entities.dates -join ",")
  $intentDiff = ($hInt -ne $sInt)
  $dateDiff = ($hDates -ne $sDates)
  $anyDiff = $intentDiff -or $dateDiff
  if ($anyDiff) { $diffCount++ }

  $results += [pscustomobject]@{
    id            = $c.id
    message       = $c.message
    expected      = $c.expected
    critical_path = $c.critical_path
    haiku_intent  = $hInt
    sonnet_intent = $sInt
    haiku_dates   = $hDates
    sonnet_dates  = $sDates
    diff          = $anyDiff
    haiku_usage   = $j.haiku.usage
    sonnet_usage  = $j.sonnet.usage
  }

  $flag = if ($anyDiff) { "DIFF" } else { "same" }
  $col = if ($anyDiff) { "Yellow" } else { "Gray" }
  Write-Host ("[{0,2}] {1,-6} H:{2,-20} S:{3,-20} | {4}" -f $c.id, $flag, $hInt, $sInt, $c.message) -ForegroundColor $col
}

# === Cache + maliyet ozeti ===
function Sum-Usage($rows, $key) {
  $inp = 0; $out = 0; $cc = 0; $cr = 0
  foreach ($r in $rows) {
    $u = $r.$key
    if ($u) {
      $inp += [int]($u.input_tokens); $out += [int]($u.output_tokens)
      $cc += [int]($u.cache_creation_input_tokens); $cr += [int]($u.cache_read_input_tokens)
    }
  }
  return [pscustomobject]@{ input = $inp; output = $out; cache_creation = $cc; cache_read = $cr }
}
$hSum = Sum-Usage $results "haiku_usage"
$sSum = Sum-Usage $results "sonnet_usage"

# Fiyat ($/1M): Haiku 4.5 in=1.00 out=5.00 ; Sonnet 4.6 in=3.00 out=15.00
# cache_read genelde input'un %10'u fiyatlanir (yaklasik); rapor icin ham + tahmini.
$hCost = ($hSum.input/1e6*1.00) + ($hSum.output/1e6*5.00)
$sCostNoCache = (($sSum.input + $sSum.cache_creation + $sSum.cache_read)/1e6*3.00) + ($sSum.output/1e6*15.00)
$sCostCache = (($sSum.input + $sSum.cache_creation)/1e6*3.00) + ($sSum.cache_read/1e6*0.30) + ($sSum.output/1e6*15.00)

Write-Host "`n=== OZET ===" -ForegroundColor Cyan
Write-Host ("Toplam vaka: {0} | Farkli: {1} | Ayni: {2}" -f $results.Count, $diffCount, ($results.Count - $diffCount))
Write-Host ("Haiku  tokens: in={0} out={1} cache_read={2} | ~maliyet=`${3:N5}" -f $hSum.input, $hSum.output, $hSum.cache_read, $hCost)
Write-Host ("Sonnet tokens: in={0} out={1} cache_create={2} cache_read={3}" -f $sSum.input, $sSum.output, $sSum.cache_creation, $sSum.cache_read)
Write-Host ("Sonnet ~maliyet: cache'siz=`${0:N5} | cache_read indirimli=`${1:N5}" -f $sCostNoCache, $sCostCache)
$cacheProof = if ($sSum.cache_read -gt 0) { "VAR (cache_read=$($sSum.cache_read))" } else { "YOK (ilk kosumda beklenir; 5dk icinde tekrar kos)" }
Write-Host ("Sonnet cache hit kaniti: {0}" -f $cacheProof)

# Ham + tablo kaydet
@{
  meta    = @{ url = $Url; cases = $results.Count; diffs = $diffCount;
               haiku_usage = $hSum; sonnet_usage = $sSum;
               haiku_cost = $hCost; sonnet_cost_nocache = $sCostNoCache; sonnet_cost_cached = $sCostCache }
  results = $results
} | ConvertTo-Json -Depth 8 | Out-File $Out -Encoding utf8
Write-Host "`nSonuclar kaydedildi: $Out" -ForegroundColor Green
