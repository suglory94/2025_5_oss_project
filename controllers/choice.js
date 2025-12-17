const asyncHandler = require("express-async-handler");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Branch = require("../models/branchModel");
const Schedule = require("../models/scheduleModel");

const {
    findNextClassDetails,
    timeToMinutes,
    DAYS
} = require("./CheckClass");

const { getRawStatsInternal, getWeakestState } = require("./Stats");
const { calculateStateChanges } = require("./history");
const { generateDescription, generateOpposite } = require("./setting");
const { choiceForfreetime } = require("../ai/choiceByai");

/**
 * 시간별 질문 생성 (사용자별)
 */
const getHourlyQuestion = asyncHandler(async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    const now = new Date();
    const currentDayJsIndex = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentHour = now.getHours();

    const currentDay =
        currentDayJsIndex >= 1 && currentDayJsIndex <= 5
            ? currentDayJsIndex - 1
            : -1;

    const userSettings = await UserSettings.findOne({ userId });
    const scheduleDoc = await Schedule.findOne({ userId });

    if (!userSettings || !scheduleDoc) {
        return res.status(404).json({ message: "초기 설정을 먼저 완료하세요" });
    }

    /**
     * 1️⃣ 다음 교시 기준 수업 질문
     */
    const nextPeriodInfo = findNextClassDetails(scheduleDoc);

    if (nextPeriodInfo && nextPeriodInfo.subject) {
        const { day, hour, minute, subject, period } = nextPeriodInfo;

        const existingChoice = await HourlyChoice.findOne({ userId, day, hour });
        if (existingChoice) {
            return res.status(200).json({
                message: `다음 ${period}교시(${subject})는 이미 선택을 완료했습니다.`,
                existingChoice
            });
        }

        return res.status(200).json({
            day,
            hour,
            choiceType: "class",
            question: `${day === currentDay ? "다음" : "내일"
                } ${period}교시 ${subject} 수업이 곧 시작됩니다 (${hour}:${String(minute).padStart(
                    2,
                    "0"
                )}). 어떻게 하시겠습니까?`,
            options: [
                { value: "attend_base", label: "수업 듣기", hasCost: false },
                { value: "skip_base", label: "수업 결석", hasCost: false }
            ],
            subject
        });
    }

    /**
     * 2️⃣ 이미 선택한 시간인지 확인
     */
    if (currentDay !== -1) {
        const existingChoice = await HourlyChoice.findOne({
            userId,
            day: currentDay,
            hour: currentHour
        });

        if (existingChoice) {
            return res.status(200).json({
                message: "이미 선택한 시간입니다",
                existingChoice
            });
        }
    }

    if (nextPeriodInfo && !nextPeriodInfo.subject) {
        try {
            const rawStats = await getRawStatsInternal(userId);
            const weakestState = getWeakestState(rawStats);

            const aiChoices = await choiceForfreetime({
                rawStats,
                weakestState
            });

            if (aiChoices && aiChoices.choices?.length === 2) {
                return res.status(200).json({
                    day: nextPeriodInfo.day,
                    hour: nextPeriodInfo.hour,
                    choiceType: "ai_branch",
                    question: aiChoices.message,
                    options: aiChoices.choices.map(c => {
                        let hasCost = false;
                        let costPrompt = null;

                        if (c.category === "finance") {
                            hasCost = true;

                            const isIncome =
                                c.label.includes("알바") ||
                                c.label.includes("아르바이트") ||
                                c.label.includes("근무") ||
                                c.label.includes("벌") ||
                                c.label.includes("과외") ||
                                c.label.includes("일한다") ||
                                c.label.includes("일을") ||
                                c.label.includes("배달") ||
                                c.label.includes("장학");

                            costPrompt = isIncome
                                ? "얼마를 벌었나요? (양수 입력)"
                                : "얼마를 썼나요? (양수 입력)";
                        }

                        return {
                            value: c.label,
                            label: c.label,
                            category: c.category,
                            hasCost,
                            costPrompt
                        };
                    })
                });
            }
        } catch (err) {
            console.error("AI 질문 생성 실패:", err.message);
        }

        return res.status(200).json({
            day: nextPeriodInfo.day,
            hour: nextPeriodInfo.hour,
            choiceType: "free_time",
            question: "자유 시간입니다. 무엇을 하시겠습니까?",
            options: [
                { value: "study", label: "공부하기", hasCost: false, category: "study" },
                { value: "exercise", label: "운동하기", hasCost: false, category: "sleep" },
                {
                    value: "hobby",
                    label: "취미활동",
                    hasCost: true,
                    costPrompt: "얼마를 썼나요?",
                    category: "finance"
                },
                { value: "rest", label: "휴식", hasCost: false, category: "sleep" },
                {
                    value: "part_time",
                    label: "알바하기",
                    hasCost: true,
                    costPrompt: "얼마를 벌었나요?",
                    category: "finance"
                }
            ]
        });
    }
});

/**
 * 수업 선택 2단계 분기 (사용자별)
 */
const getHourlyBranchQuestion = asyncHandler(async (req, res) => {
    const { day, hour, subject, baseChoice, userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    if (baseChoice === "attend_base") {
        return res.status(200).json({
            day,
            hour,
            choiceType: "class",
            subject,
            question: "수업에 참석하기로 했습니다. 커피는 사시겠습니까?",
            options: [
                { value: "attend", label: "커피 없이 수업 듣기", hasCost: false },
                {
                    value: "attend_coffee",
                    label: "커피 사서 수업 듣기",
                    hasCost: true,
                    costPrompt: "커피 값은 얼마였나요?"
                }
            ],
            isFinalBranch: true
        });
    }

    if (baseChoice === "skip_base") {
        return res.status(200).json({
            day,
            hour,
            choiceType: "class",
            subject,
            question: "수업을 결석하기로 했습니다. 무엇을 하시겠습니까?",
            options: [
                { value: "skip_sleep", label: "자기", hasCost: false },
                {
                    value: "skip_play",
                    label: "놀기",
                    hasCost: true,
                    costPrompt: "얼마를 소비했나요?"
                }
            ],
            isFinalBranch: true
        });
    }

    return res.status(400).json({ message: "유효하지 않은 분기 선택입니다." });
});

/**
 * 선택 저장 (사용자별 평행우주 로직)
 */
const saveHourlyChoice = asyncHandler(async (req, res) => {
    const {
        userId,
        day,
        hour,
        choiceType,
        choice,
        subject,
        cost,
        duration = 75,
        customDescription,
        parallelChoices,
        category
    } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    console.log('📥 받은 데이터:', { userId, choice, category, cost });

    if (cost === undefined || cost === null) {
        return res.status(400).json({ message: "비용을 입력해주세요" });
    }

    // 1. 실제 우주 저장
    const changes = calculateStateChanges(choiceType, choice, cost, duration, category);
    console.log('📊 계산된 변화량:', changes);

    const description =
        customDescription ||
        generateDescription(choiceType, choice, subject, changes.financeChange);

    const settings = await UserSettings.findOne({ userId });
    if (!settings) {
        return res.status(404).json({ message: "사용자 설정을 찾을 수 없습니다" });
    }

    settings.currentBudget += changes.financeChange;
    settings.totalSleepMinutes += changes.sleepChangeMinutes;
    settings.totalStudyMinutes += changes.studyChangeMinutes;
    await settings.save();

    const savedChoice = await HourlyChoice.create({
        userId,
        day,
        hour,
        choiceType,
        choice,
        subject,
        cost,
        duration,
        description,
        ...changes
    });

    // 2. 평행우주 저장
    if (choiceType !== "ai_branch") {
        const { oppositeChoice, oppositeCost, oppositeDescription } = await generateOpposite(
            choiceType,
            choice,
            cost,
            subject
        );

        const oppositeChanges = calculateStateChanges(
            choiceType,
            oppositeChoice,
            oppositeCost,
            duration
        );

        await Branch.create({
            userId,
            day,
            hour,
            choiceType,
            oppositeChoice,
            oppositeCost,
            oppositeDescription,
            oppositeFinanceChange: oppositeChanges.financeChange,
            oppositeSleepChangeMinutes: oppositeChanges.sleepChangeMinutes,
            oppositeStudyChangeMinutes: oppositeChanges.studyChangeMinutes
        });
    } else if (parallelChoices && parallelChoices.length > 0) {
        for (const parallelOption of parallelChoices) {
            const parallelChanges = calculateStateChanges(
                choiceType,
                parallelOption.label,
                parallelOption.cost || 0,
                duration,
                parallelOption.category
            );

            await Branch.create({
                userId,
                day,
                hour,
                choiceType,
                oppositeChoice: parallelOption.label,
                oppositeCost: parallelOption.cost || 0,
                oppositeDescription: parallelOption.label,
                oppositeFinanceChange: parallelChanges.financeChange,
                oppositeSleepChangeMinutes: parallelChanges.sleepChangeMinutes,
                oppositeStudyChangeMinutes: parallelChanges.studyChangeMinutes
            });
        }
    }

    // 3. 현재 점수 계산
    const currentStats = await getRawStatsInternal(userId);

    res.status(201).json({
        message: "선택이 저장되었습니다",
        actual_universe: {
            choice,
            description,
            ...changes,
            currentBudget: settings.currentBudget
        },
        currentScores: {
            finance: currentStats.finance,
            study: currentStats.grade,
            sleep: currentStats.sleep
        }
    });
});

module.exports = {
    getHourlyQuestion,
    getHourlyBranchQuestion,
    saveHourlyChoice
};