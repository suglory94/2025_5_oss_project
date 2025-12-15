const express = require("express");
const router = express.Router();
const {
    saveInitialSettings,
    getSettings,
    getHourlyQuestion,
    saveHourlyChoice,
    getHourlyBranchQuestion,
    getWeeklyStatistics,
    getWeeklyHistory,
    getDailyChoices,
    getRawStats,
    updateChoice,
    deleteChoice,
    checkScheduleStatus,
    resetAllData
} = require("../controllers/hourlyController");

// 초기 설정
router.post("/settings", saveInitialSettings); // 시간표 + 초기 재정 저장
router.get("/settings", getSettings); // 설정 조회

// 시간별 선택
router.post("/question", getHourlyQuestion); // 특정 시간 질문 조회
router.post("/branch-question", getHourlyBranchQuestion);
router.post("/choices", saveHourlyChoice); // 선택 저장

// AI 로직이 사용하는 수업 여부 확인
router.post("/schedule/check", checkScheduleStatus);

// 통계 및 히스토리
router.get("/statistics", getWeeklyStatistics); // 주간 통계
router.get("/history", getWeeklyHistory); // 전체 히스토리
router.get("/history/:day", getDailyChoices); // 특정 날짜 선택'
router.get("/raw-stats", getRawStats); // 데이터 조회

// 수정 및 삭제
router.put("/choices/:id", updateChoice); // 선택 수정
router.delete("/choices/:id", deleteChoice); // 선택 삭제

// 초기화 라우트 추가
router.delete('/reset', resetAllData);

module.exports = router;