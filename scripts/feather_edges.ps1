Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png")
$w = $src.Width
$h = $src.Height

$dst = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$fadeDist = 28.0

for ($x = 0; $x -lt $w; $x++) {
    for ($y = 0; $y -lt $h; $y++) {
        $c = $src.GetPixel($x, $y)
        
        # Distance to closest edge
        $distLeft = $x
        $distRight = $w - 1 - $x
        $distTop = $y
        $distBottom = $h - 1 - $y
        
        $minDist = [Math]::Min([Math]::Min($distLeft, $distRight), [Math]::Min($distTop, $distBottom))
        
        if ($minDist -lt $fadeDist) {
            $factor = $minDist / $fadeDist
            # Smooth quadratic easing
            $factor = $factor * $factor * (3.0 - 2.0 * $factor)
            $alpha = [int]([Math]::Round($factor * 255.0))
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
        } else {
            $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
        }
    }
}

$outPath = "C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png"
$src.Dispose()

# Save new faded PNG
$dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Save("C:\Users\jatin\Downloads\Game\src\assets\couple-gaming-hero.png", [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()

Write-Host "Edge-faded PNG successfully saved to $outPath"

