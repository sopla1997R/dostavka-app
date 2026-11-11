# Shrinks dish photos: max 640px wide, flattened onto white, saved as JPEG q82.
# Usage: powershell -File tools/shrink.ps1 clients/imbir/img
param([string]$Dir)
Add-Type -AssemblyName System.Drawing
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]82)
$out = Join-Path $Dir 'web'
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $Dir -File | Where-Object { $_.Extension -match '^\.(png|jpe?g)$' } | ForEach-Object {
  $src = [System.Drawing.Image]::FromFile($_.FullName)
  $w = [Math]::Min(640, $src.Width); $h = [int]($src.Height * $w / $src.Width)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $g.DrawImage($src, 0, 0, $w, $h)
  $dest = Join-Path $out ($_.BaseName + '.jpg')
  $bmp.Save($dest, $codec, $params)
  $g.Dispose(); $bmp.Dispose(); $src.Dispose()
}
Get-ChildItem $Dir -File | Where-Object { $_.Extension -notmatch '^\.(png|jpe?g)$' } | Copy-Item -Destination $out
$sum = (Get-ChildItem $out | Measure-Object Length -Sum).Sum
"done: {0} files, {1} KB" -f (Get-ChildItem $out).Count, [int]($sum / 1KB)
