const asyncHandler = require("express-async-handler");
const Schedule = require("../models/scheduleModel");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Branch = require("../models/branchModel");


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

module.exports = {
    getSettings,
    getWeeklyStatistics,
    getDailyChoices,
    updateChoice,
    deleteChoice,
    resetAllData
};