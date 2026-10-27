"""Builds an encrypted copy of the Metzum deck for GitHub Pages.

Every file the deck needs is encrypted with AES-GCM under a key derived from
the password (PBKDF2-SHA256). The file list itself is encrypted too, so the
published site holds no plaintext beyond the login page and the service worker.

Usage: DECK_PASSORD=<passord> uv run --with cryptography python bygg.py
"""

import base64
import hashlib
import json
import logging
import mimetypes
import os
import re
import shutil
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%d.%m.%Y %H:%M:%S",
    level=logging.INFO,
)
log: logging.Logger = logging.getLogger("bygg")

ROT: Path = Path(__file__).resolve().parent
DECK: Path = ROT.parents[1] / "presentasjoner" / "2026-10-27_metzum-the-moment"
UT: Path = ROT / "docs"
STATISK: Path = ROT / "statisk"
ITERASJONER: int = 600_000
START: list[str] = ["index.html", "presenter.html", "manus.md"]


def finn_filer() -> list[str]:
    """Walks HTML and CSS from the entry files and returns every local path."""
    funnet: set[str] = set()
    ko: list[str] = list(START)
    while ko:
        sti: str = ko.pop()
        if sti in funnet or not (DECK / sti).is_file():
            continue
        funnet.add(sti)
        if not sti.endswith((".html", ".css")):
            continue
        tekst: str = (DECK / sti).read_text(encoding="utf-8")
        refs: list[str] = re.findall(r'(?:src|href)="([^"#?]+)', tekst)
        refs += re.findall(r"url\(['\"]?([^'\")?#]+)", tekst)
        for ref in refs:
            if not re.match(r"^(https?:|data:|mailto:|//)", ref):
                ko.append(str((Path(sti).parent / ref).as_posix()).lstrip("./"))
    return sorted(funnet)


def nokkel(passord: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERASJONER)
    return kdf.derive(passord.encode("utf-8"))


def krypter(aes: AESGCM, salt: bytes, navn: str, data: bytes) -> bytes:
    # Deterministic IV per (name, content): an unchanged file gives an unchanged
    # blob, so a rebuild only pushes what changed.
    iv: bytes = hashlib.sha256(salt + navn.encode() + data).digest()[:12]
    return iv + aes.encrypt(iv, data, None)


def main() -> None:
    passord: str | None = os.environ.get("DECK_PASSORD")
    if not passord:
        sys.exit("Sett DECK_PASSORD.")
    salt_fil: Path = UT / "salt.json"
    salt: bytes = (
        base64.b64decode(json.loads(salt_fil.read_text())["salt"])
        if salt_fil.exists()
        else os.urandom(16)
    )
    aes = AESGCM(nokkel(passord, salt))

    for gammel in (UT / "b").glob("*.bin") if (UT / "b").exists() else []:
        gammel.unlink()
    (UT / "b").mkdir(parents=True, exist_ok=True)

    manifest: dict[str, dict[str, str]] = {}
    for sti in finn_filer():
        data: bytes = (DECK / sti).read_bytes()
        blob: str = hashlib.sha256(salt + sti.encode()).hexdigest()[:20] + ".bin"
        (UT / "b" / blob).write_bytes(krypter(aes, salt, sti, data))
        type_: str = mimetypes.guess_type(sti)[0] or "application/octet-stream"
        if type_.startswith("text/") or type_ in ("application/javascript",):
            type_ += "; charset=utf-8"
        manifest[sti] = {"b": blob, "t": type_}
        log.info("%-45s %8.1f kB", sti, len(data) / 1024)

    (UT / "m.bin").write_bytes(
        krypter(aes, salt, "manifest", json.dumps(manifest).encode("utf-8"))
    )
    salt_fil.write_text(
        json.dumps({"salt": base64.b64encode(salt).decode(), "iter": ITERASJONER})
    )
    for fil in STATISK.iterdir():
        shutil.copy(fil, UT / fil.name)
    (UT / ".nojekyll").write_text("")
    log.info("%d filer kryptert til %s", len(manifest), UT)


if __name__ == "__main__":
    main()
