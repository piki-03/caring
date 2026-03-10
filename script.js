let animals = JSON.parse(localStorage.getItem('caring_v3_data') || '[]');
let historyData = JSON.parse(localStorage.getItem('caring_history') || '[]');
let selectedAnimal = null;
let intervalSensor = null;
let batPercent = 100;
let lastSaveTime = 0;

// Tambahkan library di index.html
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const supabase = supabase.createClient('https://ogxmrurivcojvzljawdp.supabase.co', 'sb_publishable_39SkbrQNVRGGD4K6iRhWww_IdeZKYXS');

// Fungsi untuk ambil data dari Supabase secara Realtime
function listenToHardware() {
    supabase
      .channel('sensor_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'monitoring_ternak' }, payload => {
          const data = payload.new;
          
          // Update UI CARING dengan data asli dari sensor
          document.getElementById('suhu').innerText = data.suhu_objek + " °C";
          document.getElementById('aktivitas').innerText = data.skor_aktivitas;
          document.getElementById('pernapasan').innerText = data.laju_napas;
          
          // Jalankan diagnosa otomatis
          diagnosa(data.suhu_objek, data.skor_aktivitas, data.laju_napas);
      })
      .subscribe();
}

// Initialize App
window.onload = () => {
    setTimeout(() => {
        document.getElementById('loader-wrapper').style.display = 'none';
        document.getElementById('main-container').classList.add('loaded');
        renderList(); 
        renderHistory();
    }, 1500);
};

// Clock Function
setInterval(() => { 
    document.getElementById("clock").innerText = new Date().toLocaleString("id-ID"); 
}, 1000);

// Page Navigation
function switchPage(id, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (btn) btn.classList.add('active');
}

// Manage Animals
function addAnimal() {
    let nama = document.getElementById('input-nama').value.trim();
    if (!nama) return alert("Masukkan nama hewan!");
    
    animals.push({ id: Date.now(), nama: nama.toUpperCase() });
    localStorage.setItem('caring_v3_data', JSON.stringify(animals));
    document.getElementById('input-nama').value = "";
    renderList();
}

function deleteAnimal(id, e) {
    e.stopPropagation();
    if (confirm("Hapus hewan ini dari daftar?")) {
        animals = animals.filter(a => a.id !== id);
        localStorage.setItem('caring_v3_data', JSON.stringify(animals));
        renderList();
    }
}

function renderList() {
    let container = document.getElementById('container-hewan');
    container.innerHTML = animals.length === 0 ? "<small>Belum ada hewan terdaftar.</small>" : "";
    
    animals.forEach(a => {
        container.innerHTML += `
            <div class="animal-card" onclick="startMonitor('${a.nama}')">
                <div style="flex:1"><b>${a.nama}</b><br><small style="color:#666">Klik untuk monitor</small></div>
                <button class="btn-del-animal" onclick="deleteAnimal(${a.id}, event)">🗑️</button>
            </div>`;
    });
}

// Monitoring Logic
function startMonitor(nama) {
    selectedAnimal = nama;
    batPercent = 100;
    document.getElementById('active-name').innerText = "MONITORING: " + nama;
    
    const btnMonitor = document.getElementById('btn-monitor');
    btnMonitor.disabled = false;
    btnMonitor.style.opacity = 1;
    
    switchPage('rt', btnMonitor);
    
    if (intervalSensor) clearInterval(intervalSensor);
    intervalSensor = setInterval(generateSensor, 3000);
}

function generateSensor() {
    let s = (Math.random() * 3 + 37.5).toFixed(1);
    let a = Math.floor(Math.random() * 100);
    let p = Math.floor(Math.random() * 100);

    // Battery simulation
    if (batPercent > 5) batPercent -= 0.2;
    document.getElementById('bat-level').style.width = batPercent + "%";
    document.getElementById('bat-text').innerText = Math.round(batPercent) + "%";

    // Display values
    document.getElementById('suhu').innerText = s + " °C";
    document.getElementById('aktivitas').innerText = a;
    document.getElementById('pernapasan').innerText = p;

    diagnosa(parseFloat(s), a, p);
}

function diagnosa(s, a, p) {
    let status = "SEHAT";
    let hasil = "Normal";
    let alasan = "Tanda vital terpantau stabil.";
    let statusBar = document.getElementById('status-bar');

    // Simple Rule Engine
    if (s >= 40 && a < 40 && p > 60) {
        hasil = "Indikasi PMK";
        alasan = "Demam tinggi, aktivitas rendah, napas cepat. Cek area mulut/kuku.";
    } else if (s >= 40.5 && a < 30) {
        hasil = "Indikasi SE (Ngorok)";
        alasan = "Suhu sangat tinggi & kelesuan akut. Segera hubungi dokter hewan!";
    } else if (s >= 39.5 && p > 65) {
        hasil = "Masalah Pernapasan";
        alasan = "Pernapasan tidak normal (Pneumonia).";
    }

    if (hasil !== "Normal") status = "SAKIT";
    
    // UI Update for Status
    statusBar.innerText = status;
    if (status === "SAKIT") {
        statusBar.style.background = "#ff4646";
        statusBar.classList.add('pulse-danger');
        document.getElementById('diag-display').className = "diag-box alert-bg";
    } else {
        statusBar.style.background = "#2e7d32";
        statusBar.classList.remove('pulse-danger');
        document.getElementById('diag-display').className = "diag-box normal-bg";
    }
    
    document.getElementById('diag-text').innerText = hasil;
    document.getElementById('diag-reason').innerText = alasan;

    // Auto Save Logic (Every 10 Minutes)
    let now = Date.now();
    if (now - lastSaveTime > 600000) {
        saveHistory(s, hasil);
        lastSaveTime = now;
    }
}

// History & Export
function saveHistory(suhu, diag) {
    let data = {
        waktu: new Date().toLocaleString("id-ID", {day:'2-digit', month:'2-digit', hour: '2-digit', minute:'2-digit'}),
        hewan: selectedAnimal,
        suhu: suhu + " °C",
        diagnosa: diag
    };
    historyData.unshift(data);
    if (historyData.length > 100) historyData.pop();
    localStorage.setItem('caring_history', JSON.stringify(historyData));
    renderHistory();
}

function renderHistory() {
    let rows = document.getElementById('history-rows');
    rows.innerHTML = "";
    historyData.forEach(d => {
        rows.innerHTML += `<tr><td>${d.waktu}</td><td>${d.hewan}</td><td>${d.suhu}</td><td>${d.diagnosa}</td></tr>`;
    });
}

function exportData(format) {
    if (historyData.length === 0) return alert("Belum ada data riwayat!");
    format === 'excel' ? exportToExcel() : exportToPDF();
}

function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(historyData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log_Caring");
    XLSX.writeFile(wb, `CARING_LOG_${Date.now()}.xlsx`);
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("LAPORAN MONITORING CARING 0.3", 14, 15);
    doc.autoTable({
        head: [['Waktu', 'Hewan', 'Suhu', 'Diagnosa']],
        body: historyData.map(d => [d.waktu, d.hewan, d.suhu, d.diagnosa]),
        startY: 25,
        headStyle: { fillColor: [0, 86, 179] }
    });
    doc.save(`CARING_REPORT_${Date.now()}.pdf`);
}

function hapusRiwayat() {
    if (confirm("Kosongkan semua riwayat?")) {
        historyData = [];
        localStorage.removeItem('caring_history');
        renderHistory();
    }
}