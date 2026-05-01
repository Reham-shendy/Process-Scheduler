# Process Scheduling Simulator (FCFS & Round Robin)

An interactive web-based tool to visualize and compare CPU scheduling algorithms. Built with vanilla HTML, CSS, and JavaScript.

## About

This simulator helps understand how different scheduling algorithms affect process execution. Add processes, choose an algorithm, and see the Gantt chart with performance metrics instantly.

## Features

- **Two Scheduling Algorithms**: FCFS (First Come First Serve) & Round Robin
- **Interactive Process Table**: Add/remove processes with custom arrival and burst times
- **Visual Gantt Chart**: See execution order and timing
- **Performance Metrics**: Average waiting time, turnaround time, and total execution time
- **Configurable Quantum**: Adjust time slice for Round Robin

## How to Use

1. Add processes using the form (PID, arrival time, burst time)
2. Select FCFS or Round Robin
3. For Round Robin, set the quantum value
4. Click "Run Algorithm" to see results

## Technologies

- HTML5
- CSS3 (Flexbox, Grid)
- Vanilla JavaScript (ES6+)
- No external dependencies


git clone https://github.com/yourusername/process-scheduler.git
cd process-scheduler
open index.html
