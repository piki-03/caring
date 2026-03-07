// ================= CONFIGURATION =================
const SUPABASE_URL = 'https://ogxmrurivcojvzljawdp.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_39SkbrQNVRGGD4K6iRhWww_IdeZKYXS'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedType = "SAPI"; // Jenis yang dipilih di menu setup
let currentAnimal = "SAPI"; // Jenis yang sedang aktif dipantau
let activeAnimalName = ""; // Nama custom (misal: "Si Putih")
let pendingAnimal = "";    // Untuk keperluan modal konfirmasi

// ================= NAVIGATION & SELECTION =================

// Pilih gambar Sapi atau Kambing di menu setup
function selectType(type) {
    selectedType = type;
    document.querySelectorAll('#setup-monitor .animal').forEach(el => el.classList.remove('active'));
    document.getElementById(`setup-${type}`).classList.add('active');
}

// Tombol dari Home ke Monitor
function goToMonitor() {
    switchPage('rt', document.getElementById('btn-monitor'));
}

// Kunci nama dan buka dashboard
function startMonitoringSession() {
    const nameInput = document.getElementById('input-nama-hewan').value;
    
    if (nameInput.trim() === "") {
        alert("Silakan masukkan nama hewan terlebih dahulu!");
        return;
    }

    activeAnimalName = nameInput;
    currentAnimal = selectedType; 

    // Update Tampilan Dashboard
    document.getElementById('display-nama').innerText = activeAnimalName;
    document.getElementById('display-jenis').innerText = `(${currentAnimal})`;

    // Tukar Tampilan
    document.getElementById('setup-monitor').style.display = 'none';
    document.getElementById('active-monitor').style.display = 'block';
}

// Reset kembali ke menu pemilihan
function resetMonitor() {
    if(confirm("Hentikan sesi monitor ini dan ganti hewan?")) {
        document.getElementById('setup-monitor').style.display = 'block';
        document.getElementById('active-monitor').style.display = 'none';
        document.getElementById('input-nama-hewan').value = "";
        activeAnimalName = ""; // Reset nama aktif
    }
}

function switchPage(id, btn){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
    
    if(id === 'hs') {
        loadHistory();
    }
}

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
        loadHistory(); 
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

function renderData(data) {
    let suhu = parseFloat(data.suhu || 0).toFixed(1);
    let aktivitasRaw = parseFloat(data.aktivitas || 0);
    let suara = parseInt(data.suara || 0);
    let batLevel = data.baterai || 100; 
    let jenisDariDB = (data.hewan || "SAPI").toUpperCase();

    // Logika Label Aktivitas
    let labelAktivitas = "";
    if (aktivitasRaw < 3) labelAktivitas = "Lemas";
    else if (aktivitasRaw >= 3 && aktivitasRaw <= 7) labelAktivitas = "Aktif";
    else labelAktivitas = "Agresif";

    // Update UI (Hanya jika sedang dalam sesi aktif atau data sesuai jenis yang dipantau)
    document.getElementById("suhu").innerText = suhu + "°C";
    document.getElementById("aktivitas").innerText = labelAktivitas; 
    document.getElementById("suara").innerText = suara + " dB";
    
    const batText = document.getElementById("bat-text");
    const batBar = document.getElementById("bat-level");
    if(batText && batBar) {
        batText.innerText = batLevel + "%";
        batBar.style.width = batLevel + "%";
        batBar.style.backgroundColor = batLevel < 20 ? "#ff5252" : "#4caf50";
    }

    processDiagnosis(suhu, aktivitasRaw, suara, currentAnimal);
    
    // Simpan ke riwayat hanya jika sesi sudah dimulai (nama tidak kosong)
    if (activeAnimalName !== "") {
        checkAndSaveHistory(suhu, labelAktivitas, suara);
    }
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

// ================= HISTORY MANAGEMENT =================

function checkAndSaveHistory(suhu, aktivitas, suara) {
    let now = new Date();
    let hour = now.getHours();

    // Jam Efektif: 6-7, 11-12 (tes), 12-13, 18-19
    let isEffectiveTime = (hour >= 6 && hour < 7) || 
                          (hour >= 11 && hour < 12) || 
                          (hour >= 12 && hour < 13) || 
                          (hour >= 18 && hour < 19);
                          
    if(isEffectiveTime) {
        saveToLocalStorage(suhu, aktivitas, suara);
    }
}

function saveToLocalStorage(t, a, s){
    let h = JSON.parse(localStorage.getItem("caring_log") || "[]");
    let now = new Date();
    
    let timeStamp = now.toLocaleDateString("id-ID", {day:'2-digit', month:'2-digit'}) + " " + 
                    now.toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'});
    
    // Simpan dengan format Nama (Jenis)
    h.unshift({ 
        time: timeStamp, 
        t: t, 
        a: a, 
        s: s, 
        animal: `${activeAnimalName} (${currentAnimal})` 
    });
    
    if(h.length > 100) h.pop(); 
    localStorage.setItem("caring_log", JSON.stringify(h));
    loadHistory();
}

function loadHistory(){
    let h = JSON.parse(localStorage.getItem("caring_log") || "[]");
    const container = document.getElementById("history");
    
    if(!container) return;
    if(h.length === 0) {
        container.innerHTML = "<tr><td colspan='5' style='text-align:center'>Belum ada data</td></tr>";
        return;
    }

    container.innerHTML = h.map(i => {
        let color = i.a === "Lemas" ? "#ff9800" : (i.a === "Aktif" ? "#4caf50" : "#f44336");
        return `
        <tr>
            <td>${i.time}</td>
            <td>${i.t}°C</td>
            <td style="font-weight:bold; color:${color}">${i.a}</td>
            <td>${i.s}dB</td>
            <td>${i.animal}</td>
        </tr>`;
    }).join('');
}

// ================= EXPORT & UTILS =================

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let nowStr = new Date().toLocaleDateString("id-ID", {year: 'numeric', month: 'long', day: 'numeric'});
    
    doc.setFontSize(18);
    doc.text("Laporan Kesehatan CARING", 14, 20);
    doc.setFontSize(11);
    doc.text(`Dicetak pada: ${nowStr}`, 14, 30);

    doc.autoTable({ 
        html: '#history-table',
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [76, 175, 80] },
        styles: { fontSize: 9 }
    });
    
    doc.save(`Laporan_Caring_${nowStr}.pdf`);
}

setInterval(() => { 
    let now = new Date();
    const clockEl = document.getElementById("clock");
    const dateEl = document.getElementById("date-display");
    if(clockEl) clockEl.innerText = now.toLocaleTimeString("id-ID"); 
    if(dateEl) dateEl.innerText = now.toLocaleDateString("id-ID", { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
}, 1000);
