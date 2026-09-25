param(
  [Parameter(Mandatory = $true)][string]$Name,
  [Parameter(Mandatory = $true)][string]$Prefix
)

$clip = (Get-Clipboard -Raw).Trim()
if ($clip -match ('^(' + [regex]::Escape($Prefix) + '\S+)$')) {
  $key = $Matches[1]
  $path = 'c:\Users\hervi\yc and trust mrr idea\specwatch\.env.local'
  $lines = Get-Content $path -Encoding UTF8
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match ('^' + [regex]::Escape($Name) + '=')) {
      $lines[$i] = $Name + '=' + $key
      $found = $true
    }
  }
  if (-not $found) { $lines += ($Name + '=' + $key) }
  Set-Content -Path $path -Value $lines -Encoding UTF8
  Write-Output ('WRITTEN ' + $Name + ' len=' + $key.Length + ' prefix=' + $key.Substring(0, 12))
} else {
  Write-Output ('MISMATCH clipboard starts with: ' + $clip.Substring(0, [Math]::Min(20, $clip.Length)))
}
