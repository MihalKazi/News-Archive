"""Modules vendored from Takedown Watch (pipeline/src/tw), with import rewrites.

Parsing (unchanged): normalise.py, extractor.py, listings.py, canon.py.
Fetch stack (imports rewritten to takedown.*): fetch/classify.py, fetch/ratelimit.py,
fetch/client.py, robots.py.
Shims replacing upstream deps: config.py, log.py, types.py.
Re-copy from upstream when it changes, then re-apply the import rewrites.
"""
