Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

$cropX = 440
$cropY = 85
$cropW = 565
$cropH = 294

$rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$crop = $img.Clone($rect, $img.PixelFormat)

# Remove "ny." which is strictly inside x=0..45, y=140..215 in this crop
for ($x = 0; $x -le 46; $x++) {
    for ($y = 140; $y -le 215; $y++) {
        $c = $crop.GetPixel($x, $y)
        # If this is text color (not light background)
        if (-not ($c.R -ge 235 -and $c.G -ge 225 -and $c.B -ge 245)) {
            # sample the lavender background from x=52 at the same y
            $bg = $crop.GetPixel(52, $y)
            $crop.SetPixel($x, $y, $bg)
        }
    }
}

$outPath = "C:\Users\jatin\Downloads\Game\public\couple-gaming-perfect.png"
$crop.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$img.Dispose()
Write-Host "Saved perfect crop to $outPath"

