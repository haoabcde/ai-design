"""Optional Python checks. Metadata tests need only the standard library;
PDF integration tests additionally need reportlab and pypdf.
"""
import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/images-to-pdf.py"
spec = importlib.util.spec_from_file_location("images_to_pdf", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
PDF_AVAILABLE = all(importlib.util.find_spec(name) is not None for name in ("reportlab", "pypdf"))


def png(color):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    pixels = bytes(color) * 6
    rows = b"\x00" + pixels[:9] + b"\x00" + pixels[9:]
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 3, 2, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


class BookletTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        for name, color in (("z", (255, 0, 0)), ("a", (0, 0, 255))):
            (self.root / f"{name}.png").write_bytes(png(color))
            (self.root / f"{name}.md").write_text(f"Complete page prompt for {name}", encoding="utf-8")
        (self.root / "brief.md").write_text("Keep product identity; vary scene.", encoding="utf-8")
        self.plan = {"title": "Concept booklet", "pageSize": "A4", "brief": "brief.md", "pages": [
            {"id": "cover", "image": "z.png", "prompt": "z.md", "status": "reviewed"},
            {"id": "scene", "image": "a.png", "prompt": "a.md", "status": "reviewed",
             "references": [{"path": "z.png", "role": "product-and-style"}]}
        ]}
        self.manifest = self.root / "booklet.json"
        self.output = self.root / "booklet.pdf"
        self.save()

    def save(self):
        self.manifest.write_text(json.dumps(self.plan), encoding="utf-8")

    def test_manifest_order_and_paths_are_independent_of_working_directory(self):
        plan = module.load_booklet(self.manifest)
        self.assertEqual(plan["images"], [self.root / "z.png", self.root / "a.png"])
        self.assertEqual(plan["prompts"], [str(self.root / "z.md"), str(self.root / "a.md")])
        self.plan["pages"].append({"id": "closing", "image": "z.png", "prompt": "z.md", "status": "reviewed"})
        self.save()
        self.assertEqual(module.load_booklet(self.manifest)["images"], [self.root / "z.png", self.root / "a.png", self.root / "z.png"])

    def test_unreviewed_page_blocks_cli_before_any_pdf_is_created(self):
        self.plan["pages"][1]["status"] = "generated"
        self.save()
        result = subprocess.run([sys.executable, str(SCRIPT), "--manifest", str(self.manifest), "--output", str(self.output)], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.output.exists())

    def test_missing_or_empty_prompts_and_reference_files_are_rejected(self):
        (self.root / "reference.png").write_bytes(png((0, 255, 0)))
        self.plan["pages"][1]["references"].append({"path": "reference.png", "role": "style"})
        self.save()
        for filename in ("z.md", "reference.png"):
            with self.subTest(filename=filename):
                target = self.root / filename
                original = target.read_bytes()
                target.unlink()
                with self.assertRaises(ValueError):
                    module.load_booklet(self.manifest)
                target.write_bytes(original)
        (self.root / "a.md").write_text(" \n", encoding="utf-8")
        with self.assertRaises(ValueError):
            module.load_booklet(self.manifest)

    def test_duplicate_page_ids_are_not_silently_merged(self):
        self.plan["pages"][1]["id"] = self.plan["pages"][0]["id"]
        self.save()
        with self.assertRaises(ValueError):
            module.load_booklet(self.manifest)

    def test_invalid_structure_and_reference_roles_are_rejected(self):
        cases = [None, {"pages": []}, {"pages": ["bad"]}, {**self.plan, "pageSize": "wrong"}]
        for value in cases:
            with self.subTest(value=value):
                self.manifest.write_text(json.dumps(value), encoding="utf-8")
                with self.assertRaises(ValueError):
                    module.load_booklet(self.manifest)
        self.plan["pages"][1]["references"] = [{"path": "z.png"}]
        self.save()
        with self.assertRaises(ValueError):
            module.load_booklet(self.manifest)

    def test_cli_does_not_accept_two_different_page_order_sources(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "--manifest", str(self.manifest), "--images", str(self.root / "a.png"), "--output", str(self.output)], capture_output=True)
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.output.exists())

    @unittest.skipUnless(PDF_AVAILABLE, "Optional reportlab and pypdf not installed")
    def test_export_retains_declared_page_order_pixels_size_and_title(self):
        from pypdf import PdfReader
        result = subprocess.run([sys.executable, str(SCRIPT), "--manifest", str(self.manifest), "--output", str(self.output)], capture_output=True, text=True, check=True)
        report = json.loads(result.stdout)
        self.assertEqual(report["pages"], 2)
        reader = PdfReader(self.output)
        self.assertEqual(reader.metadata.title, "Concept booklet")
        self.assertEqual(len(reader.pages), 2)
        for page, color in zip(reader.pages, ((255, 0, 0), (0, 0, 255))):
            self.assertAlmostEqual(float(page.mediabox.width), 595.27559, places=3)
            objects = page["/Resources"]["/XObject"]
            image = next(obj.get_object() for obj in objects.values() if obj.get_object().get("/Subtype") == "/Image")
            self.assertEqual(image.get_data(), bytes(color) * 6)

    @unittest.skipUnless(PDF_AVAILABLE, "Optional reportlab and pypdf not installed")
    def test_plain_image_input_still_works_and_existing_output_is_preserved(self):
        result = module.assemble([self.root / "a.png"], self.output, "native")
        self.assertEqual(result["pageSizePoints"], [2.25, 1.5])
        original = self.output.read_bytes()
        with self.assertRaises(ValueError):
            module.assemble([self.root / "z.png"], self.output)
        self.assertEqual(self.output.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
