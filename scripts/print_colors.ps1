Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

for ($y = 240; $y -le 280; $y += 5) {
    $c = $img.GetPixel(440, $y)
    Write-Host "x=440, y=$($y): R=$($c.R), G=$($c.G), B=$($c.B)"
}

$img.Dispose()

