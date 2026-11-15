"""`eir config set` of an approval-policy key is gated — and only the INVOCATION is.

The rule exists because `eir config set` can rewrite the agent's own approval policy
(``approvals.mode``, ``approvals.deny``, ``command_allowlist``), so it is gated like the
file-tool path for ``~/.eir/config.yaml``.

The first form of the rule was ``\\beir\\b.*\\bconfig\\b.*\\bset\\b.*\\bapprovals\\b``,
which matched that TEXT anywhere in the command. A plain read of the text therefore demanded
an approval it has no business demanding:

    grep -r 'eir config set' docs/approvals.md

The rule is anchored to a real invocation instead, so the read above stays a read.
"""

import time

import pytest

from tools.approval_detection import (
    _iter_dangerous_descriptions,
    detect_dangerous_command,
)

POLICY_RULE = "eir config set approval settings"


def _policy_rule_fires(command: str) -> bool:
    """Whether THIS rule matches (other rules may match the same command first)."""
    return POLICY_RULE in set(_iter_dangerous_descriptions(command, only={POLICY_RULE}))


@pytest.mark.parametrize("command", [
    "eir config set approvals.mode off",
    "eir config set approvals.deny 'rm -rf /'",
    "eir config set approvals allow",
    "eir config set command_allowlist 'rm -rf /'",
    # `config unset` removes a policy the same way `config set` rewrites it.
    "eir config unset approvals.deny",
    "eir config unset command_allowlist",
    # A global option in front of the subcommand, both spellings.
    "eir --profile work config set approvals.mode off",
    "eir -p work config set approvals.mode off",
    "eir --json config set approvals.mode off",
    # `config set`'s own flag.
    "eir config set --force approvals.mode off",
    # The macOS bundle binary and an absolute path to the program.
    "ai.eir config set approvals.mode off",
    "/usr/local/bin/eir config set approvals.mode off",
    "eir.exe config set approvals.mode off",
    # The module form the updater and the cron lifecycle guard actually invoke.
    "python -m eir_cli.main config set approvals.mode off",
    "python3 -m eir_cli.main config set approvals.mode off",
    # Behind another command in a chain.
    "cd /tmp && eir config set approvals.mode off",
    # The spellings the issue names: an inline home override in front of the program.
    "EIR_HOME=/tmp/x eir config set approvals.mode off",
    # Other value-taking top-level flags from the real parser.
    "eir --resume abc config set approvals.mode off",
    "eir -s skill config set command_allowlist x",
    # A quoted key reaches the CLI as the same key.
    'eir config set "approvals.mode" off',
    "eir config set 'command_allowlist' x",
    # `-p`/`--profile` is stripped from anywhere in argv, so it also works after the subcommand.
    "eir config set -p work approvals.mode off",
    "eir config set --profile=work approvals.mode off",
    "eir config -p work set approvals.mode off",
    "eir config --profile work unset command_allowlist",
    # A quoted assignment in front of the program.
    "NOTE='a b' eir config set approvals.mode off",
    'NOTE="a b" eir config set approvals.mode off',
    # A Windows drive-qualified program, either separator, and an attached `-m`.
    r"C:\Users\me\AppData\Local\eir\eir.exe config set approvals.mode off",
    "C:/Users/me/eir.exe config set approvals.mode off",
    r"C:\Python312\python.exe -m eir_cli.main config set approvals.mode off",
    "python -meir_cli.main config set approvals.mode off",
])
def test_a_real_config_set_invocation_is_gated(command):
    dangerous, _key, _description = detect_dangerous_command(command)
    assert dangerous is True, command
    assert _policy_rule_fires(command), f"the approval-policy rule did not fire for {command!r}"


@pytest.mark.parametrize("command", [
    # The reported false positive: a READ of the text, not the invocation.
    "grep -r 'eir config set' docs/approvals.md",
    "rg 'eir config set approvals' website/docs",
    "cat notes.md | grep 'eir config set'",
    # The text appears in a quoted argument of another command.
    "echo 'eir config set approvals.mode off'",
    "grep -rn 'eir config set command_allowlist' .",
    # A `eir` invocation that is not the policy write.
    "eir config show",
    "eir config get approvals.mode",
    "eir config set model.default gpt-4o",
    "eir config set display.language en",
    # `unset` of a key that is not the approval policy.
    "eir config unset display.language",
    # The module form, but not a policy write.
    "python -m eir_cli.main config show",
    "EIR_HOME=/tmp/x eir config show",
    'eir config set "display.language" en',
    "eir config -p work set display.language en",
    "NOTE='a b' eir config show",
])
def test_a_read_or_an_unrelated_invocation_is_not_gated(command):
    dangerous, _key, description = detect_dangerous_command(command)
    assert dangerous is False, f"{command!r} was gated as {description!r}"
    assert description is None, command
    assert not _policy_rule_fires(command), f"the approval-policy rule fired for {command!r}"


def test_the_rule_is_approvable_not_a_hardline():
    """The policy write is a DANGEROUS rule (approvable, and bypassable under yolo /
    approvals.mode=off), not a HARDLINE one: hardline rules are never bypassable and are
    reserved for commands with no recovery path."""
    from tools.approval_detection import detect_hardline_command

    is_hardline, description = detect_hardline_command("eir config set approvals.mode off")
    assert is_hardline is False, description


def test_a_long_global_option_run_stays_linear():
    """The global-option run must not backtrack exponentially: a plain nested `(?:\\s+...)*`
    measured 0.34s per pattern at 30 flags and doubled every 2 more, and this rule is scanned
    on every terminal command."""
    command = "eir " + " ".join(["--flag=value"] * 40) + " config set approvals.mode off"
    start = time.perf_counter()
    detect_dangerous_command(command)
    elapsed = time.perf_counter() - start
    assert elapsed < 2.0, f"detection took {elapsed:.3f}s for a 40-flag run"
