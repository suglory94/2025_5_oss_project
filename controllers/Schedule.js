const asyncHandler = require("express-async-handler");
const UserSettings = require("../models/userSettingsModel");
const Schedule = require("../models/scheduleModel");

// 요일 맵핑 (CheckClass.js에서도 사용)
const WEEKDAYS_MAP = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4
};

// 시간표 + 초기 재정 저장
const saveInitialSettings = asyncHandler(async (req, res) => {
    const { schedule, initialBudget, timetable_array } = req.body;

    // 시간표 저장
    const savedSchedule = await Schedule.findOneAndUpdate(
        {},
        schedule,
        { upsert: true, new: true }
    );

    // 사용자 설정 저장
    const settings = await UserSettings.findOneAndUpdate(
        {},
        {
            initialBudget,
            currentBudget: initialBudget,
            weekStartDate: new Date(),
            timetableArray: timetable_array
        },
        { upsert: true, new: true }
    );

    res.status(201).json({
        message: "초기 설정 완료",
        schedule: savedSchedule,
        settings
    });
});

// 시간표 상태 조회
const checkScheduleStatus = asyncHandler(async (req, res) => {
    const { day, period } = req.body;
    
    // 저장된 시간표 배열 조회
    const settings = await UserSettings.findOne().select('timetableArray');
    
    // 데이터 유효성 및 초기 설정 확인
    if (!settings || !settings.timetableArray || settings.timetableArray.length === 0) {
        // 시간표 설정이 없거나 비어있으면 수업이 없다고 가정
        return res.status(200).json({ hasClass: false });
    }

    const timetableArray = settings.timetableArray;

    // 요일 및 교시를 배열 인덱스로 변환
    const dayIndex = WEEKDAYS_MAP[day];
    const periodIndex = period - 1;

    let hasClass = false;

    if (dayIndex !== undefined && dayIndex >= 0 && dayIndex <= 4 && periodIndex >= 0 && periodIndex <= 5) {
        if (timetableArray[dayIndex] && timetableArray[dayIndex][periodIndex] === 1) {
            hasClass = true;
        }
    }

    // 결과 반환
    return res.status(200).json({
        hasClass: hasClass
    });
});

module.exports = {
    saveInitialSettings,
    checkScheduleStatus
};