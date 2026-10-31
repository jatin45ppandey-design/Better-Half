Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

for ($x = 430; $x -le 480; $x += 5) {
    for ($y = 230; $y -le 290; $y += 5) {
        $c = $img.GetPixel($x, $y)
        if ($c.R -lt 150 -and $c.B -gt 100) {
            Write-Host "x=$($x), y=$($y): R=$($c.R), G=$($c.G), B=$($c.B)"
        }
    }
}

$img.Dispose()

