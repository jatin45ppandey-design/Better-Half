Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

# Check each column from x=450 to 520
for ($x = 450; $x -le 520; $x++) {
    $nonBgCount = 0
    for ($y = 220; $y -le 330; $y++) {
        $c = $img.GetPixel($x, $y)
        # Background is R > 230, G > 220, B > 240
        if (-not ($c.R -gt 230 -and $c.G -gt 220 -and $c.B -gt 240)) {
            $nonBgCount++
        }
    }
    if ($nonBgCount -eq 0) {
        Write-Host "Column x=$($x) is 100% background between y=220 and 330!"
    }
}

$img.Dispose()

