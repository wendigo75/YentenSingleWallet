/* ==========================================================================
# Yenten Single Wallet
# Copyright (c) 2026 wendigo75
# This file is part of the Yenten Single Wallet project.
# It is designed specifically to operate alongside the compiled executable. 
# This software is provided "AS IS", without warranty of any kind.
# For full license terms, see the LICENSE file in the root directory.
# ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const userLanguage = navigator.language || navigator.userLanguage;
    const sysLang = userLanguage.substring(0, 2).toLowerCase();
    let currentLang = "EN";
    const btnLang = document.getElementById('btn-lang');
    const btnWalletLang = document.getElementById('btn-wallet-lang');
    const walletHelpLanguageIcon = document.getElementById('wallet-help-language-icon');
    const languageButtons = [btnLang, btnWalletLang];
    const translatableElements = document.querySelectorAll('.translate-me');
    const originalTexts = new Map();
    translatableElements.forEach(el => {
    const targetText = el.getAttribute('data-translate-title') || (el.children.length === 0 ? el.innerText.trim() : null);
    if (targetText) {
            originalTexts.set(el, targetText);
        }
    });
    const backupWarningTexts = Array.from(
        document.querySelectorAll('#modal-backup-warning .translate-me')
    ).map(element => ({ element, text: element.innerText.trim() }));
    backupWarningTexts.forEach(({ element }) => originalTexts.delete(element));
    const cacheTranslatedTexts = new Map();
    const dynamicTextTranslationCache = new Map();
    const dynamicTranslationCallbacks = [];
    function setTranslatedText(element, text) {
        if (element.hasAttribute('data-translate-title')) {
            element.title = text;
            if (element.hasAttribute('aria-label')) {
                element.setAttribute('aria-label', text);
            }
        } else {
            element.innerText = text;
        }
    }
    function protectTechnicalTerms(text) {
        const terms = [];
        const protectedText = text.replace(/\b(seed phrase|wallets?|keys?|wif|seed|bip39)\b/gi, (term) => {
            const marker = 'ZXQXZQXZQXZ' + terms.length + 'XZQXZQXZQ';
            terms.push({ marker, term });
            return marker;
        });
        return {
            text: protectedText,
            restore: (translatedText) => terms.reduce(
                (result, entry) => result.replace(new RegExp(entry.marker, 'gi'), entry.term),
                translatedText
            )
        };
    }
    async function translatePage(targetLang) {
        document.documentElement.lang = targetLang;
        for (let [el, originalText] of originalTexts) {
            if (targetLang === 'en') {
                setTranslatedText(el, originalText);
            } else {
                if (cacheTranslatedTexts.has(el)) {
                    setTranslatedText(el, cacheTranslatedTexts.get(el));
                    continue;
                }
                try {
                    const protectedText = protectTechnicalTerms(originalText);
                    const baseLink = "https://translate.googleapis.com" + "/translate_a/single?client=gtx" + "&sl=en&tl=" + targetLang + "&dt=t&q=" + encodeURIComponent(protectedText.text);
                    const response = await fetch(baseLink);
                    const data = await response.json();                    
                    if (data && data[0] && data[0][0] && data[0][0][0]) {
                        const translatedText = protectedText.restore(data[0][0][0]).toUpperCase();
                        setTranslatedText(el, translatedText);
                        cacheTranslatedTexts.set(el, translatedText);
                    } else {
                        setTranslatedText(el, originalText);
                    }
                } catch (error) {
                    setTranslatedText(el, originalText);
                }
            }
        }
    }
    async function translateAlertMessage(message, targetLang = currentLang === "EN" ? "en" : sysLang) {
        if (targetLang === 'en') {
            return message;
        }
        const cacheKey = targetLang + '\u0000' + message;
        if (dynamicTextTranslationCache.has(cacheKey)) {
            return dynamicTextTranslationCache.get(cacheKey);
        }
        const translationRequest = (async () => {
            try {
                const translateUrl = "https://translate.googleapis.com/translate_a/single" +
                    "?client=gtx&sl=en&tl=" + encodeURIComponent(targetLang) +
                    "&dt=t&q=" + encodeURIComponent(message);
                const response = await fetch(translateUrl);
                if (!response.ok) {
                    throw new Error("Translation service returned HTTP " + response.status + ".");
                }
                const data = await response.json();
                if (!data || !data[0] || !data[0][0] || !data[0][0][0]) {
                    throw new Error("Translation service returned an invalid response.");
                }
                return data[0][0][0].toUpperCase();
            } catch (error) {
                dynamicTextTranslationCache.delete(cacheKey);
                console.error("Could not translate the alert message:", error);
                return message;
            }
        })();
        dynamicTextTranslationCache.set(cacheKey, translationRequest);
        return translationRequest;
    }
    function setDynamicTranslatedText(element, message, attribute = 'textContent') {
        const targetLang = currentLang === "EN" ? "en" : sysLang;
        element.dataset.translationSource = message;
        element.dataset.translationAttribute = attribute;
        element.dataset.translationLanguage = targetLang;
        translateAlertMessage(message, targetLang).then((translatedText) => {
            if (
                element.dataset.translationSource === message &&
                element.dataset.translationLanguage === targetLang &&
                (currentLang === "EN" ? "en" : sysLang) === targetLang
            ) {
                if (attribute === 'textContent') {
                    element.textContent = translatedText;
                } else {
                    element.setAttribute(attribute, translatedText);
                    if (attribute === 'title' && element.hasAttribute('aria-label')) {
                        element.setAttribute('aria-label', translatedText);
                    }
                }
            }
        });
    }
    function refreshDynamicTranslations() {
        document.querySelectorAll('[data-translation-source]').forEach((element) => {
            setDynamicTranslatedText(
                element,
                element.dataset.translationSource,
                element.dataset.translationAttribute
            );
        });
    }
    dynamicTranslationCallbacks.push(refreshDynamicTranslations);
    function updateInterface() {
        const baseFlagUrl = "https://flagcdn.com" + "/24x18/";
        let flagCode = "gb";
        let languageLabel = "EN";
        if (currentLang === "EN") {
            flagCode = "gb";
            languageLabel = "EN";
            translatePage("en");
        } else {
            flagCode = sysLang === "en" ? "gb" : sysLang;
            languageLabel = sysLang.toUpperCase();
            translatePage(sysLang);
        }
        dynamicTranslationCallbacks.forEach((refreshTranslation) => {
            refreshTranslation(currentLang === "EN" ? "en" : sysLang);
        });
        languageButtons.forEach((button) => {
            button.innerHTML = '<img src="' + baseFlagUrl + flagCode + '.png" alt="' +
                languageLabel + '" style="vertical-align: middle; width: 24px; height: 18px; border-radius: 2px;">';
            button.title = languageLabel;
            button.setAttribute('aria-label', 'Change language (' + languageLabel + ')');
        });
        walletHelpLanguageIcon.src = baseFlagUrl + flagCode + '.png';
    }
    updateInterface();
    const btnCreate = document.getElementById('btn-create');
    const btnImport = document.getElementById('btn-import');
    const btnOpen = document.getElementById('btn-open');
    const btnRemove = document.getElementById('btn-remove');
    const btnWalletView = document.getElementById('btn-wallet-view');
    const modalCreateWallet = document.getElementById('modal-create-wallet');
    const btnCloseCreateWallet = document.getElementById('btn-close-create-wallet');
    const createPassphraseToggle = document.getElementById('create-passphrase-toggle');
    const createPassphraseOffLabel = document.getElementById('create-passphrase-off-label');
    const createPassphraseOnLabel = document.getElementById('create-passphrase-on-label');
    const modalCreateExpertWarning = document.getElementById('modal-create-expert-warning');
    const btnConfirmCreateExpertMode = document.getElementById('btn-confirm-create-expert-mode');
    const modalCreateCredentials = document.getElementById('modal-create-credentials');
    const btnCloseCreateCredentials = document.getElementById('btn-close-create-credentials');
    const createBip39PassphraseFields = document.getElementById('create-bip39-passphrase-fields');
    const createBip39PassphraseInput = document.getElementById('create-bip39-passphrase');
    const createBip39PassphraseConfirmInput = document.getElementById('create-bip39-passphrase-confirm');
    const createWalletPasswordInput = document.getElementById('create-wallet-password');
    const createWalletPasswordConfirmInput = document.getElementById('create-wallet-password-confirm');
    const btnStartCreate = document.getElementById('btn-start-create');
    const btnSubmitCreate = document.getElementById('btn-submit-create');
    function updateWalletButtons() {
        const hasSavedWallet = Boolean(localStorage.getItem('ytn_wallet'));
        const hasSavedWalletData = Boolean(localStorage.getItem('ytn_wallet_data'));
        btnCreate.classList.toggle('hidden', hasSavedWallet);
        btnImport.classList.toggle('hidden', hasSavedWallet);
        btnOpen.classList.toggle('hidden', !hasSavedWallet);
        btnRemove.classList.toggle('hidden', !hasSavedWallet);
        btnWalletView.classList.toggle('hidden', !hasSavedWalletData);
    }
    updateWalletButtons();
    function toggleLanguage() {
        currentLang = (currentLang === "EN") ? "SYS" : "EN";
        updateInterface();
    }
    languageButtons.forEach((button) => {
        button.addEventListener('click', toggleLanguage);
    });
    const modalHelp = document.getElementById('modal-help');
    const btnHelp = document.getElementById('btn-help');
    const btnCloseHelp = document.getElementById('btn-close-help');
    btnHelp.addEventListener('click', () => {
        modalHelp.showModal(); 
    });
    btnCloseHelp.addEventListener('click', () => {
        modalHelp.close();     
    });
    modalHelp.addEventListener('click', (event) => {
        const rect = modalHelp.getBoundingClientRect();
        const isInModal = (rect.top <= event.clientY && event.clientY <= rect.bottom &&
                           rect.left <= event.clientX && event.clientX <= rect.right);        
        if (!isInModal) {
            modalHelp.close();
        }
	});	
    const modalInfo = document.getElementById('modal-info');
    const btnInfo = document.getElementById('btn-info');
    const btnCloseInfo = document.getElementById('btn-close-info');
    btnInfo.addEventListener('click', () => {
        modalInfo.showModal(); 
    });
    btnCloseInfo.addEventListener('click', () => {
        modalInfo.close();
    });
    modalInfo.addEventListener('click', (event) => {
        const rect = modalInfo.getBoundingClientRect();
        const isInModal = (rect.top <= event.clientY && event.clientY <= rect.bottom &&
                           rect.left <= event.clientX && event.clientX <= rect.right);        
        if (!isInModal) {
            modalInfo.close();
        }
    });
    const modalCredits = document.getElementById('modal-credits');
    const btnCredits = document.getElementById('btn-credits');
    const btnCloseCredits = document.getElementById('btn-close-credits');
    btnCredits.addEventListener('click', () => {
        modalCredits.showModal(); 
    });
    btnCloseCredits.addEventListener('click', () => {
        modalCredits.close();
    });
    modalCredits.addEventListener('click', (event) => {
        const rect = modalCredits.getBoundingClientRect();
        const isInModal = (rect.top <= event.clientY && event.clientY <= rect.bottom &&
                           rect.left <= event.clientX && event.clientX <= rect.right);        
        if (!isInModal) {
            modalCredits.close();
        }
    });
    const modalImport = document.getElementById('modal-import-wallet');
    const btnImportWallet = document.getElementById('btn-import'); 
    const btnCloseImport = document.getElementById('btn-close-import'); 
    const btnCancelImport = document.getElementById('btn-cancel-import'); 
    let walletImportInProgress = false;
    btnImportWallet.addEventListener('click', () => {
        modalImport.showModal(); 
    });
    btnCloseImport.addEventListener('click', () => {
        if (!walletImportInProgress) modalImport.close();
    });
    btnCancelImport.addEventListener('click', () => {
        if (!walletImportInProgress) modalImport.close();
    });
    modalImport.addEventListener('click', (event) => {
        const rect = modalImport.getBoundingClientRect();
        const isInModal = (rect.top <= event.clientY && event.clientY <= rect.bottom &&
                           rect.left <= event.clientX && event.clientX <= rect.right);        
        if (!isInModal && !walletImportInProgress) {
            modalImport.close();
        }
    });	
    modalImport.addEventListener('cancel', (event) => {
        if (walletImportInProgress) event.preventDefault();
    });
    let acceptCreateExpertMode = false;
    let walletCreateInProgress = false;
    function updateCreatePassphraseMode() {
        const enabled = createPassphraseToggle.checked;
        createBip39PassphraseFields.classList.toggle('hidden', !enabled);
        createBip39PassphraseInput.disabled = !enabled;
        createBip39PassphraseConfirmInput.disabled = !enabled;
        createPassphraseOffLabel.classList.toggle('is-selected', !enabled);
        createPassphraseOnLabel.classList.toggle('is-selected', enabled);
        createPassphraseToggle.setAttribute('aria-label', enabled ? 'BIP39 passphrase on' : 'BIP39 passphrase off');
        if (!enabled) {
            createBip39PassphraseInput.value = "";
            createBip39PassphraseConfirmInput.value = "";
        }
    }
    btnCreate.addEventListener('click', () => {
        createPassphraseToggle.checked = false;
        updateCreatePassphraseMode();
        modalCreateWallet.showModal();
    });
    btnCloseCreateWallet.addEventListener('click', () => modalCreateWallet.close());
    modalCreateWallet.addEventListener('click', (event) => {
        const rect = modalCreateWallet.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) modalCreateWallet.close();
    });
    createPassphraseToggle.addEventListener('change', () => {
        if (!createPassphraseToggle.checked) {
            updateCreatePassphraseMode();
            return;
        }
        createPassphraseToggle.checked = false;
        updateCreatePassphraseMode();
        modalCreateWallet.close();
        modalCreateExpertWarning.showModal();
    });
    btnConfirmCreateExpertMode.addEventListener('click', () => {
        acceptCreateExpertMode = true;
        modalCreateExpertWarning.close();
    });
    modalCreateExpertWarning.addEventListener('close', () => {
        createPassphraseToggle.checked = acceptCreateExpertMode;
        acceptCreateExpertMode = false;
        updateCreatePassphraseMode();
        modalCreateWallet.showModal();
    });
    modalCreateExpertWarning.addEventListener('click', (event) => {
        const rect = modalCreateExpertWarning.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) modalCreateExpertWarning.close();
    });
    btnStartCreate.addEventListener('click', () => {
        modalCreateWallet.close();
        createBip39PassphraseInput.value = "";
        createBip39PassphraseConfirmInput.value = "";
        createWalletPasswordInput.value = "";
        createWalletPasswordConfirmInput.value = "";
        createBip39PassphraseFields.classList.toggle('hidden', !createPassphraseToggle.checked);
        createBip39PassphraseInput.disabled = !createPassphraseToggle.checked;
        createBip39PassphraseConfirmInput.disabled = !createPassphraseToggle.checked;
        modalCreateCredentials.showModal();
        (createPassphraseToggle.checked ? createBip39PassphraseInput : createWalletPasswordInput).focus();
    });
    btnCloseCreateCredentials.addEventListener('click', () => {
        if (!walletCreateInProgress) modalCreateCredentials.close();
    });
    modalCreateCredentials.addEventListener('close', () => {
        createBip39PassphraseInput.value = "";
        createBip39PassphraseConfirmInput.value = "";
        createWalletPasswordInput.value = "";
        createWalletPasswordConfirmInput.value = "";
    });
    modalCreateCredentials.addEventListener('click', (event) => {
        const rect = modalCreateCredentials.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal && !walletCreateInProgress) modalCreateCredentials.close();
    });
    modalCreateCredentials.addEventListener('cancel', (event) => {
        if (walletCreateInProgress) event.preventDefault();
    });
    const modalWalletCore = document.getElementById('modal-wallet-core');
    const modalWalletUnlock = document.getElementById('modal-wallet-unlock');
    const modalWalletAlert = document.getElementById('modal-wallet-alert');
    const walletAlertMessage = document.getElementById('wallet-alert-message');
    const btnCloseWalletAlert = document.getElementById('btn-close-wallet-alert');
    const walletUnlockPasswordInput = document.getElementById('wallet-unlock-password');
    const walletUnlockStatus = document.getElementById('wallet-unlock-status');
    const btnUnlockWallet = document.getElementById('btn-unlock-wallet');
    const btnCancelWalletUnlock = document.getElementById('btn-cancel-wallet-unlock');
    const btnSubmitImport = document.getElementById('btn-submit-import'); 
    const btnWalletExit = document.getElementById('btn-wallet-exit');    
    const btnCopyAddress = document.getElementById('btn-copy-address');
    const importSeedInput = document.getElementById('import-seed-input');
    const importBip39PassphraseInput = document.getElementById('import-bip39-passphrase');
    const importWalletPasswordInput = document.getElementById('import-wallet-password');
    const importBip39PassphraseField = document.getElementById('import-bip39-passphrase-field');
    const importModeToggle = document.getElementById('import-mode-toggle');
    const importModeSeedLabel = document.getElementById('import-mode-seed-label');
    const importModeWifLabel = document.getElementById('import-mode-wif-label');
    const walletAddressDisplay = document.getElementById('wallet-address-display');
    const walletBalanceDisplay = document.getElementById('wallet-balance-value');
    const walletBalanceStatus = document.getElementById('wallet-balance-status');
    const walletQrContainer = document.getElementById('wallet-qrcode');
    const btnCopyBalance = document.getElementById('btn-copy-balance');
    const btnCopyQr = document.getElementById('btn-copy-qr');
    const modalSettings = document.getElementById('modal-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnExportBackup = document.getElementById('btn-export-backup');
    const modalBackupWarning = document.getElementById('modal-backup-warning');
    const btnProceedExportBackup = document.getElementById('btn-proceed-export-backup');
    const modalBackupPdfPreview = document.getElementById('modal-backup-pdf-preview');
    const backupPdfPreviewFrame = document.getElementById('backup-pdf-preview-frame');
    const btnDownloadBackupPdf = document.getElementById('btn-download-backup-pdf');
    const btnPrintBackupPdf = document.getElementById('btn-print-backup-pdf');
    const btnCloseBackupPdfPreview = document.getElementById('btn-close-backup-pdf-preview');
    const btnCloseBackupPdfPreviewFooter = document.getElementById('btn-close-backup-pdf-preview-footer');
    const backupFormatToggle = document.getElementById('backup-format-toggle');
    const backupFormatTxtLabel = document.getElementById('backup-format-txt-label');
    const backupFormatPdfLabel = document.getElementById('backup-format-pdf-label');
    let walletDataForBackup = null;
    let backupPdfObjectUrl = null;
    let walletUnlockMode = 'open';
    let walletUnlockResolver = null;
    let walletUnlockRejecter = null;
    let walletUnlockInProgress = false;
    const modalWalletHelp = document.getElementById('modal-wallet-help');
    const btnWalletHelp = document.getElementById('btn-wallet-help');
    const btnCloseWalletHelp = document.getElementById('btn-close-wallet-help');
    const btnWalletSign = document.getElementById('btn-wallet-sign');
    const modalWalletSignature = document.getElementById('modal-wallet-signature');
    const btnCloseWalletSignature = document.getElementById('btn-close-wallet-signature');
    const btnCreateMessageSignature = document.getElementById('btn-create-message-signature');
    const walletSignMessage = document.getElementById('wallet-sign-message');
    const walletSignatureValue = document.getElementById('wallet-signature-value');
    const btnCopyMessageSignature = document.getElementById('btn-copy-message-signature');
    const walletSignatureStatus = modalWalletSignature.querySelector('.wallet-signature-status');
    let walletSignatureStatusMessage = "";
    let walletSignatureStatusRequest = 0;
    const walletSignatureStatusTranslations = new Map();
    async function refreshWalletSignatureStatus(targetLang) {
        const requestId = ++walletSignatureStatusRequest;
        if (!walletSignatureStatusMessage) {
            walletSignatureStatus.textContent = "";
            return;
        }
        if (targetLang === 'en') {
            walletSignatureStatus.textContent = walletSignatureStatusMessage;
            return;
        }
        const cacheKey = targetLang + ':' + walletSignatureStatusMessage;
        if (walletSignatureStatusTranslations.has(cacheKey)) {
            walletSignatureStatus.textContent = walletSignatureStatusTranslations.get(cacheKey);
            return;
        }
        try {
            const translateUrl = "https://translate.googleapis.com/translate_a/single" +
                "?client=gtx&sl=en&tl=" + encodeURIComponent(targetLang) +
                "&dt=t&q=" + encodeURIComponent(walletSignatureStatusMessage);
            const response = await fetch(translateUrl);
            if (!response.ok) {
                throw new Error("Translation service returned HTTP " + response.status + ".");
            }
            const data = await response.json();
            if (!data || !data[0] || !data[0][0] || !data[0][0][0]) {
                throw new Error("Translation service returned an invalid response.");
            }

            const translatedText = data[0][0][0].toUpperCase();
            walletSignatureStatusTranslations.set(cacheKey, translatedText);
            if (requestId === walletSignatureStatusRequest) {
                walletSignatureStatus.textContent = translatedText;
            }
        } catch (error) {
            console.error("Could not translate the signature status message:", error);
            if (requestId === walletSignatureStatusRequest) {
                walletSignatureStatus.textContent = walletSignatureStatusMessage;
            }
        }
    }
    dynamicTranslationCallbacks.push(refreshWalletSignatureStatus);
    refreshWalletSignatureStatus(currentLang === "EN" ? "en" : sysLang);
    const publicYentenApiBaseUrl = typeof window.YTN_PUBLIC_API_BASE_URL === 'string'
        ? window.YTN_PUBLIC_API_BASE_URL.trim()
        : '';
    const publicYentenApiEnabled = publicYentenApiBaseUrl !== '';
    const balanceApiUrl = window.YTN_BALANCE_API_URL || '/api/balance';
    const statusApiUrl = window.YTN_STATUS_API_URL || '/api/status';
    const networkStatus = document.getElementById('wallet-network-status');
    const networkChecking = document.getElementById('wallet-network-checking');
    const networkOnline = document.getElementById('wallet-network-online');
    const networkOffline = document.getElementById('wallet-network-offline');
    const networkBlockHeight = document.getElementById('wallet-block-height');
    const historyApiUrl = window.YTN_HISTORY_API_URL || '/api/history';
    const mempoolHistoryApiUrl = window.YTN_MEMPOOL_HISTORY_API_URL || '/api/history/mempool';
    const unspentApiUrl = window.YTN_UNSPENT_API_URL || '/api/unspent';
    const modalWalletSend = document.getElementById('modal-wallet-send');
    const btnWalletSend = document.getElementById('btn-wallet-send');
    const btnCloseWalletSend = document.getElementById('btn-close-wallet-send');
    const btnCloseWalletSendFooter = document.getElementById('btn-close-wallet-send-footer');
    const walletSendRecipient = document.getElementById('wallet-send-recipient');
    const walletSendQrLockNote = document.getElementById('wallet-send-qr-lock-note');
    const btnUnlockWalletSendRecipient = document.getElementById('btn-unlock-wallet-send-recipient');
    const btnScanWalletSendQr = document.getElementById('btn-scan-wallet-send-qr');
    const btnPasteWalletSendQr = document.getElementById('btn-paste-wallet-send-qr');
    const walletSendQrFile = document.getElementById('wallet-send-qr-file');
    const walletSendQrVideo = document.getElementById('wallet-send-qr-video');
    const walletSendQrStatus = document.getElementById('wallet-send-qr-status');
    const modalWalletQrConfirm = document.getElementById('modal-wallet-qr-confirm');
    const walletSendQrCandidate = document.getElementById('wallet-send-qr-candidate');
    const btnConfirmWalletSendRecipient = document.getElementById('btn-confirm-wallet-send-recipient');
    const btnCancelWalletSendRecipient = document.getElementById('btn-cancel-wallet-send-recipient');
    const walletSendAmount = document.getElementById('wallet-send-amount');
    const walletSendFee = document.getElementById('wallet-send-fee');
    const btnConfirmWalletSend = document.getElementById('btn-confirm-wallet-send');
    const walletSendAvailableBalance = document.getElementById('wallet-send-available-balance');
    const walletSendBalanceStatus = document.getElementById('wallet-send-balance-status');
    const modalWalletSendResult = document.getElementById('modal-wallet-send-result');
    const walletSendResultStatus = document.getElementById('wallet-send-result-status');
    const walletSendResultSummary = document.getElementById('wallet-send-result-summary');
    const walletSendResultSteps = document.getElementById('wallet-send-result-steps');
    const btnCloseWalletSendResult = document.getElementById('btn-close-wallet-send-result');
    const btnCloseWalletSendResultFooter = document.getElementById('btn-close-wallet-send-result-footer');
    const modalWalletSendConfirm = document.getElementById('modal-wallet-send-confirm');
    const walletSendConfirmSender = document.getElementById('wallet-send-confirm-sender');
    const walletSendConfirmRecipient = document.getElementById('wallet-send-confirm-recipient');
    const walletSendConfirmAmount = document.getElementById('wallet-send-confirm-amount');
    const walletSendConfirmFee = document.getElementById('wallet-send-confirm-fee');
    const walletSendConfirmTotal = document.getElementById('wallet-send-confirm-total');
    const walletSendConfirmStatus = document.getElementById('wallet-send-confirm-status');
    const btnBroadcastWalletSend = document.getElementById('btn-broadcast-wallet-send');
    const btnCancelWalletSendConfirm = document.getElementById('btn-cancel-wallet-send-confirm');
    const localSendSimulationEnabled = window.YTN_LOCAL_SEND_SIMULATION === true;
    const liveSendEnabled = window.YTN_LIVE_SEND_ENABLED === true;
    const liveBroadcastCsrfToken = window.YTN_CSRF_TOKEN;
    const broadcastApiUrl = typeof window.YTN_BROADCAST_API_URL === 'string' &&
        window.YTN_BROADCAST_API_URL.trim()
        ? window.YTN_BROADCAST_API_URL.trim()
        : publicYentenApiEnabled
            ? new URL('broadcast', publicYentenApiBaseUrl.endsWith('/')
                ? publicYentenApiBaseUrl
                : publicYentenApiBaseUrl + '/').href
            : '/api/broadcast';
    let unspentRequestController = null;
    let walletSendSimulationController = null;
    let unspentRequestId = 0;
    let walletSendStatusUpdateId = 0;
    let pendingQrRecipientAddress = null;
    let walletSendQrStream = null;
    let walletSendQrAnimationFrame = null;
    let walletSendQrScanInProgress = false;
    let walletSendQrCameraRequestId = 0;
    let walletSendQrStatusUpdateId = 0;
    let walletSendInProgress = false;
    let walletSendBroadcastInProgress = false;
    let pendingWalletSend = null;
    btnConfirmWalletSend.disabled = !localSendSimulationEnabled && !liveSendEnabled;
    const modalWalletHistory = document.getElementById('modal-wallet-history');
    const btnWalletHistory = document.getElementById('btn-wallet-history');
    const btnCloseHistory = document.getElementById('btn-close-history');
    const btnHistoryMore = document.getElementById('btn-history-more');
    const walletHistoryStatus = document.getElementById('wallet-history-status');
    const walletHistoryList = document.getElementById('wallet-history-list');
    const walletPendingStatus = document.getElementById('wallet-pending-status');
    const walletPendingList = document.getElementById('wallet-pending-list');
    let activeBalanceAddress = null;
    let balanceRefreshTimer = null;
    let balanceRequestInProgress = false;
    let balanceRequestController = null;
    let networkStatusController = null;
    let walletBalanceCopyValue = null;
    let historyAddress = null;
    let historyNextOffset = 0;
    let historyTotal = 0;
    let historyTransactions = [];
    let historyRefreshTimer = null;
    let historyRefreshInProgress = false;
    let historyRefreshGeneration = 0;
    let historyLoading = false;
    let historyPageController = null;
    let mempoolController = null;
    const yentenNetwork = {
        messagePrefix: '\x17Yenten Signed Message:\n',
        bip32: {
            public: 0x0488b21e,
            private: 0x0488ade4
        },
        pubKeyHash: 0x4e,
        scriptHash: 0x0a,
        wif: 0x7b
    };
    async function fetchPublicYentenApiResult(path, signal) {
        const baseUrl = publicYentenApiBaseUrl.endsWith('/')
            ? publicYentenApiBaseUrl
            : publicYentenApiBaseUrl + '/';
        const response = await fetch(new URL(path, baseUrl), {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal
        });
        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new Error('Yenten API returned an unreadable response.');
        }
        if (!response.ok || !payload || payload.error !== null) {
            const apiError = payload && payload.error;
            const message = apiError && typeof apiError.message === 'string'
                ? apiError.message
                : typeof apiError === 'string'
                    ? apiError
                    : 'Yenten API returned an error.';
            throw new Error(message);
        }
        if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
            throw new Error('Yenten API returned an invalid response.');
        }
        return payload.result;
    }
    function publicApiInteger(value, label) {
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new Error('Yenten API returned an invalid ' + label + '.');
        }
        return value;
    }
    function publicApiTransactionAddresses(item) {
        const script = item && item.scriptPubKey;
        if (!script || typeof script !== 'object') {
            return [];
        }
        if (Array.isArray(script.addresses)) {
            return script.addresses;
        }
        return typeof script.address === 'string' ? [script.address] : [];
    }
    function normalizePublicApiTransaction(txid, address, transaction, pending) {
        if (!transaction || !Array.isArray(transaction.vin) || !Array.isArray(transaction.vout)) {
            throw new Error('Yenten API returned invalid transaction details.');
        }
        const sumForAddress = (items) => items.reduce((total, item) => {
            if (!item || typeof item !== 'object') {
                throw new Error('Yenten API returned an invalid transaction item.');
            }
            if (!publicApiTransactionAddresses(item).includes(address)) {
                return total;
            }
            const value = publicApiInteger(item.value, 'transaction value');
            return total + BigInt(value);
        }, 0n);
        const netSatoshis = sumForAddress(transaction.vout) - sumForAddress(transaction.vin);
        const timestamp = Number.isSafeInteger(transaction.time) && transaction.time > 0
            ? transaction.time
            : Number.isSafeInteger(transaction.blocktime) && transaction.blocktime > 0
                ? transaction.blocktime
                : null;
        const confirmations = Number.isSafeInteger(transaction.confirmations) &&
            transaction.confirmations >= 0
            ? transaction.confirmations
            : 0;
        const magnitude = netSatoshis < 0n ? -netSatoshis : netSatoshis;
        const amount = (magnitude / 100000000n).toString() + '.' +
            (magnitude % 100000000n).toString().padStart(8, '0');
        return {
            txid,
            direction: netSatoshis > 0n
                ? 'incoming'
                : netSatoshis < 0n
                    ? 'outgoing'
                    : 'neutral',
            amount,
            timestamp,
            confirmations,
            pending
        };
    }
    async function mapWithConcurrency(items, limit, mapper) {
        const results = new Array(items.length);
        let nextIndex = 0;
        const workers = Array.from(
            { length: Math.min(limit, items.length) },
            async () => {
                while (nextIndex < items.length) {
                    const index = nextIndex++;
                    results[index] = await mapper(items[index], index);
                }
            }
        );
        await Promise.all(workers);
        return results;
    }
    async function requestPublicYentenHistory(address, offset, pending, signal) {
        const endpoint = pending
            ? 'mempool/' + encodeURIComponent(address)
            : 'history/' + encodeURIComponent(address) + '?offset=' + String(offset);
        const history = await fetchPublicYentenApiResult(endpoint, signal);
        const entries = history && history.tx;
        const txcount = history && history.txcount;
        if (
            !Array.isArray(entries) ||
            !Number.isSafeInteger(txcount) ||
            txcount < 0
        ) {
            throw new Error('Yenten API returned invalid transaction history.');
        }
        const txids = [];
        const seenTxids = new Set();
        entries.forEach((entry) => {
            const txid = pending && entry && typeof entry === 'object'
                ? entry.txid
                : entry;
            if (typeof txid !== 'string' || !/^[0-9a-f]{64}$/i.test(txid)) {
                throw new Error('Yenten API returned an invalid transaction ID.');
            }
            if (!seenTxids.has(txid)) {
                seenTxids.add(txid);
                txids.push(txid);
            }
        });
        const transactions = await mapWithConcurrency(txids, 5, async (txid) => {
            const details = await fetchPublicYentenApiResult(
                'transaction/' + encodeURIComponent(txid),
                signal
            );
            return normalizePublicApiTransaction(txid, address, details, pending);
        });
        return {
            address,
            offset,
            txcount,
            transactions
        };
    }
    async function loadBip39Wordlist() {
        const response = await fetch(new URL('static/bip39-english.txt', window.location.href), {
            cache: 'force-cache'
        });
        if (!response.ok) {
            throw new Error("Could not load the bundled BIP39 English wordlist (HTTP " + response.status + ").");
        }
        const words = (await response.text()).trim().split(/\r?\n/);
        if (words.length !== 2048 || new Set(words).size !== 2048) {
            throw new Error("The bundled BIP39 wordlist is invalid.");
        }
        return words;
    }
    async function generateBip39Mnemonic(words) {
        if (!window.crypto || !window.crypto.getRandomValues || !window.crypto.subtle) {
            throw new Error("A secure browser random generator is unavailable. Use localhost or HTTPS.");
        }
        const entropy = window.crypto.getRandomValues(new Uint8Array(16));
        const checksumHash = new Uint8Array(await window.crypto.subtle.digest('SHA-256', entropy));
        const entropyBits = Array.from(entropy, (byte) => byte.toString(2).padStart(8, '0')).join('');
        const checksumBits = Array.from(checksumHash, (byte) => byte.toString(2).padStart(8, '0')).join('').slice(0, 4);
        const mnemonicBits = entropyBits + checksumBits;
        const wordsInMnemonic = [];
        for (let offset = 0; offset < mnemonicBits.length; offset += 11) {
            wordsInMnemonic.push(words[parseInt(mnemonicBits.slice(offset, offset + 11), 2)]);
        }
        return wordsInMnemonic.join(' ');
    }
    async function validateBip39Mnemonic(seedPhrase, words) {
        const wordIndexes = new Map(words.map((word, index) => [word, index]));
        const phraseWords = seedPhrase.split(' ');
        if (phraseWords.length !== 12 || phraseWords.some((word) => !wordIndexes.has(word))) {
            throw new Error('The recovery phrase must contain 12 words from the English BIP39 wordlist.');
        }

        const mnemonicBits = phraseWords
            .map((word) => wordIndexes.get(word).toString(2).padStart(11, '0'))
            .join('');
        const entropyBits = mnemonicBits.slice(0, 128);
        const checksumBits = mnemonicBits.slice(128);
        const entropy = new Uint8Array(16);
        for (let index = 0; index < entropy.length; index += 1) {
            entropy[index] = parseInt(entropyBits.slice(index * 8, index * 8 + 8), 2);
        }

        const checksumHash = new Uint8Array(await window.crypto.subtle.digest('SHA-256', entropy));
        const expectedChecksum = Array.from(checksumHash, (byte) =>
            byte.toString(2).padStart(8, '0')
        ).join('').slice(0, 4);
        entropy.fill(0);
        if (checksumBits !== expectedChecksum) {
            throw new Error('The recovery phrase has an invalid BIP39 checksum. Check for typing errors.');
        }
    }
    async function deriveKeyPairFromMnemonic(seedPhrase, bip39Passphrase) {
        const cryptoKey = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(seedPhrase.normalize('NFKD')),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        const seedBits = await window.crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt: new TextEncoder().encode('mnemonic' + bip39Passphrase.normalize('NFKD')),
            iterations: 2048,
            hash: 'SHA-512'
        }, cryptoKey, 512);
        const seedBuffer = window.Buffer.from(seedBits);
        const rootNode = window.bitcoin.bip32.fromSeed(seedBuffer, yentenNetwork);
        const childNode = rootNode.derivePath("m/44'/125'/0'/0/0");
        return window.bitcoin.ECPair.fromPrivateKey(childNode.privateKey, {
            network: yentenNetwork,
            compressed: true
        });
    }
    function updateImportMode() {
        const isWifMode = importModeToggle.checked;
        const isSeedMode = !isWifMode;
        importBip39PassphraseField.classList.toggle('hidden', !isSeedMode);
        importBip39PassphraseInput.disabled = !isSeedMode;
        importModeSeedLabel.classList.toggle('is-selected', isSeedMode);
        importModeWifLabel.classList.toggle('is-selected', isWifMode);
        importModeToggle.setAttribute('aria-label', isWifMode ? 'WIF selected' : 'SEED selected');
        if (!isSeedMode) {
            importBip39PassphraseInput.value = "";
        }
    }
    importModeToggle.addEventListener('change', updateImportMode);
    updateImportMode();
    async function refreshWalletBalance(address) {
        if (balanceRequestInProgress || document.hidden || !modalWalletCore.open) {
            return;
        }
        balanceRequestInProgress = true;
        const controller = new AbortController();
        balanceRequestController = controller;
        walletBalanceStatus.textContent = "Updating balance...";
        try {
            let result;
            if (publicYentenApiEnabled) {
                const balanceResult = await fetchPublicYentenApiResult(
                    'balance/' + encodeURIComponent(address),
                    controller.signal
                );
                const balanceSatoshis = publicApiInteger(
                    balanceResult && balanceResult.balance,
                    'balance'
                );
                result = {
                    address,
                    balance: (BigInt(balanceSatoshis) / 100000000n).toString() + '.' +
                        (BigInt(balanceSatoshis) % 100000000n).toString().padStart(8, '0')
                };
            } else {
                const url = new URL(balanceApiUrl, window.location.href);
                url.searchParams.set('address', address);
                const response = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal
                });
                result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || "Balance service returned an error.");
                }
            }
            if (result.address !== address || !/^\d+(?:\.\d+)?$/.test(result.balance)) {
                throw new Error("Balance service returned invalid data.");
            }

            const balance = Number(result.balance);
            if (!Number.isFinite(balance)) {
                throw new Error("Balance service returned invalid data.");
            }
            walletBalanceDisplay.textContent = new Intl.NumberFormat(undefined, {
                minimumFractionDigits: 8,
                maximumFractionDigits: 8
            }).format(balance);
            walletBalanceCopyValue = result.balance;
            btnCopyBalance.disabled = false;
            walletBalanceStatus.textContent = "Updated " + new Date().toLocaleTimeString();
        } catch (error) {
            if (error.name !== 'AbortError' && activeBalanceAddress === address && modalWalletCore.open) {
                walletBalanceStatus.textContent = "Balance update failed: " + error.message;
            }
        } finally {
            if (balanceRequestController === controller) {
                balanceRequestController = null;
                balanceRequestInProgress = false;
            }
        }
    }
    async function refreshWalletNetworkStatus() {
        if (networkStatusController) {
            networkStatusController.abort();
        }
        const controller = new AbortController();
        networkStatusController = controller;
        networkStatus.classList.remove('is-online', 'is-offline');
        networkStatus.classList.add('is-checking');
        networkChecking.classList.remove('hidden');
        networkOnline.classList.add('hidden');
        networkOffline.classList.add('hidden');
        networkBlockHeight.textContent = '';
        try {
            let blockHeight;
            if (publicYentenApiEnabled) {
                const networkInfo = await fetchPublicYentenApiResult('info', controller.signal);
                blockHeight = networkInfo && networkInfo.blocks;
            } else {
                const response = await fetch(new URL(statusApiUrl, window.location.href), {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Network status service returned an error.');
                }
                blockHeight = result.block_height;
            }
            if (!Number.isSafeInteger(blockHeight) || blockHeight < 0) {
                throw new Error('Network status service returned an invalid block height.');
            }
            if (networkStatusController !== controller || !modalWalletCore.open) {
                return;
            }
            networkStatus.classList.remove('is-checking', 'is-offline');
            networkStatus.classList.add('is-online');
            networkChecking.classList.add('hidden');
            networkOnline.classList.remove('hidden');
            networkBlockHeight.textContent = '#' + blockHeight.toLocaleString();
        } catch (error) {
            if (error.name !== 'AbortError' && networkStatusController === controller && modalWalletCore.open) {
                networkStatus.classList.remove('is-checking', 'is-online');
                networkStatus.classList.add('is-offline');
                networkChecking.classList.add('hidden');
                networkOnline.classList.add('hidden');
                networkOffline.classList.remove('hidden');
                networkBlockHeight.textContent = '';
            }
        } finally {
            if (networkStatusController === controller) {
                networkStatusController = null;
            }
        }
    }
    function stopWalletBalanceRefresh() {
        if (balanceRefreshTimer !== null) {
            window.clearInterval(balanceRefreshTimer);
            balanceRefreshTimer = null;
        }
        if (balanceRequestController) {
            balanceRequestController.abort();
            balanceRequestController = null;
            balanceRequestInProgress = false;
        }
        if (networkStatusController) {
            networkStatusController.abort();
            networkStatusController = null;
        }
        activeBalanceAddress = null;
    }
    function startWalletBalanceRefresh(address) {
        stopWalletBalanceRefresh();
        activeBalanceAddress = address;
        walletBalanceDisplay.textContent = "--";
        walletBalanceCopyValue = null;
        btnCopyBalance.disabled = true;
        refreshWalletBalance(address);
        refreshWalletNetworkStatus();
        balanceRefreshTimer = window.setInterval(() => {
            if (activeBalanceAddress && modalWalletCore.open && !document.hidden) {
                refreshWalletBalance(activeBalanceAddress);
            }
        }, 60000);
    }
    function renderWalletAddress(address) {
        walletAddressDisplay.textContent = address;
        walletQrContainer.replaceChildren();
        btnCopyQr.disabled = true;
        try {
            new window.QRCode(walletQrContainer, {
                text: address,
                width: 240,
                height: 240,
                colorDark: '#14263c',
                colorLight: '#ffffff',
                correctLevel: window.QRCode.CorrectLevel.M
            });
            btnCopyQr.disabled = false;
        } catch (error) {
            walletQrContainer.textContent = "QR generation failed: " + error.message;
        }
    }
    function openSavedWallet(address) {
        renderWalletAddress(address);
        modalWalletCore.showModal();
        startWalletBalanceRefresh(address);
    }
    async function showWalletAlert(message) {
        walletAlertMessage.textContent = await translateAlertMessage(message);
        modalWalletAlert.showModal();
    }
    const walletEncryptionIterations = 600000;

    function encodeBase64(bytes) {
        let binary = '';
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return window.btoa(binary);
    }
    function decodeBase64(value) {
        if (typeof value !== 'string' || value.length === 0) {
            throw new Error('Encrypted wallet data is incomplete.');
        }
        const binary = window.atob(value);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    function walletEncryptionAdditionalData(walletRecord) {
        return new TextEncoder().encode(JSON.stringify({
            version: walletRecord.version,
            importType: walletRecord.importType,
            address: walletRecord.address,
            publicKey: walletRecord.publicKey,
            importedAt: walletRecord.importedAt
        }));
    }
    async function deriveWalletEncryptionKey(password, salt, usage) {
        if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
            throw new Error('Secure browser cryptography is unavailable. Use localhost or HTTPS.');
        }
        const passwordMaterial = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: walletEncryptionIterations,
                hash: 'SHA-256'
            },
            passwordMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            [usage]
        );
    }
    async function encryptWalletSecrets(walletData, password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptionKey = await deriveWalletEncryptionKey(password, salt, 'encrypt');
        const secrets = {
            privateKeyHex: walletData.privateKeyHex,
            wif: walletData.wif,
            seedPhrase: walletData.seedPhrase,
            bip39Passphrase: walletData.bip39Passphrase
        };
        const plaintext = new TextEncoder().encode(JSON.stringify(secrets));
        try {
            const walletRecord = {
                version: 2,
                importType: walletData.importType,
                address: walletData.address,
                publicKey: walletData.publicKey,
                importedAt: walletData.importedAt
            };
            const ciphertext = await window.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv,
                    additionalData: walletEncryptionAdditionalData(walletRecord)
                },
                encryptionKey,
                plaintext
            );
            return {
                ...walletRecord,
                encryption: {
                    algorithm: 'AES-GCM',
                    keyLength: 256,
                    kdf: 'PBKDF2',
                    hash: 'SHA-256',
                    iterations: walletEncryptionIterations,
                    salt: encodeBase64(salt),
                    iv: encodeBase64(iv),
                    ciphertext: encodeBase64(new Uint8Array(ciphertext))
                }
            };
        } finally {
            plaintext.fill(0);
            Object.keys(secrets).forEach((field) => {
                secrets[field] = '';
            });
        }
    }
    function saveEncryptedWallet(address, encryptedWalletData) {
        const previousAddress = localStorage.getItem('ytn_wallet');
        const previousWalletData = localStorage.getItem('ytn_wallet_data');
        try {
            localStorage.setItem('ytn_wallet_data', JSON.stringify(encryptedWalletData));
            localStorage.setItem('ytn_wallet', address);
        } catch (error) {
            if (previousWalletData === null) {
                localStorage.removeItem('ytn_wallet_data');
            } else {
                localStorage.setItem('ytn_wallet_data', previousWalletData);
            }
            if (previousAddress === null) {
                localStorage.removeItem('ytn_wallet');
            } else {
                localStorage.setItem('ytn_wallet', previousAddress);
            }
            throw error;
        }
    }
    async function decryptWalletSecrets(walletRecord, password) {
        const encryption = walletRecord && walletRecord.encryption;
        if (
            !walletRecord ||
            walletRecord.version !== 2 ||
            !encryption ||
            encryption.algorithm !== 'AES-GCM' ||
            encryption.keyLength !== 256 ||
            encryption.kdf !== 'PBKDF2' ||
            encryption.hash !== 'SHA-256' ||
            encryption.iterations !== walletEncryptionIterations
        ) {
            throw new Error('This wallet is not in the encrypted test format. Re-import it into TESTCRYPTO.');
        }
        const salt = decodeBase64(encryption.salt);
        const iv = decodeBase64(encryption.iv);
        const ciphertext = decodeBase64(encryption.ciphertext);
        if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) {
            throw new Error('Encrypted wallet data is malformed.');
        }
        const encryptionKey = await deriveWalletEncryptionKey(password, salt, 'decrypt');
        let plaintext;
        try {
            plaintext = new Uint8Array(await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv,
                    additionalData: walletEncryptionAdditionalData(walletRecord)
                },
                encryptionKey,
                ciphertext
            ));
            const secrets = JSON.parse(new TextDecoder().decode(plaintext));
            if (
                !secrets ||
                typeof secrets !== 'object' ||
                typeof secrets.privateKeyHex !== 'string' ||
                typeof secrets.wif !== 'string' ||
                typeof secrets.seedPhrase !== 'string' ||
                typeof secrets.bip39Passphrase !== 'string'
            ) {
                throw new Error('Decrypted wallet data is incomplete.');
            }
            return { ...walletRecord, ...secrets };
        } catch (error) {
            if (error.name === 'OperationError' || error.name === 'DataError') {
                throw new Error('Incorrect password or damaged encrypted wallet data.');
            }
            throw error;
        } finally {
            if (plaintext) {
                plaintext.fill(0);
            }
            ciphertext.fill(0);
        }
    }
    function clearDecryptedWalletData(walletData) {
        if (!walletData || typeof walletData !== 'object') {
            return;
        }
        ['privateKeyHex', 'wif', 'seedPhrase', 'bip39Passphrase'].forEach((field) => {
            walletData[field] = '';
        });
    }
    function requestDecryptedWalletData() {
        if (walletUnlockResolver) {
            return Promise.reject(new Error('A wallet password request is already in progress.'));
        }
        walletUnlockMode = 'operation';
        walletUnlockPasswordInput.value = '';
        walletUnlockStatus.textContent = '';
        modalWalletUnlock.showModal();
        walletUnlockPasswordInput.focus();
        return new Promise((resolve, reject) => {
            walletUnlockResolver = resolve;
            walletUnlockRejecter = reject;
        });
    }
    btnOpen.addEventListener('click', () => {
        try {
            const address = localStorage.getItem('ytn_wallet');
            if (!address) {
                alert("NO SAVED WALLET WAS FOUND IN THIS BROWSER.");
                updateWalletButtons();
                return;
            }
            const walletDataText = localStorage.getItem('ytn_wallet_data');
            if (!walletDataText) {
                throw new Error('Saved wallet data is missing.');
            }
            const walletData = JSON.parse(walletDataText);
            if (!walletData || typeof walletData !== 'object' || walletData.address !== address) {
                throw new Error('Saved wallet data is invalid.');
            }
            if (walletData.version !== 2) {
                throw new Error('This wallet uses the old unencrypted test format. Re-import it into TESTCRYPTO.');
            }
            walletUnlockMode = 'open';
            walletUnlockPasswordInput.value = "";
            walletUnlockStatus.textContent = '';
            modalWalletUnlock.showModal();
            walletUnlockPasswordInput.focus();
        } catch (error) {
            alert("THE SAVED WALLET COULD NOT BE OPENED: " + error.message);
        }
    });
    async function unlockSavedWallet() {
        if (walletUnlockInProgress) {
            return;
        }
        walletUnlockInProgress = true;
        btnUnlockWallet.disabled = true;
        btnCancelWalletUnlock.disabled = true;
        let password = walletUnlockPasswordInput.value;
        try {
            const address = localStorage.getItem('ytn_wallet');
            const walletDataText = localStorage.getItem('ytn_wallet_data');
            const walletRecord = walletDataText ? JSON.parse(walletDataText) : null;
            if (!address || !walletRecord || walletRecord.address !== address) {
                throw new Error('Saved wallet data is missing or invalid.');
            }
            const walletData = await decryptWalletSecrets(walletRecord, password);
            walletUnlockPasswordInput.value = '';
            walletUnlockStatus.textContent = '';
            if (walletUnlockMode === 'operation') {
                const resolve = walletUnlockResolver;
                walletUnlockResolver = null;
                walletUnlockRejecter = null;
                modalWalletUnlock.close();
                if (resolve) {
                    resolve(walletData);
                } else {
                    clearDecryptedWalletData(walletData);
                }
                return;
            }
            modalWalletUnlock.close();
            clearDecryptedWalletData(walletData);
            openSavedWallet(address);
        } catch (error) {
            walletUnlockPasswordInput.value = '';
            if (walletUnlockMode === 'operation') {
                walletUnlockStatus.textContent = error.message;
                return;
            }
            modalWalletUnlock.close();
            await showWalletAlert(error.message + ' Returning to home.');
        } finally {
            password = '';
            walletUnlockPasswordInput.value = '';
            walletUnlockInProgress = false;
            btnUnlockWallet.disabled = false;
            btnCancelWalletUnlock.disabled = false;
        }
    }
    btnUnlockWallet.addEventListener('click', unlockSavedWallet);
    walletUnlockPasswordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            unlockSavedWallet();
        }
    });
    btnCancelWalletUnlock.addEventListener('click', () => {
        if (walletUnlockInProgress) {
            return;
        }
        modalWalletUnlock.close();
        walletUnlockPasswordInput.value = "";
        walletUnlockStatus.textContent = '';
        if (walletUnlockRejecter) {
            const reject = walletUnlockRejecter;
            walletUnlockResolver = null;
            walletUnlockRejecter = null;
            reject(new DOMException('Wallet password entry cancelled.', 'AbortError'));
        }
    });
    btnCloseWalletAlert.addEventListener('click', () => {
        modalWalletAlert.close();
    });
    modalWalletAlert.addEventListener('click', (event) => {
        const rect = modalWalletAlert.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) {
            modalWalletAlert.close();
        }
    });
    modalWalletUnlock.addEventListener('click', (event) => {
        const rect = modalWalletUnlock.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal && !walletUnlockInProgress) {
            modalWalletUnlock.close();
            walletUnlockPasswordInput.value = "";
            walletUnlockStatus.textContent = '';
            if (walletUnlockRejecter) {
                const reject = walletUnlockRejecter;
                walletUnlockResolver = null;
                walletUnlockRejecter = null;
                reject(new DOMException('Wallet password entry cancelled.', 'AbortError'));
            }
        }
    });
    modalWalletUnlock.addEventListener('cancel', (event) => {
        if (walletUnlockInProgress) {
            event.preventDefault();
        }
    });
    modalWalletUnlock.addEventListener('close', () => {
        walletUnlockPasswordInput.value = '';
        walletUnlockStatus.textContent = '';
        if (walletUnlockRejecter) {
            const reject = walletUnlockRejecter;
            walletUnlockResolver = null;
            walletUnlockRejecter = null;
            reject(new DOMException('Wallet password entry cancelled.', 'AbortError'));
        }
    });
    btnRemove.addEventListener('click', () => {
        if (!window.confirm("Remove the saved wallet and its recovery data from this browser? This cannot be undone unless you have another backup.")) {
            return;
        }
        try {
            localStorage.removeItem('ytn_wallet');
            localStorage.removeItem('ytn_wallet_data');
        } catch (error) {
            alert("THE SAVED WALLET COULD NOT BE REMOVED: " + error.message);
            return;
        }
        stopWalletBalanceRefresh();
        if (modalWalletHistory.open) modalWalletHistory.close();
        if (modalWalletCore.open) modalWalletCore.close();
        if (modalSettings.open) modalSettings.close();
        walletAddressDisplay.textContent = "";
        walletQrContainer.replaceChildren();
        btnCopyQr.disabled = true;
        walletBalanceDisplay.textContent = "--";
        walletBalanceCopyValue = null;
        btnCopyBalance.disabled = true;
        walletBalanceStatus.textContent = "Balance not loaded";
        updateWalletButtons();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && activeBalanceAddress && modalWalletCore.open) {
            refreshWalletBalance(activeBalanceAddress);
        }
        if (!document.hidden && modalWalletHistory.open) {
            refreshWalletHistory();
        }
    });
    function validateHistoryTransaction(transaction, pending) {
        return transaction &&
            typeof transaction === 'object' &&
            /^[0-9a-f]{64}$/i.test(transaction.txid) &&
            ['incoming', 'outgoing', 'neutral'].includes(transaction.direction) &&
            /^\d+\.\d{8}$/.test(transaction.amount) &&
            (transaction.timestamp === null ||
                (Number.isSafeInteger(transaction.timestamp) && transaction.timestamp > 0)) &&
            Number.isInteger(transaction.confirmations) &&
            transaction.pending === pending;
    }
    async function requestHistoryJson(apiUrl, address, offset, signal) {
        if (publicYentenApiEnabled) {
            return requestPublicYentenHistory(
                address,
                offset,
                apiUrl === mempoolHistoryApiUrl,
                signal
            );
        }
        const url = new URL(apiUrl, window.location.href);
        url.searchParams.set('address', address);
        if (offset !== null) {
            url.searchParams.set('offset', String(offset));
        }
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'History service returned an error.');
        }
        return result;
    }
    function formatHistoryAmount(amount, direction) {
        const [whole, fraction] = amount.split('.');
        const groupedWhole = new Intl.NumberFormat(undefined, {
            maximumFractionDigits: 0
        }).format(BigInt(whole));
        const decimalSeparator = new Intl.NumberFormat().formatToParts(1.1)
            .find((part) => part.type === 'decimal').value;
        const sign = direction === 'incoming' ? '+' : direction === 'outgoing' ? '\u2212' : '';
        return sign + groupedWhole + decimalSeparator + fraction + ' YTN';
    }
    function renderHistoryTransaction(transaction, pending) {
        const item = document.createElement('li');
        item.className = 'wallet-history-item';
        item.dataset.transactionId = transaction.txid;
        const heading = document.createElement('div');
        heading.className = 'wallet-history-item-heading';
        const direction = document.createElement('strong');
        direction.className = 'wallet-history-direction ' + transaction.direction;
        setDynamicTranslatedText(direction, transaction.direction === 'incoming'
            ? '\u2191 INCOMING'
            : transaction.direction === 'outgoing'
                ? '\u2193 OUTGOING'
                : 'NO NET CHANGE');
        const amount = document.createElement('strong');
        amount.className = 'wallet-history-amount ' + transaction.direction;
        amount.textContent = formatHistoryAmount(transaction.amount, transaction.direction);
        heading.append(direction, amount);
        const meta = document.createElement('div');
        meta.className = 'wallet-history-item-meta';
        const date = document.createElement('span');
        if (transaction.timestamp === null) {
            setDynamicTranslatedText(date, 'Time unavailable');
        } else {
            date.textContent = new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(new Date(transaction.timestamp * 1000));
        }
        const status = document.createElement('span');
        setDynamicTranslatedText(status, pending
            ? 'PENDING · ' + transaction.confirmations + ' confirmations'
            : transaction.confirmations + ' confirmations');
        meta.append(date, status);
        const txid = document.createElement('p');
        txid.className = 'wallet-history-txid';
        const txidValue = document.createElement('span');
        txidValue.textContent = 'TXID: ' + transaction.txid;
        const copyTxid = document.createElement('button');
        copyTxid.type = 'button';
        copyTxid.className = 'wallet-history-copy-txid';
        setDynamicTranslatedText(copyTxid, 'Copy transaction ID', 'title');
        copyTxid.textContent = '📋';
        copyTxid.addEventListener('click', () => {
            copyTextToClipboard(transaction.txid, copyTxid, 'TRANSACTION ID');
        });
        txid.append(txidValue, copyTxid);

        item.append(heading, meta, txid);
        return item;
    }
    async function loadConfirmedHistory(reset = false) {
        if (historyLoading || !historyAddress || !modalWalletHistory.open) {
            return;
        }
        if (reset) {
            walletHistoryList.replaceChildren();
            historyNextOffset = 0;
            historyTotal = 0;
            historyTransactions = [];
        }
        historyLoading = true;
        const offset = historyNextOffset;
        const controller = new AbortController();
        historyPageController = controller;
        btnHistoryMore.disabled = true;
        setDynamicTranslatedText(walletHistoryStatus, 'Loading transaction history...');
        try {
            const result = await requestHistoryJson(
                historyApiUrl,
                historyAddress,
                offset,
                controller.signal
            );
            if (
                result.address !== historyAddress ||
                result.offset !== offset ||
                !Number.isInteger(result.txcount) ||
                result.txcount < 0 ||
                !Array.isArray(result.transactions) ||
                !result.transactions.every((transaction) =>
                    validateHistoryTransaction(transaction, false))
            ) {
                throw new Error('History service returned invalid transaction data.');
            }
            if (historyAddress !== activeBalanceAddress || !modalWalletHistory.open) {
                return;
            }
            historyTotal = result.txcount;
            result.transactions.forEach((transaction) => {
                historyTransactions.push(transaction);
                walletHistoryList.append(renderHistoryTransaction(transaction, false));
            });
            historyNextOffset = offset + result.transactions.length;
            if (historyNextOffset === 0 && historyTotal === 0) {
                setDynamicTranslatedText(walletHistoryStatus, 'No confirmed transactions found.');
            } else {
                setDynamicTranslatedText(
                    walletHistoryStatus,
                    'Showing ' + historyNextOffset + ' of ' + historyTotal + ' confirmed transactions.'
                );
            }
            btnHistoryMore.classList.toggle(
                'hidden',
                historyNextOffset >= historyTotal || result.transactions.length === 0
            );
        } catch (error) {
            if (error.name !== 'AbortError' && historyAddress && modalWalletHistory.open) {
                setDynamicTranslatedText(
                    walletHistoryStatus,
                    'Could not load transaction history: ' + error.message
                );
            }
        } finally {
            if (historyPageController === controller) {
                historyPageController = null;
                historyLoading = false;
                btnHistoryMore.disabled = false;
            }
        }
    }
    async function loadPendingHistory(address) {
        if (mempoolController) {
            mempoolController.abort();
        }
        const controller = new AbortController();
        mempoolController = controller;
        setDynamicTranslatedText(walletPendingStatus, 'Loading unconfirmed transactions...');
        try {
            const result = await requestHistoryJson(
                mempoolHistoryApiUrl,
                address,
                null,
                controller.signal
            );
            if (
                result.address !== address ||
                !Number.isInteger(result.txcount) ||
                result.txcount < 0 ||
                !Array.isArray(result.transactions) ||
                !result.transactions.every((transaction) =>
                    validateHistoryTransaction(transaction, true))
            ) {
                throw new Error('History service returned invalid pending transaction data.');
            }
            if (
                mempoolController !== controller ||
                historyAddress !== address ||
                !modalWalletHistory.open
            ) {
                return;
            }
            walletPendingList.replaceChildren();
            result.transactions.forEach((transaction) => {
                walletPendingList.append(renderHistoryTransaction(transaction, true));
            });
            setDynamicTranslatedText(walletPendingStatus, result.transactions.length === 0
                ? 'No unconfirmed transactions.'
                : result.transactions.length + ' unconfirmed transaction(s).');
        } catch (error) {
            if (
                error.name !== 'AbortError' &&
                mempoolController === controller &&
                historyAddress === address &&
                modalWalletHistory.open
            ) {
                setDynamicTranslatedText(
                    walletPendingStatus,
                    'Could not load unconfirmed transactions: ' + error.message
                );
            }
        } finally {
            if (mempoolController === controller) {
                mempoolController = null;
            }
        }
    }
    async function refreshConfirmedHistory() {
        if (historyLoading || !historyAddress || !modalWalletHistory.open) {
            return;
        }
        historyLoading = true;
        const controller = new AbortController();
        historyPageController = controller;
        btnHistoryMore.disabled = true;
        try {
            const result = await requestHistoryJson(
                historyApiUrl,
                historyAddress,
                0,
                controller.signal
            );
            if (
                result.address !== historyAddress ||
                result.offset !== 0 ||
                !Number.isInteger(result.txcount) ||
                result.txcount < 0 ||
                !Array.isArray(result.transactions) ||
                !result.transactions.every((transaction) =>
                    validateHistoryTransaction(transaction, false))
            ) {
                throw new Error('History service returned invalid transaction data.');
            }
            if (
                historyPageController !== controller ||
                historyAddress !== activeBalanceAddress ||
                !modalWalletHistory.open
            ) {
                return;
            }

            const latestIds = new Set(result.transactions.map((transaction) => transaction.txid));
            const olderTransactions = historyTransactions.filter(
                (transaction) => !latestIds.has(transaction.txid)
            );
            const loadedCount = Math.min(
                Math.max(historyTransactions.length, result.transactions.length),
                result.txcount
            );
            historyTransactions = result.transactions
                .concat(olderTransactions.slice(0, Math.max(0, loadedCount - result.transactions.length)));
            historyTotal = result.txcount;
            historyNextOffset = historyTransactions.length;
            walletHistoryList.replaceChildren();
            historyTransactions.forEach((transaction) => {
                walletHistoryList.append(renderHistoryTransaction(transaction, false));
            });
            setDynamicTranslatedText(walletHistoryStatus, historyTotal === 0
                ? 'No confirmed transactions found.'
                : 'Showing ' + historyNextOffset + ' of ' + historyTotal + ' confirmed transactions.');
            btnHistoryMore.classList.toggle(
                'hidden',
                historyNextOffset >= historyTotal || result.transactions.length === 0
            );
        } catch (error) {
            if (
                error.name !== 'AbortError' &&
                historyPageController === controller &&
                historyAddress &&
                modalWalletHistory.open
            ) {
                setDynamicTranslatedText(
                    walletHistoryStatus,
                    'Could not refresh transaction history: ' + error.message
                );
            }
        } finally {
            if (historyPageController === controller) {
                historyPageController = null;
                historyLoading = false;
                btnHistoryMore.disabled = false;
            }
        }
    }
    async function refreshWalletHistory() {
        if (
            historyRefreshInProgress ||
            document.hidden ||
            !historyAddress ||
            !modalWalletHistory.open
        ) {
            return;
        }
        historyRefreshInProgress = true;
        const refreshGeneration = ++historyRefreshGeneration;
        try {
            await Promise.all([
                refreshConfirmedHistory(),
                loadPendingHistory(historyAddress)
            ]);
        } finally {
            if (refreshGeneration === historyRefreshGeneration) {
                historyRefreshInProgress = false;
            }
        }
    }
    function openWalletHistory() {
        if (!activeBalanceAddress) {
            setDynamicTranslatedText(walletHistoryStatus, 'Open a wallet before loading its history.');
            return;
        }
        historyAddress = activeBalanceAddress;
        historyNextOffset = 0;
        historyTotal = 0;
        historyTransactions = [];
        walletHistoryList.replaceChildren();
        walletPendingList.replaceChildren();
        setDynamicTranslatedText(walletHistoryStatus, 'Loading transaction history...');
        setDynamicTranslatedText(walletPendingStatus, 'Loading unconfirmed transactions...');
        btnHistoryMore.classList.add('hidden');
        btnHistoryMore.disabled = true;
        modalWalletHistory.showModal();
        loadConfirmedHistory(true);
        loadPendingHistory(historyAddress);
        if (historyRefreshTimer !== null) {
            window.clearInterval(historyRefreshTimer);
        }
        historyRefreshTimer = window.setInterval(refreshWalletHistory, 30000);
    }
    function formatSatoshis(satoshis) {
        const amount = BigInt(satoshis);
        const wholeYtn = amount / 100000000n;
        const fractionalSatoshis = String(amount % 100000000n).padStart(8, '0');
        return wholeYtn + '.' + fractionalSatoshis;
    }
    async function setWalletSendBalanceStatus(message, requestId) {
        const statusUpdateId = ++walletSendStatusUpdateId;
        const translatedMessage = await translateAlertMessage(message);
        if (
            requestId === unspentRequestId &&
            statusUpdateId === walletSendStatusUpdateId &&
            modalWalletSend.open
        ) {
            walletSendBalanceStatus.textContent = translatedMessage;
        }
    }
    async function setWalletSendQrStatus(message) {
        const statusUpdateId = ++walletSendQrStatusUpdateId;
        const translatedMessage = await translateAlertMessage(message);
        if (statusUpdateId === walletSendQrStatusUpdateId) {
            walletSendQrStatus.textContent = translatedMessage;
        }
    }
    function stopWalletSendQrCamera() {
        walletSendQrCameraRequestId += 1;
        if (walletSendQrAnimationFrame !== null) {
            window.cancelAnimationFrame(walletSendQrAnimationFrame);
            walletSendQrAnimationFrame = null;
        }
        walletSendQrScanInProgress = false;
        if (walletSendQrStream) {
            walletSendQrStream.getTracks().forEach((track) => track.stop());
            walletSendQrStream = null;
        }
        walletSendQrVideo.srcObject = null;
        walletSendQrVideo.classList.add('hidden');
    }
    function validateYentenQrAddress(value) {
        if (typeof value !== 'string') {
            throw new Error('The QR code does not contain a Yenten address.');
        }
        const address = value.trim();
        if (!address || /[\s:]/.test(address)) {
            throw new Error('The QR code must contain a Yenten address only.');
        }
        let decodedAddress;
        try {
            decodedAddress = window.bitcoin.address.fromBase58Check(address);
        } catch (error) {
            throw new Error('The QR code does not contain a valid Base58Check address.');
        }
        if (decodedAddress.version !== yentenNetwork.pubKeyHash) {
            throw new Error('The QR code address is not a Yenten receiving address.');
        }
        return address;
    }
    async function handleWalletSendQrData(value) {
        stopWalletSendQrCamera();
        try {
            pendingQrRecipientAddress = validateYentenQrAddress(value);
            walletSendQrCandidate.textContent = pendingQrRecipientAddress;
            modalWalletQrConfirm.showModal();
            await setWalletSendQrStatus('QR address decoded. Verify it in the confirmation window.');
        } catch (error) {
            pendingQrRecipientAddress = null;
            await setWalletSendQrStatus(error.message);
        }
    }
    async function decodeWalletSendQrImage(blob) {
        if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) {
            throw new Error('Select or paste a valid QR image.');
        }
        if (typeof window.jsQR !== 'function') {
            throw new Error('The local QR decoder is unavailable.');
        }
        const imageUrl = URL.createObjectURL(blob);
        try {
            const image = new Image();
            image.src = imageUrl;
            await image.decode();
            if (!image.naturalWidth || !image.naturalHeight) {
                throw new Error('The selected image is empty.');
            }
            const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) {
                throw new Error('Could not read the selected QR image.');
            }
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = window.jsQR(imageData.data, imageData.width, imageData.height);
            if (!decoded) {
                throw new Error('No QR code was found in the selected image.');
            }
            await handleWalletSendQrData(decoded.data);
        } finally {
            URL.revokeObjectURL(imageUrl);
        }
    }
    async function startWalletSendQrCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            await setWalletSendQrStatus('Camera access is unavailable. Use HTTPS or localhost, or load a QR image instead.');
            return;
        }
        if (typeof window.jsQR !== 'function') {
            await setWalletSendQrStatus('The local QR decoder is unavailable.');
            return;
        }
        stopWalletSendQrCamera();
        const requestId = ++walletSendQrCameraRequestId;
        await setWalletSendQrStatus('Requesting camera access...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false
            });
            if (!modalWalletSend.open || requestId !== walletSendQrCameraRequestId) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            walletSendQrStream = stream;
            walletSendQrVideo.srcObject = stream;
            walletSendQrVideo.classList.remove('hidden');
            await walletSendQrVideo.play();
            walletSendQrScanInProgress = true;
            await setWalletSendQrStatus('Camera active. Center the Yenten QR code in view.');
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) {
                throw new Error('Could not initialize the camera QR scanner.');
            }
            const scanFrame = () => {
                if (!walletSendQrScanInProgress || !walletSendQrStream) {
                    return;
                }
                if (walletSendQrVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    const width = walletSendQrVideo.videoWidth;
                    const height = walletSendQrVideo.videoHeight;
                    if (width && height) {
                        try {
                            const scale = Math.min(1, 1000 / width);
                            const scanWidth = Math.max(1, Math.round(width * scale));
                            const scanHeight = Math.max(1, Math.round(height * scale));
                            canvas.width = scanWidth;
                            canvas.height = scanHeight;
                            context.drawImage(walletSendQrVideo, 0, 0, scanWidth, scanHeight);
                            const imageData = context.getImageData(0, 0, scanWidth, scanHeight);
                            const decoded = window.jsQR(imageData.data, scanWidth, scanHeight);
                            if (decoded) {
                                stopWalletSendQrCamera();
                                handleWalletSendQrData(decoded.data);
                                return;
                            }
                        } catch (error) {
                            stopWalletSendQrCamera();
                            setWalletSendQrStatus('Could not read the camera image: ' + error.message);
                            return;
                        }
                    }
                }
                walletSendQrAnimationFrame = window.requestAnimationFrame(scanFrame);
            };
            walletSendQrAnimationFrame = window.requestAnimationFrame(scanFrame);
        } catch (error) {
            if (requestId !== walletSendQrCameraRequestId) {
                return;
            }
            stopWalletSendQrCamera();
            await setWalletSendQrStatus('Could not start the camera: ' + error.message);
        }
    }
    async function pasteWalletSendQrImage() {
        if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
            await setWalletSendQrStatus('Image clipboard access is unavailable in this browser. Use Ctrl+V or load an image file.');
            return;
        }
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                const imageType = item.types.find((type) => type.startsWith('image/'));
                if (imageType) {
                    await decodeWalletSendQrImage(await item.getType(imageType));
                    return;
                }
            }
            throw new Error('The clipboard does not contain an image.');
        } catch (error) {
            await setWalletSendQrStatus('Could not read a QR image from the clipboard: ' + error.message);
        }
    }
    function resetWalletSendQrState() {
        stopWalletSendQrCamera();
        if (modalWalletQrConfirm.open) {
            modalWalletQrConfirm.close();
        }
        pendingQrRecipientAddress = null;
        walletSendQrCandidate.textContent = '';
        walletSendQrStatusUpdateId += 1;
        walletSendQrStatus.textContent = '';
        walletSendQrFile.value = '';
        walletSendRecipient.value = '';
        walletSendRecipient.readOnly = false;
        walletSendQrLockNote.classList.add('hidden');
        btnUnlockWalletSendRecipient.classList.add('hidden');
    }
    async function requestWalletUnspentOutputs(address, signal) {
        let result;
        if (publicYentenApiEnabled) {
            const outputs = await fetchPublicYentenApiResult(
                'unspent/' + encodeURIComponent(address),
                signal
            );
            if (!Array.isArray(outputs)) {
                throw new Error('Yenten API returned invalid unspent output data.');
            }
            const normalizedOutputs = outputs.map((output) => {
                if (!output || typeof output !== 'object') {
                    throw new Error('Yenten API returned an invalid unspent output.');
                }
                return {
                    txid: output.txid,
                    index: output.index,
                    script: output.script,
                    value_satoshis: String(output.value),
                    height: output.height
                };
            });
            const totalSatoshis = normalizedOutputs.reduce((total, output) => {
                if (typeof output.value_satoshis !== 'string' ||
                    !/^[1-9]\d*$/.test(output.value_satoshis)) {
                    throw new Error('Yenten API returned an invalid unspent output value.');
                }
                return total + BigInt(output.value_satoshis);
            }, 0n);
            result = {
                address,
                outputs: normalizedOutputs,
                count: normalizedOutputs.length,
                total_satoshis: totalSatoshis.toString()
            };
        } else {
            const url = new URL(unspentApiUrl, window.location.href);
            url.searchParams.set('address', address);
            const response = await fetch(url, {
                headers: { Accept: 'application/json' },
                cache: 'no-store',
                signal
            });
            result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Unspent output service returned an error.');
            }
        }
        if (
            !result ||
            result.address !== address ||
            !Array.isArray(result.outputs) ||
            !Number.isSafeInteger(result.count) ||
            result.count !== result.outputs.length ||
            typeof result.total_satoshis !== 'string' ||
            !/^\d+$/.test(result.total_satoshis)
        ) {
            throw new Error('Unspent output service returned invalid data.');
        }
        let totalSatoshis = 0n;
        const seenOutpoints = new Set();
        result.outputs.forEach((output) => {
            if (
                !output ||
                !/^[0-9a-f]{64}$/i.test(output.txid) ||
                !Number.isSafeInteger(output.index) ||
                output.index < 0 ||
                output.index > 0xffffffff ||
                typeof output.script !== 'string' ||
                !/^(?:[0-9a-f]{2})+$/i.test(output.script) ||
                typeof output.value_satoshis !== 'string' ||
                !/^[1-9]\d*$/.test(output.value_satoshis) ||
                !Number.isSafeInteger(output.height) ||
                output.height < 0
            ) {
                throw new Error('Unspent output service returned an invalid output.');
            }
            const outpoint = output.txid.toLowerCase() + ':' + output.index;
            if (seenOutpoints.has(outpoint)) {
                throw new Error('Unspent output service returned a duplicate outpoint.');
            }
            seenOutpoints.add(outpoint);
            totalSatoshis += BigInt(output.value_satoshis);
        });
        if (totalSatoshis !== BigInt(result.total_satoshis)) {
            throw new Error('Unspent output total does not match the returned outputs.');
        }
        return { outputs: result.outputs, totalSatoshis };
    }
    function parseYtnAmount(value, label) {
        const amountText = String(value).trim();
        if (!/^\d+(?:\.\d{1,8})?$/.test(amountText)) {
            throw new Error(label + ' must be a positive amount with up to 8 decimal places.');
        }
        const [whole, fraction = ''] = amountText.split('.');
        const satoshis = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
        if (satoshis <= 0n) {
            throw new Error(label + ' must be greater than zero.');
        }
        return satoshis;
    }
    function addWalletSendResultStep(title, detail, success) {
        const item = document.createElement('li');
        item.className = success ? 'is-success' : 'is-error';
        const heading = document.createElement('strong');
        heading.textContent = title;
        const description = document.createElement('span');
        description.textContent = detail;
        item.append(heading, description);
        walletSendResultSteps.appendChild(item);
    }
    function addWalletSendResultValue(label, value) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        row.append(term, description);
        walletSendResultSummary.appendChild(row);
    }
    function showWalletSendResult(success, message) {
        walletSendResultStatus.textContent = message;
        walletSendResultStatus.classList.toggle('is-error', !success);
        walletSendResultStatus.classList.toggle('is-success', success);
        modalWalletSendResult.showModal();
    }
    async function prepareWalletSend() {
        if ((!localSendSimulationEnabled && !liveSendEnabled) || walletSendInProgress) {
            return;
        }
        walletSendInProgress = true;
        btnConfirmWalletSend.disabled = true;
        walletSendResultSteps.replaceChildren();
        walletSendResultSummary.replaceChildren();
        const steps = [];
        const controller = new AbortController();
        walletSendSimulationController = controller;
        let signingKeyPair = null;
        let decryptedWalletData = null;
        try {
            const activeAddress = localStorage.getItem('ytn_wallet');
            if (!activeBalanceAddress || activeAddress !== activeBalanceAddress) {
                throw new Error('The currently open wallet is not available.');
            }
            const recipientAddress = walletSendRecipient.value.trim();
            const parsedRecipient = window.bitcoin.address.fromBase58Check(recipientAddress);
            if (parsedRecipient.version !== yentenNetwork.pubKeyHash) {
                throw new Error('Recipient is not a valid Yenten P2PKH address.');
            }
            const recipientPayment = window.bitcoin.payments.p2pkh({
                address: recipientAddress,
                network: yentenNetwork
            });
            if (!recipientPayment.output) {
                throw new Error('Could not construct the recipient output script.');
            }
            steps.push(['Recipient address', 'Valid Yenten address and output script.', true]);

            const amountSatoshis = parseYtnAmount(walletSendAmount.value, 'Amount');
            const feeSatoshis = parseYtnAmount(walletSendFee.value, 'Network fee');
            if (amountSatoshis > BigInt(Number.MAX_SAFE_INTEGER) ||
                feeSatoshis > BigInt(Number.MAX_SAFE_INTEGER)) {
                throw new Error('Amount or fee is too large to represent safely.');
            }
            steps.push([
                'Amounts',
                'Recipient receives ' + formatSatoshis(amountSatoshis) +
                    ' YTN; fee is charged in addition to that amount.',
                true
            ]);
            decryptedWalletData = await requestDecryptedWalletData();
            if (
                decryptedWalletData.address !== activeAddress ||
                typeof decryptedWalletData.wif !== 'string'
            ) {
                throw new Error('Saved wallet data does not match the currently open wallet.');
            }
            signingKeyPair = window.bitcoin.ECPair.fromWIF(decryptedWalletData.wif, yentenNetwork);
            const derivedAddress = window.bitcoin.payments.p2pkh({
                pubkey: signingKeyPair.publicKey,
                network: yentenNetwork
            }).address;
            if (derivedAddress !== activeAddress) {
                throw new Error('Saved signing key does not match the currently open wallet.');
            }
            const senderPayment = window.bitcoin.payments.p2pkh({
                address: activeAddress,
                network: yentenNetwork
            });
            if (!senderPayment.output) {
                throw new Error('Could not construct the sender output script.');
            }
            steps.push(['Local signing key', 'Key matches the open wallet; private data remains in this browser.', true]);
            const unspent = await requestWalletUnspentOutputs(activeAddress, controller.signal);
            if (controller.signal.aborted || !modalWalletSend.open) {
                throw new DOMException('Simulation cancelled.', 'AbortError');
            }
            const targetSatoshis = amountSatoshis + feeSatoshis;
            const sortedOutputs = unspent.outputs.slice().sort((first, second) => {
                const difference = BigInt(second.value_satoshis) - BigInt(first.value_satoshis);
                return difference > 0n ? 1 : difference < 0n ? -1 : 0;
            });
            const selectedOutputs = [];
            let selectedTotalSatoshis = 0n;
            const senderScriptHex = senderPayment.output.toString('hex').toLowerCase();
            for (const output of sortedOutputs) {
                if (output.script.toLowerCase() !== senderScriptHex) {
                    throw new Error('An unspent output does not belong to the currently open wallet.');
                }
                selectedOutputs.push(output);
                selectedTotalSatoshis += BigInt(output.value_satoshis);
                if (selectedTotalSatoshis >= targetSatoshis) {
                    break;
                }
            }
            if (selectedTotalSatoshis < targetSatoshis) {
                throw new Error(
                    'Insufficient available balance. Amount plus fee requires ' +
                    formatSatoshis(targetSatoshis) + ' YTN.'
                );
            }
            const changeSatoshis = selectedTotalSatoshis - targetSatoshis;
            if (changeSatoshis > BigInt(Number.MAX_SAFE_INTEGER)) {
                throw new Error('Change amount is too large to represent safely.');
            }
            steps.push([
                'UTXO selection',
                selectedOutputs.length + ' input(s) selected; input total ' +
                    formatSatoshis(selectedTotalSatoshis) + ' YTN.',
                true
            ]);

            if (typeof window.bitcoin.TransactionBuilder !== 'function') {
                throw new Error('The local transaction builder is unavailable.');
            }
            const transactionBuilder = new window.bitcoin.TransactionBuilder(yentenNetwork);
            selectedOutputs.forEach((output) => transactionBuilder.addInput(output.txid, output.index));
            transactionBuilder.addOutput(
                recipientAddress,
                Number(amountSatoshis)
            );
            if (changeSatoshis > 0n) {
                transactionBuilder.addOutput(activeAddress, Number(changeSatoshis));
            }
            const expectedOutputTotal = amountSatoshis + changeSatoshis;
            selectedOutputs.forEach((output, index) => transactionBuilder.sign(index, signingKeyPair));
            const signedTransaction = transactionBuilder.build();
            const expectedOutputCount = changeSatoshis > 0n ? 2 : 1;
            if (
                signedTransaction.ins.length !== selectedOutputs.length ||
                signedTransaction.outs.length !== expectedOutputCount ||
                !signedTransaction.ins.every((input) => input.script.length > 0)
            ) {
                throw new Error('Built transaction structure or input signatures are incomplete.');
            }
            if (
                !signedTransaction.outs[0].script.equals(recipientPayment.output) ||
                BigInt(signedTransaction.outs[0].value) !== amountSatoshis
            ) {
                throw new Error('Built recipient output does not match the requested address and amount.');
            }
            if (changeSatoshis > 0n && (
                !signedTransaction.outs[1].script.equals(senderPayment.output) ||
                BigInt(signedTransaction.outs[1].value) !== changeSatoshis
            )) {
                throw new Error('Built change output does not return to the open wallet.');
            }
            const actualOutputTotal = signedTransaction.outs.reduce(
                (total, output) => total + BigInt(output.value),
                0n
            );
            const actualFeeSatoshis = selectedTotalSatoshis - actualOutputTotal;
            if (actualFeeSatoshis !== feeSatoshis ||
                actualOutputTotal + actualFeeSatoshis !== selectedTotalSatoshis ||
                actualOutputTotal !== expectedOutputTotal) {
                throw new Error('Input, output, change, and fee totals do not reconcile.');
            }
            const transactionId = signedTransaction.getId();
            const serializedTransaction = signedTransaction.toBuffer();
            const transactionSize = serializedTransaction.length;
            const rawTransaction = liveSendEnabled ? serializedTransaction.toString('hex') : null;
            serializedTransaction.fill(0);
            steps.push([
                'Construction and signatures',
                'All selected inputs signed locally; recipient and change outputs verified.',
                true
            ]);
            steps.push([
                'Accounting',
                'Inputs equal recipient amount plus change plus the exact fee.',
                true
            ]);
            if (liveSendEnabled) {
                pendingWalletSend = {
                    rawTransaction,
                    transactionId,
                    senderAddress: activeAddress,
                    recipientAddress,
                    amountSatoshis,
                    feeSatoshis,
                    transactionSize
                };
                walletSendConfirmSender.textContent = activeAddress;
                walletSendConfirmRecipient.textContent = recipientAddress;
                walletSendConfirmAmount.textContent = formatSatoshis(amountSatoshis) + ' YTN';
                walletSendConfirmFee.textContent = formatSatoshis(feeSatoshis) + ' YTN';
                walletSendConfirmTotal.textContent = formatSatoshis(amountSatoshis + feeSatoshis) + ' YTN';
                walletSendConfirmStatus.textContent = '';
                btnBroadcastWalletSend.disabled = false;
                modalWalletSendConfirm.showModal();
                return;
            }
            steps.push([
                'Broadcast',
                'Not performed. No transaction was sent to any node or service.',
                true
            ]);
            addWalletSendResultValue('Recipient', recipientAddress);
            addWalletSendResultValue('Amount received', formatSatoshis(amountSatoshis) + ' YTN');
            addWalletSendResultValue('Fee', formatSatoshis(feeSatoshis) + ' YTN');
            addWalletSendResultValue('Sender total debit', formatSatoshis(amountSatoshis + feeSatoshis) + ' YTN');
            addWalletSendResultValue('Selected inputs', String(selectedOutputs.length));
            addWalletSendResultValue('Selected input total', formatSatoshis(selectedTotalSatoshis) + ' YTN');
            addWalletSendResultValue('Change back to wallet', formatSatoshis(changeSatoshis) + ' YTN');
            addWalletSendResultValue('Local transaction ID', transactionId);
            addWalletSendResultValue('Signed transaction size', transactionSize + ' bytes');
            addWalletSendResultValue('Network policy / relay check', 'Not performed');
            steps.forEach((step) => addWalletSendResultStep(step[0], step[1], step[2]));
            showWalletSendResult(
                true,
                'Local construction and signing completed. This is not a payment and will not be broadcast.'
            );
        } catch (error) {
            if (error.name === 'AbortError' && !modalWalletSend.open) {
                return;
            }
            steps.push(['Simulation stopped', error.message, false]);
            steps.forEach((step) => addWalletSendResultStep(step[0], step[1], step[2]));
            showWalletSendResult(false, 'No transaction was broadcast. ' + error.message);
        } finally {
            if (signingKeyPair && signingKeyPair.privateKey) {
                signingKeyPair.privateKey.fill(0);
            }
            clearDecryptedWalletData(decryptedWalletData);
            if (walletSendSimulationController === controller) {
                walletSendSimulationController = null;
            }
            walletSendInProgress = false;
            btnConfirmWalletSend.disabled = !localSendSimulationEnabled && !liveSendEnabled;
        }
    }
    async function broadcastPreparedWalletSend() {
        if (
            !liveSendEnabled ||
            walletSendBroadcastInProgress ||
            !pendingWalletSend
        ) {
            return;
        }
        walletSendBroadcastInProgress = true;
        btnBroadcastWalletSend.disabled = true;
        btnCancelWalletSendConfirm.disabled = true;
        walletSendConfirmStatus.textContent = 'Submitting the signed transaction for broadcast...';
        const preparedSend = pendingWalletSend;
        const resultSteps = [];
        walletSendResultSteps.replaceChildren();
        walletSendResultSummary.replaceChildren();
        try {
            const response = publicYentenApiEnabled
                ? await fetch(broadcastApiUrl, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    cache: 'no-store',
                    body: new URLSearchParams({ raw: preparedSend.rawTransaction })
                })
                : await fetch(broadcastApiUrl, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-YTN-CSRF-Token': liveBroadcastCsrfToken
                    },
                    cache: 'no-store',
                    body: JSON.stringify({ raw_transaction: preparedSend.rawTransaction })
                });
            let apiResult;
            try {
                apiResult = await response.json();
            } catch {
                const invalidResponseError = new Error('Broadcast service returned an unreadable response.');
                invalidResponseError.outcomeUncertain = true;
                throw invalidResponseError;
            }
            let result = apiResult;
            if (publicYentenApiEnabled && apiResult && typeof apiResult === 'object') {
                if (apiResult.error !== null) {
                    const rpcError = apiResult.error;
                    const errorCode = rpcError && typeof rpcError === 'object'
                        ? rpcError.code
                        : null;
                    const errorMessage = rpcError && typeof rpcError === 'object' &&
                        typeof rpcError.message === 'string'
                        ? rpcError.message
                        : typeof rpcError === 'string'
                            ? rpcError
                            : 'Yenten node rejected the transaction.';
                    result = {
                        error: errorMessage,
                        outcome_uncertain: ![-22, -25, -26].includes(errorCode)
                    };
                } else {
                    result = { transaction_id: apiResult.result };
                }
            }
            if (!response.ok) {
                const errorMessage = result && typeof result.error === 'string'
                    ? result.error
                    : 'Yenten node rejected the transaction.';
                const broadcastError = new Error(errorMessage);
                broadcastError.outcomeUncertain = Boolean(result && result.outcome_uncertain === true);
                throw broadcastError;
            }
            if (result && typeof result.error === 'string') {
                const broadcastError = new Error(result.error);
                broadcastError.outcomeUncertain = result.outcome_uncertain === true;
                throw broadcastError;
            }
            if (!result || result.transaction_id !== preparedSend.transactionId) {
                const mismatchedIdError = new Error('The returned transaction ID does not match the locally signed transaction.');
                mismatchedIdError.outcomeUncertain = true;
                throw mismatchedIdError;
            }
            addWalletSendResultValue('Transaction ID', result.transaction_id);
            addWalletSendResultValue('Recipient', preparedSend.recipientAddress);
            addWalletSendResultValue('Amount received', formatSatoshis(preparedSend.amountSatoshis) + ' YTN');
            addWalletSendResultValue('Network fee', formatSatoshis(preparedSend.feeSatoshis) + ' YTN');
            addWalletSendResultValue(
                'Total wallet debit',
                formatSatoshis(preparedSend.amountSatoshis + preparedSend.feeSatoshis) + ' YTN'
            );
            addWalletSendResultValue('Signed transaction size', preparedSend.transactionSize + ' bytes');
            resultSteps.push([
                'Broadcast response',
                'The Yenten broadcast service returned the matching transaction ID. Confirmation is not guaranteed.',
                true
            ]);
            resultSteps.forEach((step) => addWalletSendResultStep(step[0], step[1], step[2]));
            showWalletSendResult(
                true,
                'The Yenten node accepted the transaction for broadcast. Check its confirmation status using the transaction ID.'
            );
            if (activeBalanceAddress === preparedSend.senderAddress) {
                refreshWalletBalance(preparedSend.senderAddress);
            }
        } catch (error) {
            const outcomeUncertain = error.outcomeUncertain === true ||
                error instanceof TypeError;
            resultSteps.push([
                outcomeUncertain ? 'Broadcast result uncertain' : 'Broadcast rejected',
                outcomeUncertain
                    ? error.message + ' Check the transaction ID before attempting another send.'
                    : error.message,
                false
            ]);
            addWalletSendResultValue('Locally signed transaction ID', preparedSend.transactionId);
            addWalletSendResultValue('Recipient', preparedSend.recipientAddress);
            addWalletSendResultValue('Amount', formatSatoshis(preparedSend.amountSatoshis) + ' YTN');
            resultSteps.forEach((step) => addWalletSendResultStep(step[0], step[1], step[2]));
            showWalletSendResult(
                false,
                outcomeUncertain
                    ? 'The transaction may have reached a node. Do not retry until you check its transaction ID.'
                    : 'The Yenten node rejected the transaction. No successful broadcast was reported.'
            );
        } finally {
            pendingWalletSend = null;
            walletSendBroadcastInProgress = false;
            btnCancelWalletSendConfirm.disabled = false;
            if (modalWalletSendConfirm.open) {
                modalWalletSendConfirm.close();
            }
            if (modalWalletSend.open) {
                modalWalletSend.close();
            }
        }
    }
    async function loadWalletUnspentOutputs() {
        if (!activeBalanceAddress) {
            walletSendBalanceStatus.textContent = await translateAlertMessage('Open a wallet before checking the available balance.');
            return;
        }
        if (unspentRequestController) {
            unspentRequestController.abort();
        }
        const controller = new AbortController();
        unspentRequestController = controller;
        const requestId = ++unspentRequestId;
        const address = activeBalanceAddress;
        walletSendAvailableBalance.textContent = '--';
        setWalletSendBalanceStatus('Checking available balance...', requestId);
        try {
            const result = await requestWalletUnspentOutputs(address, controller.signal);

            walletSendAvailableBalance.textContent = formatSatoshis(result.totalSatoshis);
            await setWalletSendBalanceStatus(
                result.outputs.length === 0
                    ? 'No funds are currently available to send.'
                    : '',
                requestId
            );
        } catch (error) {
            if (error.name !== 'AbortError' && requestId === unspentRequestId) {
                await setWalletSendBalanceStatus('Could not update the available balance: ' + error.message, requestId);
            }
        } finally {
            if (unspentRequestController === controller) {
                unspentRequestController = null;
            }
        }
    }
    function openWalletSend() {
        pendingWalletSend = null;
        resetWalletSendQrState();
        walletSendAmount.value = '';
        walletSendAmount.readOnly = false;
        walletSendFee.value = '0.0001';
        walletSendFee.readOnly = false;
        walletSendBalanceStatus.textContent = '';
        walletSendAvailableBalance.textContent = '--';
        modalWalletSend.showModal();
        loadWalletUnspentOutputs();
    }
    function stopWalletUnspentRequest() {
        unspentRequestId += 1;
        walletSendStatusUpdateId += 1;
        if (unspentRequestController) {
            unspentRequestController.abort();
            unspentRequestController = null;
        }
    }
    btnWalletSend.addEventListener('click', openWalletSend);
    btnCloseWalletSend.addEventListener('click', () => modalWalletSend.close());
    btnCloseWalletSendFooter.addEventListener('click', () => modalWalletSend.close());
    btnConfirmWalletSend.addEventListener('click', prepareWalletSend);
    btnBroadcastWalletSend.addEventListener('click', broadcastPreparedWalletSend);
    btnCancelWalletSendConfirm.addEventListener('click', () => modalWalletSendConfirm.close());
    modalWalletSendConfirm.addEventListener('cancel', (event) => {
        if (walletSendBroadcastInProgress) {
            event.preventDefault();
        }
    });
    modalWalletSendConfirm.addEventListener('close', () => {
        if (!walletSendBroadcastInProgress) {
            pendingWalletSend = null;
            walletSendConfirmStatus.textContent = '';
            btnBroadcastWalletSend.disabled = true;
        }
    });
    [btnCloseWalletSendResult, btnCloseWalletSendResultFooter].forEach((button) => {
        button.addEventListener('click', () => modalWalletSendResult.close());
    });
    modalWalletSendResult.addEventListener('click', (event) => {
        const rect = modalWalletSendResult.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) {
            modalWalletSendResult.close();
        }
    });
    btnScanWalletSendQr.addEventListener('click', startWalletSendQrCamera);
    btnPasteWalletSendQr.addEventListener('click', pasteWalletSendQrImage);
    btnUnlockWalletSendRecipient.addEventListener('click', () => {
        walletSendRecipient.readOnly = false;
        walletSendQrLockNote.classList.add('hidden');
        btnUnlockWalletSendRecipient.classList.add('hidden');
        walletSendRecipient.focus();
    });
    walletSendQrFile.addEventListener('change', async () => {
        const imageFile = walletSendQrFile.files && walletSendQrFile.files[0];
        if (imageFile) {
            try {
                await decodeWalletSendQrImage(imageFile);
            } catch (error) {
                await setWalletSendQrStatus(error.message);
            }
        }
        walletSendQrFile.value = '';
    });
    btnConfirmWalletSendRecipient.addEventListener('click', () => {
        if (!pendingQrRecipientAddress) {
            return;
        }
        walletSendRecipient.value = pendingQrRecipientAddress;
        walletSendRecipient.readOnly = true;
        walletSendQrLockNote.classList.remove('hidden');
        btnUnlockWalletSendRecipient.classList.remove('hidden');
        pendingQrRecipientAddress = null;
        modalWalletQrConfirm.close();
        walletSendRecipient.focus();
    });
    btnCancelWalletSendRecipient.addEventListener('click', () => {
        pendingQrRecipientAddress = null;
        walletSendQrCandidate.textContent = '';
        modalWalletQrConfirm.close();
    });
    modalWalletQrConfirm.addEventListener('close', () => {
        pendingQrRecipientAddress = null;
        walletSendQrCandidate.textContent = '';
    });
    document.addEventListener('paste', (event) => {
        if (!modalWalletSend.open || !event.clipboardData) {
            return;
        }
        const imageItem = Array.from(event.clipboardData.items).find((item) =>
            item.kind === 'file' && item.type.startsWith('image/')
        );
        if (imageItem) {
            event.preventDefault();
            const imageFile = imageItem.getAsFile();
            if (imageFile) {
                decodeWalletSendQrImage(imageFile).catch((error) =>
                    setWalletSendQrStatus(error.message)
                );
            }
        }
    });
    modalWalletSend.addEventListener('close', () => {
        if (!modalWalletSend.open) {
            stopWalletUnspentRequest();
            if (walletSendSimulationController) {
                walletSendSimulationController.abort();
                walletSendSimulationController = null;
            }
            resetWalletSendQrState();
        }
    });
    modalWalletSend.addEventListener('click', (event) => {
        const rect = modalWalletSend.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) {
            modalWalletSend.close();
        }
    });
    function stopWalletHistoryRequests() {
        if (historyRefreshTimer !== null) {
            window.clearInterval(historyRefreshTimer);
            historyRefreshTimer = null;
        }
        historyRefreshGeneration += 1;
        historyRefreshInProgress = false;
        if (historyPageController) {
            historyPageController.abort();
            historyPageController = null;
        }
        if (mempoolController) {
            mempoolController.abort();
            mempoolController = null;
        }
        historyAddress = null;
        historyLoading = false;
        historyTransactions = [];
        btnHistoryMore.disabled = true;
    }
    btnWalletHistory.addEventListener('click', openWalletHistory);
    btnCloseHistory.addEventListener('click', () => modalWalletHistory.close());
    btnHistoryMore.addEventListener('click', () => loadConfirmedHistory());
    modalWalletHistory.addEventListener('close', stopWalletHistoryRequests);
    modalWalletHistory.addEventListener('click', (event) => {
        const rect = modalWalletHistory.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) {
            modalWalletHistory.close();
        }
    });
    btnWalletHelp.addEventListener('click', () => modalWalletHelp.showModal());
    btnCloseWalletHelp.addEventListener('click', () => modalWalletHelp.close());
    modalWalletHelp.addEventListener('click', (event) => {
        const rect = modalWalletHelp.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) {
            modalWalletHelp.close();
        }
    });
    async function showWalletSettings(walletData = null) {
        let decryptedWalletData = walletData;
        try {
            if (!decryptedWalletData) {
                decryptedWalletData = await requestDecryptedWalletData();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                await showWalletAlert('Wallet data could not be decrypted: ' + error.message);
            }
            return;
        }
        if (!decryptedWalletData || typeof decryptedWalletData !== 'object') {
            await showWalletAlert('Wallet data has an invalid format.');
            return;
        }
        walletDataForBackup = { ...decryptedWalletData };
        const settingsFields = {
            'settings-wallet-address': decryptedWalletData.address,
            'settings-import-type': decryptedWalletData.importType,
            'settings-public-key': decryptedWalletData.publicKey,
            'settings-private-key': decryptedWalletData.privateKeyHex,
            'settings-wif': decryptedWalletData.wif,
            'settings-seed': decryptedWalletData.seedPhrase || "Not saved (imported from WIF)",
            'settings-bip39-passphrase': decryptedWalletData.bip39Passphrase || "Not set"
        };
        Object.entries(settingsFields).forEach(([id, value]) => {
            document.getElementById(id).textContent = value || "Not available";
        });
        const copyableValues = {
            'settings-wallet-address': decryptedWalletData.address,
            'settings-public-key': decryptedWalletData.publicKey,
            'settings-private-key': decryptedWalletData.privateKeyHex,
            'settings-wif': decryptedWalletData.wif,
            'settings-seed': decryptedWalletData.seedPhrase,
            'settings-bip39-passphrase': decryptedWalletData.bip39Passphrase
        };
        document.querySelectorAll('.settings-copy-button').forEach((button) => {
            const value = copyableValues[button.dataset.copyTarget];
            button.disabled = typeof value !== 'string' || value.length === 0;
        });
        modalSettings.showModal();
    }
    btnWalletView.addEventListener('click', () => showWalletSettings());
    btnCloseSettings.addEventListener('click', () => modalSettings.close());
    modalSettings.addEventListener('close', () => {
        clearDecryptedWalletData(walletDataForBackup);
        walletDataForBackup = null;
        [
            'settings-private-key',
            'settings-wif',
            'settings-seed',
            'settings-bip39-passphrase'
        ].forEach((id) => {
            document.getElementById(id).textContent = '';
        });
        document.querySelectorAll('.settings-copy-button').forEach((button) => {
            button.disabled = true;
        });
    });
    modalSettings.addEventListener('click', (event) => {
        const rect = modalSettings.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) {
            modalSettings.close();
        }
    });
    async function formatWalletBackup(walletData) {
        const address = walletData.address || localStorage.getItem('ytn_wallet') || '';
        const targetLang = currentLang === "EN" ? "en" : sysLang;
        const englishLabels = [
            'WALLET BACKUP - KEEP THIS FILE PRIVATE',
            'Wallet address:',
            'SEED:',
            'Public Key:',
            'Private Key (hex):',
            'WIF Private Key:',
            'BIP39 passphrase:',
            'Created:',
            'IMPORTANT',
            'Anyone with the recovery phrase, WIF, or private key can control this wallet.',
            'Keep this file private and store it in a safe place.'
        ];
        const [
            backupTitle,
            addressLabel,
            seedLabel,
            publicKeyLabel,
            privateKeyLabel,
            wifLabel,
            passphraseLabel,
            createdLabel,
            importantLabel,
            warningLine1,
            warningLine2
        ] = await Promise.all(englishLabels.map((label) =>
            targetLang === 'en' ? label : translateAlertMessage(label)
        ));
        const logo = [
            '+-----------------+',
            '|   +---------+   |',
            '|   | [ ] [ ] |   |',
            '|   +--+---+--+   |',
            '|   |   /\\   |    |',
            '|      /  \\       |',
            '+-----------------+'
        ];
        const heading = [
            'Webwallet - YTN',
            'by Wendigo'.padStart('Webwallet - YTN'.length),
            '',
            'https://yentencoin.info/',
            '',
            'www.ytnweballet.github',
            '',
            ''
        ];
        const header = logo.map((line, index) =>
            line.padEnd(20) + '    ' + (heading[index] || '')
        ).join('\n');
        const lines = [
            header,
            '',
            '='.repeat(48),
            backupTitle,
            '='.repeat(48),
            '',
            addressLabel,
            address,
            '',
            seedLabel,
            walletData.seedPhrase || '',
            '',
            publicKeyLabel,
            walletData.publicKey || '',
            '',
            privateKeyLabel,
            walletData.privateKeyHex || '',
            '',
            wifLabel,
            walletData.wif || '',
            '',
            passphraseLabel,
            walletData.bip39Passphrase || '',
            '',
            createdLabel,
            new Date().toISOString(),
            '',
            '='.repeat(48),
            importantLabel,
            warningLine1,
            warningLine2,
            '='.repeat(48),
            ''
        ];
        return lines.join('\n');
    }
    function updateBackupFormat() {
        const isPdf = backupFormatToggle.checked;
        backupFormatTxtLabel.classList.toggle('is-selected', !isPdf);
        backupFormatPdfLabel.classList.toggle('is-selected', isPdf);
        backupFormatToggle.setAttribute('aria-label', isPdf ? 'PDF backup format selected' : 'TXT backup format selected');
    }
    async function saveBackupFile(blob, fileName) {
        if (window.pywebview && window.pywebview.api &&
            typeof window.pywebview.api.save_backup_file === 'function') {
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = '';
            const chunkSize = 0x8000;
            for (let offset = 0; offset < bytes.length; offset += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
            }
            const result = await window.pywebview.api.save_backup_file(fileName, btoa(binary));
            return Boolean(result && result.saved);
        }
        const downloadUrl = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        return true;
    }
    function loadBackupImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('A PDF image could not be loaded: ' + src));
            image.src = src;
        });
    }
    async function createWalletBackupPdf(walletData) {
        const targetLang = currentLang === "EN" ? "en" : sysLang;
        const englishLabels = [
            'WALLET BACKUP - KEEP THIS FILE PRIVATE',
            'Wallet address',
            'SEED:',
            'Public Key:',
            'Private Key (hex):',
            'WIF Private Key:',
            'BIP39 passphrase:',
            'Created:',
            'IMPORTANT',
            'Anyone with the recovery phrase, WIF, or private key can control this wallet. Keep this document private and store it in a safe place.',
            'Webwallet - YTN',
            'by Wendigo'
        ];
        const labels = await Promise.all(englishLabels.map((label) =>
            targetLang === 'en' ? label : translateAlertMessage(label)
        ));
        const [
            backupTitle,
            addressLabel,
            seedLabel,
            publicKeyLabel,
            privateKeyLabel,
            wifLabel,
            passphraseLabel,
            createdLabel,
            importantLabel,
            warningText,
            brandTitle,
            brandSubtitle
        ] = labels;
        const jsPDF = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDF) {
            throw new Error('The local PDF generator is unavailable.');
        }

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 17;
        const contentWidth = pageWidth - margin * 2;
        const logoUrl = new URL('static/yenten.svg', window.location.href).href;
        const watermarkUrl = new URL('static/images/YTN_Chan_Orj.png', window.location.href).href;
        const [logoImage, watermarkImage] = await Promise.all([
            loadBackupImage(logoUrl),
            loadBackupImage(watermarkUrl)
        ]);
        const watermarkCanvas = document.createElement('canvas');
        watermarkCanvas.width = watermarkImage.naturalWidth;
        watermarkCanvas.height = watermarkImage.naturalHeight;
        const watermarkContext = watermarkCanvas.getContext('2d');
        if (!watermarkContext) {
            throw new Error('The watermark could not be prepared for the PDF.');
        }
        watermarkContext.globalAlpha = 0.09;
        watermarkContext.drawImage(watermarkImage, 0, 0);
        const logoCanvas = document.createElement('canvas');
        logoCanvas.width = 512;
        logoCanvas.height = 512;
        const logoContext = logoCanvas.getContext('2d');
        if (!logoContext) {
            throw new Error('The Yenten logo could not be prepared for the PDF.');
        }
        logoContext.drawImage(logoImage, 0, 0, logoCanvas.width, logoCanvas.height);
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
        doc.addImage(watermarkCanvas.toDataURL('image/png'), 'PNG', 33, 56, pageWidth - 66, 190);
        doc.addImage(logoCanvas.toDataURL('image/png'), 'PNG', margin, 14, 23, 23);
        doc.setTextColor(52, 71, 103);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text(brandTitle, margin + 30, 23);
        doc.setTextColor(0, 161, 205);
        doc.setFontSize(10);
        doc.text(brandSubtitle, margin + 30, 30);
        doc.setDrawColor(0, 162, 232);
        doc.setLineWidth(0.9);
        doc.line(margin, 43, pageWidth - margin, 43);
        doc.setTextColor(52, 71, 103);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(backupTitle, pageWidth / 2, 54, { align: 'center', maxWidth: contentWidth });
        function drawField(label, value, x, y, width, fontSize) {
            const safeValue = String(value == null ? '' : value);
            const valueFontSize = fontSize || 9;
            doc.setFont('courier', 'bold');
            doc.setFontSize(valueFontSize);
            const lines = safeValue
                ? doc.splitTextToSize(safeValue, width - 8)
                : [''];
            const lineHeight = valueFontSize * 0.42;
            const height = Math.max(21, 12 + lines.length * lineHeight);
            doc.setDrawColor(190, 207, 218);
            doc.setLineWidth(0.35);
            doc.roundedRect(x, y, width, height, 2, 2, 'S');
            doc.setDrawColor(0, 162, 232);
            doc.setLineWidth(1);
            doc.line(x + 0.5, y + 2, x + 0.5, y + height - 2);
            doc.setTextColor(0, 160, 194);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text(label, x + 4, y + 5.5, { maxWidth: width - 8 });
            doc.setTextColor(17, 17, 17);
            doc.setFont('courier', 'bold');
            doc.setFontSize(valueFontSize);
            doc.text(lines, x + 4, y + 11, { lineHeightFactor: 1.2 });
            return height;
        }
        let y = 62;
        y += drawField(addressLabel, walletData.address, margin, y, contentWidth) + 4;
        y += drawField(seedLabel, walletData.seedPhrase, margin, y, contentWidth, 10.5) + 5;
        const columnGap = 7;
        const columnWidth = (contentWidth - columnGap) / 2;
        const firstRowHeight = Math.max(
            drawField(publicKeyLabel, walletData.publicKey, margin, y, columnWidth),
            drawField(privateKeyLabel, walletData.privateKeyHex, margin + columnWidth + columnGap, y, columnWidth)
        );
        y += firstRowHeight + 5;
        const secondRowHeight = Math.max(
            drawField(wifLabel, walletData.wif, margin, y, columnWidth),
            drawField(passphraseLabel, walletData.bip39Passphrase, margin + columnWidth + columnGap, y, columnWidth)
        );
        y += secondRowHeight + 8;
        doc.setTextColor(82, 99, 115);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(createdLabel + ' ' + new Date().toISOString(), margin, y);
        y += 7;
        const warningLines = doc.splitTextToSize(warningText, contentWidth - 10);
        const warningHeight = Math.max(24, 11 + warningLines.length * 4.2);
        doc.setDrawColor(230, 189, 85);
        doc.setLineWidth(0.4);
        doc.roundedRect(margin, y, contentWidth, warningHeight, 2, 2, 'S');
        doc.setTextColor(101, 75, 17);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(importantLabel, pageWidth / 2, y + 6, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(warningLines, pageWidth / 2, y + 12, { align: 'center', maxWidth: contentWidth - 10 });
        return doc.output('blob');
    }
    async function exportWalletBackup() {
        if (!walletDataForBackup) {
            alert("NO WALLET DATA IS AVAILABLE TO EXPORT.");
            modalBackupWarning.close();
            return;
        }
        if (backupFormatToggle.checked) {
            btnProceedExportBackup.disabled = true;
            try {
                const backupPdfBlob = await createWalletBackupPdf(walletDataForBackup);
                if (backupPdfObjectUrl) {
                    URL.revokeObjectURL(backupPdfObjectUrl);
                }
                backupPdfObjectUrl = URL.createObjectURL(backupPdfBlob);
                backupPdfPreviewFrame.src = backupPdfObjectUrl;
                modalBackupWarning.close();
                modalBackupPdfPreview.showModal();
            } catch (error) {
                alert("THE PDF PREVIEW COULD NOT BE CREATED: " + error.message);
            } finally {
                btnProceedExportBackup.disabled = false;
            }
            return;
        }
        try {
            const backupText = await formatWalletBackup(walletDataForBackup);
            const backupBlob = new Blob([backupText], { type: 'text/plain;charset=utf-8' });
            const dateStamp = new Date().toISOString().slice(0, 10);
            const saved = await saveBackupFile(backupBlob, 'YTN-wallet-backup-' + dateStamp + '.txt');
            if (saved) {
                modalBackupWarning.close();
            }
        } catch (error) {
            alert("THE TEXT BACKUP COULD NOT BE SAVED: " + error.message);
        }
    }
    async function openBackupWarning() {
        const targetLang = currentLang === "EN" ? "en" : sysLang;
        await Promise.all(backupWarningTexts.map(async ({ element, text }) => {
            element.innerText = targetLang === 'en'
                ? text
                : await translateAlertMessage(text);
        }));
        backupFormatToggle.checked = false;
        updateBackupFormat();
        modalBackupWarning.showModal();
    }
    btnExportBackup.addEventListener('click', openBackupWarning);
    backupFormatToggle.addEventListener('change', updateBackupFormat);
    btnProceedExportBackup.addEventListener('click', exportWalletBackup);
    btnDownloadBackupPdf.addEventListener('click', async () => {
        if (!backupPdfObjectUrl) {
            alert("THE PDF PREVIEW IS NOT READY.");
            return;
        }
        btnDownloadBackupPdf.disabled = true;
        try {
            const response = await fetch(backupPdfObjectUrl);
            if (!response.ok) {
                throw new Error('The PDF preview data could not be read.');
            }
            const backupPdfBlob = await response.blob();
            const dateStamp = new Date().toISOString().slice(0, 10);
            await saveBackupFile(backupPdfBlob, 'YTN-wallet-backup-' + dateStamp + '.pdf');
        } catch (error) {
            alert("THE PDF BACKUP COULD NOT BE SAVED: " + error.message);
        } finally {
            btnDownloadBackupPdf.disabled = false;
        }
    });
    btnPrintBackupPdf.addEventListener('click', () => {
        if (!backupPdfPreviewFrame.contentWindow) {
            alert("THE PDF PREVIEW IS NOT READY.");
            return;
        }
        backupPdfPreviewFrame.contentWindow.focus();
        backupPdfPreviewFrame.contentWindow.print();
    });
    [btnCloseBackupPdfPreview, btnCloseBackupPdfPreviewFooter].forEach((button) => {
        button.addEventListener('click', () => modalBackupPdfPreview.close());
    });
    modalBackupPdfPreview.addEventListener('close', () => {
        backupPdfPreviewFrame.src = 'about:blank';
        if (backupPdfObjectUrl) {
            const objectUrlToRevoke = backupPdfObjectUrl;
            window.setTimeout(() => {
                URL.revokeObjectURL(objectUrlToRevoke);
                if (backupPdfObjectUrl === objectUrlToRevoke) {
                    backupPdfObjectUrl = null;
                }
            }, 1000);
        }
    });
    modalBackupPdfPreview.addEventListener('click', (event) => {
        const rect = modalBackupPdfPreview.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) modalBackupPdfPreview.close();
    });
    modalBackupWarning.addEventListener('click', (event) => {
        const rect = modalBackupWarning.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) {
            modalBackupWarning.close();
        }
    });
    importSeedInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            btnSubmitImport.click();
        }
    });
    [importWalletPasswordInput, importBip39PassphraseInput].forEach((input) => {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                btnSubmitImport.click();
            }
        });
    });
    createWalletPasswordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            createWalletPasswordConfirmInput.focus();
        }
    });
    createWalletPasswordConfirmInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            btnSubmitCreate.click();
        }
    });
    createBip39PassphraseInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            createBip39PassphraseConfirmInput.focus();
        }
    });
    createBip39PassphraseConfirmInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            createWalletPasswordInput.focus();
        }
    });
    btnSubmitCreate.addEventListener('click', async () => {
        if (walletCreateInProgress) {
            return;
        }
        let walletPassword = createWalletPasswordInput.value;
        let walletPasswordConfirm = createWalletPasswordConfirmInput.value;
        const passphraseEnabled = createPassphraseToggle.checked;
        let bip39PassphraseInput = createBip39PassphraseInput.value;
        let bip39PassphraseConfirm = createBip39PassphraseConfirmInput.value;
        if (!walletPassword) {
            alert("PLEASE ENTER A WALLET PASSWORD.");
            return;
        }
        if (walletPassword !== walletPasswordConfirm) {
            alert("THE WALLET PASSWORDS DO NOT MATCH.");
            return;
        }
        if (passphraseEnabled && !bip39PassphraseInput) {
            alert("PLEASE ENTER A BIP39 PASSPHRASE OR TURN PASSPHRASE MODE OFF.");
            return;
        }
        if (passphraseEnabled && bip39PassphraseInput !== bip39PassphraseConfirm) {
            alert("THE BIP39 PASSPHRASES DO NOT MATCH.");
            return;
        }
        walletCreateInProgress = true;
        btnSubmitCreate.disabled = true;
        const createButtonText = btnSubmitCreate.textContent;
        btnSubmitCreate.textContent = 'CREATING WALLET...';
        [
            createWalletPasswordInput,
            createWalletPasswordConfirmInput,
            createBip39PassphraseInput,
            createBip39PassphraseConfirmInput,
            btnCloseCreateCredentials
        ].forEach((control) => {
            control.disabled = true;
        });
        let keyPair = null;
        let walletData = null;
        try {
            if (localStorage.getItem('ytn_wallet') || localStorage.getItem('ytn_wallet_data')) {
                throw new Error("A wallet is already saved in this browser. Remove it before creating another.");
            }
            const words = await loadBip39Wordlist();
            const seedPhrase = await generateBip39Mnemonic(words);
            const bip39Passphrase = passphraseEnabled ? bip39PassphraseInput.normalize('NFKD') : "";
            keyPair = await deriveKeyPairFromMnemonic(seedPhrase, bip39Passphrase);
            const { address } = window.bitcoin.payments.p2pkh({
                pubkey: keyPair.publicKey,
                network: yentenNetwork
            });
            walletData = {
                version: 1,
                importType: 'seed',
                address,
                publicKey: keyPair.publicKey.toString('hex'),
                privateKeyHex: keyPair.privateKey.toString('hex'),
                wif: keyPair.toWIF(),
                seedPhrase,
                bip39Passphrase,
                importedAt: new Date().toISOString()
            };
            const encryptedWalletData = await encryptWalletSecrets(walletData, walletPassword);
            saveEncryptedWallet(address, encryptedWalletData);
            modalCreateCredentials.close();
            createWalletPasswordInput.value = '';
            createWalletPasswordConfirmInput.value = '';
            createBip39PassphraseInput.value = '';
            createBip39PassphraseConfirmInput.value = '';
            updateWalletButtons();
            modalWalletCore.showModal();
            renderWalletAddress(address);
            startWalletBalanceRefresh(address);
            await showWalletSettings(walletData);
        } catch (error) {
            alert("WALLET CREATION FAILED: " + error.message);
        } finally {
            clearDecryptedWalletData(walletData);
            if (keyPair && keyPair.privateKey) {
                keyPair.privateKey.fill(0);
            }
            walletPassword = '';
            walletPasswordConfirm = '';
            bip39PassphraseInput = '';
            bip39PassphraseConfirm = '';
            createWalletPasswordInput.value = '';
            createWalletPasswordConfirmInput.value = '';
            createWalletPasswordInput.disabled = false;
            createWalletPasswordConfirmInput.disabled = false;
            createBip39PassphraseInput.disabled = !passphraseEnabled;
            createBip39PassphraseConfirmInput.disabled = !passphraseEnabled;
            btnCloseCreateCredentials.disabled = false;
            btnSubmitCreate.disabled = false;
            btnSubmitCreate.textContent = createButtonText;
            walletCreateInProgress = false;
        }
    });
    btnSubmitImport.addEventListener('click', async () => {
        if (walletImportInProgress) {
            return;
        }
        const importMode = importModeToggle.checked ? 'wif' : 'seed';
        let recoveryInput = importSeedInput.value.trim();
        if (importMode === 'wif') {
            recoveryInput = recoveryInput.replace(/\s+/g, '');
        }
        let walletPassword = importWalletPasswordInput.value;
        if (!recoveryInput) {
            alert("PLEASE PASTE A 12-WORD RECOVERY PHRASE OR A YENTEN WIF PRIVATE KEY.");
            return;
        }
        if (!walletPassword) {
            alert("PLEASE SET A WALLET PASSWORD.");
            return;
        }
        walletImportInProgress = true;
        let keyPair = null;
        let walletData = null;
        btnSubmitImport.disabled = true;
        const importButtonText = btnSubmitImport.textContent;
        btnSubmitImport.textContent = 'IMPORTING WALLET...';
        [
            importModeToggle,
            importSeedInput,
            importBip39PassphraseInput,
            importWalletPasswordInput,
            btnCloseImport,
            btnCancelImport
        ].forEach((control) => {
            control.disabled = true;
        });
        try {
            let seedPhrase = "";
            let bip39Passphrase = "";
            if (importMode === 'wif') {
                if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(recoveryInput)) {
                    throw new Error('WIF must contain only Base58 characters. Check the copied key for missing or extra characters.');
                }
                keyPair = window.bitcoin.ECPair.fromWIF(recoveryInput, yentenNetwork);
            } else {
                seedPhrase = recoveryInput.toLowerCase().normalize('NFKD').replace(/\s+/g, ' ');
                bip39Passphrase = importBip39PassphraseInput.value.normalize('NFKD');
                const wordArray = seedPhrase.split(' ');
                if (wordArray.length !== 12) {
                    throw new Error('The recovery phrase must contain exactly 12 words.');
                }
                const words = await loadBip39Wordlist();
                await validateBip39Mnemonic(seedPhrase, words);
                keyPair = await deriveKeyPairFromMnemonic(seedPhrase, bip39Passphrase);
            }
            const { address } = window.bitcoin.payments.p2pkh({
                pubkey: keyPair.publicKey,
                network: yentenNetwork
            });
            walletData = {
                version: 1,
                importType: importMode,
                address,
                publicKey: keyPair.publicKey.toString('hex'),
                privateKeyHex: keyPair.privateKey.toString('hex'),
                wif: keyPair.toWIF(),
                seedPhrase,
                bip39Passphrase,
                importedAt: new Date().toISOString()
            };
            const encryptedWalletData = await encryptWalletSecrets(walletData, walletPassword);
            saveEncryptedWallet(address, encryptedWalletData);
            importSeedInput.value = "";
            importBip39PassphraseInput.value = "";
            importWalletPasswordInput.value = "";
            modalImport.close();
            updateWalletButtons();
            modalWalletCore.showModal();
            renderWalletAddress(address);
            startWalletBalanceRefresh(address);
        } catch (error) {
            alert("IMPORT FAILED: " + error.message);
        } finally {
            clearDecryptedWalletData(walletData);
            if (keyPair && keyPair.privateKey) {
                keyPair.privateKey.fill(0);
            }
            walletPassword = '';
            importWalletPasswordInput.value = '';
            importModeToggle.disabled = false;
            importSeedInput.disabled = false;
            importBip39PassphraseInput.disabled = importModeToggle.checked;
            importWalletPasswordInput.disabled = false;
            btnCloseImport.disabled = false;
            btnCancelImport.disabled = false;
            btnSubmitImport.disabled = false;
            btnSubmitImport.textContent = importButtonText;
            walletImportInProgress = false;
        }
    });
    btnWalletExit.addEventListener('click', () => {
        stopWalletBalanceRefresh();
        if (modalWalletHistory.open) modalWalletHistory.close();
        modalWalletCore.close();
    });
    async function copyTextToClipboard(text, button, description) {
        try {
            if (!navigator.clipboard || !navigator.clipboard.writeText) {
                throw new Error("Clipboard access is not available in this browser.");
            }
            await navigator.clipboard.writeText(text);
            const originalTitle = button.title;
            const originalLabel = button.getAttribute('aria-label');
            button.title = "Copied!";
            if (originalLabel) button.setAttribute('aria-label', "Copied!");
            window.setTimeout(() => {
                button.title = originalTitle;
                if (originalLabel) button.setAttribute('aria-label', originalLabel);
            }, 1200);
        } catch (error) {
            alert("COULD NOT COPY " + description + ": " + error.message);
        }
    }
    function clearWalletSignature() {
        walletSignMessage.value = "";
        walletSignatureValue.value = "";
        walletSignatureStatusMessage = "";
        refreshWalletSignatureStatus(currentLang === "EN" ? "en" : sysLang);
        walletSignatureStatus.classList.remove('is-error');
        btnCopyMessageSignature.disabled = true;
    }
    function setWalletSignatureStatus(message, isError = false) {
        walletSignatureStatusMessage = message;
        walletSignatureStatus.classList.toggle('is-error', isError);
        refreshWalletSignatureStatus(currentLang === "EN" ? "en" : sysLang);
    }
    btnWalletSign.addEventListener('click', () => {
        clearWalletSignature();
        modalWalletSignature.showModal();
        walletSignMessage.focus();
    });
    btnCloseWalletSignature.addEventListener('click', () => modalWalletSignature.close());
    modalWalletSignature.addEventListener('close', clearWalletSignature);
    modalWalletSignature.addEventListener('click', (event) => {
        const rect = modalWalletSignature.getBoundingClientRect();
        const isInModal = rect.top <= event.clientY && event.clientY <= rect.bottom &&
            rect.left <= event.clientX && event.clientX <= rect.right;
        if (!isInModal) {
            modalWalletSignature.close();
        }
    });
    walletSignMessage.addEventListener('input', () => {
        walletSignatureValue.value = "";
        walletSignatureStatusMessage = "";
        refreshWalletSignatureStatus(currentLang === "EN" ? "en" : sysLang);
        walletSignatureStatus.classList.remove('is-error');
        btnCopyMessageSignature.disabled = true;
    });
    btnCreateMessageSignature.addEventListener('click', async () => {
        walletSignatureValue.value = "";
        setWalletSignatureStatus("");
        walletSignatureStatus.classList.remove('is-error');
        btnCopyMessageSignature.disabled = true;
        let walletData = null;
        let keyPair = null;
        try {
            const activeAddress = localStorage.getItem('ytn_wallet');
            if (!activeBalanceAddress || activeAddress !== activeBalanceAddress) {
                throw new Error("The currently open wallet is not available.");
            }
            walletData = await requestDecryptedWalletData();
            if (walletData.address !== activeAddress || typeof walletData.wif !== 'string') {
                throw new Error("Saved wallet data does not match the currently open wallet.");
            }
            keyPair = window.bitcoin.ECPair.fromWIF(walletData.wif, yentenNetwork);
            const derivedAddress = window.bitcoin.payments.p2pkh({
                pubkey: keyPair.publicKey,
                network: yentenNetwork
            }).address;
            if (derivedAddress !== activeAddress) {
                throw new Error("The saved signing key does not match the currently open wallet.");
            }
            if (!window.yentenMessageSigner || typeof window.yentenMessageSigner.sign !== 'function') {
                throw new Error("The local Yenten message-signing module is not available.");
            }
            walletSignatureValue.value = window.yentenMessageSigner.sign(
                keyPair.privateKey,
                walletSignMessage.value,
                keyPair.compressed
            );
            setWalletSignatureStatus(walletSignMessage.value.length === 0
                ? "Empty-message signature created locally. Use it only to remove an existing claim name."
                : "Signature created locally. Copy it into the Explorer claim form.");
            btnCopyMessageSignature.disabled = false;
        } catch (error) {
            console.error("Could not create the Yenten message signature:", error);
            setWalletSignatureStatus(
                "Could not create the signature. Check the saved wallet data and try again.",
                true
            );
        } finally {
            if (keyPair && keyPair.privateKey) {
                keyPair.privateKey.fill(0);
            }
            clearDecryptedWalletData(walletData);
        }
    });
    btnCopyMessageSignature.addEventListener('click', () => {
        if (walletSignatureValue.value) {
            copyTextToClipboard(walletSignatureValue.value, btnCopyMessageSignature, "SIGNATURE");
        }
    });
    document.querySelectorAll('.settings-copy-button').forEach((button) => {
        button.addEventListener('click', () => {
            const value = document.getElementById(button.dataset.copyTarget).textContent;
            copyTextToClipboard(value, button, "WALLET DATA");
        });
    });
    btnCopyAddress.addEventListener('click', () => {
        copyTextToClipboard(walletAddressDisplay.textContent.trim(), btnCopyAddress, "ADDRESS");
    });
    btnCopyBalance.addEventListener('click', () => {
        if (walletBalanceCopyValue === null) {
            alert("THE BALANCE HAS NOT BEEN LOADED YET.");
            return;
        }
        copyTextToClipboard(walletBalanceCopyValue, btnCopyBalance, "BALANCE");
    });
    btnCopyQr.addEventListener('click', async () => {
        try {
            const qrCanvas = walletQrContainer.querySelector('canvas');
            if (!qrCanvas) {
                throw new Error("The QR image is not ready.");
            }
            if (!navigator.clipboard || !navigator.clipboard.write || !window.ClipboardItem) {
                throw new Error("This browser does not support copying images to the clipboard.");
            }
            const qrBlob = await new Promise((resolve) => qrCanvas.toBlob(resolve, 'image/png'));
            if (!qrBlob) {
                throw new Error("The QR image could not be prepared.");
            }
            await navigator.clipboard.write([
                new window.ClipboardItem({ 'image/png': qrBlob })
            ]);
            const originalTitle = btnCopyQr.title;
            btnCopyQr.title = "Copied!";
            window.setTimeout(() => {
                btnCopyQr.title = originalTitle;
            }, 1200);
        } catch (error) {
            alert("COULD NOT COPY QR IMAGE: " + error.message);
        }
    });

});		