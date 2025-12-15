const asyncHandler = require("express-async-handler");
const Schedule = require("../models/scheduleModel");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Branch = require("../models/branchModel");

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

// 설정 조회
const getSettings = asyncHandler(async (req, res) => {
    const settings = await UserSettings.findOne();
    const schedule = await Schedule.findOne();

    if (!settings || !schedule) {
        return res.status(404).json({ message: "초기 설정을 먼저 완료하세요" });
    }

    res.status(200).json({
        settings,
        schedule
    });
});

// 가장 가까운 수업 찾기
const findNextClassDetails = (scheduleDoc) => {
    const now = new Date();
    const currentDayJsIndex = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let currentDayDbIndex = -1;
    if (currentDayJsIndex >= 1 && currentDayJsIndex <= 5) {
        currentDayDbIndex = currentDayJsIndex - 1;
    }

    if (currentDayDbIndex === -1) {
        return null;
    }

    let minTimeDiffMs = Infinity;
    let nextClassDetails = null;

    for (let d = 0; d < 5; d++) {
        const checkDayDbIndex = d;
        const checkDayName = DAYS[checkDayDbIndex];

        const isToday = (checkDayDbIndex === currentDayDbIndex);
        const startMinuteCheck = isToday ? currentMinutes : timeToMinutes("08:59");

        const classesOnDay = scheduleDoc[checkDayName] || [];

        for (let period = 1; period <= 6; period++) {
            const periodTimes = PERIOD_TIMES[period];
            const startMinutes = timeToMinutes(periodTimes.start);

            const currentClass = classesOnDay.find(cls => {
                const classStartMinutes = timeToMinutes(cls.start);
                return classStartMinutes === startMinutes;
            });

            if (!currentClass) continue;

            // 수업 날짜 계산
            let classDate = new Date(now);

            let daysToAdd = checkDayDbIndex - currentDayDbIndex;
            if (daysToAdd < 0) daysToAdd += 5;

            classDate.setDate(now.getDate() + daysToAdd);
            classDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

            const timeDiffMs = classDate.getTime() - now.getTime();

            if (timeDiffMs > 0 && timeDiffMs < minTimeDiffMs) {
                minTimeDiffMs = timeDiffMs;
                nextClassDetails = {
                    day: checkDayDbIndex,
                    hour: Math.floor(startMinutes / 60),
                    minute: startMinutes % 60,
                    subject: currentClass.subject,
                    period: period
                };
            }
        }
    }

    return nextClassDetails;
}

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
                    // ... (수업 관련 옵션) ...
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

    // 4. 자유 시간
    const { choice } = require('../ai/choice');
    if (currentDay !== -1 && currentHour >= 8 && currentHour < 23) {
        // 가장 부족한 상태를 찾음 (choice.js가 필요로 함)
        const rawStats = await getRawStatsInternal();
        const calculatedWeakestState = getWeakestState(rawStats);

        // choice.js의 AI에게 2가지 선택지를 요청
        const aiChoices = await choice({
            period: currentPeriod || '자유',
            hasClass: isCurrentTimeClass,
            weakestState: calculatedWeakestState,
            currentStats: rawStats
        });

        if (aiChoices.choices && aiChoices.choices.length === 2) {
            // choice.js가 생성한 AI 선택지를 반환
            return res.status(200).json({
                day: currentDay,
                hour: currentHour,
                choiceType: "ai_branch", // 새로운 타입으로 설정
                question: aiChoices.message, // AI가 만든 상황 설명
                options: aiChoices.choices.map((c, index) => ({
                    value: `choice_${index === 0 ? 'A' : 'B'}`, // 선택지를 구별할 수 있는 value
                    label: c.label,
                    category: c.category, // AI 조언을 위해 카테고리 추가 (study|sleep|finance)
                    hasCost: true, // 임의로 비용을 받는다고 가정 (프론트에서 처리)
                    costPrompt: "활동 비용/수입은 얼마였나요?",
                    needsDescription: false
                }))
            });
        }
    }

    // 5. 모든 조건에 해당하지 않는 경우 (예: 주말, 새벽 7시 등)
    return res.status(200).json({
        day: currentDay, // 주말이면 -1
        hour: currentHour,
        choiceType: "rest",
        question: "현재는 활동 시간이 아니거나 주말입니다. 잠시 휴식하세요.",
        options: [
            { value: "rest_passive", label: "잠시 휴식하기", hasCost: false, costPrompt: null, needsDescription: false }
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
                // 참석 + 커피 안 사기
                { value: "attend", label: "커피 없이 수업 듣기", hasCost: false },
                // 참석 + 커피 사기
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
                // 결석 + 자기
                { value: "skip_sleep", label: "자기", hasCost: false },
                // 결석 + 놀기 (자유시간)
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
        // 사용자가 직접 입력한 설명
        description = customDescription;
    } else {
        // 자동 생성
        description = generateDescription(choiceType, choice, subject, cost);
    }

    const settings = await UserSettings.findOne();

    // 우주 상태 변화 계산
    const actualChanges = calculateStateChanges(choiceType, choice, cost, duration);

    // 1. 재정, 수면 시간 업데이트
    settings.currentBudget += actualChanges.financeChange; // cost 대신 financeChange 사용
    settings.totalSleepMinutes += actualChanges.sleepChangeMinutes; // 수면 시간 반영
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
        // 받은 배열(parallelChoices)의 각 항목을 순회하며 Branch를 생성합니다.
        for (const oppositeData of parallelChoices) {
            // Branch 모델에 저장할 데이터 구성
            const oppositeChoiceValue = oppositeData.value || "none";
            const oppositeCostValue = oppositeData.cost !== undefined ? oppositeData.cost : 0;
            const oppositeDuration = oppositeData.duration || 60;
            const category = oppositeData.category;

            // 상태 변화 계산 (category가 있으면 우선 사용)
            let oppositeChanges = { financeChange: 0, sleepChangeMinutes: 0, studyChangeMinutes: 0 };

            if (category === 'study' || category === 'grade') {
                oppositeChanges.studyChangeMinutes += oppositeDuration;
            } else if (category === 'sleep') {
                oppositeChanges.sleepChangeMinutes += oppositeDuration;
            } else if (category === 'finance') {
                // 재정은 cost로 처리되므로 추가 시간 변화 없음
            } else {
                // 카테고리가 없으면 기존 로직 사용
                oppositeChanges = calculateStateChanges(
                    choiceType,
                    oppositeChoiceValue,
                    oppositeCostValue,
                    oppositeDuration
                );
            }

            // 재정 변화 적용 (입력받은 cost 반영)
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


// 모든 선택 및 히스토리 초기화
const resetAllData = asyncHandler(async (req, res) => {
    await HourlyChoice.deleteMany({});
    await Branch.deleteMany({});

    // 설정 초기화 (예산, 수면, 학습 시간)
    const settings = await UserSettings.findOne();
    if (settings) {
        settings.currentBudget = settings.initialBudget;
        settings.totalSleepMinutes = 0;
        settings.totalStudyMinutes = 0;
        settings.weekStartDate = new Date();
        await settings.save();
    }

    res.status(200).json({
        message: "모든 데이터가 초기화되었습니다"
    });
});

// 설명 생성 함수
const generateDescription = (choiceType, choice, subject, cost) => {
    // cost 포함 설명
    const costText = cost > 0 ? `+${cost.toLocaleString()}원` : cost < 0 ? `${cost.toLocaleString()}원` : '';

    const descriptions = {
        class: {
            attend: `${subject} 수업을 듣는다`,
            attend_coffee: `${subject} 수업을 듣고 커피를 사서 간다 (${costText})`,
            skip_sleep: `${subject} 수업을 땡땡이 치고 잔다`,
            skip_play: `${subject} 수업을 땡땡이 치고 논다 (${costText})`
        },
        meal: {
            restaurant: `식당에서 밥을 먹는다 (${costText})`,
            cafeteria: `학식을 먹는다 (${costText})`,
            convenience: `편의점에서 간단히 먹는다 (${costText})`,
            skip: "밥을 거른다",
            custom: `식사 (${costText})`
        },
        sleep: {
            sleep: "잠을 잔다",
            stay_up: "밤을 새워 공부한다",
            stay_up_play: `밤을 새워 논다 (${costText})`
        },
        free_time: {
            study: "공부를 한다",
            exercise: "운동을 한다",
            hobby: `취미활동을 한다 (${costText})`,
            rest: "휴식을 취한다",
            part_time: `알바를 한다 (${costText})`,
            custom: `활동 (${costText})`
        }
    };

    return descriptions[choiceType]?.[choice] || `${choice} (${costText})`;
};

// 통계 조회
const getWeeklyStatistics = asyncHandler(async (req, res) => {
    const settings = await UserSettings.findOne();
    const schedule = await Schedule.findOne();
    const choices = await HourlyChoice.find().sort({ day: 1, hour: 1 });

    if (!settings || !schedule) {
        return res.status(404).json({ message: "데이터가 없습니다" });
    }

    // 1. 일수 계산
    const daysPassed = Math.ceil(
        (Date.now() - settings.weekStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 2. 평균 수면 시간 계산
    const averageSleepHours = daysPassed > 0
        ? (settings.totalSleepMinutes / 60 / daysPassed).toFixed(1)
        : 0;

    // 3. 출석률 계산
    const classChoices = choices.filter(c => c.choiceType === "class");
    const attendedClasses = classChoices.filter(
        c => c.choice === "attend" || c.choice === "attend_coffee"
    ).length;

    const totalClassHours = classChoices.length;
    const attendanceRate = totalClassHours > 0
        ? ((attendedClasses / totalClassHours) * 100).toFixed(1)
        : 0;

    // 4. 재정 분석
    const totalSpent = settings.initialBudget - settings.currentBudget;
    const dailyAverageSpent = daysPassed > 0
        ? Math.round(totalSpent / daysPassed)
        : 0;

    // 5. 활동 시간 집계
    const activities = {
        study: 0,
        exercise: 0,
        hobby: 0,
        rest: 0,
        partTime: 0
    };

    choices.forEach(c => {
        if (c.choice === "study") activities.study += c.duration;
        if (c.choice === "exercise") activities.exercise += c.duration;
        if (c.choice === "hobby") activities.hobby += c.duration;
        if (c.choice === "rest") activities.rest += c.duration;
        if (c.choice === "part_time") activities.partTime += c.duration;
    });

    // 분 -> 시간 변환
    Object.keys(activities).forEach(key => {
        activities[key] = (activities[key] / 60).toFixed(1);
    });

    res.status(200).json({
        period: {
            startDate: settings.weekStartDate,
            daysPassed
        },
        sleep: {
            averageHoursPerDay: parseFloat(averageSleepHours),
            totalMinutes: settings.totalSleepMinutes
        },
        attendance: {
            rate: parseFloat(attendanceRate),
            attended: attendedClasses,
            total: totalClassHours
        },
        budget: {
            initial: settings.initialBudget,
            current: settings.currentBudget,
            spent: totalSpent,
            dailyAverage: dailyAverageSpent
        },
        activities: {
            study: parseFloat(activities.study),
            exercise: parseFloat(activities.exercise),
            hobby: parseFloat(activities.hobby),
            rest: parseFloat(activities.rest),
            partTime: parseFloat(activities.partTime)
        }
    });
});

// 히스토리 조회 (실제 우주 + 평행 우주)
const getWeeklyHistory = asyncHandler(async (req, res) => {
    const choices = await HourlyChoice.find().sort({ day: 1, hour: 1 });
    const branches = await Branch.find().sort({ day: 1, hour: 1 });

    res.status(200).json({
        actual_universe: choices,
        parallel_universe: branches
    });
});

// 특정 날짜의 선택 조회
const getDailyChoices = asyncHandler(async (req, res) => {
    const { day } = req.params;

    const choices = await HourlyChoice.find({ day: parseInt(day) }).sort({ hour: 1 });
    const branches = await Branch.find({ day: parseInt(day) }).sort({ hour: 1 });

    res.status(200).json({
        day: parseInt(day),
        choices,
        branches
    });
});

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

// 선택 수정
const updateChoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { choice, cost } = req.body;

    const hourlyChoice = await HourlyChoice.findById(id);

    if (!hourlyChoice) {
        return res.status(404).json({ message: "선택을 찾을 수 없습니다" });
    }

    // 재정 재계산
    const settings = await UserSettings.findOne();
    // 수면 시간 업데이트를 위해 기존 비용과 수면 시간을 롤백해야 함
    if (hourlyChoice.choice === "sleep") {
        settings.totalSleepMinutes -= hourlyChoice.duration;
    }
    settings.currentBudget -= hourlyChoice.cost;
    settings.currentBudget += cost;

    // 선택 업데이트
    hourlyChoice.choice = choice;
    hourlyChoice.cost = cost;
    hourlyChoice.description = generateDescription(
        hourlyChoice.choiceType,
        choice,
        hourlyChoice.subject,
        cost
    );

    await hourlyChoice.save();
    await settings.save();

    // 평행우주 업데이트
    if (hourlyChoice.choiceType !== "ai_branch") {
        const { oppositeChoice, oppositeCost, oppositeDescription } = await generateOpposite(
            hourlyChoice.choiceType,
            choice,
            cost,
            hourlyChoice.subject
        );

        await Branch.updateOne(
            { day: hourlyChoice.day, hour: hourlyChoice.hour },
            {
                oppositeChoice,
                oppositeCost,
                oppositeDescription
            }
        );
    }

    res.status(200).json({
        message: "선택이 수정되었습니다",
        choice: hourlyChoice,
        currentBudget: settings.currentBudget
    });
});

// 선택 삭제
const deleteChoice = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const choice = await HourlyChoice.findById(id);

    if (!choice) {
        return res.status(404).json({ message: "선택을 찾을 수 없습니다" });
    }

    // 재정 롤백
    const settings = await UserSettings.findOne();
    settings.currentBudget -= choice.cost;
    await settings.save();

    // 선택 삭제
    await HourlyChoice.findByIdAndDelete(id);

    // 평행우주 삭제
    await Branch.deleteOne({ day: choice.day, hour: choice.hour });

    res.status(200).json({
        message: "선택이 삭제되었습니다",
        currentBudget: settings.currentBudget
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

// 상태 변화 계산 함수
const calculateStateChanges = (choiceType, choice, cost, duration = 60) => {
    let financeChange = 0;
    let sleepChangeMinutes = 0;
    let studyChangeMinutes = 0;

    // 1. 재정 변화는 입력된 cost를 사용
    financeChange -= cost;

    // 2. 학습/수면 시간 변화 (임의의 로직 적용)
    switch (choiceType) {
        case 'class':
            switch (choice) {
                case 'attend':
                case 'attend_coffee':
                    studyChangeMinutes += duration; // 수업 시간만큼 학습 시간 증가
                    break;
                case 'skip_sleep':
                    sleepChangeMinutes += duration; // 수업 시간만큼 수면 시간 증가
                    break;
                case 'skip_play':
                    studyChangeMinutes -= 10; // 수업을 안 들었으니 약간의 패널티
                    break;
            }
            break;
        case 'sleep':
            switch (choice) {
                case 'sleep':
                    sleepChangeMinutes += duration; // 수면 시간 증가
                    break;
                case 'stay_up':
                    studyChangeMinutes += duration; // 밤샘 공부 시간만큼 학습 시간 증가
                    sleepChangeMinutes -= duration; // 수면 시간 감소
                    break;
                case 'stay_up_play':
                    studyChangeMinutes -= 20; // 놀았으니 학습 패널티
                    sleepChangeMinutes -= duration; // 수면 시간 감소
                    break;
            }
            break;
        case 'ai_branch':
        case 'free_time':
            // AI 또는 자유 시간 선택의 경우
            switch (choice) {
                case 'study':
                case 'choice_A': // 선택 A, B가 공부/수면/재정 중 하나에 기여한다고 가정
                    studyChangeMinutes += duration;
                    break;
                case 'sleep':
                case 'choice_B': // 평행 선택
                    sleepChangeMinutes += duration;
                    break;
                case 'rest':
                    sleepChangeMinutes += duration / 2; // 휴식은 수면 시간의 절반 정도 기여
                    break;
                case 'part_time':
                    // 재정 변화는 cost로 이미 반영됨
                    break;
                // 기타 선택지에 따른 추가 로직...
            }
            break;
        // meal이나 기타 선택지는 큰 변화가 없다고 가정
    }

    // 시간당 획득/손실 점수를 간단하게 분 단위로 반영
    return {
        financeChange,
        sleepChangeMinutes,
        studyChangeMinutes
    };
};

module.exports = {
    saveInitialSettings,
    getSettings,
    getHourlyQuestion,
    saveHourlyChoice,
    getHourlyBranchQuestion,
    getWeeklyStatistics,
    getWeeklyHistory,
    getDailyChoices,
    getRawStats,
    getRawStatsInternal,
    getWeakestState,
    updateChoice,
    deleteChoice,
    checkScheduleStatus,
    resetAllData
};