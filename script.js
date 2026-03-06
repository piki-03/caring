// ================= CONFIGURATION =================
const SUPABASE_URL = 'https://ogxmrurivcojvzljawdp.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_39SkbrQNVRGGD4K6iRhWww_IdeZKYXS'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= GLOBAL VARIABLES =================
let currentAnimal = "SAPI";
let pendingAnimal = "";
let battery = 100;

// ================= INITIALIZATION & LOADER =================
window.addEventListener('load', () => {
    initApp();
    setTimeout(() => {
        const loader = document.getElementById('loader-wrapper');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { 
                loader.style.visibility = 'hidden'; 
                document.getElementById('main-container').classList.add('loaded'); 
            }, 800);
        }
    }, 2000); 
});

async function initApp() {
    try {
        await fetchInitialData();
        setupRealtimeSubscription();
        loadHistory(); // Memuat riwayat saat aplikasi pertama kali dijalankan
    } catch (err) {
        console.error("Init App Gagal:", err);
    }
}

// ================= CORE LOGIC: DATA MONITORING =================

async function fetchInitialData() {
    try {
        const { data, error } = await supabaseClient
            .from('monitoring') 
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            renderData(data[0]);
        }
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

function renderData(data) {
    let suhu = parseFloat(data.suhu || 0).toFixed(1);
    let aktivitas = parseFloat(data.aktivitas || 0).toFixed(1);
    let suara = parseInt(data.suara || 0);
    let batLevel = data.baterai || 100; 
    let jenisHewan = (data.hewan || "SAPI").toUpperCase();

    currentAnimal = jenisHewan;
    document.querySelectorAll('.animal').forEach(a => a.classList.remove('active'));
    const activeEl = document.getElementById(`animal-${jenisHewan}`);
    if (activeEl) activeEl.classList.add('active');

    document.getElementById("suhu").innerText = suhu + "°C";
    document.getElementById("aktivitas").innerText = aktivitas;
    document.getElementById("suara").innerText = suara + " dB";
    
    const batText = document.getElementById("bat-text");
    const batBar = document.getElementById("bat-level");
    if(batText && batBar) {
        batText.innerText = batLevel + "%";
        batBar.style.width = batLevel + "%";
        batBar.style.backgroundColor = batLevel < 20 ? "var(--danger)" : "var(--green)";
    }

    processDiagnosis(suhu, aktivitas, suara, jenisHewan);
    checkAndSaveHistory(suhu, aktivitas, suara);
}

function setupRealtimeSubscription() {
    supabaseClient
        .channel('changes')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'monitoring' 
        }, (payload) => {
            renderData(payload.new);
        })
        .subscribe();
}

function processDiagnosis(suhu, aktivitas, suara, jenis) {
    const status = document.getElementById("status");
    const diagBox = document.getElementById("diagnosis");
    const diagText = document.getElementById("diag-text");

    let diagnosis = "";
    let isDanger = false;

    const thresholdMax = (jenis === "SAPI") ? 40.0 : 40.5;
    const thresholdMin = (jenis === "SAPI") ? 37.5 : 38.0;

    if (suhu > thresholdMax) {
        diagnosis = `Suhu ${jenis} sangat tinggi! Indikasi Gejala PMK atau Infeksi Akut.`;
        isDanger = true;
    } else if (suara > 85) {
        diagnosis = `Suara tinggi! ${jenis} mungkin stres atau batuk.`;
        isDanger = true;
    } else if (suhu > (thresholdMax - 0.5) && aktivitas < 3) {
        diagnosis = `Demam & Lemas. Kemungkinan BEF pada ${jenis}.`;
        isDanger = true;
    } else if (suhu < thresholdMin) {
        diagnosis = `Suhu ${jenis} rendah (Hipotermia). Segera beri penghangat.`;
        isDanger = true;
    } else {
        diagnosis = `Kondisi ${jenis} Stabil. Hewan sehat dan aktif.`;
        isDanger = false;
    }

    if(status && diagBox && diagText) {
        status.className = isDanger ? "status alert" : "status safe";
        status.innerText = isDanger ? `⚠ PERINGATAN: ${jenis} TIDAK NORMAL` : `✅ KONDISI ${jenis} NORMAL`;
        diagBox.className = isDanger ? "diag-box diag-alert" : "diag-box diag-normal";
        diagText.innerText = diagnosis;
    }
}

// ================= NAVIGATION & SELECTION =================
function switchPage(id, btn){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
    
    // Pastikan memuat riwayat setiap kali pindah ke halaman riwayat (ID 'hs')
    if(id === 'hs') {
        loadHistory();
    }
}

function requestSetAnimal(name) {
    if(name === currentAnimal) return;
    pendingAnimal = name;
    document.getElementById("verify-text").innerText = `Ganti pantauan ke ${name === 'SAPI' ? 'Sapi' : 'Kambing'}?`;
    document.getElementById("verify-modal").style.display = "flex";
}

function closeModal() { 
    document.getElementById("verify-modal").style.display = "none"; 
}

document.getElementById("confirm-btn").onclick = function() {
    // Update variabel lokal saja
    currentAnimal = pendingAnimal;
    
    // Update tampilan Foto Sapi/Kambing yang aktif
    document.querySelectorAll('.animal').forEach(a => a.classList.remove('active'));
    const activeEl = document.getElementById(`animal-${currentAnimal}`);
    if(activeEl) activeEl.classList.add('active');
    
    // Tutup Modal
    closeModal();
    console.log("Mode pantauan diganti ke: " + currentAnimal);
};

// ================= UTILS: CLOCK =================
setInterval(() => { 
    let now = new Date();
    document.getElementById("clock").innerText = now.toLocaleTimeString("id-ID"); 
    document.getElementById("date-display").innerText = now.toLocaleDateString("id-ID", { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
}, 1000);

// ================= HISTORY MANAGEMENT (JAM EFEKTIF) =================

function checkAndSaveHistory(suhu, aktivitas, suara) {
    let now = new Date();
    let hour = now.getHours();
    let minute = now.getMinutes();
    let second = now.getSeconds();

    // Sesuai keinginanmu: Jam 6-7, 12-13, 18-19
    // Saya tambahkan jam 11 (seperti di kodemu tadi) agar kamu bisa tes sekarang
    let isEffectiveTime = (hour >= 6 && hour < 7) || 
                          (hour >= 11 && hour < 12) || 
                          (hour >= 12 && hour < 13) || 
                          (hour >= 18 && hour < 19);
    if(isEffectiveTime) {
        saveToLocalStorage(suhu, aktivitas, suara);
    }
    // LOGIKA: Simpan hanya di detik ke-0 (agar tidak tersimpan berkali-kali dalam satu menit)
    // if(isEffectiveTime && second === 0) {
    //     saveToLocalStorage(suhu, aktivitas, suara);
    //     console.log("Data berhasil dicatat pada jam efektif!");
    // }
}

function saveToLocalStorage(t, a, s){
    let h = JSON.parse(localStorage.getItem("caring_log") || "[]");
    let now = new Date();
    
    // Format Waktu Indonesia
    let timeStamp = now.toLocaleDateString("id-ID", {day:'2-digit', month:'2-digit'}) + " " + 
                    now.toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'});
    
    // Tambah data ke urutan paling atas
    h.unshift({ time: timeStamp, t, a, s, animal: currentAnimal });
    
    // Batasi riwayat (Misal 10 atau 100 data)
    if(h.length > 100) h.pop(); 
    
    localStorage.setItem("caring_log", JSON.stringify(h));
    
    // UPDATE TABEL SECARA REALTIME
    loadHistory();
}

// ================= DISPLAY HISTORY (MENAMPILKAN RIWAYAT) =================
function loadHistory(){
    let h = JSON.parse(localStorage.getItem("caring_log") || "[]");
    const container = document.getElementById("history"); // Pastikan <tbody> di HTML memiliki ID 'history'
    
    if(!container) return;

    if(h.length === 0) {
        container.innerHTML = "<tr><td colspan='5' style='text-align:center'>Belum ada data di waktu efektif</td></tr>";
        return;
    }

    container.innerHTML = h.map(i => `
        <tr>
            <td>${i.time}</td>
            <td>${i.t}°C</td>
            <td>${i.a}</td>
            <td>${i.s}dB</td>
            <td>${i.animal}</td>
        </tr>`).join('');
}

// ================= EXPORT PDF (DOWNLOAD PDF) =================
function exportToPDF() {
    // Pastikan library jsPDF dan autoTable sudah terpasang di HTML
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let now = new Date().toLocaleDateString("id-ID", {year: 'numeric', month: 'long', day: 'numeric'});
    
    // Judul PDF
    doc.setFontSize(18);
    doc.text("Laporan Kesehatan CARING", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Dicetak pada: ${now}`, 14, 30);
    doc.text(`Target Pantauan: ${currentAnimal}`, 14, 37);

    // Membuat Tabel PDF
    doc.autoTable({ 
        html: '#history-table', // ID tabel HTML kamu
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [0, 123, 255] }, // Warna biru untuk header
        styles: { fontSize: 10 }
    });
    
    doc.save(`Laporan_Caring_${currentAnimal}_${now}.pdf`);
}
