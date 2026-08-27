#!/usr/bin/env python3
"""Download the pinned MediaPipe browser runtime and Hand Landmarker model."""

from __future__ import annotations

import io
import os
from pathlib import Path
import tarfile
import tempfile
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
TASKS_VISION_VERSION = "1.0.1"
TASKS_VISION_URL = (
    "https://registry.npmjs.org/@mediapipe/tasks-vision/-/"
    f"tasks-vision-{TASKS_VISION_VERSION}.tgz"
)
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)
PACKAGE_MEMBERS = (
    "package/vision_bundle.mjs",
    "package/wasm/vision_wasm_internal.js",
    "package/wasm/vision_wasm_internal.wasm",
    "package/wasm/vision_wasm_module_internal.js",
    "package/wasm/vision_wasm_module_internal.wasm",
    "package/wasm/vision_wasm_nosimd_internal.js",
    "package/wasm/vision_wasm_nosimd_internal.wasm",
)


def download(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": "hand-landmarker-demo/1.0"})
    with urlopen(request, timeout=120) as response:
        data = response.read()
    if len(data) < 1_000:
        raise RuntimeError(f"Downloaded asset is unexpectedly small: {url}")
    return data


def atomic_write(destination: Path, data: bytes) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}.",
        dir=destination.parent,
    )
    try:
        with os.fdopen(file_descriptor, "wb") as temporary_file:
            temporary_file.write(data)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.replace(temporary_name, destination)
    except BaseException:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def install_runtime(archive_data: bytes) -> None:
    with tarfile.open(fileobj=io.BytesIO(archive_data), mode="r:gz") as archive:
        members = {member.name: member for member in archive.getmembers()}
        for member_name in PACKAGE_MEMBERS:
            member = members.get(member_name)
            if member is None or not member.isfile():
                raise RuntimeError(f"Missing expected npm package member: {member_name}")
            extracted = archive.extractfile(member)
            if extracted is None:
                raise RuntimeError(f"Could not read npm package member: {member_name}")
            relative = Path(member_name).relative_to("package")
            if relative == Path("vision_bundle.mjs"):
                destination = ROOT / "vendor/mediapipe/vision_bundle.mjs"
            else:
                destination = ROOT / "vendor/mediapipe" / relative
            atomic_write(destination, extracted.read())


def main() -> None:
    print(f"Downloading MediaPipe Tasks Vision {TASKS_VISION_VERSION}...")
    install_runtime(download(TASKS_VISION_URL))
    print("Downloading Hand Landmarker float16 model...")
    atomic_write(ROOT / "models/hand_landmarker.task", download(MODEL_URL))
    print(f"Assets installed under {ROOT}")


if __name__ == "__main__":
    main()
