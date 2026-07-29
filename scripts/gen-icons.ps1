Add-Type -AssemblyName System.Drawing

function New-Icon {
    param(
        [int]$Size,
        [string]$Path,
        [double]$SafeZoneRatio = 1.0
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#0B1F14")
    $limeColor = [System.Drawing.ColorTranslator]::FromHtml("#A3E635")

    $g.Clear($bgColor)

    # Marco de "cancha": un rectangulo con esquinas redondeadas sutil, dentro
    # de la safe zone (relevante para el icono maskable).
    $inner = $Size * $SafeZoneRatio
    $offset = ($Size - $inner) / 2

    $fontSize = [float]($inner * 0.52)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush($limeColor)

    $text = "p."
    $textSize = $g.MeasureString($text, $font)
    $x = $offset + ($inner - $textSize.Width) / 2
    $y = $offset + ($inner - $textSize.Height) / 2 - ($inner * 0.03)

    $g.DrawString($text, $font, $brush, [float]$x, [float]$y)

    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$outDir = $args[0]

New-Icon -Size 192 -Path (Join-Path $outDir "icon-192.png") -SafeZoneRatio 1.0
New-Icon -Size 512 -Path (Join-Path $outDir "icon-512.png") -SafeZoneRatio 1.0
New-Icon -Size 512 -Path (Join-Path $outDir "icon-maskable-512.png") -SafeZoneRatio 0.7
New-Icon -Size 180 -Path (Join-Path $outDir "apple-touch-icon.png") -SafeZoneRatio 1.0

Write-Output "Icons generated in $outDir"
