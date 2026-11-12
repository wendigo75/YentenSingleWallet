# YentenSingleWallet
A secure, lightweight, and completely standalone desktop single wallet for **Yenten coin (YTN)**. It combines a robust Python backend (Flask) with a clean, highly responsive native local user interface (HTML/JS/CSS) rendered via `pywebview`.

## 🚀 Key Features
* **100% Standalone Binaries:** Compiled and packed into a single standalone executable for **Windows** (`YentenSingleWallet.exe`) and a self-contained distribution package for **Linux** (`YentenSingleWallet-Linux-x86_64.tar.gz`). No external dependencies or Python runtime required.
* **Multi-Language & Built-in Auto-Translator:** Defaults to English, with an integrated translator supporting any language and character set. Clicking the language button automatically detects your machine's system language (`system.language`) and translates the entire interface on the fly.
* **Client-Side Security:** Private keys, seed generation (BIP39), and transaction cryptographic signing happen entirely client-side within the isolated browser context using `bitcoinjs-lib`. Your secrets never leave your view.
* **OS Lifecycle Binding:** On Windows, Win32 JobObject binding ties the Flask backend server to the native UI window; closing the desktop interface instantly terminates all background processes, preventing "ghost" background tasks.
* **Secure Document Export:** Built-in secure bridge allows you to export wallet backup data and transaction certificates directly into verified local `.txt` or `.pdf` documents via native OS save dialogs.

## 🛠️ How to Build from Source

### 🪟 Windows (`.exe`)
If you want to audit the source code and compile the standalone Windows executable yourself, open PowerShell in the project root directory and run the automated build script:
```powershell
.\build_windows.ps1
```
*The automated script parses version strings from `version.py`, generates dynamic Windows file metadata, compiles a multi-resolution embedded icon (`.ico`), and bundles all assets using PyInstaller.*

### 🐧 Linux (`x86_64`)
To build the standalone Linux binary and `.tar.gz` release archive from source, open your terminal in the project root directory and run:
```bash
chmod +x Linux_compile.sh
./Linux_compile.sh
```
*This script compiles the standalone executable via PyInstaller and packages it together with `install.sh`, `app_icon.svg`, and the `.desktop` launcher into `YentenSingleWallet-Linux-x86_64.tar.gz`.*

## 🛡️ Authenticity & Anti-Malware Verification
This is a **fully free, open-source, non-commercially signed project** (NotSigned). Because the application acts as a cryptocurrency wallet, malicious third parties might modify and redistribute altered versions injected with malware.
To guarantee your absolute safety and ensure the file you are running is exactly the one produced by this repository, **always verify the SHA-256 hash of the downloaded file before executing it.**

### How to verify the SHA-256 on Windows:
Open Command Prompt (CMD) or PowerShell, navigate to the folder containing your executable, and run:
```cmd
certutil -hashfile YentenSingleWallet.exe SHA256
```

### How to verify the SHA-256 on Linux:
Open your terminal, navigate to the folder containing the downloaded archive, and run:
```bash
sha256sum YentenSingleWallet-Linux-x86_64.tar.gz
```

Compare the resulting alphanumeric string with the official hash provided in our official [Releases](https://github.com/wendigo75/YentenSingleWallet/releases) page. **If the hashes do not match perfectly, the file has been tampered with. DO NOT RUN IT.**

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. You are free to use, modify, and distribute this software, provided that proper credit and attribution to the original author (**wendigo75**) is maintained in all copies or substantial portions of the software.
