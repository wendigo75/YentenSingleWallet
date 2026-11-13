# ==========================================================================
# Yenten Single Wallet
# Copyright (c) 2026 wendigo75
# This file is part of the Yenten Single Wallet project.
# It is designed specifically to operate alongside the compiled executable. 
# This software is provided "AS IS", without warranty of any kind.
# For full license terms, see the LICENSE file in the root directory.
# ==========================================================================

import ctypes
import base64
import binascii
import logging
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import multiprocessing
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from app import app

SERVER_ARGUMENT = '--wallet-server'
LOCAL_SERVER_PORT = 51827
CREATE_NO_WINDOW = 0x08000000
JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9

class IoCounters(ctypes.Structure):
    _fields_ = [
        ('ReadOperationCount', ctypes.c_ulonglong),
        ('WriteOperationCount', ctypes.c_ulonglong),
        ('OtherOperationCount', ctypes.c_ulonglong),
        ('ReadTransferCount', ctypes.c_ulonglong),
        ('WriteTransferCount', ctypes.c_ulonglong),
        ('OtherTransferCount', ctypes.c_ulonglong),
    ]
class BasicLimitInformation(ctypes.Structure):
    _fields_ = [
        ('PerProcessUserTimeLimit', ctypes.c_longlong),
        ('PerJobUserTimeLimit', ctypes.c_longlong),
        ('LimitFlags', ctypes.c_ulong),
        ('MinimumWorkingSetSize', ctypes.c_size_t),
        ('MaximumWorkingSetSize', ctypes.c_size_t),
        ('ActiveProcessLimit', ctypes.c_ulong),
        ('Affinity', ctypes.c_size_t),
        ('PriorityClass', ctypes.c_ulong),
        ('SchedulingClass', ctypes.c_ulong),
    ]
class ExtendedLimitInformation(ctypes.Structure):
    _fields_ = [
        ('BasicLimitInformation', BasicLimitInformation),
        ('IoInfo', IoCounters),
        ('ProcessMemoryLimit', ctypes.c_size_t),
        ('JobMemoryLimit', ctypes.c_size_t),
        ('PeakProcessMemoryUsed', ctypes.c_size_t),
        ('PeakJobMemoryUsed', ctypes.c_size_t),
    ]
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
        destination = Path(save_path)
        if not destination.suffix:
            destination = destination.with_suffix(extension)
        elif destination.suffix.lower() != extension:
            raise ValueError(f'Choose a filename ending in {extension}.')
        with destination.open('wb') as backup_file:
            backup_file.write(content)
        return {'saved': True}
class JobObject:
    def __init__(self, process_id):
        if sys.platform != 'win32':
            self.handle = None
            return
        self.kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
        self.kernel32.CreateJobObjectW.restype = ctypes.c_void_p
        self.kernel32.OpenProcess.argtypes = [
            ctypes.c_ulong,
            ctypes.c_int,
            ctypes.c_ulong,
        ]
        self.kernel32.OpenProcess.restype = ctypes.c_void_p
        self.kernel32.SetInformationJobObject.argtypes = [
            ctypes.c_void_p,
            ctypes.c_int,
            ctypes.c_void_p,
            ctypes.c_ulong,
        ]
        self.kernel32.AssignProcessToJobObject.argtypes = [
            ctypes.c_void_p,
            ctypes.c_void_p,
        ]
        self.kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
        self.kernel32.CloseHandle.restype = ctypes.c_int
        self.handle = self.kernel32.CreateJobObjectW(None, None)
        if not self.handle:
            raise ctypes.WinError(ctypes.get_last_error())
        information = ExtendedLimitInformation()
        information.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not self.kernel32.SetInformationJobObject(
            self.handle,
            JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
            ctypes.byref(information),
            ctypes.sizeof(information),
        ):
            error = ctypes.WinError(ctypes.get_last_error())
            self.close()
            raise error
        process_handle = self.kernel32.OpenProcess(0x0101, False, process_id)
        if not process_handle:
            error = ctypes.WinError(ctypes.get_last_error())
            self.close()
            raise error
        try:
            if not self.kernel32.AssignProcessToJobObject(self.handle, process_handle):
                raise ctypes.WinError(ctypes.get_last_error())
        except Exception:
            self.close()
            raise
        finally:
            self.kernel32.CloseHandle(process_handle)
    def close(self):
        if self.handle:
            self.kernel32.CloseHandle(self.handle)
            self.handle = None
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
    if sys.platform == 'win32':
        local_app_data = os.environ.get('LOCALAPPDATA')
        if local_app_data:
            storage_root = Path(local_app_data)
        else:
            storage_root = Path.home() / 'AppData' / 'Local'
        storage_path = storage_root / 'YentenSingleWallet' / 'WebView2'
    else:
        xdg_data_home = os.environ.get('XDG_DATA_HOME')
        if xdg_data_home:
            storage_root = Path(xdg_data_home)
        else:
            storage_root = Path.home() / '.local' / 'share'
        storage_path = storage_root / 'YentenSingleWallet'
    storage_path.mkdir(parents=True, exist_ok=True)
    return str(storage_path)
def start_server_process(port):
    creation_flags = CREATE_NO_WINDOW if sys.platform == 'win32' else 0
    descriptor, pid_file = tempfile.mkstemp(prefix='yenten-wallet-', suffix='.pid')
    os.close(descriptor)
    command = [sys.executable]
    if not getattr(sys, 'frozen', False):
        command.append(os.path.abspath(__file__))
    command.extend([SERVER_ARGUMENT, str(port), pid_file])
    process = None
    server_pid = None
    try:
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags,
            close_fds=True,
        )
        server_pid = wait_for_server_pid(process, pid_file)
        job = JobObject(server_pid)
    except Exception:
        if process is not None:
            stop_server_process(process)
        if server_pid is not None:
            terminate_process_by_pid(server_pid)
        if os.path.exists(pid_file):
            os.remove(pid_file)
        raise
    return process, job, pid_file
def terminate_process_by_pid(process_id):
    if sys.platform != 'win32':
        return
    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel32.OpenProcess.argtypes = [ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
    kernel32.OpenProcess.restype = ctypes.c_void_p
    kernel32.TerminateProcess.argtypes = [ctypes.c_void_p, ctypes.c_uint]
    kernel32.TerminateProcess.restype = ctypes.c_int
    kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
    process_handle = kernel32.OpenProcess(0x0001, False, process_id)
    if not process_handle:
        return
    try:
        kernel32.TerminateProcess(process_handle, 1)
    finally:
        kernel32.CloseHandle(process_handle)
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
    if process.poll() is not None:
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
    if sys.platform == 'win32':
        ctypes.windll.user32.MessageBoxW(
            None,
            message,
            'YentenSingleWallet',
            0x10,
        )
    else:
        print(message, file=sys.stderr)
def set_linux_window_icon():
    if sys.platform == 'win32':
        return
    try:
        import gi
        gi.require_version('Gtk', '3.0')
        from gi.repository import Gtk
        if getattr(sys, 'frozen', False):
            base_path = Path(sys._MEIPASS)
        else:
            base_path = Path(__file__).resolve().parent
        icon_path = base_path / 'static' / 'images' / 'wallet.svg'
        if icon_path.exists():
            Gtk.Window.set_default_icon_from_file(str(icon_path))
    except Exception as error:
        logging.debug(f'Could not set Linux window icon: {error}')
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
    server_job = None
    server_pid_file = None
    backup_file_api = BackupFileApi()
    try:
        port = choose_local_port()
        url = f'http://127.0.0.1:{port}/'
        server_process, server_job, server_pid_file = start_server_process(port)
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
        start_kwargs = {
            'debug': False,
            'private_mode': False,
            'storage_path': webview_storage_path(),
        }
        if sys.platform == 'win32':
            start_kwargs['gui'] = 'edgechromium'
        set_linux_window_icon()
        webview.start(**start_kwargs)
        return 0
    except Exception as error:
        show_startup_error('Could not start the desktop wallet.\n\n' + str(error))
        return 1
    finally:
        if server_job is not None:
            server_job.close()
        if server_process is not None:
            stop_server_process(server_process)
        if server_pid_file is not None and os.path.exists(server_pid_file):
            os.remove(server_pid_file)
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
    if sys.platform == 'win32':
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