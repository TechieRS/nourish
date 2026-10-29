#!/usr/bin/env python3
"""Deploy the tested commit to an existing Render service and wait for it to be live."""

import json
import os
import re
import time
from urllib.error import HTTPError
from urllib.request import Request

from http_utils import open_url


def main():
    token, service, commit = (
        os.environ.get(name, "")
        for name in ["RENDER_API_KEY", "RENDER_SERVICE_ID", "GITHUB_SHA"]
    )
    if (
        not token
        or not re.fullmatch(r"srv-[a-zA-Z0-9]+", service)
        or not re.fullmatch(r"[a-f0-9]{40}", commit)
    ):
        raise SystemExit(
            "Set RENDER_API_KEY, RENDER_SERVICE_ID and a full GITHUB_SHA before deployment."
        )

    def call(path, payload=None):
        request = Request(
            "https://api.render.com/v1" + path,
            data=json.dumps(payload).encode() if payload is not None else None,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        with open_url(request, timeout=60) as response:
            return json.load(response)

    deploy = call(
        f"/services/{service}/deploys",
        {"commitId": commit, "clearCache": "do_not_clear"},
    )
    identity = deploy["id"]
    print(f"Render deployment {identity} started for {commit}.", flush=True)
    deadline = time.monotonic() + 1200
    previous = None
    while time.monotonic() < deadline:
        deployment = call(f"/services/{service}/deploys/{identity}")
        status = deployment["status"]
        if status != previous:
            print(f"Render status: {status}", flush=True)
            previous = status
        if status == "live":
            if deployment.get("commit", {}).get("id") != commit:
                raise SystemExit(
                    "Render deployed a different commit; refusing frontend deployment."
                )
            return
        if status in {
            "build_failed",
            "update_failed",
            "pre_deploy_failed",
            "canceled",
            "deactivated",
        }:
            raise SystemExit(
                f"Render deployment failed: {status}. Inspect the service logs."
            )
        time.sleep(10)
    raise SystemExit(
        "Render deployment timed out. Inspect its status before deploying again."
    )


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        raise SystemExit(
            f"Render API returned HTTP {error.code}; inspect service access and settings."
        )
