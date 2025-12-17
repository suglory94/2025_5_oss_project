const asyncHandler = require("express-async-handler");
const Schedule = require("../models/scheduleModel");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Branch = require("../models/branchModel");

// 설정 조회 (사용자별)
const getSettings = asyncHandler(async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    const settings = await UserSettings.findOne({ userId });
    const schedule = await Schedule.findOne({ userId });

    if (!settings || !schedule) {
        return res.status(404).json({ message: "초기 설정을 먼저 완료하세요" });
    }

    res.status(200).json({
        settings,
        schedule
    });
});

// 모든 선택 및 히스토리 초기화 (사용자별)
const resetAllData = asyncHandler(async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    await HourlyChoice.deleteMany({ userId });
    await Branch.deleteMany({ userId });

    const settings = await UserSettings.findOne({ userId });
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

// 평행우주 반대 선택 생성 함수
const generateOpposite = async (choiceType, choice, cost, subject) => {
    let oppositeChoice = '';
    let oppositeCost = 0;
    let oppositeDescription = '';

    switch (choiceType) {
        case 'class':
            if (choice === 'attend' || choice === 'attend_coffee') {
                oppositeChoice = 'skip_sleep';
                oppositeCost = 0;
                oppositeDescription = `${subject} 수업을 땡땡이 치고 잔다`;
            } else {
                oppositeChoice = 'attend';
                oppositeCost = 0;
                oppositeDescription = `${subject} 수업을 듣는다`;
            }
            break;

        case 'meal':
            if (choice === 'skip') {
                oppositeChoice = 'cafeteria';
                oppositeCost = -5000;
                oppositeDescription = '학식을 먹는다 (-5,000원)';
            } else {
                oppositeChoice = 'skip';
                oppositeCost = 0;
                oppositeDescription = '밥을 거른다';
            }
            break;

        case 'sleep':
            if (choice === 'sleep') {
                oppositeChoice = 'stay_up';
                oppositeCost = 0;
                oppositeDescription = '밤을 새워 공부한다';
            } else {
                oppositeChoice = 'sleep';
                oppositeCost = 0;
                oppositeDescription = '잠을 잔다';
            }
            break;

        case 'free_time':
            if (choice === 'study') {
                oppositeChoice = 'rest';
                oppositeCost = 0;
                oppositeDescription = '휴식을 취한다';
            } else if (choice === 'part_time') {
                oppositeChoice = 'study';
                oppositeCost = 0;
                oppositeDescription = '공부를 한다';
            } else {
                oppositeChoice = 'study';
                oppositeCost = 0;
                oppositeDescription = '공부를 한다';
            }
            break;

        default:
            oppositeChoice = 'rest';
            oppositeCost = 0;
            oppositeDescription = '휴식을 취한다';
    }

    return {
        oppositeChoice,
        oppositeCost,
        oppositeDescription
    };
};

// 통계 조회 (사용자별)
const getWeeklyStatistics = asyncHandler(async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    const settings = await UserSettings.findOne({ userId });
    const schedule = await Schedule.findOne({ userId });
    const choices = await HourlyChoice.find({ userId }).sort({ day: 1, hour: 1 });

    if (!settings || !schedule) {
        return res.status(404).json({ message: "데이터가 없습니다" });
    }

    const daysPassed = Math.ceil(
        (Date.now() - settings.weekStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const averageSleepHours = daysPassed > 0
        ? (settings.totalSleepMinutes / 60 / daysPassed).toFixed(1)
        : 0;

    const classChoices = choices.filter(c => c.choiceType === "class");
    const attendedClasses = classChoices.filter(
        c => c.choice === "attend" || c.choice === "attend_coffee"
    ).length;

    const totalClassHours = classChoices.length;
    const attendanceRate = totalClassHours > 0
        ? ((attendedClasses / totalClassHours) * 100).toFixed(1)
        : 0;

    const totalSpent = settings.initialBudget - settings.currentBudget;
    const dailyAverageSpent = daysPassed > 0
        ? Math.round(totalSpent / daysPassed)
        : 0;

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

// 특정 날짜의 선택 조회 (사용자별)
const getDailyChoices = asyncHandler(async (req, res) => {
    const { day } = req.params;
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    const choices = await HourlyChoice.find({ userId, day: parseInt(day) }).sort({ hour: 1 });
    const branches = await Branch.find({ userId, day: parseInt(day) }).sort({ hour: 1 });

    res.status(200).json({
        day: parseInt(day),
        choices,
        branches
    });
});

// 선택 수정 (사용자별)
const updateChoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { choice, cost, userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    const hourlyChoice = await HourlyChoice.findOne({ _id: id, userId });

    if (!hourlyChoice) {
        return res.status(404).json({ message: "선택을 찾을 수 없습니다" });
    }

    const settings = await UserSettings.findOne({ userId });

    settings.currentBudget -= hourlyChoice.cost;

    if (hourlyChoice.choice === "sleep") {
        settings.totalSleepMinutes -= hourlyChoice.duration;
    }

    settings.currentBudget += cost;

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

    if (hourlyChoice.choiceType !== "ai_branch") {
        const { oppositeChoice, oppositeCost, oppositeDescription } = await generateOpposite(
            hourlyChoice.choiceType,
            choice,
            cost,
            hourlyChoice.subject
        );

        await Branch.updateOne(
            { userId, day: hourlyChoice.day, hour: hourlyChoice.hour },
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

// 선택 삭제 (사용자별)
const deleteChoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    const choice = await HourlyChoice.findOne({ _id: id, userId });

    if (!choice) {
        return res.status(404).json({ message: "선택을 찾을 수 없습니다" });
    }

    const settings = await UserSettings.findOne({ userId });
    settings.currentBudget -= choice.cost;
    await settings.save();

    await HourlyChoice.findByIdAndDelete(id);
    await Branch.deleteOne({ userId, day: choice.day, hour: choice.hour });

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
    resetAllData,
    generateDescription,
    generateOpposite
};