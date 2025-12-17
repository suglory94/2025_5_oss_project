// 사용자 초기 설정 (사용자별 분리)
const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,  // 사용자당 하나의 설정만
        index: true
    },
    initialBudget: {
        type: Number,
        required: true,
        default: 100000
    },
    currentBudget: {
        type: Number,
        required: true
    },
    weekStartDate: {
        type: Date,
        default: Date.now
    },
    sleepStartHour: Number,
    wakeUpHour: Number,
    totalSleepMinutes: {
        type: Number,
        default: 0
    },
    totalStudyMinutes: {
        type: Number,
        default: 0
    },
    timetableArray: {
        type: [[Number]],
        default: []
    }
}, {
    timestamps: true
});

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);
module.exports = UserSettings;