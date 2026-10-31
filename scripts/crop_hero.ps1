Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

Write-Host "Source Image Size: $($img.Width) x $($img.Height)"

# Check background color at top-left:
$bgTopLeft = $img.GetPixel(50, 50)
Write-Host "Top-left bg: R=$($bgTopLeft.R), G=$($bgTopLeft.G), B=$($bgTopLeft.B)"

# Check where the dark showcase banner starts and ends
for ($y = 360; $y -le 420; $y += 5) {
    $c = $img.GetPixel(100, $y)
    Write-Host "y=$y at x=100: R=$($c.R), G=$($c.G), B=$($c.B)"
}

for ($y = 540; $y -le 600; $y += 5) {
    $c = $img.GetPixel(100, $y)
    Write-Host "y=$y at x=100: R=$($c.R), G=$($c.G), B=$($c.B)"
}

$img.Dispose()

