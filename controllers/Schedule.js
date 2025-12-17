const asyncHandler = require("express-async-handler");
const UserSettings = require("../models/userSettingsModel");
const Schedule = require("../models/scheduleModel");

const WEEKDAYS_MAP = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4
};

// 시간표 + 초기 재정 저장 (사용자별)
const saveInitialSettings = asyncHandler(async (req, res) => {
    const { schedule, initialBudget, timetable_array, userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    // 시간표 저장 (userId로 찾아서 업데이트 또는 생성)
    const savedSchedule = await Schedule.findOneAndUpdate(
        { userId },
        { userId, ...schedule },
        { upsert: true, new: true }
    );

    // 사용자 설정 저장
    const settings = await UserSettings.findOneAndUpdate(
        { userId },
        {
            userId,
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

// 시간표 상태 조회 (사용자별)
const checkScheduleStatus = asyncHandler(async (req, res) => {
    const { day, period, userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    const settings = await UserSettings.findOne({ userId }).select('timetableArray');

    if (!settings || !settings.timetableArray || settings.timetableArray.length === 0) {
        return res.status(200).json({ hasClass: false });
    }

    const timetableArray = settings.timetableArray;

    const dayIndex = WEEKDAYS_MAP[day];
    const periodIndex = period - 1;

    let hasClass = false;

    if (dayIndex !== undefined && dayIndex >= 0 && dayIndex <= 4 && periodIndex >= 0 && periodIndex <= 5) {
        if (timetableArray[dayIndex] && timetableArray[dayIndex][periodIndex] === 1) {
            hasClass = true;
        }
    }

    return res.status(200).json({
        hasClass: hasClass
    });
});

module.exports = {
    saveInitialSettings,
    checkScheduleStatus
};