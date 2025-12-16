// 1) 현재 요일 계산
const DAYS = [
    {index : 0}, //monday
    {index : 1}, //tuesday
    {index : 2}, //wedenesday
    {index : 3}, //thursday
    {index : 0}//friday
];

export function getToday() {
    return DAYS[new Date().getDay()].index;
}


// 2) 다음 교시 계산
export function NextClass() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const time = hour * 60 + minute;

    // 각 교시 수업 시간을 분으로 표현 
    const classes = [
        { class: 1, start: 540 },   // 9:00 ~ 10:15
        { class: 2, start: 630 },   // 10:30 ~ 11:45
        { class: 3, start: 720 },   // 12:00 ~ 13:15
        { class: 4, start: 810 },   // 13:30 ~ 14:45
        { class: 5, start: 900 },   // 15:00 ~ 16:15
        { class: 6, start: 990 },  // 16:30 ~ 17:45
        { class: 7, start: 1080 }  // 18:00 ~ 18:50
    ];

    // 다음 교시 찾기; 
    for (const p of classes) {
        if (p.start > time)
            return p.class;
    }

    return null;
}


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

