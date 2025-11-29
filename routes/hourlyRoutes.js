const express = require("express");
const router = express.Router();
const {
    saveInitialSettings,
    getSettings,
    getHourlyQuestion,
    saveHourlyChoice,
    getWeeklyStatistics,
    getWeeklyHistory,
    getDailyChoices,
    updateChoice,
    deleteChoice
} = require("../controllers/hourlyController");

// 초기 설정
router.post("/settings", saveInitialSettings); // 시간표 + 초기 재정 저장
router.get("/settings", getSettings); // 설정 조회

// 시간별 선택
router.post("/question", getHourlyQuestion); // 특정 시간 질문 조회
router.post("/choices", saveHourlyChoice); // 선택 저장

// 통계 및 히스토리
router.get("/statistics", getWeeklyStatistics); // 주간 통계
router.get("/history", getWeeklyHistory); // 전체 히스토리
router.get("/history/:day", getDailyChoices); // 특정 날짜 선택

// 수정 및 삭제
router.put("/choices/:id", updateChoice); // 선택 수정
router.delete("/choices/:id", deleteChoice); // 선택 삭제

module.exports = router;