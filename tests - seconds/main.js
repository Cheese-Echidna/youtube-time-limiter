// a non production ready branch which enables to quickly test the extension

// for test purposes
// localStorage.setItem("ytb_time_spent", 59999);
// localStorage.setItem("ytb_last_session_day", 1);

setInterval(countTimeSpentSeconds, 1000);

async function countTimeSpentSeconds() {
    let seconds = 0;
    let today =  new Date;
    try {
        lastday = await localStorage.getItem("ytb_last_session_day");
        console.log("last day = "+lastday);
    } catch (error) {
        console.log(error);
        lastday = -1;
    }

    if (today.getDate() != lastday) { // then reset time spent
        localStorage.setItem("ytb_time_spent", 0);
    } // else do nothing

    localStorage.setItem("ytb_last_session_day", today.getDate());
    console.log("today date = "+today.getDate());

    try {
        seconds = await localStorage.getItem("ytb_time_spent");
        console.log("s2 = "+seconds);
    } catch (error) {
        console.log(error);
        seconds = 0;
    }
    localStorage.setItem("ytb_time_spent", (Number(seconds)+1));
    console.log("s3 = "+seconds);

    if(seconds > 10) {
        alert("Daily YouTube time limit reached !");
    }
}