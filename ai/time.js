import axios from "axios";


// 현재 요일 계산
const days = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

export function GetDay() {
  const now = new Date();
  return days[now.getDay()];
}


// 현재 교시 계산 
// 해당 교시의 수업 시작 30분 전에 선택지 제공
export function GetClass() {
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

  // “시작 30분 전” 기준으로 period 활성화
  for (const t of classes) {
    if (time >= t.start - 30 && time < t.start) {
      return t.class;
    }
  }

  return 0; // 선택을 할 수 있는 시간이 아님
}


// 3) 백엔드에게 이 교시에 수업 있는지 요청
export async function ClassStatus(day, period) {
  try {
    const response = await axios.post(
      "http://localhost:3000/api/schedule/check", //*backend
      { day, period }
    );

    return response.data.hasClass; // *backend
  } catch (error) {
    console.error("수업 여부 조회 실패:", error);
    return -1;  // 실패하면 false로 처리
  }
}


// 메인 함수
export async function ClassInfo() {
  const Day = GetDay();
  const Class = GetClass();

  if (Class === 0) {
    return {
      Day,
      Class: 0,
      hasClass: -1,
      message: "지금은 선택지 제공 시간이 아님"
    };
  }

  const hasClass = await ClassStatus(Day, Class);

  return {
    Day,
    Class,
    hasClass
  };
}
