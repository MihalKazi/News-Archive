import sys
from pathlib import Path

# Make sibling modules (fetch, tagging, ...) importable, matching `python ingest/run.py`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
