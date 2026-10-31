Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

for ($x = 450; $x -le 520; $x += 5) {
    Write-Host "--- Column x=$($x) ---"
    for ($y = 220; $y -le 310; $y += 5) {
        $c = $img.GetPixel($x, $y)
        Write-Host "y=$($y): R=$($c.R), G=$($c.G), B=$($c.B)"
    }
}

$img.Dispose()

