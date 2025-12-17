// 시간별 선택 (사용자별 분리)
const mongoose = require("mongoose");

const hourlyChoiceSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true  // 빠른 조회를 위한 인덱스
    },
    day: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },
    hour: {
        type: Number,
        required: true,
        min: 0,
        max: 23
    },
    choiceType: {
        type: String,
        enum: ["class", "meal", "study", "free_time", "sleep", "exercise", "hobby", "ai_branch", "rest"],
        required: true
    },
    choice: {
        type: String,
        required: true
    },
    subject: String,
    cost: {
        type: Number,
        default: 0
    },
    duration: {
        type: Number,
        default: 60
    },
    description: String,
    sleepChangeMinutes: {
        type: Number,
        default: 0
    },
    studyChangeMinutes: {
        type: Number,
        default: 0
    },
    financeChange: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 복합 인덱스: 사용자별 + 날짜/시간별 빠른 조회
hourlyChoiceSchema.index({ userId: 1, day: 1, hour: 1 });

const HourlyChoice = mongoose.model("HourlyChoice", hourlyChoiceSchema);
module.exports = HourlyChoice;