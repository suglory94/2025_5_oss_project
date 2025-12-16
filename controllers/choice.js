const asyncHandler = require("express-async-handler");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Branch = require("../models/branchModel");
const Schedule = require("../models/scheduleModel");

// CheckClass.js에서 함수들 import (같은 controllers 폴더에 있다고 가정)
const {
    findNextClassDetails,
    checkClassStatusFromArray,
    getCurrentPeriod,
    timeToMinutes,
    DAYS,
    PERIOD_TIMES
} = require("./CheckClass");

// Stats.js에서 함수들 import
const { getRawStatsInternal, getWeakestState } = require("./Stats");

// history.js에서 함수 import
const { calculateStateChanges } = require("./history");

// setting.js에서 함수 import
const { generateDescription } = require("./setting");
const { choiceForfreetime } = require("../ai/choiceByai");

// 시간별 선택 질문 생성
const getHourlyQuestion = asyncHandler(async (req, res) => {
    const now = new Date();
    const currentDayJsIndex = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 현재 요일
    const currentDay = (currentDayJsIndex >= 1 && currentDayJsIndex <= 5) ? currentDayJsIndex - 1 : -1;
    const currentHour = now.getHours();
    const currentPeriod = getCurrentPeriod(currentMinutes); // 현재 교시 번호

    const userSettings = await UserSettings.findOne();
    const scheduleDoc = await Schedule.findOne();

    if (!userSettings || !scheduleDoc) {
        return res.status(404).json({ message: "초기 설정을 먼저 완료하세요" });
    }

    // 가장 가까운 수업 찾기
    const closestClass = findNextClassDetails(scheduleDoc);

    if (closestClass) {
        const { day, hour, minute, subject } = closestClass;

        const existingChoice = await HourlyChoice.findOne({ day, hour });
        if (existingChoice) {
            return res.status(200).json({
                message: `가장 가까운 수업(${subject}, ${DAYS[day]} ${hour}시)은 이미 선택을 완료했습니다. 다음 이벤트를 선택하세요.`,
                existingChoice
            });
        }

        return res.status(200).json({
            day,
            hour,
            choiceType: "class",
            question: `${subject} 수업이 곧 시작됩니다 (${hour}:${String(minute).padStart(2, '0')}). 어떻게 하시겠습니까?`,
            options: [
                { value: "attend_base", label: "수업 듣기", hasCost: false },
                { value: "skip_base", label: "수업 결석", hasCost: false },
            ],
            subject: subject
        });
    }

    // 가까운 수업이 없는 경우 : 현재 시간을 기준으로 식사 / 수면 / 자유 시간 로직
    // 선택된 시간인지 확인
    if (currentDay !== -1) {
        const existingChoice = await HourlyChoice.findOne({ day: currentDay, hour: currentHour });
        if (existingChoice) {
            return res.status(200).json({
                message: "이미 선택한 시간입니다",
                existingChoice
            });
        }

        const isCurrentTimeClass = currentPeriod !== null && checkClassStatusFromArray(userSettings.timetableArray, currentDay, currentPeriod);

        if (isCurrentTimeClass) {
            const currentDayName = DAYS[currentDay];
            const classesOnDay = scheduleDoc[currentDayName] || [];
            const periodTimes = PERIOD_TIMES[currentPeriod];

            const currentClassDetail = classesOnDay.find(cls => {
                const classStartMinutes = timeToMinutes(cls.start);
                return classStartMinutes === timeToMinutes(periodTimes.start);
            });

            const subject = currentClassDetail ? currentClassDetail.subject : "수업";

            return res.status(200).json({
                day: currentDay,
                hour: currentHour,
                choiceType: "class",
                question: `현재 ${currentPeriod}교시 ${subject} 수업 중입니다.`,
                options: [
                    { value: "attend", label: "수업 듣기", hasCost: false },
                    { value: "attend_coffee", label: "수업 듣고 커피 사기", hasCost: true, costPrompt: "커피 값은 얼마였나요" },
                    { value: "skip_sleep", label: "결석하고 자기", hasCost: false },
                    { value: "skip_play", label: "결석하고 놀기", hasCost: true, costPrompt: "얼마를 소비했나요:" }
                ],
                subject: subject
            });
        }
    }

    // 2. 식사 시간인 경우 (12시, 18시)
    if (currentHour === 12 || currentHour === 18) {
        return res.status(200).json({
            day: currentDay,
            hour: currentHour,
            choiceType: "meal",
            question: `${currentHour === 12 ? '점심' : '저녁'} 시간입니다. 어떻게 드시겠습니까?`,
            options: [
                { value: "restaurant", label: "식당에서 먹기", hasCost: true, costPrompt: "식사 비용은 얼마였나요?" },
                { value: "cafeteria", label: "학식 먹기", hasCost: true, costPrompt: "학식 비용은 얼마였나요?" },
                { value: "convenience", label: "편의점", hasCost: true, costPrompt: "얼마를 썼나요?" },
                { value: "skip", label: "안 먹기", hasCost: false },
                { value: "custom", label: "기타", hasCost: true, costPrompt: "무엇을 먹었고 얼마를 썼나요?", needsDescription: true }
            ]
        });
    }

    // 3. 수면시간
    if (currentHour >= 23 || currentHour < 8) {
        return res.status(200).json({
            day: currentDay,
            hour: currentHour,
            choiceType: "sleep",
            question: "수면 시간입니다.",
            options: [
                { value: "sleep", label: "자기", hasCost: false },
                { value: "stay_up", label: "밤샘 공부", hasCost: false },
                { value: "stay_up_play", label: "밤샘 놀기", hasCost: true, costPrompt: "얼마 썼나요?" }
            ]
        });
    }

    // 4. 자유 시간 - AI 선택지 생성
    if (currentDay !== -1 && currentHour >= 8 && currentHour < 23) {
        try {
            // 가장 부족한 상태를 찾음
            const rawStats = await getRawStatsInternal();
            const calculatedWeakestState = getWeakestState(rawStats);

            // AI 모듈 import
            const { choiceForfreetime } = require('../ai/choiceByai');
            
            // AI에게 선택지 요청
            const aiChoices = await choiceForfreetime({
                rawStats: rawStats,
                weakestState: calculatedWeakestState
            });

            // AI가 정상적으로 선택지를 생성한 경우
            if (aiChoices && aiChoices.choices && aiChoices.choices.length === 2) {
                return res.status(200).json({
                    day: currentDay,
                    hour: currentHour,
                    choiceType: "ai_branch",
                    question: aiChoices.message,
                    options: aiChoices.choices.map((c, index) => {
                        // 카테고리별로 hasCost와 costPrompt 설정
                        let hasCost = false;
                        let costPrompt = null;

                        // AI가 생성한 label을 분석해서 알바/수입 관련인지 확인
                        const isIncomeActivity = c.label.includes('알바') || 
                                                c.label.includes('아르바이트') || 
                                                c.label.includes('일') ||
                                                c.label.includes('벌');

                        switch (c.category) {
                            case 'study':
                                // 공부: 비용 입력 없음
                                hasCost = false;
                                break;
                            case 'sleep':
                                // 수면: 비용 입력 없음
                                hasCost = false;
                                break;
                            case 'finance':
                                // 재정: 비용/수입에 따라 다르게 표시
                                hasCost = true;
                                if (isIncomeActivity) {
                                    costPrompt = "얼마를 벌었나요? (양수로 입력, 예: 5000)";
                                } else {
                                    costPrompt = "얼마를 썼나요? (음수로 입력, 예: -5000)";
                                }
                                break;
                        }

                        return {
                            value: `choice_${index === 0 ? 'A' : 'B'}`,
                            label: c.label,
                            category: c.category,
                            hasCost: hasCost,
                            costPrompt: costPrompt
                        };
                    })
                });
            }
        } catch (error) {
            // AI 모듈이 없거나 오류가 발생한 경우
            console.log('AI module error:', error.message);
            console.log('Using default choices');
        }

        // AI 모듈이 없거나 오류가 발생한 경우 기본 자유시간 선택지
        return res.status(200).json({
            day: currentDay,
            hour: currentHour,
            choiceType: "free_time",
            question: "자유 시간입니다. 무엇을 하시겠습니까?",
            options: [
                { value: "study", label: "공부하기", hasCost: false },
                { value: "exercise", label: "운동하기", hasCost: false },
                { value: "hobby", label: "취미활동", hasCost: true, costPrompt: "얼마를 썼나요? (음수로 입력, 예: -5000)" },
                { value: "rest", label: "휴식", hasCost: false },
                { value: "part_time", label: "알바하기", hasCost: true, costPrompt: "얼마를 벌었나요? (양수로 입력)" }
            ]
        });
    }

    // 5. 모든 조건에 해당하지 않는 경우 (예: 주말, 새벽 7시 등)
    return res.status(200).json({
        day: currentDay,
        hour: currentHour,
        choiceType: "rest",
        question: "현재는 활동 시간이 아니거나 주말입니다. 잠시 휴식하세요.",
        options: [
            { value: "rest_passive", label: "잠시 휴식하기", hasCost: false }
        ]
    });
});

// 분기된 2단계 질문을 반환
const getHourlyBranchQuestion = asyncHandler(async (req, res) => {
    const {
        day,
        hour,
        subject,
        baseChoice
    } = req.body;

    if (baseChoice === "attend_base") {
        return res.status(200).json({
            day,
            hour,
            choiceType: "class",
            subject,
            question: `수업에 참석하기로 했습니다. 커피는 사시겠습니까?`,
            options: [
                { value: "attend", label: "커피 없이 수업 듣기", hasCost: false },
                { value: "attend_coffee", label: "커피 사서 수업 듣기", hasCost: true, costPrompt: "커피 값은 얼마였나요?" }
            ],
            isFinalBranch: true
        });
    }
    else if (baseChoice === "skip_base") {
        return res.status(200).json({
            day,
            hour,
            choiceType: "class",
            subject,
            question: `수업을 결석하기로 했습니다. 무엇을 하시겠습니까?`,
            options: [
                { value: "skip_sleep", label: "자기", hasCost: false },
                { value: "skip_play", label: "놀기 (자유시간)", hasCost: true, costPrompt: "얼마를 소비했나요:" }
            ],
            isFinalBranch: true
        });
    }
    return res.status(400).json({ message: "유효하지 않은 분기 선택입니다." });
});

// 선택 저장
const saveHourlyChoice = asyncHandler(async (req, res) => {
    const {
        day,
        hour,
        choiceType,
        choice,
        subject,
        cost,
        duration = 60,
        customDescription,
        parallelChoices,
        parallelCost = 0,
        parallelDescription
    } = req.body;

    // cost가 없으면 에러
    if (cost === undefined || cost === null) {
        return res.status(400).json({
            message: "비용을 입력해주세요",
            error: "cost is required"
        });
    }

    // 설명 생성
    let description;
    if (customDescription) {
        description = customDescription;
    } else {
        description = generateDescription(choiceType, choice, subject, cost);
    }

    const settings = await UserSettings.findOne();

    // 우주 상태 변화 계산
    const actualChanges = calculateStateChanges(choiceType, choice, cost, duration);

    // 1. 재정, 수면 시간 업데이트
    settings.currentBudget += actualChanges.financeChange;
    settings.totalSleepMinutes += actualChanges.sleepChangeMinutes;
    settings.totalStudyMinutes += actualChanges.studyChangeMinutes;

    await settings.save();

    // 2. 선택 저장
    const hourlyChoice = await HourlyChoice.create({
        day,
        hour,
        choiceType,
        choice,
        subject,
        cost,
        duration,
        description,
        sleepChangeMinutes: actualChanges.sleepChangeMinutes,
        studyChangeMinutes: actualChanges.studyChangeMinutes,
        financeChange: actualChanges.financeChange
    });

    // 3. 평행우주 생성
    const savedBranches = [];
    if (parallelChoices && Array.isArray(parallelChoices)) {
        for (const oppositeData of parallelChoices) {
            const oppositeChoiceValue = oppositeData.value || "none";
            const oppositeCostValue = oppositeData.cost !== undefined ? oppositeData.cost : 0;
            const oppositeDuration = oppositeData.duration || 60;
            const category = oppositeData.category;

            // 상태 변화 계산
            let oppositeChanges = { financeChange: 0, sleepChangeMinutes: 0, studyChangeMinutes: 0 };

            if (category === 'study' || category === 'grade') {
                oppositeChanges.studyChangeMinutes += oppositeDuration;
            } else if (category === 'sleep') {
                oppositeChanges.sleepChangeMinutes += oppositeDuration;
            } else if (category === 'finance') {
                // 재정은 cost로 처리
            } else {
                oppositeChanges = calculateStateChanges(
                    choiceType,
                    oppositeChoiceValue,
                    oppositeCostValue,
                    oppositeDuration
                );
            }

            // 재정 변화 적용
            oppositeChanges.financeChange -= oppositeCostValue;

            const branch = await Branch.create({
                day,
                hour,
                choiceType,
                oppositeChoice: oppositeChoiceValue,
                oppositeCost: oppositeCostValue,
                oppositeDescription: oppositeData.description || `(평행우주) ${oppositeChoiceValue}`,
                oppositeSleepChangeMinutes: oppositeChanges.sleepChangeMinutes,
                oppositeStudyChangeMinutes: oppositeChanges.studyChangeMinutes,
                oppositeFinanceChange: oppositeChanges.financeChange
            });

            savedBranches.push(branch);
        }
    }

    // 5. 응답
    res.status(201).json({
        message: "선택이 저장되었습니다",
        actual_universe: {
            choice,
            description,
            cost: actualChanges.financeChange,
            sleepChangeMinutes: actualChanges.sleepChangeMinutes,
            studyChangeMinutes: actualChanges.studyChangeMinutes,
            currentBudget: settings.currentBudget
        },
        parallel_universe: savedBranches.map(b => ({
            choice: b.oppositeChoice,
            description: b.oppositeDescription,
            cost: b.oppositeCost,
            sleepChangeMinutes: b.oppositeSleepChangeMinutes,
            studyChangeMinutes: b.oppositeStudyChangeMinutes
        }))
    });
});

module.exports = {
    getHourlyQuestion,
    saveHourlyChoice,
    getHourlyBranchQuestion
};