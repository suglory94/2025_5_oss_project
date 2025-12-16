// 시간별 선택
const mongoose = require("mongoose");

const hourlyChoiceSchema = new mongoose.Schema({
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

const HourlyChoice = mongoose.model("HourlyChoice", hourlyChoiceSchema);
module.exports = HourlyChoice;