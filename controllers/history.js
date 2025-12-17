const asyncHandler = require("express-async-handler");
const UserSettings = require("../models/userSettingsModel");
const HourlyChoice = require("../models/hourlyChoiceModel");
const Branch = require("../models/branchModel");

// 히스토리 조회 (실제 우주 + 평행 우주)
const getWeeklyHistory = asyncHandler(async (req, res) => {
    const choices = await HourlyChoice.find().sort({ day: 1, hour: 1 });
    const branches = await Branch.find().sort({ day: 1, hour: 1 });

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
            // ✅ 1. 먼저 category 필드 확인 (AI 선택지의 경우)
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
                        // 재정은 이미 위에서 처리됨
                        break;
                }
            } 
            // ✅ 2. category가 없으면 텍스트 기반 판단 (fallback)
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
            // 식사는 재정 변화만 있음
            break;

        case 'exercise':
            sleepChangeMinutes += duration / 3;
            break;

        case 'hobby':
            // 취미활동은 주로 재정 변화만
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
