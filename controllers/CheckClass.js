const Schedule = require("../models/scheduleModel");

// 요일 인덱스
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const WEEKDAYS_MAP = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4
};

// 교시별 시간 정보
const PERIOD_TIMES = {
    1: { start: "09:00", end: "10:15" },
    2: { start: "10:30", end: "11:45" },
    3: { start: "12:00", end: "13:15" },
    4: { start: "13:30", end: "14:45" },
    5: { start: "15:00", end: "16:15" },
    6: { start: "16:30", end: "17:45" }
};

// 문자열을 분으로 변환
const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

// 현재 시간을 기준으로 교시 번호를 찾음
const getCurrentPeriod = (currentMinutes) => {
    for (const [period, times] of Object.entries(PERIOD_TIMES)) {
        if (currentMinutes >= timeToMinutes(times.start) && currentMinutes < timeToMinutes(times.end)) {
            return Number(period);
        }
    }
    return null;
};

// 특정 교시에 수업이 있는지 확인
const checkClassStatusFromArray = (timetableArray, dayIndex, period) => {
    const periodIndex = period - 1;

    // 인덱스 유효성 검사 (월~금, 1~6교시)
    if (dayIndex >= 0 && dayIndex <= 4 && periodIndex >= 0 && periodIndex <= 5) {
        // timetableArray[요일 인덱스][교시 인덱스] == 1 (수업 있음)
        return timetableArray[dayIndex] && timetableArray[dayIndex][periodIndex] === 1;
    }
    return false;
};

// 가장 가까운 수업 찾기
const findNextClassDetails = (scheduleDoc) => {
    const now = new Date();
    const currentDayJsIndex = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let currentDayDbIndex = -1;
    if (currentDayJsIndex >= 1 && currentDayJsIndex <= 5) {
        currentDayDbIndex = currentDayJsIndex - 1;
    }

    if (currentDayDbIndex === -1) {
        return null;
    }

    let minTimeDiffMs = Infinity;
    let nextClassDetails = null;

    for (let d = 0; d < 5; d++) {
        const checkDayDbIndex = d;
        const checkDayName = DAYS[checkDayDbIndex];

        const isToday = (checkDayDbIndex === currentDayDbIndex);
        const startMinuteCheck = isToday ? currentMinutes : timeToMinutes("08:59");

        const classesOnDay = scheduleDoc[checkDayName] || [];

        for (let period = 1; period <= 6; period++) {
            const periodTimes = PERIOD_TIMES[period];
            const startMinutes = timeToMinutes(periodTimes.start);

            const currentClass = classesOnDay.find(cls => {
                const classStartMinutes = timeToMinutes(cls.start);
                return classStartMinutes === startMinutes;
            });

            if (!currentClass) continue;

            // 수업 날짜 계산
            let classDate = new Date(now);

            let daysToAdd = checkDayDbIndex - currentDayDbIndex;
            if (daysToAdd < 0) daysToAdd += 5;

            classDate.setDate(now.getDate() + daysToAdd);
            classDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

            const timeDiffMs = classDate.getTime() - now.getTime();

            if (timeDiffMs > 0 && timeDiffMs < minTimeDiffMs) {
                minTimeDiffMs = timeDiffMs;
                nextClassDetails = {
                    day: checkDayDbIndex,
                    hour: Math.floor(startMinutes / 60),
                    minute: startMinutes % 60,
                    subject: currentClass.subject,
                    period: period
                };
            }
        }
    }

    return nextClassDetails;
}

module.exports = {
    findNextClassDetails,
    checkClassStatusFromArray,
    getCurrentPeriod,
    timeToMinutes,
    DAYS,
    WEEKDAYS_MAP,
    PERIOD_TIMES
};