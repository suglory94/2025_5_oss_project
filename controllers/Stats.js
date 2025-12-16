const asyncHandler = require("express-async-handler");


// 값 상태 (재정, 수면 시간, 학습 시간)
const getRawStatsInternal = async () => {
    const settings = await UserSettings.findOne();
    const choices = (await HourlyChoice.find()).toSorted({ day: 1, hour: 1 });
    const scheduleDoc = await Schedule.findOne();

    if (!settings || !scheduleDoc) return null;

    const now = new Date();
    const daysPassed = Math.ceil(
        (now.getTime() - settings.weekStartData.getTime()) / (1000 * 60 * 60 * 24)
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

    // 🌟 순공 시간 기반 학습 점수 계산 (사용자 요청 반영)
    const totalStudyMinutes = settings.totalStudyMinutes;
    const averageStudyHours = (totalStudyMinutes / 60) / daysPassed; // 일 평균 순공 시간 (시간 단위)
    const targetAverageStudyHours = 5; // 목표 일 평균 순공 시간 (예시: 5시간)
    const maxScore = 100;
    const minScore = 10;
    const baseScore = 50; // 기본 점수 (0시간일 때 시작 점수)

    let studyScore;

    if (averageStudyHours >= targetAverageStudyHours) {
        studyScore = maxScore;
    } else {
        studyScore = baseScore + (averageStudyHours * (maxScore - baseScore) / targetAverageStudyHours);
    }

    // 점수 범위 제한 (10점 ~ 100점)
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
    let minScore = scores.grade;

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