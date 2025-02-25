document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("extra").addEventListener("click", async () => {
        await incrementTimeSpent(-20*60)
        await incrementButtonPresses();
    });
    document.getElementById("return").addEventListener("click", async () => {
        let timeRemaining = await getTimeRemaining();
        if (timeRemaining < 25*60) {
            return
        }
        await incrementTimeSpent(25*60)
        await decrementButtonPresses();
    });
    await update();
});

const timeoutTime = 1000;

setInterval(update, timeoutTime);

async function update() {
    await updateTimeSpent();
    await updateDev();
    await updateButtonCount();
}

async function updateDev() {
    if (DEBUG) {
        let dev = document.getElementById("dev")
        let timeSpent = await getTimeSpent();
        dev.innerHTML = `
            <h2>Debug Mode</h2>
            <p>Time spent: ${timeSpent}s - ${formatSeconds(timeSpent)}</p>
            <button id="1">Reset time spent</button>
            <p>Last session day: ${await getItem(LAST_SESSION_DAY_KEY, -1)}</p>
            <button id="2">Reset last session day</button>
            <p>Button presses: ${await getButtonPresses()}</p>
            <button id="3">Reset button presses</button>
           `
        document.getElementById("1").addEventListener("click", async () => {
            await resetTimeSpent();
            await update();
        });
        document.getElementById("2").addEventListener("click", async () => {
            await setItem(LAST_SESSION_DAY_KEY, -1);
            await swapDay();
            await update();
        });
        document.getElementById("3").addEventListener("click", async () => {
            await setItem(BUTTON, 0);
            await update();
        });
    }
}

async function updateButtonCount() {
    const buttonCount = await getButtonPresses();
    document.getElementById("button-count").textContent = `${buttonCount} presses`;
}

async function updateTimeSpent() {
    let time = await getTimeRemaining();
    document.getElementById("output").textContent = `Time remaining: ${formatSeconds(time)}`;
    if (time <= 0) {
        document.getElementById("output").textContent = "Time is up!";
        document.body.style.backgroundColor = "#ff6060";
    } else {
        document.body.style.backgroundColor = "#ffffff";
    }
}

setInterval(updateTimeSpent, 1000);