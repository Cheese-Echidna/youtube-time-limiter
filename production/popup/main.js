document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("extra").addEventListener("click", async () => {
        let timeSpent = await getTimeSpent();
        if (timeSpent <= 0) {
            return
        }
        await incrementTimeSpent(-20*60)
        await incrementButtonPresses();
        await update();
    });
    document.getElementById("return").addEventListener("click", async () => {
        let timeRemaining = await getTimeRemaining();
        if (timeRemaining < 30*60) {
            return
        }
        await incrementTimeSpent(30*60)
        await decrementButtonPresses();
        await update();
    });
    await update();
});

async function update() {
    await updateTimeSpent();
    await updateButtonCount();
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
    }
}

setInterval(updateTimeSpent, 1000);