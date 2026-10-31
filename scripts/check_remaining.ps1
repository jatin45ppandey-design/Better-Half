Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png")

for ($x = 0; $x -le 25; $x++) {
    for ($y = 100; $y -le 125; $y++) {
        $c = $img.GetPixel($x, $y)
        if ($c.R -lt 230 -or $c.G -lt 220) {
            Write-Host "Remaining pixel at x=$($x), y=$($y): R=$($c.R), G=$($c.G), B=$($c.B)"
        }
    }
}

$img.Dispose()

