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

// 가장 가까운 "교시" 찾기 (반환 형식은 동일)
const findNextClassDetails = (scheduleDoc) => {
    const now = new Date();
    const currentDayJsIndex = now.getDay(); // 0~6 (일~토)
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 월~금만 처리
    let currentDayDbIndex = -1;
    if (currentDayJsIndex >= 1 && currentDayJsIndex <= 5) {
        currentDayDbIndex = currentDayJsIndex - 1;
    }
    if (currentDayDbIndex === -1) {
        return null;
    }

    let targetDay = currentDayDbIndex;
    let targetPeriod = null;

    // 오늘 기준 "다음 교시" 찾기 (현재 교시는 제외)
    for (const [period, times] of Object.entries(PERIOD_TIMES)) {
        const startMinutes = timeToMinutes(times.start);
        if (startMinutes > currentMinutes) {
            targetPeriod = Number(period);
            break;
        }
    }

    // 오늘 남은 교시가 없으면 → 다음 날 1교시
    if (targetPeriod === null) {
        targetPeriod = 1;
        targetDay += 1;

        // 금요일 → 월요일
        if (targetDay > 4) {
            targetDay = 0;
        }
    }

    const periodTimes = PERIOD_TIMES[targetPeriod];
    const startMinutes = timeToMinutes(periodTimes.start);

    // 3️⃣ 해당 교시에 수업이 있는지 확인
    const dayName = DAYS[targetDay];
    const classesOnDay = scheduleDoc[dayName] || [];

    const classDetail = classesOnDay.find(cls =>
        timeToMinutes(cls.start) === startMinutes
    );

    return {
        day: targetDay,
        hour: Math.floor(startMinutes / 60),
        minute: startMinutes % 60,
        subject: classDetail ? classDetail.subject : null,
        period: targetPeriod
    };
};


module.exports = {
    findNextClassDetails,
    checkClassStatusFromArray,
    getCurrentPeriod,
    timeToMinutes,
    DAYS,
    WEEKDAYS_MAP,
    PERIOD_TIMES
};