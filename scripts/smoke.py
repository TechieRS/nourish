#!/usr/bin/env python3
"""Read-only checks for local QA and deployed Vercel + Render environments."""

import argparse
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request

from http_utils import open_url


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-url", required=True, help="API origin, without /api")
    parser.add_argument("--frontend-url", required=True)
    args = parser.parse_args()
    backend, frontend = args.backend_url.rstrip("/"), args.frontend_url.rstrip("/")
    for path, expected in [
        ("/api/health", dict),
        ("/api/config", dict),
        ("/api/clients", list),
        ("/api/appointments", list),
        ("/api/dashboard/summary", dict),
        ("/api/availability?date=2099-01-01", dict),
        ("/openapi.json", dict),
    ]:
        with open_url(
            Request(backend + path, headers={"Origin": frontend}), timeout=90
        ) as response:
            data = json.load(response)
            assert isinstance(data, expected), f"Unexpected payload at {path}"
            assert response.headers.get("Cache-Control") == "no-store", (
                f"API cache header missing: {path}"
            )
            assert response.headers.get("Access-Control-Allow-Origin") == frontend, (
                f"CORS missing for {frontend}"
            )
            if path == "/api/health":
                assert (
                    data.get("status") == "ok" and data.get("database") == "postgresql"
                )
        print(f"PASS {path}")
    preflight = Request(
        backend + "/api/appointments",
        method="OPTIONS",
        headers={
            "Origin": frontend,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    with open_url(preflight, timeout=30) as response:
        assert response.headers.get("Access-Control-Allow-Origin") == frontend, (
            "Booking preflight CORS failed"
        )
    for path in ["/", "/book", "/appointments", "/profile", "/nutritionist"]:
        with open_url(frontend + path, timeout=30) as response:
            assert "text/html" in response.headers.get("Content-Type", ""), (
                f"Frontend returned non-HTML: {path}"
            )
            assert '<div id="root">' in response.read().decode(), (
                f"SPA shell missing: {path}"
            )
        print(f"PASS frontend {path}")
    with open_url(frontend + "/manifest.webmanifest", timeout=30) as response:
        assert json.load(response)["display"] == "standalone"
    print("Read-only deployment smoke checks passed.")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, HTTPError, URLError, ValueError) as error:
        raise SystemExit(f"Smoke check failed: {error}")
