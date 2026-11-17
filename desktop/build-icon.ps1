# Render the geometry of public/favicon.svg into Windows multi-resolution icons.
Add-Type -AssemblyName System.Drawing
$frames = @()
foreach ($size in @(16, 24, 32, 48, 64, 128, 256)) {
  $bitmap = New-Object Drawing.Bitmap($size, $size)
  $g = [Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.ScaleTransform(($size / 40.0), ($size / 40.0))
  $bg = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#2EC4D6'))
  $fg = New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml('#1C1D21'))
  $shape = New-Object Drawing.Drawing2D.GraphicsPath
  $shape.AddArc(0,0,20,20,180,90)
  $shape.AddArc(20,0,20,20,270,90)
  $shape.AddArc(20,20,20,20,0,90)
  $shape.AddArc(0,20,20,20,90,90)
  $shape.CloseFigure()
  $g.FillPath($bg, $shape)
  $coords = @(8,27,8,14,12,14,16,20,20,14,24,14,24,27,20,27,20,20,16,26,12,20,12,27)
  $points = for ($i=0; $i -lt $coords.Count; $i+=2) { [Drawing.PointF]::new($coords[$i],$coords[$i+1]) }
  $g.FillPolygon($fg, [Drawing.PointF[]]$points)
  $pen = New-Object Drawing.Pen($fg, 2)
  $g.DrawLine($pen,30,13,30,26)
  $g.DrawLines($pen,[Drawing.PointF[]]@([Drawing.PointF]::new(26,22),[Drawing.PointF]::new(30,26),[Drawing.PointF]::new(34,22)))
  $stream = New-Object IO.MemoryStream
  $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
  $frames += ,($stream.ToArray())
  $stream.Dispose(); $pen.Dispose(); $shape.Dispose(); $fg.Dispose(); $bg.Dispose(); $g.Dispose(); $bitmap.Dispose()
}
$output = [IO.File]::Create((Join-Path $PSScriptRoot 'icon.ico'))
$writer = New-Object IO.BinaryWriter($output)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
$offset = 6 + 16 * $frames.Count
$sizes = @(16,24,32,48,64,128,256)
for ($i=0; $i -lt $frames.Count; $i++) {
  $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
  $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
  $offset += $frames[$i].Length
}
foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
$writer.Dispose(); $output.Dispose()
