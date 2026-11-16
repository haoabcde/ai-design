#!/usr/bin/env python3
"""Assemble ordered, finished page images into a PDF without cropping or stretching.
Optional dependency: reportlab. No image generation or image editing is performed.
"""
import argparse
import json
from pathlib import Path
import tempfile


def assemble(images, output, page_size="A4"):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfgen.canvas import Canvas
    except ImportError as error:
        raise ValueError("需要可选 Python 依赖 reportlab；使用宿主 PDF 环境或安装 reportlab") from error

    if not images:
        raise ValueError("至少提供一张已核对的页面图片")
    if page_size not in ("A4", "native"):
        raise ValueError("page_size 只能为 A4 或 native")
    output = Path(output).resolve()
    if output.exists():
        raise ValueError(f"输出已存在，请使用新文件名：{output}")
    pages = []
    for filename in images:
        source = Path(filename).resolve()
        if not source.is_file():
            raise ValueError(f"页面图片不存在：{source}")
        try:
            reader = ImageReader(str(source))
            width, height = reader.getSize()
        except Exception as error:
            raise ValueError(f"无法读取页面图片：{source}") from error
        if width <= 0 or height <= 0:
            raise ValueError(f"页面尺寸无效：{source}")
        pages.append((source, reader, width, height))
    size = A4 if page_size == "A4" else (pages[0][2] * 0.75, pages[0][3] * 0.75)
    output.parent.mkdir(parents=True, exist_ok=True)
    placements = []
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".pdf", delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        canvas = Canvas(str(temporary_path), pagesize=size, pageCompression=1)
        canvas.setTitle(output.stem)
        for source, reader, width, height in pages:
            factor = min(size[0] / width, size[1] / height)
            draw_width, draw_height = width * factor, height * factor
            x, y = (size[0] - draw_width) / 2, (size[1] - draw_height) / 2
            canvas.drawImage(reader, x, y, width=draw_width, height=draw_height, mask="auto")
            canvas.showPage()
            placements.append({"source": str(source), "pixels": [width, height], "paddingPoints": [round(x, 3), round(y, 3)], "effectivePpi": round(72 / factor, 1)})
        canvas.save()
        temporary_path.replace(output)
    finally:
        temporary_path.unlink(missing_ok=True)
    return {"output": str(output), "pages": len(pages), "pageSizePoints": list(size), "placements": placements}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--images", nargs="+", required=True, help="按最终页序列出 PNG/JPEG；不是整本缩略图")
    parser.add_argument("--output", required=True)
    parser.add_argument("--page-size", choices=["A4", "native"], default="A4", help="A4 或以首图的 96dpi 尺寸为统一页面；完整等比放置，差异处留白")
    args = parser.parse_args()
    try:
        print(json.dumps(assemble(args.images, args.output, args.page_size), ensure_ascii=False, indent=2))
    except (ValueError, OSError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
