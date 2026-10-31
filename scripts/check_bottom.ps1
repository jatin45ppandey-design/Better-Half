Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Check x=650 (around boy's knees/couch) from y=340 to 400
for ($y = 340; $y -le 400; $y += 5) {
    $c = $img.GetPixel(650, $y)
    Write-Host "y=$y at x=650: R=$($c.R), G=$($c.G), B=$($c.B)"
}

# Check x=800 (around girl's legs/couch) from y=340 to 400
for ($y = 340; $y -le 400; $y += 5) {
    $c = $img.GetPixel(800, $y)
    Write-Host "y=$y at x=800: R=$($c.R), G=$($c.G), B=$($c.B)"
}

$img.Dispose()

