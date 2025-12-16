const asyncHandler = require("express-async-handler");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Schedule = require("../models/scheduleModel");

// 값 상태 (재정, 수면 시간, 학습 시간)
const getRawStatsInternal = async () => {
    const settings = await UserSettings.findOne();
    const choices = await HourlyChoice.find().sort({ day: 1, hour: 1 });
    const scheduleDoc = await Schedule.findOne();

    if (!settings || !scheduleDoc) return null;

    const now = new Date();
    // weekStartData -> weekStartDate 수정
    const daysPassed = Math.ceil(
        (now.getTime() - settings.weekStartDate.getTime()) / (1000 * 60 * 60 * 24)
    ) || 1;

    // 재정 계산
    const initialBudget = settings.initialBudget;
    const currentBudget = settings.currentBudget;
    const budgetRatio = currentBudget / initialBudget;
    const financeScore = Math.min(100, Math.max(10, Math.round(budgetRatio * 100)));

    // 수면 시간 계산
    const targetSleepMinutes = 7 * 60;
    const averageSleepMinutes = settings.totalSleepMinutes / daysPassed;

    let sleepScore;
    if (averageSleepMinutes >= targetSleepMinutes) {
        sleepScore = 100;
    }
    else if (averageSleepMinutes >= 300) {
        sleepScore = Math.round(50 + (averageSleepMinutes - 300) / 120 * 50);
    }
    else {
        sleepScore = Math.round(30 + averageSleepMinutes / 300 * 20);
    }
    sleepScore = Math.min(100, Math.max(10, sleepScore));

    // 순공 시간 기반 학습 점수 계산
    const totalStudyMinutes = settings.totalStudyMinutes || 0;
    const averageStudyHours = (totalStudyMinutes / 60) / daysPassed;
    const targetAverageStudyHours = 5;
    const maxScore = 100;
    const minScore = 10;
    const baseScore = 50;

    let studyScore;

    if (averageStudyHours >= targetAverageStudyHours) {
        studyScore = maxScore;
    } else {
        studyScore = baseScore + (averageStudyHours * (maxScore - baseScore) / targetAverageStudyHours);
    }

    studyScore = Math.min(maxScore, Math.max(minScore, Math.round(studyScore)));

    const studyStatusScore = studyScore;

    return {
        grade: studyStatusScore,
        sleep: sleepScore,
        finance: financeScore
    };
};

// 학습 시간, 수면, 재정 상태 조회
const getRawStats = asyncHandler(async (req, res) => {
    const rawStats = await getRawStatsInternal();

    if (!rawStats) {
        return res.status(404).json({ message: "초기 설정 데이터가 없습니다" });
    }

    res.status(200).json(rawStats);
});

// 가장 부족한 상태 찾기
const getWeakestState = (rawStats) => {
    if (!rawStats) return 'grade';

    const scores = {
        study: rawStats.grade,
        sleep: rawStats.sleep,
        finance: rawStats.finance
    };

    let weakestState = 'grade';
    let minScore = scores.study;

    for (const [state, score] of Object.entries(scores)) {
        if (score < minScore) {
            minScore = score;
            weakestState = state;
        }
    }

    return weakestState;
};

module.exports = {
    getRawStats,
    getRawStatsInternal,
    getWeakestState,
};