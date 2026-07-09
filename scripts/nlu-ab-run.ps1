# NLU A/B kosum scripti - FAZ NLU-pilot-A olcum.
# demo-chat X-NLU-AB debug yolundan korpusu iki modelde (Haiku + Sonnet-4.6) kosar,
# fark tablosu + ham JSON uretir. CANLI DAVRANIS DEGISMEZ (debug yolu state'e yazmaz).
#
# Kullanim:
#   $env:NLU_AB_TOKEN = "<secret>"   # demo-chat NLU_AB_TOKEN ile AYNI
#   ./scripts/nlu-ab-run.ps1
# Opsiyonel: -Url <fn-url> -Corpus <path> -Out <path> -Token <secret>
#
# GUVENLIK: token yoksa/yanlissa debug yolu kapali -> script anlamli cikti alamaz.

param(
  [string]$Url = "https://yaxjygtjtjmzslajuctk.supabase.co/functions/v1/demo-chat",
  [string]$Corpus = "$PSScriptRoot/../docs/nlu-ab-corpus.json",
  [string]$Out = "$PSScriptRoot/../docs/nlu-ab-results.json",
  [string]$Token = $env:NLU_AB_TOKEN
)

if (-not $Token) { Write-Error "NLU_AB_TOKEN gerekli (env veya -Token)."; exit 1 }

$corpusData = Get-Content $Corpus -Raw -Encoding utf8 | ConvertFrom-Json
$cases = $corpusData.cases
Write-Host ("Korpus: " + $cases.Count + " vaka | Model: Haiku vs Sonnet-4.6") -ForegroundColor Cyan

$results = @()
$diffCount = 0

foreach ($c in $cases) {
  $payload = @{
    message      = $c.message
    sessionId    = "nlu-ab-" + $c.id
    summary      = $c.summary
    state        = $c.state
    selectedTour = $null
  } | ConvertTo-Json -Depth 6

  try {
    $resp = Invoke-WebRequest -Uri $Url -Method POST -ContentType "application/json; charset=utf-8" -Headers @{ "X-NLU-AB" = $Token } -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 60
    $j = $resp.Content | ConvertFrom-Json
  } catch {
    Write-Host ("[" + $c.id + "] HATA: " + $_.Exception.Message) -ForegroundColor Red
    continue
  }

  if (-not $j.ab) { Write-Host ("[" + $c.id + "] debug yolu KAPALI (token yanlis?)") -ForegroundColor Red; break }

  $hInt = [string]$j.haiku.intent
  $sInt = [string]$j.sonnet.intent
  $hDates = ($j.haiku.entities.dates -join ",")
  $sDates = ($j.sonnet.entities.dates -join ",")
  $anyDiff = ($hInt -ne $sInt) -or ($hDates -ne $sDates)
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

  $flag = "same"; $col = "Gray"
  if ($anyDiff) { $flag = "DIFF"; $col = "Yellow" }
  $line = "[" + $c.id + "] " + $flag + "  H:" + $hInt.PadRight(20) + " S:" + $sInt.PadRight(20) + " msg:" + $c.message
  Write-Host $line -ForegroundColor $col
}

function Get-UsageSum($rows, $key) {
  $inp = 0; $out = 0; $cc = 0; $cr = 0
  foreach ($r in $rows) {
    $u = $r.$key
    if ($u) {
      if ($u.input_tokens) { $inp += [int]$u.input_tokens }
      if ($u.output_tokens) { $out += [int]$u.output_tokens }
      if ($u.cache_creation_input_tokens) { $cc += [int]$u.cache_creation_input_tokens }
      if ($u.cache_read_input_tokens) { $cr += [int]$u.cache_read_input_tokens }
    }
  }
  return [pscustomobject]@{ input = $inp; output = $out; cache_creation = $cc; cache_read = $cr }
}

$hSum = Get-UsageSum $results "haiku_usage"
$sSum = Get-UsageSum $results "sonnet_usage"

# Fiyat USD/1M: Haiku 4.5 in=1.00 out=5.00 ; Sonnet 4.6 in=3.00 out=15.00 ; cache_read ~ in*0.1
$hCost = ($hSum.input / 1e6 * 1.00) + ($hSum.output / 1e6 * 5.00)
$sCostNoCache = (($sSum.input + $sSum.cache_creation + $sSum.cache_read) / 1e6 * 3.00) + ($sSum.output / 1e6 * 15.00)
$sCostCache = (($sSum.input + $sSum.cache_creation) / 1e6 * 3.00) + ($sSum.cache_read / 1e6 * 0.30) + ($sSum.output / 1e6 * 15.00)

Write-Host ""
Write-Host "=== OZET ===" -ForegroundColor Cyan
Write-Host ("Toplam vaka: " + $results.Count + " | Farkli: " + $diffCount + " | Ayni: " + ($results.Count - $diffCount))
Write-Host ("Haiku  tokens: in=" + $hSum.input + " out=" + $hSum.output + " cache_read=" + $hSum.cache_read + " | ~maliyet USD=" + [math]::Round($hCost, 5))
Write-Host ("Sonnet tokens: in=" + $sSum.input + " out=" + $sSum.output + " cache_create=" + $sSum.cache_creation + " cache_read=" + $sSum.cache_read)
Write-Host ("Sonnet ~maliyet USD: cachesiz=" + [math]::Round($sCostNoCache, 5) + " | cache_read indirimli=" + [math]::Round($sCostCache, 5))
$cacheProof = "YOK (ilk kosumda beklenir; 5dk icinde tekrar kos)"
if ($sSum.cache_read -gt 0) { $cacheProof = "VAR (cache_read=" + $sSum.cache_read + ")" }
Write-Host ("Sonnet cache hit kaniti: " + $cacheProof)

@{
  meta    = @{ url = $Url; cases = $results.Count; diffs = $diffCount; haiku_usage = $hSum; sonnet_usage = $sSum; haiku_cost = $hCost; sonnet_cost_nocache = $sCostNoCache; sonnet_cost_cached = $sCostCache }
  results = $results
} | ConvertTo-Json -Depth 8 | Out-File $Out -Encoding utf8
Write-Host ""
Write-Host ("Sonuclar kaydedildi: " + $Out) -ForegroundColor Green
