"""Advisory only: simultaneous installs share profile data, not ownership."""
from __future__ import annotations

from pathlib import Path

from eir_cli.process_identity import install_id, ledger_entries
from eir_constants import eir_home_key


def shared_profile_warning(*, home: Path | None = None, project_root: Path | None = None) -> str:
    """An old stamp or a profile name alone cannot prove concurrent use."""
    own_install = install_id(project_root)
    home_key = eir_home_key(home)
    if any(
        entry.get("install") and entry["install"] != own_install
        and entry.get("eir_home") == home_key
        for entry in ledger_entries(all_installs=True, verified_only=True)
    ):
        return (
            "Another Eir installation is using this profile. Both installations share "
            "its settings and data, so changes can conflict. You can continue, or close "
            "the other installation before making changes."
        )
    return ""
