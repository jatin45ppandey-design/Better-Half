Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

$cropX = 440
$cropY = 85
$cropW = 565
$cropH = 294

$rect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$crop = $img.Clone($rect, $img.PixelFormat)

# Remove text "ny." in x = 0..45, y = 85..145
for ($x = 0; $x -le 45; $x++) {
    for ($y = 85; $y -le 145; $y++) {
        $c = $crop.GetPixel($x, $y)
        # Check if text pixel (non-background)
        # Background is R ~ 246, G ~ 238, B ~ 254
        if ($c.R -lt 230 -or $c.G -lt 220) {
            # sample from clean background column at x=50, y
            $bg = $crop.GetPixel(50, $y)
            $crop.SetPixel($x, $y, $bg)
        }
    }
}

$outClean = "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png"
$crop.Save($outClean, [System.Drawing.Imaging.ImageFormat]::Png)

# Also save to src/assets
$outAsset = "C:\Users\jatin\Downloads\Game\src\assets\couple-gaming-hero.png"
$crop.Save($outAsset, [System.Drawing.Imaging.ImageFormat]::Png)

$crop.Dispose()
$img.Dispose()
Write-Host "Saved couple-gaming-hero.png perfectly"
