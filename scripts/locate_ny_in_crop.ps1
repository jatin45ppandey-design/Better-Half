Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\Downloads\Game\public\crop-430-70-580-320.png")

Write-Host "Crop image size: $($img.Width) x $($img.Height)"
for ($x = 0; $x -le 60; $x += 2) {
    for ($y = 0; $y -lt $img.Height; $y += 2) {
        $c = $img.GetPixel($x, $y)
        # dark text
        if ($c.R -lt 100 -and $c.B -gt 50 -and $c.G -lt 50) {
            Write-Host "Found text in crop at x=$($x), y=$($y): R=$($c.R), G=$($c.G), B=$($c.B)"
        }
    }
}

$img.Dispose()

