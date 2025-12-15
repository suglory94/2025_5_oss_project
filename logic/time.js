import axios from "axios";


// 1) 현재 요일 계산
const DAYS = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
];

export function getToday() {
    return DAYS[new Date().getDay()];
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


// 3) 백엔드한테 해당 교시에 수업 있는지 요청
export async function checkClassStatus(day, period) {
    try {
        const response = await axios.post(
            "http://localhost:3000/api/hourly/schedule/check", //*backend
            { day, period }
        );

        return response.data.hasClass; // *backend
    } catch (error) {
        console.error("수업 여부 조회 실패:", error);
        return null;  // 실패하면 false로 처리
    }
}

