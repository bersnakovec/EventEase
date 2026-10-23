"""Izpiše povzetek kcov pokritosti (Markdown) in vrne napako, če je pod pragom.

Uporaba: python3 scripts/zig-coverage-summary.py <coverage.json> [prag_v_odstotkih]
"""
import json
import os
import sys


def main() -> int:
    path = sys.argv[1]
    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 90.0
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    lines = ["### Backend (Zig) unit test coverage", "", "| File | Lines % |", "|---|---|"]
    for entry in data["files"]:
        lines.append(f"| {os.path.relpath(entry['file'])} | {entry['percent_covered']} |")
    lines.append(
        f"| **total** | **{data['percent_covered']}** ({data['covered_lines']}/{data['total_lines']}) |"
    )
    report = "\n".join(lines) + "\n"

    print(report)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(report)

    total = float(data["percent_covered"])
    if not data["files"] or total < threshold:
        print(f"Zig coverage {total}% is below the {threshold}% threshold", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
