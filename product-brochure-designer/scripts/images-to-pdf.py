#!/usr/bin/env python3
"""Assemble ordered, finished page images into a PDF without cropping or stretching.
Optional dependency: reportlab. No image generation or image editing is performed.
"""
import argparse
import json
from pathlib import Path
import tempfile


def load_booklet(filename):
    """Read an optional reviewed-page manifest; paths are relative to its file."""
    source = Path(filename).resolve()
    data = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("pages"), list) or not data["pages"]:
        raise ValueError("手册清单必须是包含非空 pages 数组的对象")
    page_size = data.get("pageSize", "A4")
    if page_size not in ("A4", "native"):
        raise ValueError("清单 pageSize 只能为 A4 或 native")
    title = data.get("title")
    if title is not None and (not isinstance(title, str) or not title.strip()):
        raise ValueError("清单 title 必须为非空文字")

    def file(value, label, text=False):
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{label} 需要非空文件路径")
        target = (source.parent / value).resolve()
        if not target.is_file() or not target.stat().st_size:
            raise ValueError(f"{label} 不存在或为空：{target}")
        if text:
            try:
                content = target.read_text(encoding="utf-8")
            except UnicodeError as error:
                raise ValueError(f"{label} 必须是 UTF-8 文本：{target}") from error
            if not content.strip():
                raise ValueError(f"{label} 为空：{target}")
        return target

    if "brief" in data:
        file(data["brief"], "全书简报", text=True)
    ids, images, prompts = set(), [], []
    for number, page in enumerate(data["pages"], 1):
        if not isinstance(page, dict):
            raise ValueError(f"第 {number} 页需要一个对象")
        identifier = page.get("id")
        if not isinstance(identifier, str) or not identifier.strip() or identifier in ids:
            raise ValueError(f"第 {number} 页 id 为空或重复")
        ids.add(identifier)
        if page.get("status") != "reviewed":
            raise ValueError(f"第 {number} 页 {identifier} 尚未完成目检（status={page.get('status')}）；未导出 PDF")
        image = file(page.get("image"), f"第 {number} 页图片")
        prompt = file(page.get("prompt"), f"第 {number} 页完整提示词", text=True)
        references = page.get("references", [])
        if not isinstance(references, list):
            raise ValueError(f"第 {number} 页 references 必须是数组")
        for reference in references:
            if not isinstance(reference, dict) or not isinstance(reference.get("role"), str) or not reference["role"].strip():
                raise ValueError(f"第 {number} 页参考图需要 path 和非空 role")
            file(reference.get("path"), f"第 {number} 页参考图")
        images.append(image)
        prompts.append(str(prompt))
    return {"images": images, "page_size": page_size, "title": title, "prompts": prompts, "manifest": str(source)}


def assemble(images, output, page_size="A4", title=None):
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
        canvas.setTitle(title or output.stem)
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
    inputs = parser.add_mutually_exclusive_group(required=True)
    inputs.add_argument("--images", nargs="+", help="按最终页序列出已检查的 PNG/JPEG")
    inputs.add_argument("--manifest", help="使用手册清单，核对逐页提示词、参考文件与 reviewed 状态")
    parser.add_argument("--output", required=True)
    parser.add_argument("--page-size", choices=["A4", "native"], help="覆盖清单画幅；未指定时使用清单 pageSize 或 A4")
    args = parser.parse_args()
    try:
        plan = load_booklet(args.manifest) if args.manifest else None
        report = assemble(plan["images"] if plan else args.images, args.output,
                          args.page_size or (plan["page_size"] if plan else "A4"),
                          title=plan["title"] if plan else None)
        if plan:
            report.update(manifest=plan["manifest"], promptFiles=plan["prompts"])
        print(json.dumps(report, ensure_ascii=False, indent=2))
    except (ValueError, OSError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
