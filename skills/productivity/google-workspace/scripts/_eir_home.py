"""Resolve EIR_HOME for standalone skill scripts.

Skill scripts may run outside the Eir process (e.g. system Python,
nix env, CI) where ``eir_constants`` is not importable.  This module
provides the same ``get_eir_home()`` and ``display_eir_home()``
contracts as ``eir_constants`` without requiring it on ``sys.path``.

When ``eir_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``eir_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``EIR_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from eir_constants import display_eir_home
    from eir_constants import get_eir_home
except (ModuleNotFoundError, ImportError):

    def get_eir_home() -> Path:
        """Return the Eir home directory (default: ~/.eir).

        Mirrors ``eir_constants.get_eir_home()``."""
        val = os.environ.get("EIR_HOME", "").strip()
        return Path(val) if val else Path.home() / ".eir"

    def display_eir_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``eir_constants.display_eir_home()``."""
        home = get_eir_home()
        try:
            return "~/" + home.relative_to(Path.home()).as_posix()
        except ValueError:
            return str(home)
