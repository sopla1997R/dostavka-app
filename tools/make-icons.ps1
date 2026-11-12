# App icons for "Add to home screen": a letter on a solid square (phones round the corners themselves).
# Usage: powershell -File tools/make-icons.ps1 -Letter И -Bg "#141414" -Fg "#F5F4F2" -Out docs/imbir/icons
param([string]$Letter, [string]$Bg = "#141414", [string]$Fg = "#F5F4F2", [string]$Out)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $Out | Out-Null
$bgc = [System.Drawing.ColorTranslator]::FromHtml($Bg)
$fgc = [System.Drawing.ColorTranslator]::FromHtml($Fg)
foreach ($s in @(@('icon-512.png', 512), @('icon-192.png', 192), @('apple-touch-icon.png', 180))) {
  $px = $s[1]
  $bmp = New-Object System.Drawing.Bitmap $px, $px
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAlias'
  $g.Clear($bgc)
  $font = New-Object System.Drawing.Font 'Segoe UI Semibold', ([single]($px * 0.52)), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
  $brush = New-Object System.Drawing.SolidBrush $fgc
  $rect = New-Object System.Drawing.RectangleF 0, ([single]($px * 0.015)), $px, $px
  $g.DrawString($Letter, $font, $brush, $rect, $sf)
  $bmp.Save((Join-Path $Out $s[0]), [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose(); $font.Dispose(); $g.Dispose(); $bmp.Dispose()
}
"icons: $Out"
