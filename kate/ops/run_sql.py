"""Run a SQL file in BigQuery: python -m kate.ops.run_sql sql/schema.sql [--var N_CUSTOMERS=100000]

${PROJECT}, ${DATASET}, ${LOCATION} and ${GEMINI_MODEL} are filled in from the settings; extra
variables come from --var. Multi-statement scripts are fine; the result of the last statement is printed.
"""

import argparse
import re
import string
import sys
import time
from pathlib import Path

from kate import gcp
from kate.config import get_settings

SAFE_VALUE = re.compile(r"^[A-Za-z0-9_.\-]+$")


def render(path: Path, extra: dict[str, str]) -> str:
    settings = get_settings()
    if not settings.gcp_project_id:
        sys.exit("GCP_PROJECT_ID is not set")
    variables = {
        "PROJECT": settings.gcp_project_id,
        "DATASET": settings.bq_dataset,
        "LOCATION": settings.bq_location,
        "GEMINI_MODEL": settings.gemini_model,
        **extra,
    }
    for key, value in variables.items():
        if not SAFE_VALUE.match(str(value)):
            sys.exit(f"refusing unsafe value for {key}: {value!r}")
    return string.Template(path.read_text()).substitute(variables)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sql_file", type=Path)
    parser.add_argument("--var", action="append", default=[], metavar="KEY=VALUE")
    args = parser.parse_args()
    extra = dict(item.split("=", 1) for item in args.var)

    sql = render(args.sql_file, extra)
    started = time.monotonic()
    job = gcp.bigquery_client().query(sql, location=get_settings().bq_location)
    print(f"BigQuery job {job.job_id} running {args.sql_file} ...", file=sys.stderr)
    rows = list(job.result())
    elapsed = time.monotonic() - started
    billed = (job.total_bytes_billed or 0) / 1e9
    print(f"done in {elapsed:.1f}s, {billed:.2f} GB billed", file=sys.stderr)
    for row in rows[:50]:
        print(dict(row.items()))


if __name__ == "__main__":
    main()
