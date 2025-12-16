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

// 상태 변화 계산 함수
const calculateStateChanges = (choiceType, choice, cost, duration = 75) => {
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
    getWeeklyHistory,
    calculateStateChanges
};