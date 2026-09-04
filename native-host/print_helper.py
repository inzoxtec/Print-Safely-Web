#!/usr/bin/env python3
"""
print_helper.py

Native Messaging Host for the "SafelyPrint" Chrome extension.
"""

import sys
import os
import json
import struct
import base64
import platform
import subprocess
import tempfile
import uuid
import logging
from pathlib import Path

# Logging setup
LOG_DIR = Path(tempfile.gettempdir()) / "printsafely_logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = LOG_DIR / "print_helper.log"

logging.basicConfig(
    filename=str(LOG_PATH),
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("print_helper")

SUPPORTED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx"}
MAX_DECODED_BYTES = 100 * 1024 * 1024

def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length or len(raw_length) < 4:
        return None

    message_length = struct.unpack("=I", raw_length)[0]
    if message_length == 0:
        return {}

    message_bytes = sys.stdin.buffer.read(message_length)
    if len(message_bytes) < message_length:
        raise IOError("Truncated message from Chrome.")

    return json.loads(message_bytes.decode("utf-8"))

def send_message(message_dict):
    encoded = json.dumps(message_dict).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def send_success(detail, printers=None):
    resp = {"status": "success", "detail": detail}
    if printers is not None:
        resp["printers"] = printers
    send_message(resp)

def send_error(detail):
    log.error(detail)
    send_message({"status": "error", "detail": detail})

def get_installed_printers():
    printers = []
    if platform.system() == "Windows":
        try:
            import win32print
            for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
                if p[2]:
                    printers.append(p[2])
        except Exception as e:
            log.warning(f"Error enumerating Windows printers via win32print: {e}")
            try:
                out = subprocess.check_output('wmic printer get name', shell=True, text=True)
                lines = [line.strip() for line in out.splitlines() if line.strip() and line.strip() != 'Name']
                printers = lines
            except Exception as e2:
                log.warning(f"WMIC fallback error: {e2}")
    elif platform.system() in ("Darwin", "Linux"):
        try:
            out = subprocess.check_output(['lpstat', '-p'], text=True)
            for line in out.splitlines():
                if line.startswith("printer"):
                    parts = line.split()
                    if len(parts) >= 2:
                        printers.append(parts[1])
        except Exception as e:
            log.warning(f"lpstat printer enumeration error: {e}")
    return printers

def save_temp_file(file_data_b64, file_ext):
    try:
        decoded = base64.b64decode(file_data_b64, validate=True)
    except Exception as exc:
        raise ValueError(f"Could not decode base64 file data: {exc}") from exc

    if len(decoded) == 0:
        raise ValueError("Decoded file data is empty.")
    if len(decoded) > MAX_DECODED_BYTES:
        raise ValueError("Decoded file exceeds the maximum allowed size.")

    temp_dir = Path(tempfile.mkdtemp(prefix="printsafely_"))
    temp_path = temp_dir / f"secure_print_{uuid.uuid4().hex}.{file_ext}"

    with open(temp_path, "wb") as f:
        f.write(decoded)

    try:
        os.chmod(temp_path, 0o600)
    except Exception:
        pass

    return temp_path

def cleanup_temp_file(path):
    try:
        if path and path.exists():
            path.unlink()
        parent = path.parent
        if parent.exists() and not any(parent.iterdir()):
            parent.rmdir()
    except Exception as exc:
        log.warning(f"Failed to clean up temp file {path}: {exc}")

def print_on_windows(file_path, printer_name):
    try:
        os.startfile(str(file_path), "print")
    except OSError as exc:
        raise RuntimeError(
            f"Windows could not print '{file_path.name}' via shell verb: {exc}."
        ) from exc

def print_on_posix(file_path, file_ext, printer_name):
    target_path = file_path
    if file_ext in ("doc", "docx"):
        target_path = convert_office_doc_to_pdf(file_path)

    lp_cmd = ["lp"]
    if printer_name:
        lp_cmd += ["-d", printer_name]
    lp_cmd.append(str(target_path))

    try:
        result = subprocess.run(lp_cmd, capture_output=True, text=True, timeout=60, check=False)
    except FileNotFoundError as exc:
        raise RuntimeError("'lp' command not found. Ensure CUPS is installed.") from exc
    finally:
        if target_path != file_path:
            cleanup_temp_file(target_path)

    if result.returncode != 0:
        raise RuntimeError(f"'lp' exited with code {result.returncode}: {result.stderr.strip()}")

def convert_office_doc_to_pdf(file_path):
    soffice = find_soffice_binary()
    if not soffice:
        raise RuntimeError("LibreOffice ('soffice') was not found.")

    out_dir = file_path.parent
    cmd = [soffice, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", str(out_dir), str(file_path)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=90, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr.strip()}")

    converted_path = out_dir / (file_path.stem + ".pdf")
    if not converted_path.exists():
        raise RuntimeError("LibreOffice reported success but no PDF was produced.")
    return converted_path

def find_soffice_binary():
    candidates = ["soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice", "/usr/bin/soffice"]
    for candidate in candidates:
        if candidate == "soffice":
            from shutil import which
            found = which("soffice")
            if found:
                return found
            continue
        if Path(candidate).exists():
            return candidate
    return None

def print_file(file_path, file_ext, printer_name):
    system = platform.system()
    if system == "Windows":
        print_on_windows(file_path, printer_name)
    elif system in ("Darwin", "Linux"):
        print_on_posix(file_path, file_ext, printer_name)
    else:
        raise RuntimeError(f"Unsupported OS: {system}")

def handle_secure_print(message):
    file_data = message.get("fileData")
    file_ext = (message.get("fileExt") or "").lower().lstrip(".")
    printer_name = message.get("printerName") or None

    if not file_data:
        raise ValueError("Missing 'fileData'.")
    if file_ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported fileExt '{file_ext}'.")

    temp_path = save_temp_file(file_data, file_ext)
    try:
        print_file(temp_path, file_ext, printer_name)
        return f"File sent to printer ({file_ext})."
    finally:
        cleanup_temp_file(temp_path)

def main():
    log.info("print_helper.py native host started.")
    try:
        message = read_message()
    except Exception as exc:
        send_error(f"Failed to read message: {exc}")
        return

    if message is None:
        return

    action = message.get("action")
    if action in ("list_printers", "get_printers"):
        try:
            printers = get_installed_printers()
            send_success("Enumerated printers successfully", printers=printers)
        except Exception as exc:
            send_error(f"Failed to enumerate printers: {exc}")
        return

    if action == "secure_print":
        try:
            detail = handle_secure_print(message)
            send_success(detail)
        except Exception as exc:
            send_error(str(exc))
        return

    send_error(f"Unsupported action: {action!r}")

if __name__ == "__main__":
    main()
