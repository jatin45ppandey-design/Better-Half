Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

$found = @()
for ($x = 300; $x -le 520; $x += 1) {
    for ($y = 150; $y -le 350; $y += 1) {
        $c = $img.GetPixel($x, $y)
        # Check for darker color of text (Better company.)
        # Text "Better company." is purple: R < 120, G < 80, B < 150 or similar
        if ($c.R -lt 120 -and $c.G -lt 80) {
            $found += "$($x),$($y)"
        }
    }
}
Write-Host "Found $($found.Count) dark text pixels"
if ($found.Count -gt 0) {
    $minX = 1000; $maxX = 0; $minY = 1000; $maxY = 0
    foreach ($p in $found) {
        $parts = $p.Split(',')
        $px = [int]$parts[0]
        $py = [int]$parts[1]
        if ($px -lt $minX) { $minX = $px }
        if ($px -gt $maxX) { $maxX = $px }
        if ($py -lt $minY) { $minY = $py }
        if ($py -gt $maxY) { $maxY = $py }
    }
    Write-Host "Text bounds: X=$minX..$maxX, Y=$minY..$maxY"
}

$img.Dispose()

