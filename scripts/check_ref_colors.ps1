Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("C:\Users\jatin\.gemini\antigravity\brain\f78e97f8-3b73-419e-a361-ab13c404552b\.user_uploaded\media_1793455285238_bf819b1d.jpg")

Write-Host "Checking background colors in approved reference image:"
Write-Host "Navbar at (200, 25): $( $src.GetPixel(200, 25) )"
Write-Host "Hero left at (100, 150): $( $src.GetPixel(100, 150) )"
Write-Host "Hero left at (100, 250): $( $src.GetPixel(100, 250) )"
Write-Host "Hero center-top at (500, 60): $( $src.GetPixel(500, 60) )"
Write-Host "Hero right at (980, 100): $( $src.GetPixel(980, 100) )"
Write-Host "Hero right at (980, 300): $( $src.GetPixel(980, 300) )"
Write-Host "Hero bottom behind banner at (500, 360): $( $src.GetPixel(500, 360) )"
Write-Host "Footer at (200, 620): $( $src.GetPixel(200, 620) )"

$src.Dispose()

