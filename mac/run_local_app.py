# ==========================================================================
# Yenten Single Wallet - macOS Entry Point
# Copyright (c) 2026 wendigo75
# This file is part of the Yenten Single Wallet project.
# It is designed specifically to operate alongside the macOS .app bundle.
# This software is provided "AS IS", without warranty of any kind.
# For full license terms, see the LICENSE file in the root directory.
# ==========================================================================

import atexit
import base64
import binascii
import logging
import multiprocessing
import os
import re
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
from app import app
SERVER_ARGUMENT = '--wallet-server'
LOCAL_SERVER_PORT = 51827
class BackupFileApi:
    MAX_BACKUP_SIZE = 8 * 1024 * 1024
    FILE_NAME_PATTERN = re.compile(r'^YTN-wallet-backup-\d{4}-\d{2}-\d{2}\.(txt|pdf)$')
    def __init__(self):
        self._window = None
    def save_backup_file(self, file_name, base64_content):
        import webview
        if not isinstance(file_name, str) or not self.FILE_NAME_PATTERN.fullmatch(file_name):
            raise ValueError('The backup filename is invalid.')
        if not isinstance(base64_content, str):
            raise ValueError('The backup content is invalid.')
        try:
            content = base64.b64decode(base64_content, validate=True)
        except (binascii.Error, ValueError) as error:
            raise ValueError('The backup content could not be decoded.') from error
        if not content or len(content) > self.MAX_BACKUP_SIZE:
            raise ValueError('The backup is empty or exceeds the size limit.')
        extension = Path(file_name).suffix.lower()
        if extension == '.pdf' and not content.startswith(b'%PDF-'):
            raise ValueError('The generated PDF is invalid.')
        if extension == '.txt':
            try:
                content.decode('utf-8')
            except UnicodeDecodeError as error:
                raise ValueError('The text backup is not valid UTF-8.') from error
        file_types = ('PDF document (*.pdf)',) if extension == '.pdf' else ('Text document (*.txt)',)
        save_path = self._window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=file_name,
            file_types=file_types,
        )
        if not save_path:
            return {'saved': False}
        if isinstance(save_path, (tuple, list)):
            if not save_path:
                return {'saved': False}
            save_path = save_path[0]
        destination = Path(save_path)
        if not destination.suffix:
            destination = destination.with_suffix(extension)
        elif destination.suffix.lower() != extension:
            raise ValueError(f'Choose a filename ending in {extension}.')
        with destination.open('wb') as backup_file:
            backup_file.write(content)
        return {'saved': True}
def choose_local_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        try:
            listener.bind(('127.0.0.1', LOCAL_SERVER_PORT))
        except OSError as error:
            raise RuntimeError(
                f'Local wallet port {LOCAL_SERVER_PORT} is already in use. '
                'Close the other application using this port and try again. '
                'The wallet uses a fixed port so saved wallet data remains available.'
            ) from error
        return LOCAL_SERVER_PORT
def webview_storage_path():
    storage_root = Path.home() / 'Library' / 'Application Support'
    storage_path = storage_root / 'YentenSingleWallet'
    storage_path.mkdir(parents=True, exist_ok=True)
    return str(storage_path)
def start_server_process(port):
    descriptor, pid_file = tempfile.mkstemp(prefix='yenten-wallet-', suffix='.pid')
    os.close(descriptor)
    command = [sys.executable]
    if not getattr(sys, 'frozen', False):
        command.append(os.path.abspath(__file__))
    command.extend([SERVER_ARGUMENT, str(port), pid_file])
    process = None
    try:
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
        )
        wait_for_server_pid(process, pid_file)
    except Exception:
        if process is not None:
            stop_server_process(process)
        if os.path.exists(pid_file):
            os.remove(pid_file)
        raise
    return process, pid_file
def wait_for_server_pid(process, pid_file, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('The local wallet server stopped during startup.')
        try:
            with open(pid_file, encoding='ascii') as pid_file_handle:
                server_pid = int(pid_file_handle.read().strip())
            if server_pid > 0:
                return server_pid
        except (FileNotFoundError, ValueError):
            pass
        time.sleep(0.1)
    raise RuntimeError('The local wallet server process did not start in time.')
def wait_for_server(process, url, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('The local wallet server stopped during startup.')
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            time.sleep(0.2)
    raise RuntimeError('The local wallet server did not start in time.')
def stop_server_process(process):
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
def run_server(port, pid_file):
    from werkzeug.serving import make_server
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    app.config['YTN_LIVE_SEND_ENABLED'] = True
    with open(pid_file, 'w', encoding='ascii') as pid_file_handle:
        pid_file_handle.write(str(os.getpid()))
    server = make_server('127.0.0.1', port, app, threaded=True)
    server.serve_forever()
def show_startup_error(message):
    print(message, file=sys.stderr)
    try:
        escaped = message.replace('\\', '\\\\').replace('"', '\\"')
        subprocess.run(
            [
                'osascript',
                '-e',
                f'display alert "YentenSingleWallet" message "{escaped}" as critical',
            ],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass
def run_desktop_app():
    try:
        import webview
    except ImportError as error:
        show_startup_error(
            'The desktop window component could not be loaded. '
            'Rebuild the application with pywebview installed.\n\n' + str(error)
        )
        return 1
    server_process = None
    server_pid_file = None
    backup_file_api = BackupFileApi()
    def cleanup():
        stop_server_process(server_process)
        if server_pid_file is not None and os.path.exists(server_pid_file):
            try:
                os.remove(server_pid_file)
            except OSError:
                pass
    atexit.register(cleanup)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        port = choose_local_port()
        url = f'http://127.0.0.1:{port}/'
        server_process, server_pid_file = start_server_process(port)
        wait_for_server(server_process, url)
        window = webview.create_window(
            'YentenSingleWallet',
            url,
            width=1100,
            height=780,
            min_size=(760, 560),
            confirm_close=False,
            js_api=backup_file_api,
        )
        backup_file_api._window = window

        webview.start(
            debug=False,
            private_mode=False,
            storage_path=webview_storage_path(),
        )
        return 0
    except Exception as error:
        show_startup_error('Could not start the desktop wallet.\n\n' + str(error))
        return 1
    finally:
        cleanup()
def run_browser_app():
    from werkzeug.serving import make_server
    try:
        port = choose_local_port()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1
    url = f'http://127.0.0.1:{port}/'
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    app.config['YTN_LIVE_SEND_ENABLED'] = True
    server = make_server('127.0.0.1', port, app, threaded=True)
    webbrowser.open(url)
    print(f'YentenSingleWallet is running at {url}. Press Ctrl+C to stop.')
    server.serve_forever()
    return 0
def main():
    multiprocessing.freeze_support()
    if len(sys.argv) == 4 and sys.argv[1] == SERVER_ARGUMENT:
        try:
            run_server(int(sys.argv[2]), sys.argv[3])
        except (OSError, ValueError):
            return 1
        return 0
    return run_desktop_app()
if __name__ == '__main__':
    raise SystemExit(main())