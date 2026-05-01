// ---------- Data Store ----------
let processes = [];   // each: { id, arrival, burst, originalBurst (for RR remaining), completed? not needed directly, we'll clone for simulation }

// default sample processes (matching style from reference but adaptable)
function initDefaultProcesses() {
    return [
        { id: "P1", arrival: 3, burst: 4 },
        { id: "P2", arrival: 5, burst: 3 },
        { id: "P3", arrival: 2, burst: 3 },
        { id: "P4", arrival: 6, burst: 4 }   // similar to example in description
    ];
}

// Load initial data
processes = initDefaultProcesses();

// Helper: render the process table
function renderProcessTable() {
    const tbody = document.getElementById('processTableBody');
    tbody.innerHTML = '';
    processes.forEach((p, idx) => {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = p.id;
        row.insertCell(1).innerText = p.arrival;
        row.insertCell(2).innerText = p.burst;
        const delCell = row.insertCell(3);
        const delBtn = document.createElement('button');
        delBtn.innerText = '✖';
        delBtn.className = 'remove-btn';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            processes.splice(idx, 1);
            renderProcessTable();
            // after removal, clear old gantt, show placeholder
            clearGanttDisplay();
        });
        delCell.appendChild(delBtn);
    });
}

function clearGanttDisplay() {
    document.getElementById('ganttBars').innerHTML = '<div style="padding: 20px; text-align:center; color:#7f8c8d;">⏳ No schedule yet. Run algorithm.</div>';
    document.getElementById('timeMarkers').innerHTML = '';
    document.getElementById('avgWait').innerText = '—';
    document.getElementById('avgTurn').innerText = '—';
    document.getElementById('totalExec').innerText = '—';
}

// Helper to compute scheduling (supports FCFS and Round Robin)
function computeSchedule(processList, algorithm, quantum = 2) {
    if (!processList.length) return { timeline: [], stats: null };
    // deep copy for simulation
    let proc = processList.map(p => ({
        id: p.id,
        arrival: p.arrival,
        burst: p.burst,
        remaining: p.burst,    // for RR preemptive
        originalBurst: p.burst
    }));

    // FCFS (non-preemptive) based on arrival, then order
    if (algorithm === 'fcfs') {
        // sort by arrival time, then maybe ID for stability
        const sorted = [...proc].sort((a, b) => a.arrival - b.arrival);
        let timeline = [];   // each entry: { pid, start, end }
        let currentTime = 0;
        let finishTimes = new Map();
        for (let p of sorted) {
            if (currentTime < p.arrival) currentTime = p.arrival;
            const start = currentTime;
            const end = currentTime + p.burst;
            timeline.push({ pid: p.id, start, end, duration: p.burst });
            currentTime = end;
            finishTimes.set(p.id, end);
        }
        // compute waiting & turnaround
        let totalWait = 0, totalTurn = 0;
        for (let p of sorted) {
            const finish = finishTimes.get(p.id);
            const turnaround = finish - p.arrival;
            const waiting = turnaround - p.burst;
            totalWait += waiting;
            totalTurn += turnaround;
        }
        const avgWait = totalWait / sorted.length;
        const avgTurn = totalTurn / sorted.length;
        const totalExecTime = currentTime;
        return { timeline, stats: { avgWait, avgTurn, totalExecTime, processCount: sorted.length } };
    }
    else if (algorithm === 'rr') {
        // Round Robin: preemptive using ready queue, sort processes by arrival, maintain time quantum
        let time = 0;
        let timeline = []; // { pid, start, end }
        const n = proc.length;
        // prepare queue: sort by arrival
        let remainingProcs = proc.map(p => ({ ...p, remaining: p.burst, started: false }));
        remainingProcs.sort((a, b) => a.arrival - b.arrival);
        let readyQueue = [];
        let idx = 0;
        let lastActivePid = null;
        let segmentStart = null;
        let processFinishTimes = new Map();
        let totalBurstSum = remainingProcs.reduce((s, p) => s + p.burst, 0);

        // auxiliary to push newly arrived processes into ready queue (sorted by arrival, but we push in arrival order)
        function addNewArrivals(currentTime) {
            while (idx < remainingProcs.length && remainingProcs[idx].arrival <= currentTime) {
                readyQueue.push(remainingProcs[idx]);
                idx++;
            }
        }

        // track last segment for gantt merging (if consecutive same PID we merge)
        function addSegment(pid, start, end) {
            if (start === end) return;
            if (timeline.length > 0 && timeline[timeline.length - 1].pid === pid && timeline[timeline.length - 1].end === start) {
                timeline[timeline.length - 1].end = end;
            } else {
                timeline.push({ pid, start, end });
            }
        }

        addNewArrivals(time);
        while (readyQueue.length > 0 || idx < remainingProcs.length) {
            if (readyQueue.length === 0 && idx < remainingProcs.length) {
                // jump to next arrival
                time = remainingProcs[idx].arrival;
                addNewArrivals(time);
                continue;
            }
            let currentProc = readyQueue.shift();
            // execute for quantum or remaining
            const execTime = Math.min(quantum, currentProc.remaining);
            const startTime = time;
            const endTime = time + execTime;
            // record gantt segment
            addSegment(currentProc.id, startTime, endTime);
            time = endTime;
            currentProc.remaining -= execTime;
            // after execution, add newly arrived processes (that arrived during this burst)
            addNewArrivals(time);
            if (currentProc.remaining > 0) {
                // not finished -> push back to ready queue
                readyQueue.push(currentProc);
            } else {
                // finished: record finish time
                processFinishTimes.set(currentProc.id, time);
            }
        }

        // compute final waiting times & turnaround from finish times
        let totalWait = 0, totalTurn = 0;
        for (let p of remainingProcs) {
            const finish = processFinishTimes.get(p.id);
            if (finish === undefined) continue; // safety
            const turnaround = finish - p.arrival;
            const waiting = turnaround - p.originalBurst;
            totalWait += waiting;
            totalTurn += turnaround;
        }
        const avgWait = totalWait / remainingProcs.length;
        const avgTurn = totalTurn / remainingProcs.length;
        const totalExecTime = time;
        return { timeline, stats: { avgWait, avgTurn, totalExecTime, processCount: remainingProcs.length } };
    }
    return { timeline: [], stats: null };
}

// Draw Gantt chart from timeline segments
function renderGantt(timeline) {
    const ganttDiv = document.getElementById('ganttBars');
    const markersDiv = document.getElementById('timeMarkers');
    if (!timeline || timeline.length === 0) {
        ganttDiv.innerHTML = '<div style="padding: 20px; text-align:center;">📭 No processes scheduled</div>';
        markersDiv.innerHTML = '';
        return;
    }
    // compute total width scaling: we use flex with dynamic width based on duration
    // each unit time = 14px min width, but better approach: compute min time unit, display as blocks
    // actually we generate individual blocks per timeline segment, using style width: calc( (duration) * 12px + 20px? but better: each time unit min 5px max 22px
    // We'll use a container with display flex, each block width = max(30px, duration * 12px) but consistent scaling: total time range
    const totalTime = Math.max(...timeline.map(t => t.end), 1);
    // scale: each time unit uses about 14px, but clamp for min-width
    ganttDiv.innerHTML = '';
    for (let seg of timeline) {
        const duration = seg.end - seg.start;
        // dynamic width: base 14px per unit time, but min 32px for visibility, max reasonable
        let widthPercent = (duration / totalTime) * 100;
        // better use px based on relative
        const containerWidth = Math.min(1200, window.innerWidth - 100);
        let pxWidth = Math.max(38, duration * 16);
        if (duration === 0) continue;
        const block = document.createElement('div');
        block.className = 'gantt-block';
        block.style.width = `${Math.min(180, pxWidth)}px`;
        block.style.flexShrink = '0';
        block.innerText = `${seg.pid}\n${seg.start}→${seg.end}`;
        block.title = `${seg.pid} | ${seg.start} → ${seg.end} (${duration} units)`;
        ganttDiv.appendChild(block);
    }
    // Time markers: generate key points using timeline boundaries
    let allTimes = new Set();
    timeline.forEach(seg => { allTimes.add(seg.start); allTimes.add(seg.end); });
    let sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
    const markersHtml = sortedTimes.map(t => `<span style="margin-right: ${t > 0 ? 'auto' : '8px'}; font-weight:500;">${t}</span>`).join('');
    markersDiv.innerHTML = `<div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;">${markersHtml}</div>`;
}

// main function to run selected algorithm and update UI
function runScheduler() {
    if (processes.length === 0) {
        alert("No processes in table. Please add at least one process.");
        return;
    }
    const algoRadio = document.querySelector('input[name="algorithm"]:checked');
    const algorithm = algoRadio ? algoRadio.value : 'fcfs';
    let quantum = 2;
    if (algorithm === 'rr') {
        const quantumInput = document.getElementById('quantumValue');
        let qval = parseInt(quantumInput.value);
        if (isNaN(qval) || qval <= 0) qval = 2;
        quantum = qval;
    }
    // sanity: check for processes with burst <=0
    for (let p of processes) {
        if (p.burst <= 0) {
            alert(`Process ${p.id} has burst time <=0, adjust to positive.`);
            return;
        }
        if (p.arrival < 0) p.arrival = 0;
    }
    // compute schedule
    const { timeline, stats } = computeSchedule(processes, algorithm, quantum);
    if (!stats) {
        clearGanttDisplay();
        return;
    }
    // render gantt
    renderGantt(timeline);
    // update stats
    document.getElementById('avgWait').innerText = stats.avgWait.toFixed(2);
    document.getElementById('avgTurn').innerText = stats.avgTurn.toFixed(2);
    document.getElementById('totalExec').innerText = stats.totalExecTime;

    // extra detail: optionally, we can show quantum note
    if (algorithm === 'rr') {
        const noteEl = document.querySelector('.note');
        if (noteEl) noteEl.innerHTML = `⚡ Round Robin (Quantum = ${quantum}) | Preemptive context switching shown.`;
    } else {
        document.querySelector('.note').innerHTML = `📌 FCFS (non-preemptive) scheduled by arrival time.`;
    }
}

// add new process with validation
function addProcess() {
    let pid = document.getElementById('pidInput').value.trim();
    if (!pid) pid = `P${processes.length + 5}`;
    // ensure no duplicate id? but we allow maybe same? better warn
    if (processes.some(p => p.id === pid)) {
        alert(`Process ID "${pid}" already exists. Use unique ID.`);
        return;
    }
    let arrival = parseInt(document.getElementById('arrivalInput').value);
    let burst = parseInt(document.getElementById('burstInput').value);
    if (isNaN(arrival)) arrival = 0;
    if (isNaN(burst) || burst <= 0) {
        alert("Burst time must be a positive integer");
        return;
    }
    processes.push({ id: pid, arrival: arrival, burst: burst });
    renderProcessTable();
    // after adding, reset gantt results to avoid stale schedule
    clearGanttDisplay();
    // reset inputs for convenience but keep last pid pattern increment
    document.getElementById('pidInput').value = `P${processes.length + 1}`;
    document.getElementById('arrivalInput').value = 0;
    document.getElementById('burstInput').value = 3;
}

// toggle quantum visibility
function syncQuantumVisibility() {
    const selectedAlgo = document.querySelector('input[name="algorithm"]:checked').value;
    const quantumDiv = document.getElementById('quantumDiv');
    if (selectedAlgo === 'rr') {
        quantumDiv.style.display = 'flex';
    } else {
        quantumDiv.style.display = 'none';
    }
}

// event listeners
document.getElementById('addProcessBtn').addEventListener('click', addProcess);
document.getElementById('runAlgorithmBtn').addEventListener('click', runScheduler);
const radioFcfs = document.querySelector('input[value="fcfs"]');
const radioRr = document.querySelector('input[value="rr"]');
radioFcfs.addEventListener('change', syncQuantumVisibility);
radioRr.addEventListener('change', syncQuantumVisibility);
// initial visibility
syncQuantumVisibility();
renderProcessTable();
clearGanttDisplay();  // show placeholder but not auto-run
// to have a warm demo, on load we could run once? but better user runs.
// optionally, run initial demo
setTimeout(() => {
    runScheduler();
}, 100);