#!/usr/bin/env python3
"""
Enhanced Dashboard Server

Serves dashboard files and provides dynamic story description extraction.

Features:
- Serves static files from docs/ directory
- Dynamically generates story-descriptions.json from story files
- Serves sprint-status.yaml and orchestrator files from implementation-artifacts
- Auto-symlinks required files if not present

Usage:
    cd /Users/teazyou/dev/grimoire/docs
    python3 server.py

Then open: http://localhost:8080/dashboard.html
"""

from __future__ import annotations
import http.server
import socketserver
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse
from typing import Optional, Dict

PORT = 8080

# Paths
DOCS_DIR = Path(__file__).parent
PROJECT_ROOT = DOCS_DIR.parent
ARTIFACTS_DIR = PROJECT_ROOT / '_bmad-output' / 'implementation-artifacts'


def extract_story_id(filename: str) -> Optional[str]:
    """Extract full story ID from filename like '2a-1-session-scanner.md' -> '2a-1-session-scanner'"""
    # Remove .md extension and return full name as story ID
    if filename.endswith('.md'):
        story_id = filename[:-3]  # Remove .md
        # Verify it starts with a story pattern (digit followed by optional letter, dash, digit)
        if re.match(r'^\d+[a-z]?-\d+', story_id):
            return story_id
    return None


def extract_description(filepath: Path) -> Optional[str]:
    """Extract text between ## Story and next ## heading"""
    try:
        content = filepath.read_text(encoding='utf-8')

        # Find ## Story section
        story_match = re.search(
            r'^##\s+Story[^\n]*\n(.*?)(?=^##\s|\Z)',
            content,
            re.MULTILINE | re.DOTALL
        )

        if story_match:
            description = story_match.group(1).strip()
            # Clean up: remove markdown formatting, limit length
            description = re.sub(r'\*\*([^*]+)\*\*', r'\1', description)  # Remove bold
            description = re.sub(r'\n+', ' ', description)  # Flatten newlines
            description = description[:500]  # Limit length
            return description

        # Fallback: try to get first paragraph after title
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('# '):
                # Get next non-empty lines as description
                desc_lines = []
                for j in range(i + 1, min(i + 10, len(lines))):
                    if lines[j].strip() and not lines[j].startswith('#'):
                        desc_lines.append(lines[j].strip())
                    elif lines[j].startswith('#'):
                        break
                if desc_lines:
                    return ' '.join(desc_lines)[:500]

        return None
    except Exception as e:
        print(f"Error reading {filepath}: {e}", file=sys.stderr)
        return None


def scan_artifacts() -> Dict[str, str]:
    """Scan artifacts directory and extract all story descriptions"""
    descriptions = {}

    if not ARTIFACTS_DIR.exists():
        print(f"Artifacts directory not found: {ARTIFACTS_DIR}", file=sys.stderr)
        return descriptions

    # Find all .md files
    for filepath in ARTIFACTS_DIR.glob('*.md'):
        filename = filepath.name

        # Skip non-story files
        if filename.startswith('tech-spec-'):
            continue
        if filename in ('orchestrator.md', 'sprint-status.yaml', 'index.md'):
            continue

        story_id = extract_story_id(filename)
        if story_id:
            description = extract_description(filepath)
            if description:
                descriptions[story_id] = description
                print(f"Extracted: {story_id}", file=sys.stderr)

    return descriptions


def ensure_symlinks():
    """Create symlinks for data files if they don't exist"""
    links = {
        'sprint-status.yaml': ARTIFACTS_DIR / 'sprint-status.yaml',
        'orchestrator.md': ARTIFACTS_DIR / 'orchestrator.md',
    }

    for link_name, target in links.items():
        link_path = DOCS_DIR / link_name
        if not link_path.exists() and target.exists():
            try:
                link_path.symlink_to(target)
                print(f"Created symlink: {link_name} -> {target}")
            except Exception as e:
                print(f"Failed to create symlink {link_name}: {e}")


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that serves story descriptions dynamically"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.lstrip('/')

        # Dynamic story descriptions endpoint
        if path == 'story-descriptions.json':
            self.send_story_descriptions()
            return

        # Whitelist allowed data files - serve directly from artifacts dir
        ALLOWED_DATA_FILES = {'sprint-status.yaml', 'orchestrator.md', 'orchestrator.csv', 'orchestrator-sample.md'}

        if path in ALLOWED_DATA_FILES:
            self.serve_artifact_file(path)
            return

        # Security: Validate path doesn't escape docs directory
        try:
            normalized = os.path.normpath(path)
            if normalized.startswith('..') or normalized.startswith('/'):
                self.send_error(403, "Forbidden: Path traversal attempt blocked")
                return
        except Exception as e:
            self.send_error(400, f"Bad Request: Invalid path - {e}")
            return

        # For other requests, use default handler
        super().do_GET()

    def serve_artifact_file(self, filename):
        """Serve a file from artifacts directory, or docs if not found there"""
        # Try artifacts first, then docs
        filepath = ARTIFACTS_DIR / filename
        if not filepath.exists():
            filepath = DOCS_DIR / filename
        if not filepath.exists():
            self.send_error(404, f"File not found: {filename}")
            return

        try:
            content = filepath.read_bytes()
            content_type = 'text/plain; charset=utf-8'
            if filename.endswith('.yaml'):
                content_type = 'application/x-yaml; charset=utf-8'
            elif filename.endswith('.json'):
                content_type = 'application/json; charset=utf-8'

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(content))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    def send_story_descriptions(self):
        """Generate and send story descriptions JSON"""
        descriptions = scan_artifacts()
        content = json.dumps(descriptions, ensure_ascii=False, indent=2).encode('utf-8')

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(content))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        """Custom logging format"""
        print(f"[{self.log_date_time_string()}] {args[0]}")


def main():
    # Change to docs directory
    os.chdir(DOCS_DIR)

    # Ensure symlinks exist
    ensure_symlinks()

    # Create server with SO_REUSEADDR to allow quick restart
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    with ReusableTCPServer(("", PORT), DashboardHandler) as httpd:
        print(f"\n{'='*50}")
        print(f"Grimoire Dashboard Server")
        print(f"{'='*50}")
        print(f"\nServing at: http://localhost:{PORT}/dashboard.html")
        print(f"\nEndpoints:")
        print(f"  - /dashboard.html          Main dashboard")
        print(f"  - /story-descriptions.json Dynamic story descriptions")
        print(f"  - /sprint-status.yaml      Sprint data (symlinked)")
        print(f"  - /orchestrator.md         Activity log (symlinked)")
        print(f"\nPress Ctrl+C to stop\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()


if __name__ == '__main__':
    main()
