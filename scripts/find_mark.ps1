Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png")

for ($x = 0; $x -le 20; $x++) {
    for ($y = 0; $y -le 200; $y++) {
        $c = $img.GetPixel($x, $y)
        # Background is R ~ 246, G ~ 238, B ~ 254
        if ($c.R -lt 220 -or $c.G -lt 210) {
            Write-Host "Non-bg at x=$($x), y=$($y): R=$($c.R), G=$($c.G), B=$($c.B)"
        }
    }
}

$img.Dispose()

