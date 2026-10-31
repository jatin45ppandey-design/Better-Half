Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Check where "ny." is in the source:
# It's part of "Better company."
# Let's find every dark pixel (R < 80, G < 60, B < 90) between x=400 and x=500, y=200 and y=320:
$darkPixels = @()
$textMinX = 1000; $textMaxX = 0; $textMinY = 1000; $textMaxY = 0
for ($x = 400; $x -le 500; $x++) {
    for ($y = 200; $y -le 320; $y++) {
        $c = $img.GetPixel($x, $y)
        if ($c.R -lt 100 -and $c.G -lt 80 -and $c.B -lt 120) {
            if ($x -lt $textMinX) { $textMinX = $x }
            if ($x -gt $textMaxX) { $textMaxX = $x }
            if ($y -lt $textMinY) { $textMinY = $y }
            if ($y -gt $textMaxY) { $textMaxY = $y }
        }
    }
}
Write-Host "Dark text 'ny.' box: X=$textMinX..$textMaxX, Y=$textMinY..$textMaxY"

# Check where couch armrest starts on left (y from 320 to 385):
$couchPoints = @()
for ($y = 300; $y -le 385; $y += 10) {
    for ($x = 420; $x -le 520; $x++) {
        $c = $img.GetPixel($x, $y)
        # couch color: purple R: 100..160, G: 80..140, B: 160..210
        if ($c.R -ge 90 -and $c.R -le 170 -and $c.G -ge 70 -and $c.G -le 150 -and $c.B -ge 150) {
            $couchPoints += "y=$($y): x=$($x)"
            break
        }
    }
}
Write-Host "Couch left edge points: $($couchPoints -join ', ')"

$img.Dispose()
