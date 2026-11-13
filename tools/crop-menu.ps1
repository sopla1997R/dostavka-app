# Cuts dish photos out of menu-page photos.  Usage: crop-menu.ps1 <pagesDir> <crops.csv> <outDir>
# crops.csv lines: productId,page,x,y,w,h  (page = file name without .jpg)
param($pages, $csv, $out)
Add-Type -AssemblyName System.Drawing
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90L
foreach ($line in Get-Content $csv) {
  $id, $pg, $x, $y, $w, $h = $line.Split(',')
  $src = [System.Drawing.Image]::FromFile((Resolve-Path (Join-Path $pages "$pg.jpg")))
  $x = [Math]::Max(0, [int]$x); $y = [Math]::Max(0, [int]$y)
  $w = [Math]::Min([int]$w, $src.Width - $x); $h = [Math]::Min([int]$h, $src.Height - $y)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $x, $y, $w, $h), 'Pixel')
  $bmp.Save((Join-Path $out "$id.jpg"), $enc, $ep)
  $g.Dispose(); $bmp.Dispose(); $src.Dispose()
}
