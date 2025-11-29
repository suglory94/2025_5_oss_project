// 사용자 초기 설정
const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema({
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
    }
}, {
    timestamps: true
});

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);
module.exports = UserSettings;