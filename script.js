// ================= CONFIGURATION =================
const SUPABASE_URL = 'https://ogxmrurivcojvzljawdp.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_39SkbrQNVRGGD4K6iRhWww_IdeZKYXS'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedType = "SAPI"; 
let currentAnimal = "SAPI"; 
let activeAnimalName = ""; 

// ================= NAVIGATION & SELECTION =================

function selectType(type) {
    selectedType = type;
    document.querySelectorAll('#setup-monitor .animal').forEach(el => el.classList.remove('active'));
    document.getElementById(`setup-${type}`).classList.add('active');
}

function goToMonitor() {
    switchPage('rt', document.getElementById('btn-monitor'));
}

function startMonitoringSession() {
    const nameInput = document.getElementById('input-nama-hewan').value;
    if (nameInput.trim() === "") {
        alert("Silakan masukkan nama hewan terlebih dahulu!");
        return;
    }
    activeAnimalName = nameInput;
    currentAnimal = selectedType; 

    document.getElementById('display-nama').innerText = activeAnimalName;
    document.getElementById('display-jenis').innerText = `(${currentAnimal})`;
    document.getElementById('setup-monitor').style.display = 'none';
    document.getElementById('active-monitor').style.display = 'block';
}

function resetMonitor() {
    if(confirm("Hentikan sesi monitor ini dan ganti hewan?")) {
        document.getElementById('setup-monitor').style.display = 'block';
        document.getElementById('active-monitor').style.display = 'none';
        document.getElementById('input-nama-hewan').value = "";
        activeAnimalName = "";
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

// ================= INITIALIZATION =================
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

// ================= CORE LOGIC =================

async function fetchInitialData() {
    try {
        const { data, error } = await supabaseClient
            .from('monitoring') 
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
        if (data && data.length > 0) renderData(data[0]);
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

    let labelAktivitas = (aktivitasRaw < 3) ? "Lemas" : (aktivitasRaw <= 7 ? "Aktif" : "Agresif");

    document.getElementById("suhu").innerText = suhu + "°C";
    document.getElementById("aktivitas").innerText = labelAktivitas; 
    document.getElementById("suara").innerText = suara + " dB";
    
    const batBar = document.getElementById("bat-level");
    if(batBar) {
        batBar.style.width = batLevel + "%";
        batBar.style.backgroundColor = batLevel < 20 ? "#ff5252" : "#4caf50";
    }

    processDiagnosis(suhu, aktivitasRaw, suara, currentAnimal);
    if (activeAnimalName !== "") checkAndSaveHistory(suhu, labelAktivitas, suara);
}

function processDiagnosis(suhu, aktivitas, suara, jenis) {
    const status = document.getElementById("status");
    const diagBox = document.getElementById("diagnosis");
    const diagText = document.getElementById("diag-text");
    let diagnosis = "";
    let isDanger = false;

    const thresholdMax = (jenis === "SAPI") ? 40.0 : 40.5;
    const thresholdMin = (jenis === "SAPI") ? 37.5 : 38.0;

    if (suhu > thresholdMax) { diagnosis = `Suhu ${jenis} tinggi! Gejala PMK/Infeksi.`; isDanger = true; }
    else if (suara > 85) { diagnosis = `${jenis} Stres/Batuk!`; isDanger = true; }
    else if (suhu < thresholdMin) { diagnosis = `${jenis} Hipotermia!`; isDanger = true; }
    else { diagnosis = `Kondisi ${jenis} Stabil.`; isDanger = false; }

    if(status && diagBox) {
        status.className = isDanger ? "status alert" : "status safe";
        status.innerText = isDanger ? `⚠ ${jenis} TIDAK NORMAL` : `✅ ${jenis} NORMAL`;
        diagBox.className = isDanger ? "diag-box diag-alert" : "diag-box diag-normal";
        diagText.innerText = diagnosis;
    }
}

// ================= HISTORY & STORAGE =================

function checkAndSaveHistory(suhu, aktivitas, suara) {
    let hour = new Date().getHours();
    let isEffective = (hour >= 6 && hour < 7) || (hour >= 11 && hour < 13) || (hour >= 18 && hour < 19);
    if(isEffective) saveToLocalStorage(suhu, aktivitas, suara);
}

function saveToLocalStorage(t, a, s){
    let h = JSON.parse(localStorage.getItem("caring_log") || "[]");
    let now = new Date();
    let timeStamp = now.toLocaleDateString("id-ID", {day:'2-digit', month:'2-digit'}) + " " + 
                    now.toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'});
    
    h.unshift({ time: timeStamp, t: t, a: a, s: s, animal: `${activeAnimalName} (${currentAnimal})` });
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
        return `<tr><td>${i.time}</td><td>${i.t}°C</td><td style="color:${color}">${i.a}</td><td>${i.s}dB</td><td>${i.animal}</td></tr>`;
    }).join('');
}

// ================= EXPORT LOGIC =================

function openDownloadModal() {
    document.getElementById('download-modal').style.display = 'flex';
}

function closeDownloadModal() {
    document.getElementById('download-modal').style.display = 'none';
}

function exportToPDF(filterType) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let historyData = JSON.parse(localStorage.getItem("caring_log") || "[]");
    let filteredData = historyData.filter(item => item.animal.includes(`(${filterType})`));

    if (filteredData.length === 0) {
        alert(`Data riwayat ${filterType} tidak ditemukan!`);
        return;
    }

    let nowStr = new Date().toLocaleDateString("id-ID", {year: 'numeric', month: 'long', day: 'numeric'});
    doc.setFontSize(18);
    doc.text(`LAPORAN KESEHATAN ${filterType}`, 14, 20);
    
    const tableRows = filteredData.map(item => [item.time, item.t + "°C", item.a, item.s + " dB", item.animal]);
    doc.autoTable({ 
        head: [['Waktu', 'Suhu', 'Aktivitas', 'Suara', 'Hewan']],
        body: tableRows,
        startY: 35,
        headStyles: { fillColor: filterType === 'SAPI' ? [46, 125, 50] : [109, 76, 65] }
    });
    
    doc.save(`Laporan_${filterType}_${nowStr}.pdf`);
    closeDownloadModal();
}

// ================= UTILS =================
setInterval(() => { 
    let now = new Date();
    if(document.getElementById("clock")) document.getElementById("clock").innerText = now.toLocaleTimeString("id-ID"); 
    if(document.getElementById("date-display")) document.getElementById("date-display").innerText = now.toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}, 1000);

window.onclick = (event) => {
    if (event.target == document.getElementById('download-modal')) closeDownloadModal();
}