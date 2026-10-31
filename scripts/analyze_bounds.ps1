Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Background color is approximately R=246..248, G=236..242, B=252..255
function IsBg($r, $g, $b) {
    return ($r -ge 235 -and $g -ge 225 -and $b -ge 245)
}

$minX = 1024; $maxX = 0; $minY = 676; $maxY = 0

for ($x = 420; $x -lt 1020; $x += 2) {
    for ($y = 50; $y -lt 388; $y += 2) {
        $c = $img.GetPixel($x, $y)
        if (-not (IsBg $c.R $c.G $c.B)) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Host "Couple bounding box above banner (y < 388):"
Write-Host "X: $minX to $maxX (width: $($maxX - $minX))"
Write-Host "Y: $minY to $maxY (height: $($maxY - $minY))"

# Check right side next to banner (y between 388 and 573, x > 950)
$bannerRightMinX = 1024; $bannerRightMaxX = 0; $bannerRightMinY = 676; $bannerRightMaxY = 0
for ($x = 900; $x -lt 1020; $x += 2) {
    for ($y = 388; $y -lt 573; $y += 2) {
        $c = $img.GetPixel($x, $y)
        if (-not (IsBg $c.R $c.G $c.B)) {
            # Check if this pixel is inside the dark banner or part of the couch/tic-tac-toe
            # Dark banner has R < 80, G < 60, B < 100
        }
    }
}

$img.Dispose()

