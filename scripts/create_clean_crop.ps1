Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# We want:
# X from 415 to 1005 (width: 590)
# Y from 85 to 384 (height: 299)
$cropX = 415
$cropY = 85
$cropW = 590
$cropH = 299

$rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$crop = $img.Clone($rect, $img.PixelFormat)

# In the crop:
# Any stray text from "games." is in relative X = 0 to (485 - 415) = 70, relative Y = (165 - 85) = 80 to (225 - 85) = 140
# Let's inspect that region and fill any dark text pixels with the surrounding background color.
# The background in that region is around R=247, G=239, B=254.
for ($x = 0; $x -le 72; $x++) {
    for ($y = 75; $y -le 145; $y++) {
        $c = $crop.GetPixel($x, $y)
        # If this is text (dark or saturated purple/text color, not the light lavender background)
        if (-not ($c.R -ge 235 -and $c.G -ge 225 -and $c.B -ge 245)) {
            # sample background from x=75, y
            $bgSample = $crop.GetPixel(75, $y)
            $crop.SetPixel($x, $y, $bgSample)
        }
    }
}

# Also check if any text pixels exist at relative Y=145..220, X=0..70
for ($x = 0; $x -le 70; $x++) {
    for ($y = 145; $y -le 220; $y++) {
        $c = $crop.GetPixel($x, $y)
        if (-not ($c.R -ge 235 -and $c.G -ge 225 -and $c.B -ge 245)) {
            $bgSample = $crop.GetPixel(75, $y)
            $crop.SetPixel($x, $y, $bgSample)
        }
    }
}

# Also at the very bottom (last 2 rows: y = 297, 298), check if any banner border pixels remain
for ($x = 0; $x -lt $cropW; $x++) {
    for ($y = 296; $y -lt $cropH; $y++) {
        $c = $crop.GetPixel($x, $y)
        # dark banner border has R < 100, G < 80, B < 120
        if ($c.R -lt 100 -and $c.G -lt 80 -and $c.B -lt 120) {
            # If couch is above it, keep couch, but if it's the thin banner line, blend it with the couch or background
            $above = $crop.GetPixel($x, 294)
            $crop.SetPixel($x, $y, $above)
        }
    }
}

$outPath = "C:\Users\jatin\Downloads\Game\public\couple-gaming-clean.png"
$crop.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()
$img.Dispose()
Write-Host "Saved cleaned crop to $outPath"

