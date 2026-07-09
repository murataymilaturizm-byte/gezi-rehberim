# NLU 7-dil baseline kosum scripti - FAZ 4 P0.
# IKI BOLUM:
#  (1) OFFLINE DETERMINISTIK-SINYAL PROOF (endpoint GEREKTIRMEZ): Katman-1
#      sinyallerini (availability/tour_change/superlative/relative) korpus
#      mesajlarina uygular (kaynaktan BIREBIR .NET regex) -> dil x sinyal fire/miss
#      matrisi. Bu, P1-oncesi baseline'dir: bosluklarin 5 dilde KACTIGINI kanitlar.
#  (2) CANLI NLU (opsiyonel, -Token/NLU_AB_TOKEN verilirse): demo-chat X-NLU-AB
#      debug yolundan Sonnet-4.6 intent'i -> dil x intent. State'e yazmaz.
#
# Kullanim:
#   ./scripts/nlu-ab-run.ps1                      # yalniz offline proof
#   $env:NLU_AB_TOKEN="<secret>"; ./scripts/nlu-ab-run.ps1   # + canli NLU
#   ./scripts/nlu-ab-run.ps1 -Lang de             # tek-dil filtre
# Parametreler: -Url -Corpus -Out -Token -Lang

param(
  [string]$Url = "https://yaxjygtjtjmzslajuctk.supabase.co/functions/v1/demo-chat",
  [string]$Corpus = "$PSScriptRoot/../docs/nlu-ab-corpus.json",
  [string]$Out = "$PSScriptRoot/../docs/nlu-ab-results.json",
  [string]$Token = $env:NLU_AB_TOKEN,
  [string]$Lang = ""
)

$raw = Get-Content $Corpus -Raw -Encoding utf8
$raw = $raw -replace "^\xEF\xBB\xBF", ""
$corpusData = $raw | ConvertFrom-Json
$cases = $corpusData.cases
if ($Lang) { $cases = $cases | Where-Object { $_.lang -eq $Lang } }
$LANGS = @("tr", "en", "de", "fr", "es", "ru", "ar")

# ── Deterministik sinyal regexleri (KAYNAKTAN BIREBIR) ──
$reAvail = [regex]::new('(?<![\p{L}\p{N}])(müsait|musait|uygun|boş|bos|dolu|yer\s*var|available|availability|müsaitlik|musaitlik)', 'IgnoreCase')
$reTourChange = [regex]::new('(?:turuna\s+geç|tura\s+geç|turunu\s+değiş|turunu\s+al|turuna\s+geçelim|turuna\s+geçeyim|tur\s+değiş|değiştir.{0,10}tur|tur.{0,20}değiş|aslında.{0,30}tur|tur.{0,20}(?:yanlış|yanlis|hata)|(?:yanlış|yanlis).{0,15}tur|olacaktı|olacakti|değildi|degildi|olmamıştı|olmamisti)', 'IgnoreCase')
$reSupAsc = [regex]::new('(?<![\p{L}\p{N}])(en\s+(ucuz|uygun|hesaplı|hesapli|düşük|dusuk)|cheapest|lowest\s+price|cheapest\s+tour)', 'IgnoreCase')
$reSupDesc = [regex]::new('(?<![\p{L}\p{N}])(en\s+(pahalı|pahali|yüksek|yuksek)|most\s+expensive|highest\s+price)', 'IgnoreCase')
# relative: kaynak REL_* birlesimi (AR day-after/next-week/gun-adi KAYNAKTA YOK -> miss)
$relBody = 'bugün|bugun|today|heute|сегодня|اليوم|aujourdhui|hoy|' +
  'yarın|yarin|tomorrow|morgen|завтра|غدا|غداً|demain|mañana|manana|' +
  'öbür\s*gün|obür\s*gün|öbur\s*gün|obur\s*gün|öbür\s*gun|obür\s*gun|obur\s*gun|ertesi\s*gün|ertesi\s*gun|day\s*after\s*tomorrow|übermorgen|uebermorgen|послезавтра|après[\s-]?demain|apres[\s-]?demain|pasado\s*ma[nñ]ana|' +
  'haftaya|gelecek\s*hafta|önümüzdeki\s*hafta|onumuzdeki\s*hafta|next\s*week|nächste\s*woche|naechste\s*woche|следующ\S+\s+недел\S+|la\s*semaine\s*prochaine|semaine\s*prochaine|la\s*próxima\s*semana|próxima\s*semana'
$reRelative = [regex]::new("(?<![\p{L}\p{N}])(?:$relBody)(?![\p{L}\p{N}])", 'IgnoreCase')

function Test-DetSignal($sig, $msg) {
  switch ($sig) {
    "availability" { return $reAvail.IsMatch($msg) }
    "tour_change"  { return $reTourChange.IsMatch($msg) }
    "superlative"  { return $reSupAsc.IsMatch($msg) -or $reSupDesc.IsMatch($msg) }
    "relative"     { return $reRelative.IsMatch($msg) }
    default        { return $null }
  }
}

$doLive = [bool]$Token
Write-Host ("Korpus: " + $cases.Count + " vaka | Offline-proof: EVET | Canli-NLU: " + $(if ($doLive) { "EVET" } else { "HAYIR (token yok)" })) -ForegroundColor Cyan

$results = @()
foreach ($c in $cases) {
  $detFires = $null
  if ($c.det_signal) { $detFires = Test-DetSignal $c.det_signal $c.message }

  # gap-durumu: gap!=null ise sinyal MISS beklenir (baseline proof); fire ederse beklenmedik
  $gapStatus = ""
  if ($c.gap) {
    if ($detFires -eq $false) { $gapStatus = "GAP-DOGRULANDI(miss)" }
    elseif ($detFires -eq $true) { $gapStatus = "BEKLENMEDIK-FIRE" }
  } elseif ($null -ne $detFires) {
    if ($detFires) { $gapStatus = "OK(fire)" } else { $gapStatus = "REGRESYON?(miss)" }
  }

  $intent = ""
  if ($doLive) {
    $body = @{ message = $c.message; sessionId = "nlu7-" + $c.id; summary = $c.summary; state = $c.state } | ConvertTo-Json -Depth 6
    try {
      $resp = Invoke-WebRequest -Uri $Url -Method POST -ContentType "application/json; charset=utf-8" -Headers @{ "X-NLU-AB" = $Token } -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 60
      $j = $resp.Content | ConvertFrom-Json
      if ($j.ab) { $intent = [string]$j.sonnet.intent } else { $intent = "DEBUG-KAPALI"; $doLive = $false }
    } catch { $intent = "ERR" }
  }

  $results += [pscustomobject]@{
    id = $c.id; lang = $c.lang; scenario = $c.scenario; message = $c.message
    det_signal = $c.det_signal; det_fires = $detFires; gap = $c.gap; gap_status = $gapStatus
    expected_intent = $c.expected_intent; sonnet_intent = $intent
  }
}

# ── DIL x SINYAL BASELINE MATRISI ──
Write-Host ""
Write-Host "=== KATMAN-1 DETERMINISTIK SINYAL BASELINE (dil x sinyal: fire/miss) ===" -ForegroundColor Cyan
$sigTypes = @("availability", "tour_change", "superlative", "relative")
$hdr = "sinyal".PadRight(14); foreach ($l in $LANGS) { $hdr += $l.ToUpper().PadRight(6) }
Write-Host $hdr
foreach ($sig in $sigTypes) {
  $row = $sig.PadRight(14)
  foreach ($l in $LANGS) {
    $rr = @($results | Where-Object { $_.det_signal -eq $sig -and $_.lang -eq $l })
    if ($rr.Count -eq 0) { $row += "-".PadRight(6) }
    else {
      $anyFire = @($rr | Where-Object { $_.det_fires -eq $true }).Count -gt 0
      $row += $(if ($anyFire) { "fire" } else { "MISS" }).PadRight(6)
    }
  }
  Write-Host $row
}

# ── DIL x GECTI/KACTI OZET (deterministik sinyalli satirlar) ──
Write-Host ""
Write-Host "=== DIL OZETI (deterministik-sinyal satirlari) ===" -ForegroundColor Cyan
Write-Host ("dil".PadRight(6) + "det-satir".PadRight(11) + "fire".PadRight(7) + "miss".PadRight(7) + "gap-dogrulandi")
foreach ($l in $LANGS) {
  $lr = @($results | Where-Object { $_.lang -eq $l -and $null -ne $_.det_fires })
  if ($lr.Count -eq 0) { continue }
  $fire = @($lr | Where-Object { $_.det_fires -eq $true }).Count
  $miss = @($lr | Where-Object { $_.det_fires -eq $false }).Count
  $gapOk = @($lr | Where-Object { $_.gap_status -eq "GAP-DOGRULANDI(miss)" }).Count
  Write-Host ($l.PadRight(6) + ([string]$lr.Count).PadRight(11) + ([string]$fire).PadRight(7) + ([string]$miss).PadRight(7) + [string]$gapOk)
}

# ── CANLI NLU: DIL x INTENT (opsiyonel) ──
if ($doLive) {
  Write-Host ""
  Write-Host "=== CANLI NLU (Sonnet-4.6) INTENT ORNEKLERI ===" -ForegroundColor Cyan
  foreach ($r in $results) {
    Write-Host ("[" + $r.id.PadRight(9) + "] " + $r.lang + " intent=" + $r.sonnet_intent.PadRight(20) + " msg:" + $r.message)
  }
}

$gapConfirmed = ($results | Where-Object { $_.gap_status -eq "GAP-DOGRULANDI(miss)" }).Count
$gapUnexpected = ($results | Where-Object { $_.gap_status -eq "BEKLENMEDIK-FIRE" }).Count
Write-Host ""
Write-Host ("Toplam gap-isaretli DOGRULANDI (miss): " + $gapConfirmed + " | beklenmedik-fire: " + $gapUnexpected) -ForegroundColor Yellow

@{ meta = @{ total = $results.Count; live = $doLive; gap_confirmed = $gapConfirmed; gap_unexpected = $gapUnexpected }; results = $results } |
  ConvertTo-Json -Depth 8 | Out-File $Out -Encoding utf8
Write-Host ("Sonuclar: " + $Out) -ForegroundColor Green
