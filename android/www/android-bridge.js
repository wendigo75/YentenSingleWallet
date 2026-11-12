// ==========================================================================
// Yenten Single Wallet - Android Capacitor Filesystem & Share Bridge
// Copyright (c) 2026 wendigo75
// ==========================================================================

window.pywebview = {
    api: {
        save_backup_file: async function (fileName, base64Content) {
            try {
                const { Filesystem, Directory } = Capacitor.Plugins;
                const { Share } = Capacitor.Plugins;

                // Write file to Documents directory
                const result = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Content,
                    directory: Directory.Documents,
                    recursive: true
                });

                const uri = result.uri;

                // Share file or notify user
                if (Share) {
                    await Share.share({
                        title: 'Yenten Wallet Backup',
                        text: `Here is your backup file: ${fileName}`,
                        url: uri,
                        dialogTitle: 'Save or Share Wallet Backup'
                    });
                }

                return { saved: true, path: uri };
            } catch (error) {
                console.error('Error saving backup on Android:', error);
                throw new Error('Could not save backup file on Android: ' + (error.message || error));
            }
        }
    }
};
