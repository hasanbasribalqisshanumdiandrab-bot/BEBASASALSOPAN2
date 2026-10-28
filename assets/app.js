/* ==========================================================================
   CARI SOAL GITHUB - APP.JS
   File Utama Logika Aplikasi, UI Modal, Enkripsi, & Sinkronisasi Admin
   ========================================================================== */

(function () {
    'use strict';

    // Anti-Cache Auto Sync saat mengecek persetujuan admin
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
                const scriptEl = document.createElement('script');
                scriptEl.textContent = scriptText;
                document.head.appendChild(scriptEl);
                return true;
            }
        } catch (e) {
            console.error("Gagal sinkronisasi data kunci terbaru:", e);
        }
        return false;
    };

    // Inisialisasi Aplikasi
    document.addEventListener('DOMContentLoaded', function () {
        initApp();
        initAdminEvents();
    });

    function initApp() {
        console.log("Aplikasi Cari Soal siap.");
        checkSessionExpiry();
    }

    // Manajemen Sesi Login Maksimal 2 Jam
    function checkSessionExpiry() {
        const sessionRaw = localStorage.getItem('cs_user_session');
        if (!sessionRaw) return;

        try {
            const session = JSON.parse(sessionRaw);
            const DUA_JAM = 2 * 60 * 60 * 1000;
            if (Date.now() - session.loginTime > DUA_JAM) {
                localStorage.removeItem('cs_user_session');
                alert("Sesi 2 jam Anda telah berakhir. Silakan masukkan kode Authenticator baru dari Admin.");
                window.location.reload();
            }
        } catch (e) {
            localStorage.removeItem('cs_user_session');
        }
    }

    // Handler Event Panel Admin & Approval Device
    function initAdminEvents() {
        // Intersept tombol "Sudah disetujui? Cek" agar sinkronisasi anti-cache berjalan
        const checkBtn = document.getElementById('btn-check-approval') || document.querySelector('button[onclick*="check"]');
        if (checkBtn) {
            const originalClick = checkBtn.onclick;
            checkBtn.addEventListener('click', async function (e) {
                e.preventDefault();
                checkBtn.disabled = true;
                const oldText = checkBtn.innerText;
                checkBtn.innerText = "Mengecek ke server...";

                // 1. Tarik data keys.js paling baru langsung dari GitHub
                await window.syncLatestKeysFromGithub();

                // 2. Lanjutkan verifikasi lokal
                if (typeof originalClick === 'function') {
                    originalClick.call(this, e);
                } else if (typeof window.checkApprovalStatus === 'function') {
                    window.checkApprovalStatus();
                } else {
                    window.location.reload();
                }

                checkBtn.innerText = oldText;
                checkBtn.disabled = false;
            });
        }
    }

})();
