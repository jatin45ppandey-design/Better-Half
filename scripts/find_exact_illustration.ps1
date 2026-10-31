Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Check text "Better company." rightmost extent
# Dark text color: R < 50, G < 30, B < 60
$textMaxX = 0
for ($y = 200; $y -le 300; $y += 2) {
    for ($x = 350; $x -le 500; $x += 2) {
        $c = $img.GetPixel($x, $y)
        if ($c.R -lt 70 -and $c.G -lt 50 -and $c.B -lt 80) {
            if ($x -gt $textMaxX) { $textMaxX = $x }
        }
    }
}
Write-Host "Max X of text around y=200..300: $textMaxX"

# Check couch left edge:
# The purple couch has color R ~ 110..150, G ~ 90..130, B ~ 170..210 (soft purple)
# Let's find the leftmost point of couch or boy's elbow/arm
$couchMinX = 1024
for ($y = 300; $y -le 385; $y += 2) {
    for ($x = 400; $x -le 550; $x += 2) {
        $c = $img.GetPixel($x, $y)
        # Check non-background
        if (-not ($c.R -ge 235 -and $c.G -ge 225 -and $c.B -ge 245)) {
            if ($x -lt $couchMinX) { $couchMinX = $x }
        }
    }
}
Write-Host "Min X of couch/boy around y=300..385: $couchMinX"

# Check floating die (y ~ 160..240, x ~ 480..560)
$dieMinX = 1024
for ($y = 150; $y -le 240; $y += 2) {
    for ($x = 450; $x -le 550; $x += 2) {
        $c = $img.GetPixel($x, $y)
        if (-not ($c.R -ge 235 -and $c.G -ge 225 -and $c.B -ge 245)) {
            if ($x -lt $dieMinX) { $dieMinX = $x }
        }
    }
}
Write-Host "Min X of floating die around y=150..240: $dieMinX"

# Check top-most element:
$minY = 676
for ($x = 450; $x -le 1000; $x += 2) {
    for ($y = 50; $y -le 200; $y += 2) {
        $c = $img.GetPixel($x, $y)
        if (-not ($c.R -ge 235 -and $c.G -ge 225 -and $c.B -ge 245)) {
            if ($y -lt $minY) { $minY = $y }
        }
    }
}
Write-Host "Min Y of elements around top: $minY"

# Check right-most element:
$maxX = 0
for ($x = 900; $x -le 1020; $x += 2) {
    for ($y = 80; $y -le 480; $y += 2) {
        $c = $img.GetPixel($x, $y)
        # exclude dark banner at bottom if y >= 388
        if ($y -lt 388 -or $x -gt 980) {
            if (-not ($c.R -ge 235 -and $c.G -ge 225 -and $c.B -ge 245)) {
                if ($x -gt $maxX) { $maxX = $x }
            }
        }
    }
}
Write-Host "Max X of elements on right: $maxX"

# Check bottom of couch (y around 380..395)
# What is the exact y coordinate where the dark banner starts across x=450..950?
$bannerStarts = @()
for ($x = 450; $x -le 950; $x += 50) {
    for ($y = 370; $y -le 400; $y++) {
        $c = $img.GetPixel($x, $y)
        # dark banner has R < 70, G < 50, B < 80
        if ($c.R -lt 70 -and $c.G -lt 50 -and $c.B -lt 80) {
            $bannerStarts += "$($x): $y"
            break
        }
    }
}
Write-Host "Banner start Y per X: $($bannerStarts -join ', ')"

$img.Dispose()
