/* ==========================================================================
   APP.JS - SINKRONISASI REAL-TIME & LOGIK LOGIN 2 JAM
   ========================================================================== */

// 1. FUNGSI UNTUK MENGAMBIL DATA KUNCI TERBARU DARI SERVER (ANTI-CACHE)
async function fetchLatestKeys() {
    try {
        // Menambahkan parameter ?t=timestamp memaksa browser HP membaca file terbaru dari GitHub
        const timestamp = Date.now();
        const response = await fetch(`./data/keys.js?t=${timestamp}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (response.ok) {
            const scriptContent = await response.text();
            
            // Hapus script keys lama jika ada
            const oldScript = document.getElementById('dynamic-keys-script');
            if (oldScript) oldScript.remove();

            // Eksekusi data keys.js terbaru ke memori browser
            const scriptEl = document.createElement('script');
            scriptEl.id = 'dynamic-keys-script';
            scriptEl.textContent = scriptContent;
            document.head.appendChild(scriptEl);
            return true;
        }
    } catch (err) {
        console.error("Gagal melakukan sinkronisasi data admin:", err);
    }
    return false;
}

// 2. LOGIKA MANAJEMEN SESI 2 JAM
const DURATION_2_HOURS = 2 * 60 * 60 * 1000; // 2 jam dalam milidetik

function saveUserSession(userName, deviceId) {
    const now = Date.now();
    const sessionData = {
        userName: userName || 'Pengguna',
        deviceId: deviceId,
        loginAt: now,
        expireAt: now + DURATION_2_HOURS
    };
    localStorage.setItem('app_user_session', JSON.stringify(sessionData));
}

function checkSessionExpiration() {
    const sessionRaw = localStorage.getItem('app_user_session');
    if (!sessionRaw) return false;

    try {
        const session = JSON.parse(sessionRaw);
        const now = Date.now();

        // Jika waktu sekarang sudah melewati batas 2 jam
        if (now > session.expireAt) {
            localStorage.removeItem('app_user_session');
            alert("Sesi login 2 jam Anda telah habis. Silakan minta kode Authenticator baru ke Admin untuk masuk kembali.");
            window.location.reload();
            return false;
        }
        return true;
    } catch (e) {
        localStorage.removeItem('app_user_session');
        return false;
    }
}

// 3. INSIALISASI DAN EVENT LISTENER
document.addEventListener('DOMContentLoaded', () => {
    // Jalankan pemeriksaan sesi 2 jam setiap 1 menit sekali
    checkSessionExpiration();
    setInterval(checkSessionExpiration, 60000);

    // Event Listener untuk Tombol "Sudah disetujui? Cek"
    const btnCheckApproval = document.getElementById('btn-check-approval') || document.getElementById('btn-check');
    if (btnCheckApproval) {
        btnCheckApproval.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Ubah teks tombol saat memuat data terbaru
            const originalText = btnCheckApproval.innerText;
            btnCheckApproval.innerText = "Mengecek ke server...";
            btnCheckApproval.disabled = true;

            // 1. Tarik data keys.js paling baru dari GitHub tanpa cache
            await fetchLatestKeys();

            // 2. Jalankan fungsi verifikasi status perangkat
            if (typeof verifyDeviceApproval === 'function') {
                verifyDeviceApproval();
            } else if (typeof checkDeviceStatus === 'function') {
                checkDeviceStatus();
            } else {
                window.location.reload();
            }

            // Kembalikan status tombol
            btnCheckApproval.innerText = originalText;
            btnCheckApproval.disabled = false;
        });
    }

    // Event Listener ketika Pengguna Berhasil Login Menggunakan Authenticator
    const formLogin = document.getElementById('form-login-auth');
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputAuthCode = document.getElementById('input-auth-code')?.value;
            const inputUserName = document.getElementById('input-user-name')?.value || 'Pengguna';

            // Verifikasi kode 6 angka Authenticator Admin
            if (typeof validateAuthenticatorCode === 'function' && validateAuthenticatorCode(inputAuthCode)) {
                // Simpan sesi login 2 jam
                saveUserSession(inputUserName, window.currentDeviceId || '');
                
                // Masuk ke halaman utama
                if (typeof showMainApp === 'function') {
                    showMainApp();
                } else {
                    window.location.reload();
                }
            } else {
                alert("Kode Authenticator salah atau telah kedaluwarsa. Minta kode 6 angka terbaru ke Admin.");
            }
        });
    }
});

// 4. LOGOUT OTOMATIS BILA ADMIN MEMUTUSKAN PERANGKAT DARI PANEL
async function autoCheckIfRevoked() {
    const sessionRaw = localStorage.getItem('app_user_session');
    if (!sessionRaw) return;

    await fetchLatestKeys();
    const session = JSON.parse(sessionRaw);

    // Jika ID perangkat dicabut oleh admin dari keys.js
    if (window.APPROVED_DEVICES && !window.APPROVED_DEVICES.includes(session.deviceId)) {
        localStorage.removeItem('app_user_session');
        alert("Akses perangkat Anda telah diputuskan oleh Admin.");
        window.location.reload();
    }
}

// Cek pemutusan akses dari admin setiap 2 menit
setInterval(autoCheckIfRevoked, 120000);
