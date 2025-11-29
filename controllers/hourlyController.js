const asyncHandler = require("express-async-handler");
const Schedule = require("../models/scheduleModel");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Branch = require("../models/branchModel");

const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 시간표 + 초기 재정 저장
const saveInitialSettings = asyncHandler(async (req, res) => {
    const { schedule, initialBudget } = req.body;

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
            weekStartDate: new Date()
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

// 시간별 선택 질문 생성
const getHourlyQuestion = asyncHandler(async (req, res) => {
    const { day, hour } = req.body;

    const userSettings = await UserSettings.findOne();
    const scheduleDoc = await Schedule.findOne();

    if (!userSettings || !scheduleDoc) {
        return res.status(404).json({ message: "초기 설정을 먼저 완료하세요" });
    }

    // 선택된 시간인지 확인
    const existingChoice = await HourlyChoice.findOne({ day, hour });
    if (existingChoice) {
        return res.status(200).json({
            message: "이미 선택한 시간입니다",
            existingChoice
        });
    }

    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = days[day];
    const classesOnDay = scheduleDoc[dayName] || [];

    // 현재 시간 HH : MM
    const currentTime = `${String(hour).padStart(2, '0')}:00`;

    // 1. 수업 시간인 경우
    let currentClass = null;
    for (let cls of classesOnDay) {
        const startHour = parseInt(cls.start.split(':')[0]);
        const endHour = parseInt(cls.end.split(':')[0]);

        if (hour >= startHour && hour < endHour) {
            currentClass = cls;
            break;
        }
    }

    if (currentClass) {
        return res.status(200).json({
            day,
            hour,
            choiceType: "class",
            question: `${currentClass.subject} 수업이 있습니다. 어떻게 하시겠습니까?`,
            options: [
                { value: "attend", label: "수업 듣기", hasCost: false },
                { value: "attend_coffee", label: "수업 듣고 커피 사기", hasCost: true, costPrompt: "커피 값은 얼마였나요?" },
                { value: "skip_sleep", label: "결석하고 자기", hasCost: false },
                { value: "skip_play", label: "결석하고 놀기", hasCost: true, costPrompt: "얼마를 소비했나요?" }
            ],
            subject: currentClass.subject
        });
    }

    // 2. 식사 시간인 경우 (12시, 18시)
    if (hour === 12 || hour === 18) {
        return res.status(200).json({
            day,
            hour,
            choiceType: "meal",
            question: `${hour === 12 ? '점심' : '저녁'} 시간입니다. 어떻게 드시겠습니까?`,
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
    if (hour >= 23 || hour < 8) {
        return res.status(200).json({
            day,
            hour,
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
    return res.status(200).json({
        day,
        hour,
        choiceType: "free_time",
        question: "자유 시간입니다. 무엇을 하시겠습니까?",
        options: [
            { value: "study", label: "공부하기", hasCost: false },
            { value: "exercise", label: "운동하기", hasCost: false },
            { value: "hobby", label: "취미활동", hasCost: true, costPrompt: "얼마 썼나요?" },
            { value: "rest", label: "휴식", hasCost: false },
            { value: "part_time", label: "알바하기", hasCost: true, costPrompt: "얼마 벌었나요? (양수로 입력)" },
            { value: "custom", label: "기타 활동", hasCost: true, costPrompt: "무엇을 했고 얼마를 썼나요/벌었나요?", needsDescription: true }
        ]
    });
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
        customDescription
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

    // 1. 선택 저장
    const hourlyChoice = await HourlyChoice.create({
        day,
        hour,
        choiceType,
        choice,
        subject,
        cost,
        duration,
        description
    });

    // 2. 재정, 수면 시간 업데이트
    settings.currentBudget += cost;
    if (choice === "sleep") {
        settings.totalSleepMinutes += duration;
    }

    await settings.save();

    // 3. 평행우주 생성
    const { oppositeChoice, oppositeCost, oppositeDescription } = await generateOpposite(
        choiceType,
        choice,
        cost,
        subject
    );

    // 4. 평행우주 저장
    const branch = await Branch.create({
        day,
        hour,
        choiceType,
        oppositeChoice,
        oppositeCost,
        oppositeDescription
    });

    res.status(201).json({
        message: "선택이 저장되었습니다",
        actual_universe: {
            choice,
            description,
            cost,
            currentBudget: settings.currentBudget
        },
        parallel_universe: {
            choice: oppositeChoice,
            description: oppositeDescription,
            cost: oppositeCost
        }
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

// 반대 선택 생성 함수
const generateOpposite = async (choiceType, choice, cost, subject) => {
    const prompt = `
        당신은 평행우주 시뮬레이터의 분기 생성 AI입니다. 사용자의 활동 기록을 바탕으로 이에 극단적으로 대비되는 '평행우주(반대 선택)'를 하나 생성해 주세요.
        결과는 반드시 다음 JSON 형식으로만 반환해야 하며, 다른 텍스트(설명, 서론 등)는 일절 포함하지 마세요.
        ---
        실제 선택 정보:
        활동 유형 (choiceType): ${choiceType}
        선택 내용 (choice): ${choice}
        비용 (cost): ${cost.toLocaleString()}원 (지출은 음수, 수입은 양수)
        과목/맥락 (subject): ${subject || '없음'}
        ---
        생성 규칙:
        1. 선택지 이름 (oppositeChoice)은 영문 소문자 스네이크 케이스로, 기존 선택지와 재정적/활동적으로 대비되게 지어주세요.
        2. 비용 (oppositeCost)은 실제 선택과 반대되거나, 활동 유형에 맞는 현실적인 값(정수)으로 설정해 주세요.
        3. 설명 (oppositeDescription)은 반대 선택의 상황을 한국어로 흥미롭게 설명해 주세요.
        4. 반환 형식: {"oppositeChoice": "string", "oppositeCost": number, "oppositeDescription": "string"}
    `;

    try {
        // 2. LLM API 호출
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful assistant designed to output JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.8,
        });

        const jsonString = response.choices[0].message.content.trim();
        const oppositeData = JSON.parse(jsonString);

        // 3. LLM 결과 반환
        return {
            oppositeChoice: oppositeData.oppositeChoice,
            oppositeCost: oppositeData.oppositeCost,
            oppositeDescription: oppositeData.oppositeDescription,
        };
    } catch (error) {
        console.error("LLM API 호출 또는 JSON 파싱 중 오류 발생:", error);

        // 4. 오류 시 안전 장치(Fallback) 반환
        // LLM 호출 실패 시, 기존 로직 대신 임시 분기를 생성하여 시스템 충돌 방지
        return {
            oppositeChoice: "fallback_rest",
            oppositeCost: 0,
            oppositeDescription: `LLM 오류 발생: ${choiceType} 대신 예산 0원으로 휴식하기`,
        };
    }
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
    settings.currentBudget -= hourlyChoice.cost;
    settings.currentBudget += cost;

    // 선택 업데이트
    hourlyChoice.choice = choice;
    hourlyChoice.cost = cost;
    hourlyChoice.description = generateDescription(
        hourlyChoice.choiceType,
        choice,
        hourlyChoice.subject
    );

    await hourlyChoice.save();
    await settings.save();

    // 평행우주 업데이트
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

module.exports = {
    saveInitialSettings,
    getSettings,
    getHourlyQuestion,
    saveHourlyChoice,
    getWeeklyStatistics,
    getWeeklyHistory,
    getDailyChoices,
    updateChoice,
    deleteChoice
};