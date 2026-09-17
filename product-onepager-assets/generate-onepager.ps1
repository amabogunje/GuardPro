Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$ErrorActionPreference = "Stop"

$root = "C:\Users\mabog\OneDrive\Documents\ChatGPT\ISDL Guard Pro"
$outDir = Join-Path $root "product-onepager-assets"
$output = Join-Path $outDir "guard-patrol-one-pager.png"

$W = 1600
$H = 2100
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.Clear([System.Drawing.Color]::FromArgb(246, 248, 245))

function Color([string]$hex) {
  $hex = $hex.TrimStart("#")
  return [System.Drawing.Color]::FromArgb(
    [Convert]::ToInt32($hex.Substring(0,2),16),
    [Convert]::ToInt32($hex.Substring(2,2),16),
    [Convert]::ToInt32($hex.Substring(4,2),16)
  )
}

function Brush([string]$hex) { return New-Object System.Drawing.SolidBrush (Color $hex) }
function Pen([string]$hex, [float]$width=1) { return New-Object System.Drawing.Pen (Color $hex), $width }
function Font([float]$size, [string]$style="Regular") {
  $s = [System.Drawing.FontStyle]::Regular
  if ($style -eq "Bold") { $s = [System.Drawing.FontStyle]::Bold }
  if ($style -eq "Semibold") { $s = [System.Drawing.FontStyle]::Bold }
  return New-Object System.Drawing.Font("Segoe UI", $size, $s, [System.Drawing.GraphicsUnit]::Pixel)
}

function RoundedPath([float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function FillRound([float]$x,[float]$y,[float]$w,[float]$h,[float]$r,[string]$fill) {
  $path = RoundedPath $x $y $w $h $r
  $g.FillPath((Brush $fill), $path)
  $path.Dispose()
}

function StrokeRound([float]$x,[float]$y,[float]$w,[float]$h,[float]$r,[string]$stroke,[float]$width=2) {
  $path = RoundedPath $x $y $w $h $r
  $g.DrawPath((Pen $stroke $width), $path)
  $path.Dispose()
}

function TextBox([string]$text,[float]$x,[float]$y,[float]$w,[float]$h,[float]$size,[string]$hex,[string]$style="Regular",[string]$align="Near") {
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::$align
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
  $fmt.Trimming = [System.Drawing.StringTrimming]::Word
  $font = Font $size $style
  $rect = New-Object System.Drawing.RectangleF $x,$y,$w,$h
  $g.DrawString($text, $font, (Brush $hex), $rect, $fmt)
  $font.Dispose()
  $fmt.Dispose()
}

function DrawImageCard([string]$path,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r) {
  FillRound $x $y $w $h $r "FFFFFF"
  StrokeRound $x $y $w $h $r "D7E2DD" 2
  $img = [System.Drawing.Image]::FromFile($path)
  $pad = 22
  $iw = $w - ($pad * 2)
  $ih = $h - ($pad * 2)
  $scale = [Math]::Min($iw / $img.Width, $ih / $img.Height)
  $dw = $img.Width * $scale
  $dh = $img.Height * $scale
  $dx = $x + ($w - $dw) / 2
  $dy = $y + ($h - $dh) / 2
  $clip = RoundedPath ($x+$pad) ($y+$pad) $iw $ih 18
  $oldClip = $g.Clip
  $g.SetClip($clip)
  $g.DrawImage($img, $dx, $dy, $dw, $dh)
  $g.Clip = $oldClip
  $clip.Dispose()
  $img.Dispose()
}

function DrawBenefit([string]$num,[string]$title,[string]$body,[float]$x,[float]$y,[float]$w) {
  FillRound $x $y $w 238 26 "FFFFFF"
  StrokeRound $x $y $w 238 26 "D7E2DD" 2
  FillRound ($x+30) ($y+30) 58 58 18 "E6F4EF"
  TextBox $num ($x+48) ($y+38) 28 40 30 "00796B" "Bold" "Center"
  TextBox $title ($x+110) ($y+26) ($w-140) 44 30 "052821" "Bold"
  TextBox $body ($x+110) ($y+78) ($w-140) 122 24 "3E5550"
}

$dark = "052821"
$teal = "00796B"
$teal2 = "0F8B78"
$muted = "4D625D"
$line = "D7E2DD"
$cream = "FFF7E8"

# Header band
FillRound 78 70 1444 340 42 "FFFFFF"
StrokeRound 78 70 1444 340 42 $line 2
$icon = [System.Drawing.Image]::FromFile((Join-Path $root "public\icon-512.png"))
$g.DrawImage($icon, 124, 112, 82, 82)
$icon.Dispose()
TextBox "Guard Patrol" 230 104 500 54 36 $dark "Bold"
TextBox "Provided by Integrated Systems and Devices Limited - ISDL" 232 156 680 38 22 $muted
TextBox "PROFESSIONAL GUARD SUPERVISION" 1000 112 420 60 20 $teal "Bold" "Far"
TextBox "Know which guards are on duty, which patrols were missed, and what needs attention now." 124 204 1250 104 40 $dark "Bold"
TextBox "Mobile workspace for security teams to record shifts, patrols, reports, reviews, and owner-ready evidence." 124 318 1260 60 23 $muted

# Screenshot collage
DrawImageCard (Join-Path $root "data\owner-health-production.png") 98 460 430 870 26
TextBox "Owner view: security activity at a glance" 128 1352 400 36 24 $dark "Bold"
TextBox "Coverage health, patrol status, report risk, and last-record freshness in a simple customer overview." 128 1392 370 86 22 $muted

DrawImageCard (Join-Path $root "data\guard.png") 570 460 930 410 26
TextBox "Guard mobile workflow" 606 896 310 38 28 $dark "Bold"
TextBox "Start shift, follow scheduled rounds, report a problem, and preserve pending work when connectivity is unreliable." 606 938 770 72 23 $muted

DrawImageCard (Join-Path $root "data\supervisor-management.png") 570 1040 930 360 26
TextBox "Supervisor operations" 606 1424 330 38 28 $dark "Bold"
TextBox "Manage shifts, checkpoints, team members, instructions, problem review, and daily activity records from one workspace." 606 1466 780 72 23 $muted

# Three benefits
DrawBenefit "1" "Check-ins" "See whether scheduled guards started their shifts, including missed and late starts." 98 1580 450
DrawBenefit "2" "Patrols" "Track scheduled patrol starts and checkpoint evidence with QR, NFC, or manual code fallback." 575 1580 450
DrawBenefit "3" "Reports" "Capture incident reports, media, supervisor review, resolution notes, and approved summaries." 1052 1580 450

# Workflow strip
FillRound 98 1870 1404 100 24 $cream
TextBox "Guard records activity" 148 1900 310 36 25 $dark "Bold"
TextBox ">" 505 1898 40 36 30 $teal "Bold" "Center"
TextBox "Supervisor reviews exceptions" 575 1900 360 36 25 $dark "Bold"
TextBox ">" 964 1898 40 36 30 $teal "Bold" "Center"
TextBox "Owner sees evidence" 1042 1900 280 36 25 $dark "Bold"
TextBox "Role-based access keeps each property tied to its own people, reports, and action history." 148 1936 1160 28 20 $muted

# Footer
$footerPen = Pen $line 2
$g.DrawLine($footerPen, 98, 2020, 1502, 2020)
$footerPen.Dispose()
TextBox "Start with one property, one supervisor, and existing guards." 98 2038 760 44 24 $dark "Bold"
TextBox "Supports supervision and record keeping. For emergencies, use normal emergency and telephone contacts." 820 2034 680 62 18 $muted "Regular" "Far"

$bmp.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output $output
