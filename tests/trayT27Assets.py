import hashlib
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/desktop'

class TrayAssets(unittest.TestCase):
    def test_app_icon_preserved(self):
        self.assertEqual(hashlib.sha256((ASSETS / 'icon.png').read_bytes()).hexdigest(),
                         '0a1c2f4f6d463276ecdb217bb0e00f92f2202971deec74a724a31a13ef6d70fd')

    def test_pixels_derived_from_original_mark(self):
        source = Image.open(ASSETS / 'icon.png').convert('RGBA')
        alpha = Image.new('L', source.size)
        alpha.putdata([255 if max(pixel[:3]) > 60 else 0 for pixel in source.getdata()])
        for name, size, template in [('trayTemplate.png', 16, True),
                                     ('trayTemplate@2x.png', 32, True),
                                     ('trayColour.png', 32, False)]:
            mark = Image.new('RGBA', source.size) if template else source.copy()
            mark.putalpha(alpha)
            crop = mark.crop(alpha.getbbox())
            crop.thumbnail((size-size//8, size-size//8), Image.Resampling.LANCZOS)
            expected = Image.new('RGBA', (size, size))
            expected.paste(crop, ((size-crop.width)//2, (size-crop.height)//2))
            self.assertEqual(Image.open(ASSETS / name).tobytes(), expected.tobytes(), name)

    def test_template_16(self):
        self.assert_template('trayTemplate.png', 16)

    def test_template_32(self):
        self.assert_template('trayTemplate@2x.png', 32)

    def assert_template(self, name, size):
        image = Image.open(ASSETS / name)
        self.assertEqual(image.mode, 'RGBA')
        self.assertEqual(image.size, (size, size))
        pixels = list(image.getdata())
        self.assertTrue(all(pixel[:3] == (0, 0, 0) for pixel in pixels))
        alphas = [pixel[3] for pixel in pixels]
        self.assertEqual(min(alphas), 0)
        self.assertEqual(max(alphas), 255)
        self.assertGreater(sum(alpha > 0 for alpha in alphas), size * size * .15)
        self.assertLess(sum(alpha > 0 for alpha in alphas), size * size * .8)
        self.assertTrue(all(image.getpixel(point)[3] == 0 for point in [(0, 0), (0, size-1), (size-1, 0), (size-1, size-1)]))

    def test_colour_32(self):
        image = Image.open(ASSETS / 'trayColour.png')
        self.assertEqual(image.mode, 'RGBA')
        self.assertEqual(image.size, (32, 32))
        pixels = list(image.getdata())
        self.assertEqual(min(pixel[3] for pixel in pixels), 0)
        self.assertEqual(max(pixel[3] for pixel in pixels), 255)
        self.assertGreater(sum(pixel[3] > 0 for pixel in pixels), 150)
        self.assertGreater(len({pixel[:3] for pixel in pixels if pixel[3] > 0}), 20)
        self.assertTrue(any(r > 100 and b > 80 and g < r / 2 and a > 100 for r, g, b, a in pixels))
        self.assertEqual(image.getpixel((0, 0))[3], 0)

if __name__ == '__main__':
    unittest.main()
