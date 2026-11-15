"""Resolve EIR_HOME for standalone skill scripts.

Skill scripts may run outside the Eir process (system Python, nix env,
CI) where ``eir_constants`` is not importable.  This module provides the
same ``get_eir_home()`` contract without requiring it on ``sys.path``.

When ``eir_constants`` IS available it is used directly so profile
resolution and any future enhancements are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from eir_constants import get_eir_home
except (ModuleNotFoundError, ImportError):

    def get_eir_home() -> Path:
        """Return the Eir home directory (default: ``~/.eir``)."""
        val = os.environ.get("EIR_HOME", "").strip()
        return Path(val) if val else Path.home() / ".eir"
