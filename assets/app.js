/* ==========================================================================
   CARI SOAL GITHUB - ASSETS/APP.JS
   File Utama Logika Aplikasi, UI Modal, Authenticator 2 Jam & Anti-Cache Sync
   ========================================================================== */

(function () {
    'use strict';

    // 1. MANAJEMEN SESI SINKRONISASI ANTI-CACHE
    window.syncLatestKeysFromGithub = async function () {
        try {
            const timestamp = Date.now();
            const response = await fetch('./data/keys.js?t=' + timestamp, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (response.ok) {
                const scriptText = await response.text();
                const oldScript = document.getElementById('dynamic-keys-script');
                if (oldScript) oldScript.remove();

                const scriptEl = document.createElement('script');
                scriptEl.id = 'dynamic-keys-script';
                scriptEl.textContent = scriptText;
                document.head.appendChild(scriptEl);
                return true;
            }
        } catch (e) {
            console.error("Gagal melakukan pembaruan kunci:", e);
        }
        return false;
    };

    // 2. KONTROL SESI DURATION 2 JAM
    function checkSessionExpiry() {
        const sessionRaw = localStorage.getItem('cs_user_session');
        if (!sessionRaw) return;

        try {
            const session = JSON.parse(sessionRaw);
            const DUA_JAM = 2 * 60 * 60 * 1000; // 2 jam dalam milidetik
            if (Date.now() - session.loginTime > DUA_JAM) {
                localStorage.removeItem('cs_user_session');
                alert("Sesi login 2 jam Anda telah berakhir. Silakan minta kode Authenticator baru dari Admin.");
                window.location.reload();
            }
        } catch (e) {
            localStorage.removeItem('cs_user_session');
        }
    }

    // 3. INISIALISASI DAN PENANGANAN EVENT UI
    document.addEventListener('DOMContentLoaded', function () {
        checkSessionExpiry();
        setInterval(checkSessionExpiry, 60000); // Semak setiap 1 minit

        initAppEvents();
    });

    function initAppEvents() {
        // Event listener pada tombol "Sudah disetujui? Cek"
        const checkApprovalBtn = document.getElementById('btn-check-approval') || document.querySelector('.btn-check-status') || document.querySelector('button[onclick*="check"]');
        
        if (checkApprovalBtn) {
            checkApprovalBtn.addEventListener('click', async function (e) {
                e.preventDefault();
                const originalText = checkApprovalBtn.innerText;
                checkApprovalBtn.innerText = "Mengecek ke server...";
                checkApprovalBtn.disabled = true;

                // Memuat turun fail keys.js terkini secara langsung tanpa cache
                await window.syncLatestKeysFromGithub();

                if (typeof window.verifyDeviceApproval === 'function') {
                    window.verifyDeviceApproval();
                } else if (typeof window.checkApprovalStatus === 'function') {
                    window.checkApprovalStatus();
                } else {
                    window.location.reload();
                }

                checkApprovalBtn.innerText = originalText;
                checkApprovalBtn.disabled = false;
            });
        }

        // Tangkap borang login untuk menetapkan masa mula sesi 2 jam
        const loginForms = document.querySelectorAll('form');
        loginForms.forEach(form => {
            form.addEventListener('submit', function () {
                const sessionData = {
                    loginTime: Date.now()
                };
                localStorage.setItem('cs_user_session', JSON.stringify(sessionData));
            });
        });
    }

})();
