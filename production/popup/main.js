document.addEventListener('DOMContentLoaded', async () => {
  await initUI();
  await update();
});

const timeoutTime = 1000;

setInterval(update, timeoutTime);

async function update() {
  await ensureResetBoundary();
  await updateTimeSpent();
  await drawHistoryChart();
  await updateDev();
}

async function initUI() {
  // Only export CSV is available in the popup now
  const exportBtn = document.getElementById('export-csv');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const csv = await buildHistoryCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'yt-time-limiter-history.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}

async function drawHistoryChart() {
  const canvas = document.getElementById('history-chart');
  const ctx = canvas.getContext('2d');
  const history = await getHistory();
  const days = lastNDates(14);
  const values = days.map((d) => history[d] || 0);
  const maxVal = Math.max(...values, 1); // scale to observed max

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = 10;
  const barWidth = (canvas.width - padding * 2) / days.length;
  const height = canvas.height - padding * 2;

  // Axes
  ctx.strokeStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  // Bars
  for (let i = 0; i < days.length; i++) {
    const v = values[i];
    const h = maxVal ? Math.round((v / maxVal) * height) : 0;
    const x = padding + i * barWidth + 2;
    const y = canvas.height - padding - h;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(x, y, barWidth - 4, h);
  }
}

function lastNDates(n) {
  const res = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    res.push(d.toISOString().slice(0, 10));
  }
  return res;
}

async function updateDev() {
  if (DEBUG) {
    let dev = document.getElementById('dev');
    let timeSpentS = await getTimeSpent();
    dev.innerHTML = `
            <h2>Debug Mode</h2>
            <p>Time spent: ${timeSpentS}s - ${formatSeconds(timeSpentS)}</p>
            <button id="1">Reset time spent</button>
           `;
    document.getElementById('1').addEventListener('click', async () => {
      await resetTimeSpent();
      await update();
    });
  }
}

async function updateTimeSpent() {
  let time = await getTimeRemaining();
  document.getElementById('output').textContent = `Time remaining: ${formatSeconds(time)}`;
  if (time <= 0) {
    document.getElementById('output').textContent = 'Time is up!';
    document.body.style.backgroundColor = '#ff6060';
  } else {
    document.body.style.backgroundColor = '#ffffff';
  }
}

setInterval(updateTimeSpent, 1000);
