"""Technique names and sentences: one version, shared by the solver traces and the game (fr.ts)."""

import re

from conftest import ROOT

from dispatch_solver.deduce import RULES

FR = ROOT / "web" / "src" / "i18n" / "fr.ts"


def techniques_fr() -> dict[str, tuple[str, str]]:
    text = FR.read_text()
    block = text[text.index("export const TECHNIQUES") :]
    block = block[: block.index("};")]
    return {m[1]: (m[2], m[3]) for m in re.finditer(r"  (\w+): \{ name: '(.*?)', text: '(.*?)' \},", block)}


def test_same_ids_names_and_sentences():
    fr = techniques_fr()
    shown = {k: (r.name, r.text) for k, r in RULES.items() if r.level > 0}
    assert set(fr) == set(shown)
    for k, v in shown.items():
        assert fr[k] == v, k


def test_design_table_lists_every_technique():
    design = (ROOT / "GAME-DESIGN.md").read_text()
    for r in RULES.values():
        if r.level:
            assert f"| {r.level} | {r.name.replace('’', chr(39))} |" in design, r.id
