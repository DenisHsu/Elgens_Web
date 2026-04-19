#!/usr/bin/env python3
"""
在本機執行此腳本，自動下載並內嵌所有外部 CSS 到 Elementor HTML 檔案中。

使用方式：
  cd elementor
  python3 inline_all_css.py

需求：Python 3.6+（無需額外套件）
"""

import re
import os
import glob
import urllib.request
import ssl

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# SSL context
ctx = ssl.create_default_context()

css_cache = {}

def download_css(url):
    """Download CSS from URL."""
    url = url.replace('&amp;', '&')
    if url in css_cache:
        return css_cache[url]
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            content = resp.read().decode('utf-8', errors='replace')
            css_cache[url] = content
            return content
    except Exception as e:
        print(f"    ❌ 下載失敗 {url[:80]}: {e}")
        css_cache[url] = None
        return None

def extract_href(link_tag):
    """Extract href from <link> tag."""
    m = re.search(r'href="([^"]+)"', link_tag)
    if m:
        return m.group(1).replace('&amp;', '&')
    m = re.search(r"href='([^']+)'", link_tag)
    if m:
        return m.group(1).replace('&amp;', '&')
    return None

def process_file(filepath):
    """Process a single HTML file, inlining all CSS."""
    filename = os.path.basename(filepath)
    print(f"\n📄 處理: {filename}")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all <link> stylesheet tags
    link_pattern = r'<link[^>]*(?:rel="stylesheet"|\.css)[^>]*/?>'
    links = re.findall(link_pattern, content)

    if not links:
        print("    沒有找到 CSS <link> 標籤")
        return

    for link_tag in links:
        href = extract_href(link_tag)
        if not href:
            continue

        short_href = href[:70] + "..." if len(href) > 70 else href
        print(f"    ⬇️  {short_href}")

        if href.startswith('http'):
            css_content = download_css(href)
        else:
            # Local file - resolve relative to script directory's parent
            local_path = os.path.normpath(os.path.join(SCRIPT_DIR, '..', href))
            if os.path.exists(local_path):
                with open(local_path, 'r', encoding='utf-8') as f:
                    css_content = f.read()
            else:
                print(f"    ❌ 本地檔案不存在: {local_path}")
                css_content = None

        if css_content:
            style_block = f'<style>/* Inlined from: {href[:100]} */\n{css_content}\n</style>'
            content = content.replace(link_tag, style_block)
            print(f"    ✅ 已內嵌 ({len(css_content):,} 字元)")
        else:
            print(f"    ⚠️  保留原始 <link>")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"    💾 已儲存: {filename}")

def main():
    html_files = sorted(glob.glob(os.path.join(SCRIPT_DIR, "*-elementor.html")))

    if not html_files:
        print("❌ 找不到 *-elementor.html 檔案。請確認腳本位於 elementor 資料夾中。")
        return

    print(f"🔍 找到 {len(html_files)} 個 Elementor HTML 檔案")
    print("=" * 60)

    for filepath in html_files:
        process_file(filepath)

    print("\n" + "=" * 60)
    print(f"✅ 完成！已處理 {len(html_files)} 個檔案。")
    print(f"📁 下載的 CSS 共快取了 {len(css_cache)} 個來源。")

if __name__ == "__main__":
    main()
