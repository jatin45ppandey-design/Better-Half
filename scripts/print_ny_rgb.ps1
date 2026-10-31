Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\Downloads\Game\public\crop-untouched-440.png")

Write-Host "Checking pixels in crop-untouched-440.png at x=10..30, y=140..210:"
for ($y = 140; $y -le 210; $y += 10) {
    for ($x = 0; $x -le 35; $x += 5) {
        $c = $img.GetPixel($x, $y)
        if ($c.R -lt 150) {
            Write-Host "x=$($x), y=$($y): R=$($c.R), G=$($c.G), B=$($c.B)"
        }
    }
}

$img.Dispose()

