Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile('C:\Users\jatin\Downloads\Game\public\couple-gaming-hero.png')
$c0 = $img.GetPixel(0, 0)
$cTopRight = $img.GetPixel($img.Width - 1, 0)
$cBottomLeft = $img.GetPixel(0, 50)
Write-Host "(0,0): R=$($c0.R), G=$($c0.G), B=$($c0.B) -> Hex: #$($c0.R.ToString('X2'))$($c0.G.ToString('X2'))$($c0.B.ToString('X2'))"
Write-Host "(w-1,0): R=$($cTopRight.R), G=$($cTopRight.G), B=$($cTopRight.B) -> Hex: #$($cTopRight.R.ToString('X2'))$($cTopRight.G.ToString('X2'))$($cTopRight.B.ToString('X2'))"
Write-Host "(0,50): R=$($cBottomLeft.R), G=$($cBottomLeft.G), B=$($cBottomLeft.B) -> Hex: #$($cBottomLeft.R.ToString('X2'))$($cBottomLeft.G.ToString('X2'))$($cBottomLeft.B.ToString('X2'))"
$img.Dispose()

