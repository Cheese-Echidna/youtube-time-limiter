// for test purposes
localStorage.setItem("ytb_time_spent", 59999);
localStorage.setItem("ytb_last_session_day", 1); // from 1 to 31

setInterval(countTimeSpentMinutes, 60000); // convert to minutes after successful test

async function countTimeSpentMinutes() {
    let seconds = 0;
    let today =  new Date;
    try {
        lastday = localStorage.getItem("ytb_last_session_day");
        // console.log("last day = "+lastday);
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
        seconds = localStorage.getItem("ytb_time_spent");
        // console.log("s2 = "+seconds);
    } catch (error) {
        console.log(error);
        seconds = 0;
    }
    localStorage.setItem("ytb_time_spent", (Number(seconds)+60)); // convert to minutes after successful test
    console.log("s3 = "+seconds);

    if(seconds > 3600) {
        alert("Daily YouTube time limit of 1 hour reached !");
    }
}