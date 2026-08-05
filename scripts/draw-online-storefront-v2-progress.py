from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "experiments/online-storefront-v2/progress.png"
WIDTH, HEIGHT = 1200, 700
image = Image.new("RGB", (WIDTH, HEIGHT), "#deddd6")
draw = ImageDraw.Draw(image)
font = ImageFont.load_default()

draw.text((70, 55), "ONLINE STOREFRONT V2 / MECHANICAL EVALUATOR", fill="#1f1f1d", font=font)
draw.text((70, 80), "Protocol integrity fix; scientific outcomes unchanged", fill="#5f5d58", font=font)

left, right, top, bottom = 120, 1100, 150, 590
draw.line((left, bottom, right, bottom), fill="#1f1f1d", width=2)
draw.line((left, top, left, bottom), fill="#1f1f1d", width=2)

def y(value: float) -> int:
    return int(bottom - (value - 0.85) / 0.17 * (bottom - top))

for value in [0.85, 0.90, 0.95, 1.00]:
    py = y(value)
    draw.line((left, py, right, py), fill="#b7b7b0", width=1)
    draw.text((75, py - 6), f"{value:.2f}", fill="#1f1f1d", font=font)

target_y = y(1.0)
for x in range(left, right, 18):
    draw.line((x, target_y, min(x + 9, right), target_y), fill="#a96f64", width=3)

points = [(330, y(0.9)), (870, y(1.0))]
draw.line((*points[0], *points[1]), fill="#1f1f1d", width=4)
draw.ellipse((points[0][0] - 10, points[0][1] - 10, points[0][0] + 10, points[0][1] + 10), outline="#1f1f1d", width=4)
draw.ellipse((points[1][0] - 12, points[1][1] - 12, points[1][0] + 12, points[1][1] + 12), fill="#a96f64", outline="#1f1f1d", width=3)
draw.text((270, bottom + 30), "0 / BASELINE", fill="#1f1f1d", font=font)
draw.text((815, bottom + 30), "1 / KEPT", fill="#1f1f1d", font=font)
draw.text((255, points[0][1] + 25), "0.900 / HASH PORTABILITY FAIL", fill="#1f1f1d", font=font)
draw.text((795, points[1][1] - 35), "1.000 / ALL GATES PASS", fill="#1f1f1d", font=font)

image.save(OUTPUT)
print(OUTPUT)
