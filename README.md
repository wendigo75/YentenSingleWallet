# YentenSingleWallet
A secure, lightweight, and completely standalone desktop single wallet for **Yenten coin (YTN)**. It combines a robust Python backend (Flask) with a clean, highly responsive native local user interface (HTML/JS/CSS) rendered via `pywebview`.

## 🚀 Key Features
* **100% Standalone Executable:** Everything is compiled and packed into a single standalone binary (`YentenSingleWallet.exe`). No installation, external dependencies, or Python runtime required on the user's PC.
* **Client-Side Security:** Private keys, seed generation (BIP39), and transaction cryptographic signing happen entirely client-side within the isolated browser context using `bitcoinjs-lib`. Your secrets never leave your view.
* **Win32 JobObject Lifecycle Binding:** The Flask backend server is programmatically bound to the native Windows UI window. Closing the desktop interface instantly terminates all background server processes, preventing "ghost" background tasks.
* **Secure Document Export:** Built-in secure bridge allows you to export wallet backup data and transaction certificates directly into verified local `.txt` or `.pdf` documents via native OS save dialogs.

## 🛠️ How to Build from Source (.exe)
If you want to audit the source code and compile the standalone Windows executable yourself, open PowerShell in the project root directory and run the automated build script:
```powershell
.\build_windows.ps1
```
*The automated script will safely parse version strings from `version.py`, generate dynamic Windows file metadata, compile a multi-resolution embedded icon (`.ico`) directly from `yenten.png`, and bundle all assets using PyInstaller.*

## 🛡️ Authenticity & Anti-Malware Verification
This is a **fully free, open-source, non-commercially signed project** (NotSigned). Because the application acts as a cryptocurrency wallet, malicious third parties might modify and redistribute altered versions of this executable injected with malware.
To guarantee your absolute safety and ensure the file you are running is exactly the one produced by this repository, **always verify the SHA-256 hash of the executable before executing it.**

### How to verify the SHA-256 on Windows:
Open your Command Prompt (CMD) or PowerShell, navigate to the folder containing your executable, and run:
```cmd
certutil -hashfile YentenSingleWallet.exe SHA256
```
Compare the resulting alphanumeric string with the official hash provided in our official [Releases](https://github.com) page. **If the hashes do not match perfectly, the file has been tampered with. DO NOT RUN IT.**

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. You are free to use, modify, and distribute this software, provided that proper credit and attribution to the original author (**wendigo75**) is maintained in all copies or substantial portions of the software.
