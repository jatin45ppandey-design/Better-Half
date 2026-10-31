Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\Downloads\Game\public\crop-untouched-440.png")

for ($x = 0; $x -le 40; $x += 2) {
    for ($y = 0; $y -lt $img.Height; $y += 2) {
        $c = $img.GetPixel($x, $y)
        if ($c.R -lt 150 -and $c.B -gt 50) {
            Write-Host "Dark pixel at x=$($x), y=$($y): R=$($c.R), G=$($c.G), B=$($c.B)"
        }
    }
}

$img.Dispose()

