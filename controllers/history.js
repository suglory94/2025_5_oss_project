const asyncHandler = require("express-async-handler");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Branch = require("../models/branchModel");

// 히스토리 조회 (실제 우주 + 평행 우주) - 사용자별
const getWeeklyHistory = asyncHandler(async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ message: "userId가 필요합니다" });
    }

    const choices = await HourlyChoice.find({ userId }).sort({ day: 1, hour: 1 });
    const branches = await Branch.find({ userId }).sort({ day: 1, hour: 1 });

    res.status(200).json({
        actual_universe: choices,
        parallel_universe: branches
    });
});

// 상태 변화 계산 함수 (카테고리 필드 사용)
const calculateStateChanges = (choiceType, choice, cost, duration = 75, category = null) => {
    let financeChange = 0;
    let sleepChangeMinutes = 0;
    let studyChangeMinutes = 0;

    // 1. 재정 변화 계산
    const isIncome =
        choice.includes('part_time') ||
        choice.includes('알바') ||
        choice.includes('아르바이트') ||
        choice.includes('근무') ||
        choice.includes('벌');

    if (isIncome) {
        financeChange = Math.abs(cost); // 수입은 양수
    } else {
        financeChange = -Math.abs(cost); // 지출은 음수
    }

    // 2. 학습/수면 시간 변화
    switch (choiceType) {
        case 'class':
            switch (choice) {
                case 'attend':
                case 'attend_coffee':
                    studyChangeMinutes += duration;
                    break;
                case 'skip_sleep':
                    sleepChangeMinutes += duration;
                    break;
                case 'skip_play':
                    studyChangeMinutes -= duration;
                    break;
            }
            break;

        case 'sleep':
            switch (choice) {
                case 'sleep':
                    sleepChangeMinutes += duration;
                    break;
                case 'stay_up':
                    studyChangeMinutes += duration;
                    sleepChangeMinutes -= duration;
                    break;
                case 'stay_up_play':
                    studyChangeMinutes -= duration;
                    sleepChangeMinutes -= duration;
                    break;
            }
            break;

        case 'ai_branch':
        case 'free_time':
            if (category) {
                switch (category) {
                    case 'study':
                    case 'grade':
                        studyChangeMinutes += duration;
                        break;
                    case 'sleep':
                        sleepChangeMinutes += duration;
                        break;
                    case 'finance':
                        break;
                }
            }
            else if (choice.includes('공부') || choice.includes('study') || choice.includes('학습')) {
                studyChangeMinutes += duration;
            } else if (choice.includes('자') || choice.includes('sleep') || choice.includes('수면') || choice.includes('낮잠')) {
                sleepChangeMinutes += duration;
            } else if (choice.includes('휴식') || choice.includes('rest')) {
                sleepChangeMinutes += duration / 2;
            } else if (choice.includes('운동') || choice.includes('exercise')) {
                sleepChangeMinutes += duration / 3;
            }
            break;

        case 'meal':
            break;

        case 'exercise':
            sleepChangeMinutes += duration / 3;
            break;

        case 'hobby':
            break;

        case 'rest':
            sleepChangeMinutes += duration / 2;
            break;

        case 'study':
            studyChangeMinutes += duration;
            break;
    }

    return {
        financeChange,
        sleepChangeMinutes,
        studyChangeMinutes
    };
};

module.exports = {
    getWeeklyHistory,
    calculateStateChanges
};